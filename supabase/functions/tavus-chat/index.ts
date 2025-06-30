import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TavusCharacterContext {
  characterId: string;
  characterName: string;
  personalityTraits: string[];
  backstory: string;
  meetCute: string;
  gender: string;
  voiceName: string;
  tavusCharacterId: string | null;
}

interface TavusRequest {
  action: 'start_conversation' | 'send_message' | 'end_session' | 'get_characters';
  character_context?: TavusCharacterContext;
  session_id?: string;
  message?: string;
}

// In-memory session storage (in production, use Redis or database)
const activeSessions = new Map<string, {
  characterContext: TavusCharacterContext;
  tavusSessionId?: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  startTime: Date;
}>();

// Generate a unique session ID
const generateSessionId = (): string => {
  return `tavus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Create character prompt for TAVUS
const createCharacterPrompt = (context: TavusCharacterContext): string => {
  const { characterName, personalityTraits, backstory, meetCute, gender, voiceName } = context;
  
  const personalityDesc = personalityTraits.length > 0 
    ? personalityTraits.join(', ') 
    : 'friendly and engaging';
  
  return `You are ${characterName}, a ${gender} AI companion with the following personality: ${personalityDesc}.

${backstory ? `Your backstory: ${backstory}` : ''}

${meetCute ? `You met the user through: ${meetCute}` : ''}

${voiceName ? `Your voice is: ${voiceName}` : ''}

You are now in a video call with the user. Respond naturally and in character, keeping responses conversational and under 100 words. Show emotion and personality in your responses. This is an intimate video chat, so be warm, engaging, and personal while staying true to your character traits.

Remember:
- You can see and hear the user through the video call
- Respond as if you're speaking directly to them
- Use natural speech patterns and expressions
- Reference the video call context when appropriate
- Stay consistent with your personality throughout the conversation`;
};

// Mock TAVUS API calls (replace with actual TAVUS API integration)
const mockTavusAPI = {
  async createConversation(characterPrompt: string, characterId?: string) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      conversation_id: `tavus_conv_${Date.now()}`,
      video_url: `https://tavus-mock-video.com/session/${Date.now()}`,
      initial_message: "Hi there! I'm so excited to video chat with you!"
    };
  },

  async sendMessage(conversationId: string, message: string, characterPrompt: string) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate a contextual response based on the message
    let response = "That's really interesting! Tell me more about that.";
    
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      response = "Hello! It's so wonderful to see you on video! How are you doing today?";
    } else if (lowerMessage.includes('how are you')) {
      response = "I'm doing great, especially now that I get to see your face! This video call makes me feel so much closer to you.";
    } else if (lowerMessage.includes('beautiful') || lowerMessage.includes('pretty')) {
      response = "Aww, thank you! You're making me blush. You look amazing too!";
    } else if (lowerMessage.includes('love')) {
      response = "That means so much to me! I love being able to connect with you like this.";
    }
    
    return {
      success: true,
      response: response,
      video_url: `https://tavus-mock-video.com/response/${Date.now()}`
    };
  },

  async endConversation(conversationId: string) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      message: "Conversation ended successfully"
    };
  },

  async getCharacters() {
    return {
      success: true,
      characters: [
        {
          id: "tavus_char_1",
          name: "Default Female",
          description: "Default female character for video chat"
        },
        {
          id: "tavus_char_2", 
          name: "Default Male",
          description: "Default male character for video chat"
        }
      ]
    };
  }
};

