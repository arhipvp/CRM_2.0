import React, { useState } from 'react';
import { generateAndPlayAudio } from '../services/geminiService';
import { SpeakerIcon } from './icons/SpeakerIcon';
import { LoadingSpinner } from './icons/LoadingSpinner';

interface TTSButtonProps {
  textToSpeak: string;
}

export const TTSButton: React.FC<TTSButtonProps> = ({ textToSpeak }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      await generateAndPlayAudio(textToSpeak);
    } catch (e) {
      setError('Ошибка');
      console.error(e);
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handlePlay}
      disabled={isLoading}
      className="p-2 rounded-full text-slate-500 hover:bg-slate-200 hover:text-sky-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      title="Прочитать вслух"
    >
      {isLoading ? <LoadingSpinner /> : (error ? <span className="text-red-500 font-bold text-xs">!</span> : <SpeakerIcon />) }
    </button>
  );
};