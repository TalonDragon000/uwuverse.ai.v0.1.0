// Separated voice service for better bundle splitting
interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  gender: string;
  accent: string;
  age: string;
  tone: string;
  description: string;
  preview_url?: string;
}

// Voice cache for better performance
class VoiceCache {
  private cache = new Map<string, { data: ElevenLabsVoice[]; timestamp: number }>();
  private ttl = 30 * 60 * 1000; // 30 minutes

  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key: string, data: ElevenLabsVoice[]) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

// Audio cache for generated speech
class AudioCache {
  private cache = new Map<string, { url: string; timestamp: number }>();
  private ttl = 10 * 60 * 1000; // 10 minutes

  get(key: string): string | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      // Clean up expired URL
      URL.revokeObjectURL(item.url);
      this.cache.delete(key);
      return null;
    }
    
    return item.url;
  }

  set(key: string, url: string) {
    // Clean up old URL if it exists
    const existing = this.cache.get(key);
    if (existing) {
      URL.revokeObjectURL(existing.url);
    }
    
    this.cache.set(key, { url, timestamp: Date.now() });
  }

  clear() {
    // Clean up all URLs
    this.cache.forEach(item => URL.revokeObjectURL(item.url));
    this.cache.clear();
  }
}

const voiceCache = new VoiceCache();
const audioCache = new AudioCache();

export const getElevenLabsVoices = async (): Promise<ElevenLabsVoice[]> => {
  const cached = voiceCache.get('voices');
  if (cached) {
    return cached;
  }

  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-elevenlabs-voices`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, { headers });
    const data = await response.json();

    if (data.success) {
      voiceCache.set('voices', data.voices);
      return data.voices;
    } else {
      throw new Error(data.error || 'Failed to fetch voices');
    }
  } catch (error) {
    console.error('Error fetching voices:', error);
    throw error;
  }
};

export const generateVoicePreview = async (voiceId: string, text: string) => {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-service/generate-voice-preview`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ voice_id: voiceId, text }),
    });

    return await response.json();
  } catch (error) {
    console.error('Error generating voice preview:', error);
    throw error;
  }
};

export const generateSpeech = async (voiceId: string, text: string): Promise<string> => {
  // Create cache key from voice ID and text
  const cacheKey = `${voiceId}-${text.substring(0, 100)}`;
  
  // Check cache first
  const cachedUrl = audioCache.get(cacheKey);
  if (cachedUrl) {
    return cachedUrl;
  }

  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-service/generate-speech`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        voice_id: voiceId, 
        text: text.substring(0, 4500) // Increased limit for longer messages
      }),
    });

    const data = await response.json();

    if (!data.success) {
      // Provide more specific error messages based on the error type
      let errorMessage = data.error || 'Failed to generate speech';
      
      // Add helpful context for common issues
      if (data.debug_info) {
        console.error('Speech generation debug info:', data.debug_info);
        
        if (data.debug_info.includes('Empty audio buffer')) {
          errorMessage = 'Voice service returned no audio. This usually means insufficient account credits or an invalid voice. Please check your ElevenLabs account.';
        } else if (data.debug_info.includes('401')) {
          errorMessage = 'Voice service authentication failed. Please contact support.';
        } else if (data.debug_info.includes('402')) {
          errorMessage = 'Voice service quota exceeded. Please check your account credits.';
        } else if (data.debug_info.includes('429')) {
          errorMessage = 'Voice service rate limit exceeded. Please try again in a few minutes.';
        }
      }
      
      throw new Error(errorMessage);
    }

    // Validate that we received audio data
    if (!data.audio_data || data.audio_data.length === 0) {
      throw new Error('Voice service returned empty audio data. Please check your account status.');
    }

    // Convert base64 audio data to blob
    try {
      const audioData = atob(data.audio_data);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      
      const audioBlob = new Blob([audioArray], { type: data.content_type || 'audio/mpeg' });
      
      // Validate blob size
      if (audioBlob.size === 0) {
        throw new Error('Generated audio file is empty');
      }
      
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Cache the URL
      audioCache.set(cacheKey, audioUrl);
      
      console.log(`Successfully generated speech: ${data.audio_size_bytes || audioBlob.size} bytes`);
      return audioUrl;
    } catch (decodeError) {
      console.error('Error decoding audio data:', decodeError);
      throw new Error('Failed to process audio data from voice service');
    }
  } catch (error) {
    console.error('Error generating speech:', error);
    
    // Re-throw with the original error message if it's already user-friendly
    if (error.message.includes('Voice service') || error.message.includes('account') || error.message.includes('credits')) {
      throw error;
    }
    
    // Otherwise, provide a generic error message
    throw new Error('Failed to generate speech. Please try again later.');
  }
};

// Clean up audio cache when the page unloads
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    audioCache.clear();
  });
}