// Optimized AI service with dynamic imports and caching
interface ChatRequest {
  message: string;
  character_id: string;
  chat_history: Array<{ role: 'user' | 'assistant'; content: string }>;
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

interface CharacterRequest {
  name: string;
  gender: string;
  height: string;
  build: string;
  eye_color: string;
  hair_color: string;
  skin_tone: string;
  personality_traits: string[];
  art_style: string;
}

interface ChatResponse {
  success: boolean;
  response?: string;
  model_used?: string;
  fallback?: boolean;
  fallback_reason?: string;
  response_time_ms?: number;
  total_time_ms?: number;
  personality_profile?: {
    communication_style: string;
    current_mood: string;
    adaptation_context: string;
  };
  error?: string;
  timestamp?: string;
}

// In-memory cache for recent responses (LRU-style)
class ResponseCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private maxSize = 50;
  private ttl = 5 * 60 * 1000; // 5 minutes

  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key: string, data: any) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

const responseCache = new ResponseCache();

export const generateChatResponse = async (request: ChatRequest): Promise<ChatResponse> => {
  // Create cache key from request (excluding full chat history for better cache hits)
  const cacheKey = `chat_${request.character_id}_${request.message.substring(0, 50)}_${request.character_traits.join(',')}`;
  const cached = responseCache.get(cacheKey);
  
  if (cached) {
    return { ...cached, cached: true };
  }

  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ChatResponse = await response.json();
    
    if (data.success) {
      // Only cache successful responses that aren't fallbacks
      if (!data.fallback) {
        responseCache.set(cacheKey, data);
      }
      
      // Log personality adaptation info for debugging
      if (data.personality_profile) {
        console.log('Personality Adaptation:', {
          style: data.personality_profile.communication_style,
          mood: data.personality_profile.current_mood,
          context: data.personality_profile.adaptation_context,
          model: data.model_used
        });
      }
    }
    
    return data;
  } catch (error) {
    console.error('Chat API error:', error);
    throw error;
  }
};

export const generateCharacterImage = async (request: CharacterRequest) => {
  // Create cache key for character generation
  const cacheKey = `char_${JSON.stringify(request)}`;
  const cached = responseCache.get(cacheKey);
  
  if (cached) {
    return { ...cached, cached: true };
  }

  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-image-generation`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.success) {
      responseCache.set(cacheKey, data);
    }
    
    return data;
  } catch (error) {
    console.error('Image generation API error:', error);
    throw error;
  }
};

// Restored voice service functionality
export const getVoiceService = async () => {
  const { getElevenLabsVoices, generateVoicePreview } = await import('./voice-service');
  return { getElevenLabsVoices, generateVoicePreview };
};

// Personality analysis utilities for client-side use
export const analyzePersonalityContext = (message: string, chatHistory: Array<{ role: string; content: string }>) => {
  const recentMessages = chatHistory.slice(-5);
  const fullText = (message + ' ' + recentMessages.map(h => h.content).join(' ')).toLowerCase();
  
  const context = {
    emotional: fullText.match(/\b(feel|emotion|heart|love|care|sad|happy|worried)\b/) !== null,
    playful: fullText.match(/\b(fun|play|game|joke|laugh|haha|funny)\b/) !== null,
    romantic: fullText.match(/\b(love|kiss|date|romantic|beautiful|gorgeous)\b/) !== null,
    supportive: fullText.match(/\b(problem|help|support|advice|comfort)\b/) !== null,
    curious: fullText.match(/\b(what|how|why|when|where|tell me|explain)\b/) !== null,
  };
  
  return {
    primaryContext: Object.entries(context).find(([_, value]) => value)?.[0] || 'casual',
    allContexts: Object.entries(context).filter(([_, value]) => value).map(([key, _]) => key),
    conversationTone: message.includes('?') ? 'questioning' : 
                     message.includes('!') ? 'excited' : 'conversational'
  };
};