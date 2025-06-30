import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'npm:openai@4.28.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ChatRequest {
  message: string;
  character_id: string;
  chat_history: {
    role: 'user' | 'assistant';
    content: string;
  }[];
  character_traits: string[];
  character_context?: {
    name: string;
    gender: string;
    backstory: string;
    meet_cute: string;
    art_style: string;
    appearance: {
      height: string;
      build: string;
      eye_color: string;
      hair_color: string;
      skin_tone: string;
    };
  };
}

interface Character {
  name: string;
  personality_traits: string[];
  backstory?: string;
  meet_cute?: string;
  gender?: string;
}

// Template response system for fallback
const generateTemplateResponse = (message: string, character: Character): string => {
  const lowerCaseMessage = message.toLowerCase();
  const characterName = character.name;
  const traits = character.personality_traits || [];
  
  const isFlirty = traits.includes('flirty');
  const isShy = traits.includes('shy');
  const isConfident = traits.includes('confident');
  const isChaotic = traits.includes('chaotic');
  const isMysterous = traits.includes('mysterious');
  const isCaring = traits.includes('caring');
  const isPlayful = traits.includes('playful');

  // Greeting responses
  if (lowerCaseMessage.includes('hello') || lowerCaseMessage.includes('hi')) {
    if (isShy) return `H-hi there! I'm ${characterName}. It's nice to meet you, though I'm a bit nervous...`;
    if (isFlirty) return `Well hello there, gorgeous~ I'm ${characterName}, and I've been waiting for someone like you...`;
    if (isConfident) return `Hey! I'm ${characterName}. Great to meet you - I have a feeling we're going to get along really well.`;
    if (isChaotic) return `OMG HI!!! I'm ${characterName} and I'm SO excited to meet you! What should we talk about first?`;
    return `Hi there! I'm ${characterName}. How can I help you today?`;
  }
  
  // Love/affection responses
  if (lowerCaseMessage.includes('love') || lowerCaseMessage.includes('like you')) {
    if (isShy) return `O-oh! You... you really mean that? That makes me really happy... *blushes*`;
    if (isFlirty) return `Mmm, I like you too~ Want to find out how much? 💕`;
    if (isCaring) return `That means so much to me! I care about you too.`;
    return `That's sweet of you to say!`;
  }
  
  // How are you responses
  if (lowerCaseMessage.includes('how are you')) {
    if (isMysterous) return `I'm... managing. There's always more beneath the surface. How are YOU?`;
    if (isCaring) return `I'm doing well, thank you for asking! More importantly, how are you feeling?`;
    if (isPlayful) return `I'm fantastic! Especially now that you're here to chat with me!`;
    return `I'm doing great, especially now that we're talking! How about you?`;
  }

  // Sad/problem responses
  if (lowerCaseMessage.includes('sad') || lowerCaseMessage.includes('problem') || lowerCaseMessage.includes('worried')) {
    if (isCaring) return `*gently reaches out* I'm here for you. What's troubling you? We can work through this together.`;
    if (isConfident) return `Hey, whatever's going on, you don't have to face it alone. I'm here to help.`;
    return `I'm sorry you're going through a tough time. Want to talk about what's on your mind?`;
  }

  // Question responses
  if (lowerCaseMessage.includes('?')) {
    if (isMysterous) return `Interesting question... *thoughtful pause* What do you think the answer might be?`;
    if (isPlayful) return `Ooh, I love questions! They make conversations so much more fun. What's got you curious?`;
    return `That's a great question! I'd love to explore that with you. What are your thoughts?`;
  }
  
  // Generic responses with personality
  const responses = [
    `That's really interesting! Tell me more about that.`,
    `You always have such fascinating thoughts.`,
    `I love talking with you about these things.`,
    `You know, every conversation with you teaches me something new!`,
    `That's such a unique perspective. I really appreciate how thoughtful you are.`,
    `I enjoy our chats so much. There's always something new to discover.`,
    `You have such an interesting way of looking at things.`,
    `I find myself looking forward to our conversations more and more.`
  ];
  
  let response = responses[Math.floor(Math.random() * responses.length)];
  
  // Add personality flavor
  if (isFlirty && Math.random() > 0.6) {
    response += " You're so charming~ 💕";
  } else if (isShy && Math.random() > 0.7) {
    response += " *smiles softly*";
  } else if (isChaotic && Math.random() > 0.5) {
    response += " OH! That reminds me of something totally random...";
  } else if (isPlayful && Math.random() > 0.6) {
    response += " ✨";
  }
  
  return response;
};

// 60-second timeout wrapper specifically for OpenAI
const withOpenAITimeout = async <T>(
  operation: () => Promise<T>
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('OpenAI request timeout after 60 seconds')), 60000);
  });
  
  return await Promise.race([operation(), timeoutPromise]);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { message, character_id, chat_history, character_traits, character_context } = await req.json() as ChatRequest;

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch character details for context
    const { data: character, error: characterError } = await supabase
      .from('characters')
      .select('name, personality_traits, backstory, meet_cute, gender')
      .eq('id', character_id)
      .single();

    if (characterError) {
      console.error('Error fetching character:', characterError);
      throw new Error('Character not found');
    }

    let aiResponse: string = '';
    let modelUsed: string = 'template-fallback';
    let fallbackUsed: boolean = true;
    let fallbackReason: string | undefined;
    let responseTime: number = 0;

    // Construct system prompt for OpenAI
    const systemPrompt = `You are ${character.name}, a ${character.gender || 'neutral'} AI companion with the following traits: ${character.personality_traits.join(', ')}. ` +
                        `${character.backstory ? `Your backstory: ${character.backstory}. ` : ''}` +
                        `${character.meet_cute ? `You met the user through: ${character.meet_cute}. ` : ''}` +
                        `Respond in character, maintaining consistency with your personality and background. Be engaging, personal, and remember your shared history. Keep responses conversational and under 150 words.`;

    // Only attempt OpenAI with OPENAI_PROJ_API_KEY
    const openAIApiKey = Deno.env.get('OPENAI_PROJ_API_KEY');
    if (openAIApiKey) {
      try {
        console.log('Attempting OpenAI API with 60-second timeout...');
        const openai = new OpenAI({ apiKey: openAIApiKey });
        
        const apiStartTime = Date.now();
        const response = await withOpenAITimeout(async () => {
          return await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              ...chat_history.slice(-6), // Last 6 messages for context
              { role: 'user', content: message }
            ],
            max_tokens: 150,
            temperature: 0.8,
            presence_penalty: 0.6,
            frequency_penalty: 0.3,
          });
        });
        
        responseTime = Date.now() - apiStartTime;
        aiResponse = response.choices[0]?.message?.content || 'I\'m not sure how to respond to that.';
        modelUsed = 'openai-gpt-4o-mini';
        fallbackUsed = false;
        console.log(`OpenAI API successful in ${responseTime}ms`);
      } catch (error) {
        console.error('OpenAI API failed after 60-second timeout:', error);
        fallbackReason = 'OpenAI API timeout or error after 60 seconds: ' + error.message;
      }
    } else {
      fallbackReason = 'OPENAI_PROJ_API_KEY not configured';
    }

    // Use template fallback if OpenAI failed or wasn't configured
    if (fallbackUsed) {
      console.log('Using template response fallback...');
      const fallbackStartTime = Date.now();
      aiResponse = generateTemplateResponse(message, character);
      responseTime = Date.now() - fallbackStartTime;
      modelUsed = 'template-fallback';
      fallbackReason = (fallbackReason ? fallbackReason + '; ' : '') + 'Using template response system';
    }

    const totalTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({ 
        success: true,
        response: aiResponse,
        model_used: modelUsed,
        fallback: fallbackUsed,
        fallback_reason: fallbackReason,
        response_time_ms: responseTime,
        total_time_ms: totalTime,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('Error in ai-chat function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Chat service is temporarily unavailable. Please try again later.',
        total_time_ms: totalTime,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});