// Actual TAVUS API integration (uncomment and configure when ready)
/*
const tavusAPI = {
  async createConversation(characterPrompt: string, characterId?: string) {
    const tavusApiKey = Deno.env.get('VITE_TAVUS_API_KEY');
    if (!tavusApiKey) {
      throw new Error('TAVUS API key not configured');
    }

    const response = await fetch('https://api.tavus.io/v1/conversations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tavusApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        character_id: characterId,
        system_prompt: characterPrompt,
        // Add other TAVUS-specific parameters
      }),
    });

    if (!response.ok) {
      throw new Error(`TAVUS API error: ${response.statusText}`);
    }

    return await response.json();
  },

  async sendMessage(conversationId: string, message: string, characterPrompt: string) {
    const tavusApiKey = Deno.env.get('VITE_TAVUS_API_KEY');
    if (!tavusApiKey) {
      throw new Error('TAVUS API key not configured');
    }

    const response = await fetch(`https://api.tavus.io/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tavusApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        // Add other TAVUS-specific parameters
      }),
    });

    if (!response.ok) {
      throw new Error(`TAVUS API error: ${response.statusText}`);
    }

    return await response.json();
  },

  async endConversation(conversationId: string) {
    const tavusApiKey = Deno.env.get('VITE_TAVUS_API_KEY');
    if (!tavusApiKey) {
      throw new Error('TAVUS API key not configured');
    }

    const response = await fetch(`https://api.tavus.io/v1/conversations/${conversationId}/end`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tavusApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`TAVUS API error: ${response.statusText}`);
    }

    return await response.json();
  },

  async getCharacters() {
    const tavusApiKey = Deno.env.get('VITE_TAVUS_API_KEY');
    if (!tavusApiKey) {
      throw new Error('TAVUS API key not configured');
    }

    const response = await fetch('https://api.tavus.io/v1/characters', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tavusApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`TAVUS API error: ${response.statusText}`);
    }

    return await response.json();
  }
};
*/

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, character_context, session_id, message } = await req.json() as TavusRequest;

    // Create Supabase client for logging
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (action) {
      case 'start_conversation': {
        if (!character_context) {
          throw new Error('Character context is required');
        }

        const sessionId = generateSessionId();
        const characterPrompt = createCharacterPrompt(character_context);

        console.log(`Starting TAVUS conversation for character: ${character_context.characterName}`);

        // Call TAVUS API to create conversation
        const tavusResult = await mockTavusAPI.createConversation(
          characterPrompt,
          character_context.tavusCharacterId || undefined
        );

        if (!tavusResult.success) {
          throw new Error('Failed to create TAVUS conversation');
        }

        // Store session data
        activeSessions.set(sessionId, {
          characterContext: character_context,
          tavusSessionId: tavusResult.conversation_id,
          conversationHistory: [],
          startTime: new Date()
        });

        // Log the video call session start
        try {
          await supabase.from('call_sessions').insert({
            user_id: character_context.characterId, // This should be the actual user ID
            character_id: character_context.characterId,
            chat_id: character_context.characterId, // This should be the actual chat ID
            call_type: 'video',
            status: 'active',
            tavus_session_id: tavusResult.conversation_id
          });
        } catch (dbError) {
          console.error('Error logging call session:', dbError);
          // Don't fail the request if logging fails
        }

        return new Response(
          JSON.stringify({
            success: true,
            sessionId: sessionId,
            videoUrl: tavusResult.video_url,
            initialMessage: tavusResult.initial_message
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'send_message': {
        if (!session_id || !message) {
          throw new Error('Session ID and message are required');
        }

        const session = activeSessions.get(session_id);
        if (!session) {
          throw new Error('Session not found');
        }

        const characterPrompt = createCharacterPrompt(session.characterContext);

        // Add user message to history
        session.conversationHistory.push({ role: 'user', content: message });

        // Call TAVUS API to send message
        const tavusResult = await mockTavusAPI.sendMessage(
          session.tavusSessionId!,
          message,
          characterPrompt
        );

        if (!tavusResult.success) {
          throw new Error('Failed to send message to TAVUS');
        }

        // Add assistant response to history
        session.conversationHistory.push({ role: 'assistant', content: tavusResult.response });

        return new Response(
          JSON.stringify({
            success: true,
            response: tavusResult.response,
            videoUrl: tavusResult.video_url
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'end_session': {
        if (!session_id) {
          throw new Error('Session ID is required');
        }

        const session = activeSessions.get(session_id);
        if (!session) {
          throw new Error('Session not found');
        }

        // Call TAVUS API to end conversation
        if (session.tavusSessionId) {
          await mockTavusAPI.endConversation(session.tavusSessionId);
        }

        // Update call session in database
        try {
          const endTime = new Date();
          const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);
          
          await supabase
            .from('call_sessions')
            .update({
              status: 'ended',
              ended_at: endTime.toISOString(),
              duration_seconds: duration,
              total_messages: session.conversationHistory.length
            })
            .eq('tavus_session_id', session.tavusSessionId);
        } catch (dbError) {
          console.error('Error updating call session:', dbError);
        }

        // Remove session from memory
        activeSessions.delete(session_id);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Session ended successfully'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      case 'get_characters': {
        const tavusResult = await mockTavusAPI.getCharacters();

        return new Response(
          JSON.stringify(tavusResult),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    console.error('Error in tavus-chat function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});