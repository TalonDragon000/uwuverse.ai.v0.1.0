import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Archive, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { Database } from '../../lib/supabase/database.types';

type Character = Database['public']['Tables']['characters']['Row'] & {
  chats: Array<{ id: string; love_meter: number }> | null;
};

interface CharacterCardProps {
  character: Character;
  index: number;
  onArchive: (characterId: string) => void;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ character, index, onArchive }) => {
  const chat = character.chats && character.chats.length > 0 ? character.chats[0] : null;
  const loveMeter = chat ? chat.love_meter : 0;

  const handleArchive = () => {
    if (window.confirm(`Are you sure you want to archive ${character.name}? You can restore them later from your archived characters.`)) {
      onArchive(character.id);
    }
  };

  // Get fallback image based on character attributes
  const getFallbackImage = () => {
    if (character.art_style === 'anime') {
      return character.gender === 'male' 
        ? '/art-styles/male anime.jpg'
        : '/art-styles/female anime.jpg';
    } else if (character.art_style === '3d') {
      return character.gender === 'male'
        ? '/art-styles/male 3d.jpg'
        : '/art-styles/female 3d.jpg';
    } else if (character.art_style === 'comic') {
      return character.gender === 'male'
        ? '/art-styles/male comicbook.jpg'
        : '/art-styles/female comicbook.jpg';
    } else if (character.art_style === 'realistic') {
      return character.gender === 'male'
        ? '/art-styles/male realistic.jpg'
        : '/art-styles/female realistic.jpg';
    }
    
    // Default fallback
    return character.gender === 'male'
      ? '/art-styles/male anime.jpg'
      : '/art-styles/female anime.jpg';
  };

  const imageUrl = character.image_url || getFallbackImage();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-all duration-200"
    >
      {/* Character Portrait Thumbnail */}
      <div className="relative h-48 bg-gray-100 dark:bg-gray-700 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${character.name} - ${character.gender} character portrait`}
            className="w-full h-full object-cover object-center transition-transform duration-300 hover:scale-105"
            onError={(e) => {
              // Fallback to default image if the character image fails to load
              const target = e.target as HTMLImageElement;
              target.src = getFallbackImage();
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30">
            <User className="h-16 w-16 text-gray-400 dark:text-gray-500" />
          </div>
        )}
        
        {/* Character Info Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center justify-between text-white">
              <div>
                <p className="text-sm font-medium capitalize">{character.art_style} Style</p>
                <p className="text-xs opacity-90">
                  {character.personality_traits?.slice(0, 2).join(', ') || 'Unique personality'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-90">Love Meter</p>
                <p className="text-sm font-bold">{loveMeter}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{character.name}</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-200 px-2 py-1 rounded-full capitalize">
              {character.gender === 'male' ? 'Boyfriend' : character.gender === 'female' ? 'Girlfriend' : 'Partner'}
            </span>
            <button
              onClick={handleArchive}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              title="Archive character"
            >
              <Archive className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center mb-1">
            <Heart className="h-4 w-4 text-pink-500 mr-2" />
            <span className="text-sm font-medium">Love Meter</span>
            <span className="text-sm ml-auto">{loveMeter}%</span>
          </div>
          <div className="love-meter">
            <div className="love-meter-fill" style={{ width: `${loveMeter}%` }}></div>
          </div>
        </div>

        {chat?.id ? (
          <Link
            to={`/chat/${chat.id}`}
            className="block w-full text-center bg-gradient-to-r from-pink-400 to-lavender-400 hover:from-pink-500 hover:to-lavender-500 text-white py-2 px-4 rounded-full font-medium transition-all duration-200 transform hover:scale-105"
          >
            Chat Now
          </Link>
        ) : (
          <button
            disabled
            className="block w-full text-center bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 py-2 px-4 rounded-full font-medium cursor-not-allowed"
          >
            Chat Not Available
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default CharacterCard;