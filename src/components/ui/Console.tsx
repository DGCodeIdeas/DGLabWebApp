import React, { useEffect, useRef } from 'react';
import { Terminal, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system';
}

interface ConsoleProps {
  logs: LogEntry[];
  title?: string;
  maxHeight?: string;
}

export default function Console({ logs, title = "System Console", maxHeight = "300px" }: ConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'system': return 'text-purple-400';
      default: return 'text-blue-400';
    }
  };

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      <div className="bg-gray-900 px-3 sm:px-4 py-2 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Terminal size={14} className="text-gray-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{title}</span>
        </div>
        <div className="flex space-x-1.5 hidden sm:flex">
          <div className="w-2 h-2 rounded-full bg-red-500/20 border border-red-500/40"></div>
          <div className="w-2 h-2 rounded-full bg-yellow-500/20 border border-yellow-500/40"></div>
          <div className="w-2 h-2 rounded-full bg-green-500/20 border border-green-500/40"></div>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="p-3 sm:p-4 font-mono text-[10px] sm:text-[11px] leading-relaxed overflow-y-auto custom-scrollbar"
        style={{ maxHeight }}
      >
        <AnimatePresence initial={false}>
          {logs.length === 0 ? (
            <div className="text-gray-600 italic">Waiting for process initialization...</div>
          ) : (
            logs.map((log) => (
              <motion.div 
                key={log.id}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start space-x-1.5 mb-1.5 group"
              >
                <ChevronRight size={12} className="mt-0.5 text-gray-700 flex-shrink-0" />
                <span className={`${getTypeColor(log.type)} break-words`}>
                  {log.message}
                </span>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        <div className="flex items-center space-x-1.5 mt-1.5">
          <ChevronRight size={12} className="text-gray-700 animate-pulse flex-shrink-0" />
          <span className="w-1.5 h-3 bg-blue-500/50 animate-pulse"></span>
        </div>
      </div>
    </div>
  );
}
