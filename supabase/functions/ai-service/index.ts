const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const ELEVENLABS_API_KEY = Deno.env.get('VITE_ELEVENLABS_API_KEY');

interface VoicePreviewRequest {
  voice_id: string;
  text: string;
}

interface SpeechGenerationRequest {
  voice_id: string;
  text: string;
}

// Helper function to convert Uint8Array to base64 without stack overflow
function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binaryString = '';
  const chunkSize = 8192; // Process in chunks to avoid stack overflow
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.slice(i, i + chunkSize);
    binaryString += String.fromCharCode(...chunk);
  }
  
  return btoa(binaryString);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
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
          
          // Parse error details for better user feedback
          let userMessage = 'Voice preview temporarily unavailable. Please try again later.';
          if (response.status === 401) {
            userMessage = 'Voice service authentication failed. Please contact support.';
          } else if (response.status === 429) {
            userMessage = 'Voice service rate limit exceeded. Please try again in a few minutes.';
          } else if (response.status === 422) {
            userMessage = 'Invalid voice or text for preview. Please try a different voice.';
          }
          
          return new Response(
            JSON.stringify({ 
              success: false,
              error: userMessage,
              fallback: true,
              debug_info: `API returned ${response.status}: ${response.statusText}`
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
          console.error('ElevenLabs API returned empty audio buffer');
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Voice service returned empty audio. Please check your account credits and try again.',
              fallback: true,
              debug_info: 'Empty audio buffer received from API'
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const base64Audio = uint8ArrayToBase64(new Uint8Array(audioBuffer));

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
            fallback: true,
            debug_info: error.message
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

      // Validate voice_id format
      if (!voice_id || voice_id.length < 10) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Invalid voice ID provided',
            fallback: true
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      try {
        console.log(`Generating speech for voice ${voice_id} with ${text.length} characters`);
        
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

        console.log(`ElevenLabs API response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
          
          // Parse error details for better user feedback
          let userMessage = 'Text-to-speech temporarily unavailable. Please try again later.';
          if (response.status === 401) {
            userMessage = 'Voice service authentication failed. Please check your API key.';
          } else if (response.status === 429) {
            userMessage = 'Voice service rate limit exceeded. Please try again in a few minutes.';
          } else if (response.status === 422) {
            userMessage = 'Invalid voice or text for speech generation. Please try a different voice.';
          } else if (response.status === 402) {
            userMessage = 'Voice service quota exceeded. Please check your account credits.';
          }
          
          return new Response(
            JSON.stringify({ 
              success: false,
              error: userMessage,
              fallback: true,
              debug_info: `API returned ${response.status}: ${response.statusText}`
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const audioBuffer = await response.arrayBuffer();
        console.log(`Received audio buffer of size: ${audioBuffer.byteLength} bytes`);
        
        // Validate that we received audio data
        if (!audioBuffer || audioBuffer.byteLength === 0) {
          console.error('ElevenLabs API returned empty audio buffer despite 200 status');
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Voice service returned empty audio. This usually indicates insufficient account credits or an invalid voice. Please check your ElevenLabs account.',
              fallback: true,
              debug_info: 'Empty audio buffer received from API despite 200 status'
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Additional validation - check if buffer contains actual audio data
        if (audioBuffer.byteLength < 100) {
          console.error(`Audio buffer too small: ${audioBuffer.byteLength} bytes`);
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Voice service returned invalid audio data. Please check your account status.',
              fallback: true,
              debug_info: `Audio buffer too small: ${audioBuffer.byteLength} bytes`
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const base64Audio = uint8ArrayToBase64(new Uint8Array(audioBuffer));
        console.log(`Successfully generated speech, base64 length: ${base64Audio.length}`);

        return new Response(
          JSON.stringify({ 
            success: true,
            audio_data: base64Audio,
            content_type: 'audio/mpeg',
            model_used: 'eleven_multilingual_v2',
            audio_size_bytes: audioBuffer.byteLength
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
            fallback: true,
            debug_info: error.message
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
        error: 'An unexpected error occurred. Please try again later.',
        debug_info: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});