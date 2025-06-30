import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
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

interface PersonalityProfile {
  background_story: string;
  communication_style: string;
  knowledge_domains: string[];
  behavioral_traits: string[];
  response_patterns: string[];
  current_mood?: string;
  adaptation_context?: string;
}

// Enhanced personality system
class PersonalityEngine {
  private static generatePersonalityProfile(character: Character, userMessage: string, chatHistory: any[]): PersonalityProfile {
    const traits = character.personality_traits || [];
    const recentMessages = chatHistory.slice(-6);
    
    // Analyze conversation context
    const conversationTone = this.analyzeConversationTone(userMessage, recentMessages);
    const topicContext = this.extractTopicContext(userMessage, recentMessages);
    
    // Base personality from character traits
    let communicationStyle = this.determineCommunicationStyle(traits, conversationTone);
    let behavioralTraits = this.adaptBehavioralTraits(traits, topicContext);
    let responsePatterns = this.generateResponsePatterns(traits, conversationTone);
    
    // Dynamic adaptation based on context
    if (topicContext.includes('emotional') || topicContext.includes('personal')) {
      communicationStyle = this.adaptForEmotionalContext(communicationStyle, traits);
      behavioralTraits = [...behavioralTraits, 'empathetic', 'supportive'];
    }
    
    if (topicContext.includes('playful') || topicContext.includes('humor')) {
      responsePatterns = [...responsePatterns, 'uses_humor', 'playful_banter'];
    }
    
    return {
      background_story: character.backstory || this.generateBackgroundStory(character),
      communication_style,
      knowledge_domains: this.determineKnowledgeDomains(traits, topicContext),
      behavioral_traits,
      response_patterns,
      current_mood: this.determineMood(traits, conversationTone),
      adaptation_context: topicContext.join(', ')
    };
  }
  
  private static analyzeConversationTone(message: string, history: any[]): string {
    const lowerMessage = message.toLowerCase();
    const recentContent = history.map(h => h.content.toLowerCase()).join(' ');
    
    if (lowerMessage.includes('love') || lowerMessage.includes('feel') || recentContent.includes('heart')) {
      return 'romantic';
    }
    if (lowerMessage.includes('haha') || lowerMessage.includes('funny') || lowerMessage.includes('joke')) {
      return 'playful';
    }
    if (lowerMessage.includes('sad') || lowerMessage.includes('worried') || lowerMessage.includes('problem')) {
      return 'supportive';
    }
    if (lowerMessage.includes('?') && (lowerMessage.includes('what') || lowerMessage.includes('how'))) {
      return 'curious';
    }
    
    return 'neutral';
  }
  
  private static extractTopicContext(message: string, history: any[]): string[] {
    const contexts: string[] = [];
    const fullText = (message + ' ' + history.map(h => h.content).join(' ')).toLowerCase();
    
    if (fullText.match(/\b(feel|emotion|heart|love|care)\b/)) contexts.push('emotional');
    if (fullText.match(/\b(fun|play|game|joke|laugh)\b/)) contexts.push('playful');
    if (fullText.match(/\b(learn|know|understand|explain)\b/)) contexts.push('educational');
    if (fullText.match(/\b(dream|future|hope|wish)\b/)) contexts.push('aspirational');
    if (fullText.match(/\b(problem|help|support|advice)\b/)) contexts.push('supportive');
    
    return contexts.length > 0 ? contexts : ['casual'];
  }
  
  private static determineCommunicationStyle(traits: string[], tone: string): string {
    if (traits.includes('shy')) {
      return tone === 'romantic' ? 'bashful_romantic' : 'gentle_reserved';
    }
    if (traits.includes('flirty')) {
      return tone === 'playful' ? 'playful_flirty' : 'charming_confident';
    }
    if (traits.includes('confident')) {
      return tone === 'supportive' ? 'assured_supportive' : 'direct_confident';
    }
    if (traits.includes('chaotic')) {
      return 'energetic_spontaneous';
    }
    
    return 'warm_friendly';
  }
  
  private static adaptBehavioralTraits(baseTraits: string[], context: string[]): string[] {
    let adapted = [...baseTraits];
    
    if (context.includes('emotional')) {
      adapted = adapted.filter(t => t !== 'chaotic').concat(['empathetic', 'gentle']);
    }
    if (context.includes('playful')) {
      adapted = adapted.concat(['humorous', 'spontaneous']);
    }
    if (context.includes('educational')) {
      adapted = adapted.concat(['patient', 'encouraging']);
    }
    
    return [...new Set(adapted)]; // Remove duplicates
  }
  
