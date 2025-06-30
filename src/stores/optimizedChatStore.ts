import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Optimized chat store with selective subscriptions
interface Message {
  id: string;
  chat_id: string;
  sender: 'user' | 'character';
  content: string;
  created_at: string;
  message_type?: 'text' | 'audio_log';
}

interface Chat {
  id: string;
  user_id: string;
  character_id: string;
  love_meter: number;
  created_at: string;
}

interface ChatState {
  // Essential metadata only
  activeChat: Chat | null;
  messageIds: string[];
  messagesById: Record<string, Message>;
  isTyping: boolean;
  
  // Audio features
  isAudioEnabled: boolean;
  currentlyPlayingMessageId: string | null;
  isGeneratingAudioForMessageId: string | null;
  
  // Actions
  setActiveChat: (chat: Chat | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setIsTyping: (isTyping: boolean) => void;
  updateLoveMeter: (value: number) => void;
  
  // Audio actions
  setIsAudioEnabled: (enabled: boolean) => void;
  setCurrentlyPlayingMessageId: (messageId: string | null) => void;
  setIsGeneratingAudioForMessageId: (messageId: string | null) => void;
  
  // Selectors
  getMessages: () => Message[];
  getRecentMessages: (count: number) => Message[];
}

// Initialize audio preference from localStorage
const getInitialAudioEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem('uwuverse-audio-enabled');
  return saved !== null ? JSON.parse(saved) : true;
};

export const useChatStore = create<ChatState>()(
  subscribeWithSelector((set, get) => ({
    activeChat: null,
    messageIds: [],
    messagesById: {},
    isTyping: false,
    
    // Audio state
    isAudioEnabled: getInitialAudioEnabled(),
    currentlyPlayingMessageId: null,
    isGeneratingAudioForMessageId: null,
    
    setActiveChat: (chat) => set({ activeChat: chat }),
    
    setMessages: (messages) => {
      const messagesById: Record<string, Message> = {};
      const messageIds: string[] = [];
      
      messages.forEach(message => {
        messagesById[message.id] = message;
        messageIds.push(message.id);
      });
      
      set({ messagesById, messageIds });
    },
    
    addMessage: (message) => set((state) => ({
      messagesById: { ...state.messagesById, [message.id]: message },
      messageIds: [...state.messageIds, message.id]
    })),
    
    setIsTyping: (isTyping) => set({ isTyping }),
    
    updateLoveMeter: (value) => set((state) => ({
      activeChat: state.activeChat ? { ...state.activeChat, love_meter: value } : null
    })),
    
    // Audio actions
    setIsAudioEnabled: (enabled) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('uwuverse-audio-enabled', JSON.stringify(enabled));
      }
      set({ isAudioEnabled: enabled });
    },
    
    setCurrentlyPlayingMessageId: (messageId) => set({ currentlyPlayingMessageId: messageId }),
    
    setIsGeneratingAudioForMessageId: (messageId) => set({ isGeneratingAudioForMessageId: messageId }),
    
    // Memoized selectors
    getMessages: () => {
      const { messageIds, messagesById } = get();
      return messageIds.map(id => messagesById[id]).filter(Boolean);
    },
    
    getRecentMessages: (count) => {
      const { messageIds, messagesById } = get();
      return messageIds
        .slice(-count)
        .map(id => messagesById[id])
        .filter(Boolean);
    }
  }))
);

// Selective subscription hooks for better performance
export const useActiveChat = () => useChatStore(state => state.activeChat);
export const useIsTyping = () => useChatStore(state => state.isTyping);
export const useMessages = () => useChatStore(state => state.getMessages());
export const useRecentMessages = (count: number) => useChatStore(state => state.getRecentMessages(count));

// Audio-specific hooks
export const useIsAudioEnabled = () => useChatStore(state => state.isAudioEnabled);
export const useCurrentlyPlayingMessageId = () => useChatStore(state => state.currentlyPlayingMessageId);
export const useIsGeneratingAudioForMessageId = () => useChatStore(state => state.isGeneratingAudioForMessageId);
export const useSetIsAudioEnabled = () => useChatStore(state => state.setIsAudioEnabled);
export const useSetCurrentlyPlayingMessageId = () => useChatStore(state => state.setCurrentlyPlayingMessageId);
export const useSetIsGeneratingAudioForMessageId = () => useChatStore(state => state.setIsGeneratingAudioForMessageId);