import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ELEVENLABS_API_KEY = Deno.env.get('VITE_ELEVENLABS_API_KEY');

interface VoicePreviewRequest {
  voice_id: string;
  text: string;
}

interface SpeechGenerationRequest {
  voice_id: string;
  text: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    if (path === 'generate-voice-preview') {
      const { voice_id, text } = await req.json() as VoicePreviewRequest;
      
      // Check if ElevenLabs API key is available
      if (!ELEVENLABS_API_KEY) {
        console.log('ElevenLabs API key not configured, returning error');
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Voice preview service is not configured. Please contact support.',
            fallback: true
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Skip voice preview for fallback voices
      if (voice_id.startsWith('fallback-') || voice_id.startsWith('basic-')) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Voice preview not available for this voice',
            fallback: true
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      try {
        // Use the higher quality V2 multilingual model
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.6,
              similarity_boost: 0.7,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
          
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Voice preview temporarily unavailable. Please try again later.',
              fallback: true
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const audioBuffer = await response.arrayBuffer();
        
        // Validate that we received audio data
        if (!audioBuffer || audioBuffer.byteLength === 0) {
          throw new Error('No audio data received from ElevenLabs API');
        }

        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

        return new Response(
          JSON.stringify({ 
            success: true,
            audio_data: base64Audio,
            content_type: 'audio/mpeg',
            model_used: 'eleven_multilingual_v2'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        console.error('Error generating voice preview:', error);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Failed to generate voice preview. Please try again later.',
            fallback: true
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    if (path === 'generate-speech') {
      const { voice_id, text } = await req.json() as SpeechGenerationRequest;
      
      // Check if ElevenLabs API key is available
      if (!ELEVENLABS_API_KEY) {
        console.log('ElevenLabs API key not configured, returning error');
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Text-to-speech service is not configured. Please contact support.',
            fallback: true
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Skip speech generation for fallback voices
      if (voice_id.startsWith('fallback-') || voice_id.startsWith('basic-')) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Text-to-speech not available for this voice',
            fallback: true
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Validate input
      if (!text || text.trim().length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Text is required for speech generation'
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      try {
        // Use the higher quality V2 multilingual model
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text.substring(0, 4500), // Increased limit for longer messages
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.6,
              similarity_boost: 0.7,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
          
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Text-to-speech temporarily unavailable. Please try again later.',
              fallback: true
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const audioBuffer = await response.arrayBuffer();
        
        // Validate that we received audio data
        if (!audioBuffer || audioBuffer.byteLength === 0) {
          throw new Error('No audio data received from ElevenLabs API');
        }

        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

        return new Response(
          JSON.stringify({ 
            success: true,
            audio_data: base64Audio,
            content_type: 'audio/mpeg',
            model_used: 'eleven_multilingual_v2'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        console.error('Error generating speech:', error);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Failed to generate speech. Please try again later.',
            fallback: true
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Invalid endpoint'
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error in ai-service:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'An unexpected error occurred. Please try again later.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});