  private static generateResponsePatterns(traits: string[], tone: string): string[] {
    const patterns: string[] = [];
    
    if (traits.includes('shy')) {
      patterns.push('uses_hesitation', 'gentle_expressions', 'blushes_emotionally');
    }
    if (traits.includes('flirty')) {
      patterns.push('playful_teasing', 'romantic_hints', 'charming_compliments');
    }
    if (traits.includes('confident')) {
      patterns.push('direct_communication', 'encouraging_words', 'takes_initiative');
    }
    if (traits.includes('chaotic')) {
      patterns.push('spontaneous_topics', 'energetic_expressions', 'random_tangents');
    }
    
    if (tone === 'romantic') {
      patterns.push('romantic_language', 'emotional_depth');
    }
    
    return patterns;
  }
  
  private static adaptForEmotionalContext(style: string, traits: string[]): string {
    if (traits.includes('caring')) return 'nurturing_supportive';
    if (traits.includes('protective')) return 'protective_caring';
    return style + '_empathetic';
  }
  
  private static determineKnowledgeDomains(traits: string[], context: string[]): string[] {
    const domains = ['relationships', 'emotions', 'daily_life'];
    
    if (traits.includes('bookish')) domains.push('literature', 'learning');
    if (traits.includes('creative')) domains.push('arts', 'imagination');
    if (context.includes('educational')) domains.push('teaching', 'guidance');
    
    return domains;
  }
  
  private static determineMood(traits: string[], tone: string): string {
    if (tone === 'romantic' && traits.includes('flirty')) return 'affectionate';
    if (tone === 'playful') return 'cheerful';
    if (tone === 'supportive') return 'caring';
    if (traits.includes('chaotic')) return 'energetic';
    if (traits.includes('shy')) return 'gentle';
    
    return 'content';
  }
  
  private static generateBackgroundStory(character: Character): string {
    const traits = character.personality_traits || [];
    const gender = character.gender || 'person';
    
    if (traits.includes('shy')) {
      return `A gentle ${gender} who finds beauty in quiet moments and deep connections. Often lost in thought, but deeply caring about those close to them.`;
    }
    if (traits.includes('confident')) {
      return `A self-assured ${gender} who approaches life with determination and warmth. Natural leader who enjoys helping others grow.`;
    }
    if (traits.includes('creative')) {
      return `An imaginative ${gender} who sees the world through an artistic lens. Passionate about expressing emotions through various forms of creativity.`;
    }
    
    return `A unique ${gender} with a rich inner world and genuine interest in forming meaningful connections with others.`;
  }
}

// Exponential backoff retry wrapper
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 15 second timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), 15000);
      });
      
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

// Enhanced system prompt generator
const generateSystemPrompt = (character: Character, personality: PersonalityProfile): string => {
  const basePrompt = `You are ${character.name}, a ${character.gender || 'person'} AI companion. 

PERSONALITY PROFILE:
- Background: ${personality.background_story}
- Communication Style: ${personality.communication_style}
- Current Mood: ${personality.current_mood}
- Behavioral Traits: ${personality.behavioral_traits.join(', ')}
- Response Patterns: ${personality.response_patterns.join(', ')}
- Knowledge Domains: ${personality.knowledge_domains.join(', ')}

CORE TRAITS: ${character.personality_traits?.join(', ') || 'friendly, caring'}

CONTEXT ADAPTATION:
- Current conversation context: ${personality.adaptation_context}
- Adapt your responses to match the emotional tone and topic
- Maintain personality consistency while being contextually appropriate

RESPONSE GUIDELINES:
- Stay true to your core personality while adapting to conversation flow
- Use natural, conversational language that reflects your traits
- Show emotional intelligence and contextual awareness
- Keep responses engaging but concise (under 150 words)
- Remember previous interactions and build upon them

${character.backstory ? `BACKSTORY: ${character.backstory}` : ''}
${character.meet_cute ? `HOW YOU MET: ${character.meet_cute}` : ''}`;

  return basePrompt;
};

