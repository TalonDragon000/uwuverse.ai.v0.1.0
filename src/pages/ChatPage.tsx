import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Heart, Send, Volume2, VolumeX, Play, Square, Brain, AlertCircle } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { supabase } from '../lib/supabase/supabaseClient';
import { motion } from 'framer-motion';
import { generateChatResponse, analyzePersonalityContext } from '../lib/services/ai-service';
import { generateSpeech } from '../lib/services/voice-service';
import { toast } from 'sonner';

type Character = {
  id: string;
  name: string;
  gender: string;
  personality_traits: string[];
  image_url: string | null;
  voice_id: string | null;
  voice_name: string | null;
  backstory: string | null;
  meet_cute: string | null;
  art_style: string | null;
  height: string | null;
  build: string | null;
  eye_color: string | null;
  hair_color: string | null;
  skin_tone: string | null;
};

const ChatPage: React.FC = () => {
  const { id: chatId } = useParams<{ id: string }>();
  const { session } = useAuthStore();
  const {
    activeChat,
    messages,
    setActiveChat,
    setMessages,
    addMessage,
    isTyping,
    setIsTyping,
    updateLoveMeter
  } = useChatStore();
  
  const [character, setCharacter] = useState<Character | null>(null);
  const [messageText, setMessageText] = useState('');
  
  // Audio state
  const [isAudioEnabled, setIsAudioEnabled] = useState(() => {
    const saved = localStorage.getItem('uwuverse-audio-enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [currentlyPlayingMessageId, setCurrentlyPlayingMessageId] = useState<string | null>(null);
  const [isGeneratingAudioForMessageId, setIsGeneratingAudioForMessageId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const currentlyPlayingAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Personality state
  const [currentPersonalityContext, setCurrentPersonalityContext] = useState<string>('casual');
  const [personalityAdaptation, setPersonalityAdaptation] = useState<{
    style: string;
    mood: string;
    context: string;
  } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Save audio preference to localStorage
  useEffect(() => {
    localStorage.setItem('uwuverse-audio-enabled', JSON.stringify(isAudioEnabled));
  }, [isAudioEnabled]);

  // Clean up audio when component unmounts
  useEffect(() => {
    return () => {
      if (currentlyPlayingAudioRef.current) {
        currentlyPlayingAudioRef.current.pause();
        currentlyPlayingAudioRef.current.src = '';
      }
    };
  }, []);

  useEffect(() => {
    if (!chatId || !session?.user) return;

    const fetchChatAndMessages = async () => {
      try {
        // Fetch the chat and character details
        const { data: chatData, error: chatError } = await supabase
          .from('chats')
          .select(`
            *,
            characters (
              id, name, gender, personality_traits, image_url, voice_id, voice_name, backstory, meet_cute, art_style, height, build, eye_color, hair_color, skin_tone
            )
          `)
          .eq('id', chatId)
          .eq('user_id', session.user.id)
          .single();

        if (chatError) {
          console.error('Error fetching chat:', chatError);
          return;
        }
        setActiveChat(chatData);
        setCharacter(chatData.characters);

        // Get the total number of messages for the current chat
        const { count: messageCount, error: countError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('chat_id', chatId);

        if (countError) {
          console.error('Error fetching message count:', countError);
        }

        // Only insert the initial message if the message count is 0
        if (messageCount === 0) {
          const traits = chatData.characters.personality_traits || [];

          let greeting = `Hi there! I'm ${chatData.characters.name}. `;

          if (traits.includes('shy')) {
            greeting += "I'm a bit nervous meeting you like this... but I'm really happy we connected!";
          } else if (traits.includes('flirty')) {
            greeting += "I've been waiting to meet someone like you. What's a cutie like you doing here?";
          } else if (traits.includes('confident')) {
            greeting += "It's great to finally meet you! I have a feeling we're going to get along really well.";
          } else if (traits.includes('chaotic')) {
            greeting += "OMG HI!!! I'm so excited to meet you! What should we talk about first? I have like a MILLION things to ask you!";
          } else {
            greeting += "It's really nice to meet you. I'm looking forward to getting to know you better!";
          }

          const { error: newMessageError } = await supabase
            .from('messages')
            .insert({
              chat_id: chatId,
              sender: 'character',
              content: greeting
            });

          if (newMessageError) {
            console.error('Error inserting initial message:', newMessageError);
          }
        }

        // Fetch all messages (including the newly inserted one if applicable)
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Error fetching messages:', messagesError);
          setMessages([]);
        } else {
          setMessages(messagesData || []);
        }

      } catch (error) {
        console.error('Unexpected error in fetchChatAndMessages:', error);
      }
    };

    fetchChatAndMessages();
  }, [chatId, session, setActiveChat, setMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handlePlayStopAudio = async (messageId: string, text: string, voiceId: string | null) => {
    // Clear any previous audio errors
    setAudioError(null);

    // If this message is currently playing, stop it
    if (currentlyPlayingMessageId === messageId) {
      if (currentlyPlayingAudioRef.current) {
        currentlyPlayingAudioRef.current.pause();
        currentlyPlayingAudioRef.current.src = '';
        currentlyPlayingAudioRef.current = null;
      }
      setCurrentlyPlayingMessageId(null);
      return;
    }

    // Stop any currently playing audio
    if (currentlyPlayingAudioRef.current) {
      currentlyPlayingAudioRef.current.pause();
      currentlyPlayingAudioRef.current.src = '';
      currentlyPlayingAudioRef.current = null;
    }
    setCurrentlyPlayingMessageId(null);

    // If no voice ID, show error
    if (!voiceId) {
      const errorMsg = 'No voice selected for this character';
      setAudioError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    // Start generating audio
    setIsGeneratingAudioForMessageId(messageId);

    try {
      const audioUrl = await generateSpeech(voiceId, text);
      
      // Create and play audio
      const audio = new Audio(audioUrl);
      currentlyPlayingAudioRef.current = audio;
      
      audio.onended = () => {
        setCurrentlyPlayingMessageId(null);
        currentlyPlayingAudioRef.current = null;
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setCurrentlyPlayingMessageId(null);
        currentlyPlayingAudioRef.current = null;
        const errorMsg = 'Failed to play audio';
        setAudioError(errorMsg);
        toast.error(errorMsg);
      };

      await audio.play();
      setCurrentlyPlayingMessageId(messageId);
      
    } catch (error) {
      console.error('Error generating or playing speech:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate speech. Please try again.';
      setAudioError(errorMessage);
      
      // Show user-friendly toast message
      if (errorMessage.includes('account') || errorMessage.includes('credits')) {
        toast.error('Voice service issue. Please check your account or try again later.', { duration: 5000 });
      } else if (errorMessage.includes('rate limit')) {
        toast.error('Voice service is busy. Please try again in a few minutes.', { duration: 5000 });
      } else {
        toast.error('Failed to generate speech. Please try again.', { duration: 3000 });
      }
    } finally {
      setIsGeneratingAudioForMessageId(null);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !chatId || !session?.user || !character) return;

    const userMessage = messageText;
    setMessageText('');

    // Analyze personality context before sending
    const personalityContext = analyzePersonalityContext(userMessage, messages.slice(-5));
    setCurrentPersonalityContext(personalityContext.primaryContext);

    try {
      // Insert user message
      const { data: newUserMessage, error: userMessageError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender: 'user',
          content: userMessage
        })
        .select()
        .single();

      if (userMessageError) throw userMessageError;
      if (newUserMessage) {
        addMessage(newUserMessage);
      }

      // Simulate AI thinking with personality adaptation indicator
      setIsTyping(true);

      // Wait a realistic amount of time (1.5-3 seconds)
      const typingDelay = Math.floor(Math.random() * 1500) + 1500;
      await new Promise(resolve => setTimeout(resolve, typingDelay));

      // Call AI service for character response with enhanced context
      try {
        // Prepare chat history for AI context
        const chatHistory = messages.slice(-10).map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

        const aiData = await generateChatResponse({
          message: userMessage,
          character_id: character.id,
          chat_history: chatHistory,
          character_traits: character.personality_traits || [],
          character_context: {
            name: character.name,
            gender: character.gender,
            backstory: character.backstory || '',
            meet_cute: character.meet_cute || '',
            art_style: character.art_style || '',
            appearance: {
              height: character.height || '',
              build: character.build || '',
              eye_color: character.eye_color || '',
              hair_color: character.hair_color || '',
              skin_tone: character.skin_tone || ''
            }
          }
        });

        let aiResponse = '';
        if (aiData.success && aiData.response) {
          aiResponse = aiData.response;

          // Update personality adaptation display
          if (aiData.personality_profile) {
            setPersonalityAdaptation({
              style: aiData.personality_profile.communication_style,
              mood: aiData.personality_profile.current_mood,
              context: aiData.personality_profile.adaptation_context
            });
          }

          // Log performance metrics for monitoring
          if (aiData.response_time_ms) {
            console.log(`AI Response Time: ${aiData.response_time_ms}ms using ${aiData.model_used}`);
          }

          // Show fallback notification if needed
          if (aiData.fallback && aiData.fallback_reason) {
            console.log('AI Fallback used:', aiData.fallback_reason);
            if (!aiData.model_used?.includes('enhanced-personality')) {
              toast.info('Using backup AI system', { duration: 2000 });
            }
          }
        } else {
          throw new Error(aiData.error || 'AI service returned no response');
        }

        // Insert AI response
        const { data: newCharacterMessage, error: characterMessageError } = await supabase
          .from('messages')
          .insert({
            chat_id: chatId,
            sender: 'character',
            content: aiResponse
          })
          .select()
          .single();

        if (characterMessageError) throw characterMessageError;
        if (newCharacterMessage) {
          setIsTyping(false);
          addMessage(newCharacterMessage);
        }
      } catch (aiError) {
        console.error('AI service error:', aiError);
        setIsTyping(false);

        // Show user-friendly error message
        const errorMessage = "I'm having trouble thinking of a response right now. Could you try asking me something else?";

        const { data: newCharacterMessage, error: characterMessageError } = await supabase
          .from('messages')
          .insert({
            chat_id: chatId,
            sender: 'character',
            content: errorMessage
          })
          .select()
          .single();

        if (characterMessageError) throw characterMessageError;
        if (newCharacterMessage) {
          addMessage(newCharacterMessage);
        }
      }

      // Small chance to increase love meter for every interaction
      if (activeChat && Math.random() > 0.7) {
        const newLoveMeter = Math.min((activeChat.love_meter || 0) + 1, 100);
        updateLoveMeter(newLoveMeter);

        // Update in database
        await supabase
          .from('chats')
          .update({ love_meter: newLoveMeter })
          .eq('id', chatId);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow pt-16 flex flex-col h-[calc(100vh-4rem)]">
        {/* Chat header */}
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 py-3 px-4 sticky top-16 z-10">
          <div className="max-w-4xl mx-auto flex items-center">
            <Link to="/dashboard" className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 mr-3">
              <ArrowLeft className="h-5 w-5" />
            </Link>

            {character && (
              <div className="flex items-center flex-grow">
                <div className="h-10 w-10 rounded-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${character.image_url || 'https://images.pexels.com/photos/6157228/pexels-photo-6157228.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'})` }}>
                </div>
                <div className="ml-3 flex-grow">
                  <h2 className="font-medium">{character.name}</h2>
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    {activeChat && (
                      <>
                        <Heart className="h-3 w-3 text-pink-500 mr-1" />
                        <span>{activeChat.love_meter}% Love</span>
                      </>
                    )}
                    {character.voice_name && (
                      <>
                        <span className="mx-2">•</span>
                        <span>Voice: {character.voice_name}</span>
                      </>
                    )}
                    {personalityAdaptation && (
                      <>
                        <span className="mx-2">•</span>
                        <Brain className="h-3 w-3 text-purple-500 mr-1" />
                        <span className="capitalize">{personalityAdaptation.mood}</span>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Audio toggle button */}
                <button
                  onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                  className={`p-2 rounded-full transition-colors duration-200 ${
                    isAudioEnabled 
                      ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                  title={isAudioEnabled ? 'Disable audio' : 'Enable audio'}
                >
                  {isAudioEnabled ? (
                    <Volume2 className="h-5 w-5" />
                  ) : (
                    <VolumeX className="h-5 w-5" />
                  )}
                </button>
              </div>
            )}
          </div>
          
          {/* Personality adaptation indicator */}
          {personalityAdaptation && (
            <div className="max-w-4xl mx-auto mt-2">
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-1 inline-flex items-center">
                <Brain className="h-3 w-3 mr-1" />
                <span className="capitalize">{personalityAdaptation.style.replace(/_/g, ' ')}</span>
                <span className="mx-2">•</span>
                <span>Context: {personalityAdaptation.context}</span>
              </div>
            </div>
          )}

          {/* Audio error indicator */}
          {audioError && (
            <div className="max-w-4xl mx-auto mt-2">
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-1 inline-flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                <span>Audio: {audioError}</span>
                <button 
                  onClick={() => setAudioError(null)}
                  className="ml-2 text-red-500 hover:text-red-700 dark:hover:text-red-300"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Chat messages */}
        <div className="flex-grow overflow-auto px-4 py-4 bg-gray-50 dark:bg-gray-900/50">
          <div className="max-w-4xl mx-auto">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`mb-4 flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex items-start max-w-[80%]">
                  {/* Audio button for character messages */}
                  {message.sender === 'character' && isAudioEnabled && character?.voice_id && (
                    <button
                      onClick={() => handlePlayStopAudio(message.id, message.content, character.voice_id)}
                      disabled={isGeneratingAudioForMessageId === message.id}
                      className="mr-2 mt-1 p-1.5 rounded-full bg-pink-100 dark:bg-pink-900/30 hover:bg-pink-200 dark:hover:bg-pink-900/50 text-pink-600 dark:text-pink-400 transition-colors duration-200 flex-shrink-0"
                      title={currentlyPlayingMessageId === message.id ? 'Stop audio' : 'Play audio'}
                    >
                      {isGeneratingAudioForMessageId === message.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-pink-600 dark:border-pink-400"></div>
                      ) : currentlyPlayingMessageId === message.id ? (
                        <Square className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`px-4 py-3 rounded-2xl ${
                      message.sender === 'user'
                        ? 'bg-pink-500 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {message.content}
                  </motion.div>
                </div>
              </div>
            ))}

            {/* AI typing indicator */}
            {isTyping && (
              <div className="mb-4 flex justify-start">
                <div className="max-w-[80%] px-5 py-3.5 rounded-2xl bg-white dark:bg-gray-800">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1.5">
                      <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-pulse"></div>
                      <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      Adapting to {currentPersonalityContext} context...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message input */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="max-w-4xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center"
            >
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                className="flex-grow uwu-input rounded-r-none border-r-0"
              />
              <button
                type="submit"
                disabled={!messageText.trim() || isTyping}
                className={`uwu-input h-full rounded-l-none bg-pink-500 dark:bg-pink-600 hover:bg-pink-600 dark:hover:bg-pink-500 text-white px-4 transition-colors duration-200 ${
                  !messageText.trim() || isTyping
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                <Send className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChatPage;