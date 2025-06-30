// TAVUS Video Chat Service
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

interface TavusConversationResult {
  success: boolean;
  sessionId?: string;
  videoUrl?: string;
  initialMessage?: string;
  error?: string;
}

interface TavusMessageResult {
  success: boolean;
  response?: string;
  videoUrl?: string;
  error?: string;
}

// Start a new TAVUS conversation session
export const startTavusConversation = async (context: TavusCharacterContext): Promise<TavusConversationResult> => {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tavus-chat`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'start_conversation',
        character_context: context
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error starting TAVUS conversation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start video conversation'
    };
  }
};

// Send a message during an active TAVUS conversation
export const sendTavusMessage = async (sessionId: string, message: string): Promise<TavusMessageResult> => {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tavus-chat`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'send_message',
        session_id: sessionId,
        message: message
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending TAVUS message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message'
    };
  }
};

// End a TAVUS conversation session
export const endTavusSession = async (sessionId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tavus-chat`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'end_session',
        session_id: sessionId
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error ending TAVUS session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to end session'
    };
  }
};

// Get available TAVUS characters (for admin/setup purposes)
export const getTavusCharacters = async () => {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tavus-chat`;
    const headers = {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'get_characters'
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching TAVUS characters:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch characters'
    };
  }
};