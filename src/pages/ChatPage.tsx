import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Heart, Send } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { supabase } from '../lib/supabase/supabaseClient';
import { motion } from 'framer-motion';
import { generateChatResponse } from '../lib/services/ai-service'; // Import generateChatResponse

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          // Optionally, navigate away or show an error message to the user
          return;
        }
        setActiveChat(chatData);
        setCharacter(chatData.characters);

        // Get the total number of messages for the current chat
        const { count: messageCount, error: countError } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true }) // Use head: true for efficiency
          .eq('chat_id', chatId);

        if (countError) {
          console.error('Error fetching message count:', countError);
          // Decide how to handle this error. For now, we'll proceed but won't insert an initial message if count fails.
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
            // Optionally, show a toast notification to the user
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
          setMessages([]); // Set to empty array on error
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

  const handleSendMessage = async () => {
    if (!messageText.trim() || !chatId || !session?.user || !character) return;

    const userMessage = messageText;
    setMessageText('');

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

      // Simulate AI thinking
      setIsTyping(true);

      // Wait a realistic amount of time (1.5-3 seconds)
      const typingDelay = Math.floor(Math.random() * 1500) + 1500;
      await new Promise(resolve => setTimeout(resolve, typingDelay));

      // Call AI service for character response
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
            backstory: character.backstory || null,
            meet_cute: character.meet_cute || null,
            art_style: character.art_style || null,
            appearance: {
              height: character.height || null,
              build: character.build || null,
              eye_color: character.eye_color || null,
              hair_color: character.hair_color || null,
              skin_tone: character.skin_tone || null
            }
          }
        });

        let aiResponse = '';
        if (aiData.success && aiData.response) {
          aiResponse = aiData.response;

          // Log performance metrics for monitoring
          if (aiData.response_time_ms) {
            console.log(`AI Response Time: ${aiData.response_time_ms}ms using ${aiData.model_used}`);
          }

          // Show fallback notification if needed
          if (aiData.fallback && aiData.fallback_reason) {
            console.log('AI Fallback used:', aiData.fallback_reason);
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
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${character.image_url || 'https://images.pexels.com/photos/6157228/pexels-photo-6157228.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'})` }}>
                </div>
                <div className="ml-3">
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
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-grow overflow-auto px-4 py-4 bg-gray-50 dark:bg-gray-900/50">
          <div className="max-w-4xl mx-auto">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`mb-4 flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                    message.sender === 'user'
                      ? 'bg-pink-500 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {message.content}
                </motion.div>
              </div>
            ))}

            {/* AI typing indicator */}
            {isTyping && (
              <div className="mb-4 flex justify-start">
                <div className="max-w-[80%] px-5 py-3.5 rounded-2xl bg-white dark:bg-gray-800">
                  <div className="flex space-x-1.5">
                    <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
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