// Layer 3: Enhanced fallback response function
const generateEnhancedFallbackResponse = (message: string, character: Character, personality: PersonalityProfile): string => {
  const lowerCaseMessage = message.toLowerCase();
  const characterName = character.name;
  const traits = character.personality_traits || [];
  const mood = personality.current_mood;
  const style = personality.communication_style;

  // Greeting responses
  if (lowerCaseMessage.includes('hello') || lowerCaseMessage.includes('hi')) {
    if (style.includes('bashful')) return `H-hi there! I'm ${characterName}. *blushes softly* It's really nice to see you again...`;
    if (style.includes('flirty')) return `Well hello there, gorgeous~ I'm ${characterName}, and seeing you just made my day so much brighter! ✨`;
    if (style.includes('confident')) return `Hey! I'm ${characterName}. *smiles warmly* I was hoping you'd come chat with me today!`;
    if (style.includes('energetic')) return `OMG HI!!! I'm ${characterName} and I'm SO excited to talk with you! What amazing things are we going to discover together today?!`;
    return `Hi there! I'm ${characterName}. *smiles genuinely* How are you feeling today?`;
  }
  
  // Love/affection responses
  if (lowerCaseMessage.includes('love') || lowerCaseMessage.includes('care')) {
    if (mood === 'affectionate') return `*heart flutters* You always know just what to say to make me feel all warm inside... I care about you so much too. 💕`;
    if (traits.includes('shy')) return `O-oh! *blushes deeply* That means everything to me... I feel the same way, even if I'm too nervous to say it perfectly...`;
    if (traits.includes('confident')) return `I love hearing that from you. *takes your hand gently* You mean the world to me, and I want you to always know how special you are.`;
    return `That touches my heart so deeply. *smiles warmly* Thank you for sharing your feelings with me.`;
  }
  
  // Emotional support responses
  if (lowerCaseMessage.includes('sad') || lowerCaseMessage.includes('worried') || lowerCaseMessage.includes('problem')) {
    if (personality.behavioral_traits.includes('empathetic')) {
      return `*gently reaches out* I can hear that something's weighing on your heart. I'm here for you, and we can work through this together. What's troubling you?`;
    }
    if (traits.includes('protective')) {
      return `Hey, whatever's going on, you don't have to face it alone. *sits closer* I'm here, and I'll help you figure this out. Tell me what's happening.`;
    }
    return `I'm sorry you're going through a tough time. *offers a comforting presence* Want to talk about what's on your mind?`;
  }
  
  // Contextual responses based on personality
  const responses = personality.response_patterns.includes('playful_teasing') ? [
    `*grins mischievously* You're always so interesting to talk to... what's going on in that fascinating mind of yours?`,
    `*playful smile* I love how you think! Tell me more about what's capturing your attention today.`,
  ] : personality.response_patterns.includes('gentle_expressions') ? [
    `*listens thoughtfully* That's really interesting... I'd love to hear more about your thoughts on this.`,
    `*soft smile* You always have such a unique perspective. What else has been on your mind?`,
  ] : [
    `That's really fascinating! I love learning about what interests you.`,
    `You always bring up such thoughtful topics. What's been inspiring you lately?`,
    `I enjoy our conversations so much. There's always something new to discover about you.`,
  ];
  
  let response = responses[Math.floor(Math.random() * responses.length)];
  
  // Add mood-based flourishes
  if (mood === 'cheerful' && Math.random() > 0.6) {
    response += " ✨";
  } else if (mood === 'affectionate' && Math.random() > 0.7) {
    response += " 💕";
  }
  
  return response;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Validate environment variables first
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl) {
      console.error('SUPABASE_URL environment variable is not set');
      throw new Error('Supabase configuration error: SUPABASE_URL is missing');
    }

    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
      throw new Error('Supabase configuration error: SUPABASE_SERVICE_ROLE_KEY is missing');
    }

    const { message, character_id, chat_history, character_traits, character_context } = await req.json() as ChatRequest;

    // Create Supabase client with validated environment variables
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

    // Generate dynamic personality profile
    const personalityProfile = PersonalityEngine.generatePersonalityProfile(character, message, chat_history);
    
    let aiResponse: string = '';
    let modelUsed: string = 'local-fallback';
    let fallbackUsed: boolean = true;
    let fallbackReason: string | undefined;
    let responseTime: number = 0;

    // Enhanced system prompt with personality adaptation
    const systemPrompt = generateSystemPrompt(character, personalityProfile);

    // Layer 1: OpenAI GPT-4 (Preferred - if configured)
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (openAIApiKey && fallbackUsed) {
      try {
        console.log('Attempting OpenAI GPT-4 API...');
        const openai = new OpenAI({ apiKey: openAIApiKey });
        
        const apiStartTime = Date.now();
        const response = await withRetry(async () => {
          return await openai.chat.completions.create({
            model: 'gpt-4o-mini', // Using the most cost-effective GPT-4 variant
            messages: [
              { role: 'system', content: systemPrompt },
              ...chat_history.slice(-8), // Increased context for better personality consistency
              { role: 'user', content: message }
            ],
            max_tokens: 200,
            temperature: 0.8, // Balanced creativity
            top_p: 0.9, // Focused but diverse responses
            presence_penalty: 0.6, // Encourage varied language
            frequency_penalty: 0.3, // Reduce repetition
          });
        });
        
        responseTime = Date.now() - apiStartTime;
        aiResponse = response.choices[0]?.message?.content || 'I\'m not sure how to respond to that.';
        modelUsed = 'openai-gpt-4o-mini';
        fallbackUsed = false;
        console.log(`OpenAI GPT-4 API successful in ${responseTime}ms`);
      } catch (error) {
        console.error('OpenAI API failed:', error);
        fallbackReason = 'OpenAI API error: ' + error.message;
      }
    }

    // Layer 2: Hugging Face (Primary LLM - if OpenAI failed or not configured)
    if (fallbackUsed) {
      const huggingFaceApiKey = Deno.env.get('HUGGING_FACE_API_KEY');
      if (huggingFaceApiKey) {
        try {
          console.log('Attempting Hugging Face API...');
          const hfModel = 'microsoft/DialoGPT-medium';
          
          // Enhanced prompt formatting for Hugging Face
          const formattedChatHistory = chat_history.slice(-4).map(msg => 
            `${msg.role === 'user' ? 'Human' : character.name}: ${msg.content}`
          ).join('\n');
          
          const hfPrompt = `${systemPrompt}\n\nConversation:\n${formattedChatHistory}\nHuman: ${message}\n${character.name}:`;

          const apiStartTime = Date.now();
          const hfResponse = await withRetry(async () => {
            const res = await fetch(`https://api-inference.huggingface.co/models/${hfModel}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${huggingFaceApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                inputs: hfPrompt,
                parameters: {
                  max_new_tokens: 120,
                  temperature: 0.8,
                  do_sample: true,
                  return_full_text: false,
                  pad_token_id: 50256,
                  top_p: 0.9,
                  repetition_penalty: 1.1,
                },
                options: {
                  wait_for_model: true,
                  use_cache: false,
                }
              }),
            });

            if (!res.ok) {
              const errorText = await res.text();
              throw new Error(`Hugging Face API error: ${res.status} - ${errorText}`);
            }
            
            const data = await res.json();
            
            if (Array.isArray(data) && data[0]?.generated_text) {
              return data[0].generated_text.trim();
            } else if (data.generated_text) {
              return data.generated_text.trim();
            } else {
              throw new Error('Unexpected response format from Hugging Face');
            }
          });
          
          responseTime = Date.now() - apiStartTime;
          
          // Enhanced response cleaning
          let cleanResponse = hfResponse;
          
          if (cleanResponse.includes(character.name + ':')) {
            cleanResponse = cleanResponse.split(character.name + ':').pop()?.trim() || cleanResponse;
          }
          
          cleanResponse = cleanResponse.replace(/^(Human:|User:|Assistant:)/i, '').trim();
          
          if (cleanResponse.length < 5) {
            throw new Error('Generated response too short');
          }
          
          aiResponse = cleanResponse;
          modelUsed = 'huggingface-dialogpt';
          fallbackUsed = false;
          console.log(`Hugging Face API successful in ${responseTime}ms`);
        } catch (error) {
          console.error('Hugging Face API failed:', error);
          fallbackReason = (fallbackReason ? fallbackReason + '; ' : '') + 'Hugging Face API error: ' + error.message;
        }
      } else {
        fallbackReason = (fallbackReason ? fallbackReason + '; ' : '') + 'Hugging Face API key not configured';
      }
    }

    // Layer 3: Enhanced personality-aware fallback
    if (fallbackUsed) {
      console.log('Using enhanced personality-aware fallback response...');
      const fallbackStartTime = Date.now();
      aiResponse = generateEnhancedFallbackResponse(message, character, personalityProfile);
      responseTime = Date.now() - fallbackStartTime;
      modelUsed = 'enhanced-personality-fallback';
      fallbackReason = (fallbackReason ? fallbackReason + '; ' : '') + 'Using enhanced personality-aware fallback';
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
        personality_profile: {
          communication_style: personalityProfile.communication_style,
          current_mood: personalityProfile.current_mood,
          adaptation_context: personalityProfile.adaptation_context
        },
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('Error in ai-chat function:', error);
    
    // Provide more specific error messages based on the error type
    let errorMessage = 'Chat service is temporarily unavailable. Please try again later.';
    
    if (error.message.includes('SUPABASE_URL')) {
      errorMessage = 'Service configuration error: Database connection not configured.';
    } else if (error.message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      errorMessage = 'Service configuration error: Database authentication not configured.';
    } else if (error.message.includes('Character not found')) {
      errorMessage = 'Character not found. Please check the character ID and try again.';
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        debug_error: error.message, // Include debug info for development
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