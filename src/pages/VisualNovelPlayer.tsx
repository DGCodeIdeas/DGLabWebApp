import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { pullSingleFromServer, getLocalNovel } from '../lib/db';

interface VisualNovel {
  id: string;
  title: string;
  script: string;
}

type Step = 
  | { type: 'dialogue', speaker: string, text: string }
  | { type: 'scene', bg: string }
  | { type: 'show', character: string, emotion: string }
  | { type: 'hide', character: string }
  | { type: 'end' };

function parseScript(script: string): Step[] {
  const lines = script.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const steps: Step[] = [];
  
  for (const line of lines) {
    if (line.startsWith('label ')) continue;
    if (line === 'return') {
      steps.push({ type: 'end' });
      continue;
    }
    if (line.startsWith('scene ')) {
      steps.push({ type: 'scene', bg: line.replace('scene ', '').trim() });
      continue;
    }
    if (line.startsWith('show ')) {
      const parts = line.replace('show ', '').trim().split(' ');
      steps.push({ type: 'show', character: parts[0], emotion: parts[1] || 'normal' });
      continue;
    }
    if (line.startsWith('hide ')) {
      steps.push({ type: 'hide', character: line.replace('hide ', '').trim() });
      continue;
    }
    
    // Dialogue: "Text" or speaker "Text"
    const quoteMatch = line.match(/^(?:([\w\s]+?)\s+)?"(.*)"$/);
    if (quoteMatch) {
      steps.push({ type: 'dialogue', speaker: quoteMatch[1] || '', text: quoteMatch[2] });
      continue;
    }
  }
  
  if (steps.length === 0 || steps[steps.length - 1].type !== 'end') {
    steps.push({ type: 'end' });
  }
  
  return steps;
}

export default function VisualNovelPlayer() {
  const [novel, setNovel] = useState<VisualNovel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [steps, setSteps] = useState<Step[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [bg, setBg] = useState('default');
  const [characters, setCharacters] = useState<{name: string, emotion: string}[]>([]);
  const [dialogue, setDialogue] = useState<{speaker: string, text: string} | null>(null);
  const [isEnded, setIsEnded] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/\/visual-novels\/play\/(.+)/);
    if (match && match[1]) {
      loadNovel(match[1]);
    } else {
      setError("Invalid novel ID");
      setIsLoading(false);
    }
  }, []);

  const loadNovel = async (id: string) => {
    try {
      await pullSingleFromServer(id);
      const data = await getLocalNovel(id);
      if (data) {
        setNovel(data as VisualNovel);
        
        const parsed = parseScript(data.script || '');
        setSteps(parsed);
        advance(parsed, -1, 'default', []);
      } else {
        setError("Visual Novel not found!");
      }
    } catch (err) {
      console.error("Error loading novel:", err);
      setError("Failed to load visual novel.");
    } finally {
      setIsLoading(false);
    }
  };

  const advance = (currentSteps: Step[], currentIdx: number, currentBg: string, currentChars: {name: string, emotion: string}[]) => {
    let nextIdx = currentIdx + 1;
    let newBg = currentBg;
    let newChars = [...currentChars];
    
    while (nextIdx < currentSteps.length) {
      const step = currentSteps[nextIdx];
      
      if (step.type === 'scene') {
        newBg = step.bg;
      } else if (step.type === 'show') {
        const existing = newChars.findIndex(c => c.name === step.character);
        if (existing >= 0) newChars[existing] = { name: step.character, emotion: step.emotion };
        else newChars.push({ name: step.character, emotion: step.emotion });
      } else if (step.type === 'hide') {
        newChars = newChars.filter(c => c.name !== step.character);
      } else if (step.type === 'dialogue') {
        setBg(newBg);
        setCharacters(newChars);
        setDialogue({ speaker: step.speaker, text: step.text });
        setCurrentIndex(nextIdx);
        return;
      } else if (step.type === 'end') {
        setBg(newBg);
        setCharacters(newChars);
        setDialogue(null);
        setIsEnded(true);
        setCurrentIndex(nextIdx);
        return;
      }
      nextIdx++;
    }
  };

  const handleNext = () => {
    if (!isEnded) {
      advance(steps, currentIndex, bg, characters);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !novel) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
        <h2 className="text-2xl font-bold mb-4">{error || "Something went wrong"}</h2>
        <button 
          onClick={() => window.history.back()}
          className="px-6 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-screen bg-black overflow-hidden flex flex-col cursor-pointer select-none"
      onClick={handleNext}
    >
      {/* Top Bar */}
      <div className="absolute top-0 left-0 w-full p-4 z-50 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <button 
          onClick={(e) => { e.stopPropagation(); window.history.back(); }}
          className="p-2 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-md transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-white/80 font-bold text-lg drop-shadow-md">{novel.title}</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000"
        style={{ backgroundImage: `url(https://picsum.photos/seed/${bg}/1920/1080?blur=2)` }}
      />
      
      {/* Characters */}
      <div className="absolute inset-0 flex items-end justify-center gap-4 md:gap-12 pb-48 px-4 md:px-10">
        <AnimatePresence>
          {characters.map(char => (
            <motion.div
              key={char.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex flex-col items-center"
            >
              <div className="w-48 h-72 md:w-64 md:h-96 bg-white/10 backdrop-blur-md border border-white/20 rounded-t-3xl flex flex-col items-center justify-center shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <img 
                  src={`https://api.dicebear.com/9.x/adventurer/svg?seed=${char.name}&backgroundColor=transparent`} 
                  alt={char.name} 
                  className={`w-40 h-40 md:w-56 md:h-56 z-10 transition-transform duration-300 ${char.emotion === 'surprised' ? 'scale-110' : ''}`} 
                />
                <span className="absolute bottom-4 text-white font-bold tracking-widest uppercase z-10 text-sm md:text-base">{char.name}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Dialogue Box */}
      {dialogue && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-40">
          <motion.div 
            key={currentIndex} // Force re-animation on new dialogue
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/80 backdrop-blur-md border border-white/20 rounded-2xl p-6 md:p-8 shadow-2xl relative"
          >
            {dialogue.speaker && (
              <div className="absolute -top-5 left-6 md:left-8 bg-indigo-600 text-white px-4 md:px-6 py-1.5 md:py-2 rounded-lg font-bold text-base md:text-lg shadow-lg border border-indigo-400">
                {dialogue.speaker}
              </div>
            )}
            <p className="text-white text-xl md:text-2xl leading-relaxed mt-3 md:mt-2 font-medium min-h-[3rem]">
              {dialogue.text}
            </p>
            <div className="absolute bottom-4 right-6 animate-bounce text-white/50">
              ▼
            </div>
          </motion.div>
        </div>
      )}

      {/* End Screen */}
      {isEnded && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <h2 className="text-5xl font-extrabold text-white mb-8 tracking-tight">The End</h2>
            <button 
              onClick={(e) => { e.stopPropagation(); window.history.back(); }}
              className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors text-lg shadow-xl"
            >
              Return to Gallery
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
