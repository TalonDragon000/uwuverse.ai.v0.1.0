import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, 
  PhoneOff, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  X, 
  Send,
  User,
  Heart,
  MessageCircle
} from 'lucide-react';
import { startTavusConversation, sendTavusMessage, endTavusSession } from '../../lib/services/tavus-service';
import { toast } from 'sonner';

interface Character {
  id: string;
  name: string;
  gender: string;
  personality_traits: string[];
  image_url: string | null;
  tavus_character_id: string | null;
  tavus_video_url: string | null;
  backstory: string | null;
  meet_cute: string | null;
  voice_name: string | null;
}

interface VideoCallMessage {
  id: string;
  sender: 'user' | 'character';
  content: string;
  timestamp: Date;
  type: 'text' | 'video_response';
}

interface VideoChatProps {
  character: Character;
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
}

type CallStatus = 'incoming' | 'connecting' | 'connected' | 'ended' | 'error';

const VideoChat: React.FC<VideoChatProps> = ({ character, isOpen, onClose, chatId }) => {
  const [callStatus, setCallStatus] = useState<CallStatus>('incoming');
  const [tavusSessionId, setTavusSessionId] = useState<string | null>(null);
  const [tavusVideoUrl, setTavusVideoUrl] = useState<string | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<VideoCallMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const callStartTimeRef = useRef<Date | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start call duration timer
  useEffect(() => {
    if (callStatus === 'connected' && !callStartTimeRef.current) {
      callStartTimeRef.current = new Date();
      durationIntervalRef.current = setInterval(() => {
        if (callStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - callStartTimeRef.current.getTime()) / 1000);
          setCallDuration(elapsed);
        }
      }, 1000);
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [callStatus]);

  // Format call duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle accepting the incoming call
  const handleAcceptCall = async () => {
    setCallStatus('connecting');
    
    try {
      console.log('Starting TAVUS conversation for character:', character.name);
      
      const result = await startTavusConversation({
        characterId: character.id,
        characterName: character.name,
        personalityTraits: character.personality_traits || [],
        backstory: character.backstory || '',
        meetCute: character.meet_cute || '',
        gender: character.gender,
        voiceName: character.voice_name || '',
        tavusCharacterId: character.tavus_character_id
      });

      if (result.success) {
        setTavusSessionId(result.sessionId);
        setTavusVideoUrl(result.videoUrl || character.tavus_video_url);
        setCallStatus('connected');
        
        // Add initial greeting message
        const greetingMessage: VideoCallMessage = {
          id: `greeting-${Date.now()}`,
          sender: 'character',
          content: result.initialMessage || `Hi! I'm ${character.name}. I'm so excited to video chat with you!`,
          timestamp: new Date(),
          type: 'video_response'
        };
        setMessages([greetingMessage]);
        
        toast.success(`Connected to ${character.name}!`);
      } else {
        throw new Error(result.error || 'Failed to start video conversation');
      }
    } catch (error) {
      console.error('Error starting video call:', error);
      setCallStatus('error');
      toast.error('Failed to connect video call. Please try again.');
    }
  };

  // Handle declining the call
  const handleDeclineCall = () => {
    setCallStatus('ended');
    onClose();
  };

  // Handle ending the call
  const handleEndCall = async () => {
    if (tavusSessionId) {
      try {
        await endTavusSession(tavusSessionId);
      } catch (error) {
        console.error('Error ending TAVUS session:', error);
      }
    }
    
    setCallStatus('ended');
    
    // Clean up
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    
    onClose();
  };

  // Handle sending a message during video call
  const handleSendMessage = async () => {
    if (!messageText.trim() || !tavusSessionId || isProcessing) return;

    const userMessage: VideoCallMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: messageText,
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setMessageText('');
    setIsProcessing(true);

    try {
      const result = await sendTavusMessage(tavusSessionId, messageText);
      
      if (result.success) {
        const characterResponse: VideoCallMessage = {
          id: `character-${Date.now()}`,
          sender: 'character',
          content: result.response || 'I heard what you said!',
          timestamp: new Date(),
          type: 'video_response'
        };
        
        setMessages(prev => [...prev, characterResponse]);
        
        // Update video URL if provided
        if (result.videoUrl) {
          setTavusVideoUrl(result.videoUrl);
        }
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Render incoming call interface
  const renderIncomingCall = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 bg-gradient-to-br from-pink-900 via-purple-900 to-blue-900 flex items-center justify-center"
    >
      <div className="text-center text-white">
        {/* Character Avatar */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-32 h-32 mx-auto mb-6 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl"
        >
          {character.image_url ? (
            <img
              src={character.image_url}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
              <User className="h-16 w-16 text-white" />
            </div>
          )}
        </motion.div>

        {/* Call Info */}
        <h2 className="text-3xl font-bold mb-2">{character.name}</h2>
        <p className="text-xl text-white/80 mb-2">Incoming Video Call</p>
        <p className="text-sm text-white/60 mb-8">
          {character.voice_name && `Voice: ${character.voice_name}`}
        </p>

        {/* Call Actions */}
        <div className="flex justify-center space-x-8">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleDeclineCall}
            className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg"
          >
            <PhoneOff className="h-8 w-8 text-white" />
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleAcceptCall}
            className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg"
          >
            <Phone className="h-8 w-8 text-white" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );

  // Render connecting interface
  const renderConnecting = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center"
    >
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-400 mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold mb-2">Connecting to {character.name}...</h2>
        <p className="text-gray-400">Please wait while we establish the video connection</p>
      </div>
    </motion.div>
  );

  // Render active video call interface
  const renderVideoCall = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-gray-900 flex flex-col"
    >
      {/* Video Area */}
      <div className="flex-1 relative">
        {/* Main Video (Character) */}
        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
          {tavusVideoUrl ? (
            <video
              ref={videoRef}
              src={tavusVideoUrl}
              autoPlay
              muted={!isAudioEnabled}
              className="w-full h-full object-cover"
              onError={() => {
                console.error('Video playback error');
                toast.error('Video playback error');
              }}
            />
          ) : character.image_url ? (
            <img
              src={character.image_url}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
              <User className="h-32 w-32 text-white" />
            </div>
          )}
        </div>

        {/* Video Overlay Info */}
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-white">
          <div className="flex items-center space-x-2">
            <Heart className="h-4 w-4 text-pink-400" />
            <span className="font-medium">{character.name}</span>
            <span className="text-sm text-gray-300">•</span>
            <span className="text-sm text-gray-300">{formatDuration(callDuration)}</span>
          </div>
        </div>

        {/* Call Controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-4">
          <button
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isAudioEnabled 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          <button
            onClick={() => setIsVideoEnabled(!isVideoEnabled)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isVideoEnabled 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          <button
            onClick={handleEndCall}
            className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Chat Panel */}
      <div className="h-80 bg-gray-800 border-t border-gray-700 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-700 text-gray-100'
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-gray-700 text-gray-100 px-3 py-2 rounded-lg">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-700">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex space-x-2"
          >
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={`Message ${character.name}...`}
              className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              disabled={isProcessing}
            />
            <button
              type="submit"
              disabled={!messageText.trim() || isProcessing}
              className="bg-pink-500 hover:bg-pink-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );

  // Render error state
  const renderError = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center"
    >
      <div className="text-center text-white max-w-md mx-auto px-4">
        <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <X className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Connection Failed</h2>
        <p className="text-gray-400 mb-6">
          We couldn't connect to {character.name} for video chat. Please try again later.
        </p>
        <button
          onClick={onClose}
          className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Back to Chat
        </button>
      </div>
    </motion.div>
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {callStatus === 'incoming' && renderIncomingCall()}
      {callStatus === 'connecting' && renderConnecting()}
      {callStatus === 'connected' && renderVideoCall()}
      {callStatus === 'error' && renderError()}
    </AnimatePresence>
  );
};

export default VideoChat;