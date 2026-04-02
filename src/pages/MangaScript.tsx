import React, { useState, useCallback } from 'react';
import { BookOpen, Send, Sparkles, Loader2, CheckCircle2, AlertCircle, Download, FileJson, FileText, Settings, Cpu, Layers, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateMangaScript } from '../services/geminiService';
import Console, { LogEntry } from '../components/ui/Console';

export default function MangaScript() {
  const [title, setTitle] = useState('New Manga Project');
  const [sourceMaterial, setSourceMaterial] = useState('');
  const [category, setCategory] = useState('A');
  const [tier, setTier] = useState('medium');
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [routingInfo, setRoutingInfo] = useState<any>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    const id = Math.random().toString(36).substr(2, 9);
    setLogs(prev => [...prev, { id, timestamp, message, type }]);
  }, []);

  const handleGenerate = async () => {
    if (!sourceMaterial) return;
    
    setStatus('processing');
    setProgress(10);
    setLogs([]);
    const currentJobId = 'job_' + Math.random().toString(36).substr(2, 9);
    setJobId(currentJobId);
    
    addLog(`Initializing MangaScript Studio Workspace...`, 'system');
    addLog(`Job ID assigned: ${currentJobId}`, 'info');
    addLog(`Source material detected: ${sourceMaterial.length} characters`, 'info');
    
    try {
      addLog(`Contacting DGLab Routing Engine (Category: ${category}, Tier: ${tier})...`, 'info');
      
      // 1. Call backend routing engine
      const routeResponse = await fetch('/api/mangascript/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, tier })
      });
      
      const contentType = routeResponse.headers.get('content-type');
      if (!routeResponse.ok) {
        let errorMsg = 'Routing engine failed';
        if (contentType && contentType.includes('application/json')) {
          const errorData = await routeResponse.json();
          errorMsg = errorData.error || errorMsg;
        } else {
          const text = await routeResponse.text();
          errorMsg = text.substring(0, 100) || errorMsg;
        }
        throw new Error(errorMsg);
      }

      if (!contentType || !contentType.includes('application/json')) {
        const text = await routeResponse.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
      }

      const routeData = await routeResponse.json();
      setRoutingInfo(routeData.routing);
      setProgress(30);
      
      addLog(`Routing decision: ${routeData.routing.model.provider} / ${routeData.routing.model.id}`, 'success');
      addLog(`Provider Tier: ${routeData.routing.category.name} (Tier ${routeData.routing.category.tier})`, 'info');

      // 2. Execute generation (using Gemini if routed to Google)
      if (routeData.routing.model.provider === 'google') {
        addLog(`Initiating generation with ${routeData.routing.model.id}...`, 'info');
        addLog(`Applying system instructions for manga script formatting...`, 'info');
        
        const script = await generateMangaScript(title, sourceMaterial, routeData.routing.model.id);
        setGeneratedScript(script || null);
        
        addLog(`Generation successful. Received ${script?.length} characters of script data.`, 'success');
      } else {
        addLog(`Routing to non-Google provider: ${routeData.routing.model.provider}`, 'warning');
        addLog(`Simulation mode active for this provider...`, 'info');
        await new Promise(r => setTimeout(r, 2000));
        setGeneratedScript("Script generation for non-Google providers is currently handled by the backend routing engine simulation.");
        addLog(`Simulation complete.`, 'success');
      }

      addLog(`Finalizing workspace state...`, 'info');
      setProgress(100);
      setStatus('completed');
      addLog(`Process completed successfully.`, 'system');
    } catch (error) {
      console.error("Generation failed:", error);
      addLog(`CRITICAL ERROR: ${error instanceof Error ? error.message : String(error)}`, 'error');
      setStatus('failed');
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col">
      {/* Workspace Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-4">
          <div className="bg-purple-600 p-2 rounded-lg shadow-lg shadow-purple-500/20">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">MangaScript Studio</h1>
            <div className="flex items-center space-x-2 text-xs text-gray-400 font-medium uppercase tracking-wider">
              <span className="text-purple-400">Phase 1: Core</span>
              <span>\</span>
              <span>AI Routing Engine v2.0</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400" title="Settings">
            <Settings size={20} />
          </button>
          <div className="h-6 w-px bg-gray-700 mx-2"></div>
          <button 
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-lg shadow-purple-500/20 transition-all flex items-center space-x-2 disabled:opacity-50"
            onClick={handleGenerate}
            disabled={status === 'processing' || !sourceMaterial}
          >
            {status === 'processing' ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            <span>{status === 'processing' ? 'Generating...' : 'Generate Script'}</span>
          </button>
        </div>
      </header>

      <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
        {/* Left Panel: Input */}
        <section className="w-full md:w-1/2 p-6 border-r border-gray-800 overflow-y-auto custom-scrollbar">
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Project Configuration</label>
                <span className="text-[10px] bg-gray-800 px-2 py-1 rounded border border-gray-700 text-gray-500 font-mono uppercase">Auto-save: ON</span>
              </div>
              
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase">Project Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl p-4 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all text-lg font-bold"
                  placeholder="Enter project title..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase flex items-center">
                    <Cpu size={12} className="mr-1" /> AI Provider
                  </label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 focus:border-purple-500 outline-none appearance-none cursor-pointer"
                  >
                    <option value="A">Enterprise Cloud (A)</option>
                    <option value="B">Open Model (B)</option>
                    <option value="D">Regional Cloud (D)</option>
                    <option value="E">Local Host (E)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase flex items-center">
                    <Layers size={12} className="mr-1" /> Context Tier
                  </label>
                  <select 
                    value={tier}
                    onChange={(e) => setTier(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 focus:border-purple-500 outline-none appearance-none cursor-pointer"
                  >
                    <option value="short">Short (Scenes)</option>
                    <option value="medium">Medium (Chapters)</option>
                    <option value="long">Long (Short Stories)</option>
                    <option value="massive">Massive (Full Novels)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest">Source Material</label>
              <div className="relative">
                <textarea 
                  value={sourceMaterial}
                  onChange={(e) => setSourceMaterial(e.target.value)}
                  rows={15}
                  className="w-full bg-gray-800 border border-gray-700 rounded-2xl p-6 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all resize-none font-serif text-lg leading-relaxed text-gray-300 shadow-inner"
                  placeholder="Paste your novel content or story here..."
                ></textarea>
                <div className="absolute bottom-4 right-4 text-[10px] text-gray-600 font-mono uppercase">
                  Characters: {sourceMaterial.length} | Words: {sourceMaterial.split(/\s+/).filter(Boolean).length}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Panel: Preview/Output */}
        <section className="w-full md:w-1/2 bg-gray-950 p-6 overflow-y-auto custom-scrollbar relative">
          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div 
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center space-y-6"
              >
                <div className="w-24 h-24 bg-gray-900 rounded-3xl flex items-center justify-center border border-gray-800 shadow-2xl">
                  <BookOpen size={48} className="text-gray-700" />
                </div>
                <div className="max-w-xs space-y-2">
                  <h3 className="text-xl font-bold text-gray-400">Ready to Transform</h3>
                  <p className="text-sm text-gray-600">Configure your project and click "Generate Script" to begin the AI-powered conversion process.</p>
                </div>
              </motion.div>
            )}

            {status === 'processing' && (
              <motion.div 
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col space-y-6"
              >
                <div className="flex flex-col items-center justify-center space-y-6 py-8">
                  <div className="relative">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                      className="w-32 h-32 rounded-full border-4 border-purple-500/20 border-t-purple-500"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-purple-400">{progress}%</span>
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold text-white">
                      {progress < 30 ? 'Routing request...' : 'Generating script...'}
                    </h3>
                    <p className="text-sm text-gray-500 font-mono">Job ID: {jobId}</p>
                  </div>
                  <div className="w-64 bg-gray-900 rounded-full h-1.5 overflow-hidden">
                    <motion.div 
                      className="bg-purple-500 h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="flex-grow">
                  <Console logs={logs} title="MangaScript Generation Stream" maxHeight="400px" />
                </div>
              </motion.div>
            )}

            {status === 'completed' && (
              <motion.div 
                key="completed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full flex flex-col space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-green-400">
                    <CheckCircle2 size={20} />
                    <span className="font-bold uppercase tracking-widest text-sm">Generation Complete</span>
                  </div>
                  <div className="flex space-x-2">
                    <span className="text-[10px] bg-gray-800 px-2 py-1 rounded border border-gray-700 text-gray-400 font-mono uppercase">
                      {routingInfo?.model.id}
                    </span>
                    <button className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300" title="Download PDF">
                      <FileText size={18} />
                    </button>
                    <button className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-gray-300" title="Export JSON">
                      <FileJson size={18} />
                    </button>
                  </div>
                </div>

                <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 font-mono text-sm text-gray-300 shadow-2xl flex-grow overflow-y-auto custom-scrollbar whitespace-pre-wrap leading-relaxed">
                  {generatedScript}
                </div>

                <div className="h-48 flex-shrink-0">
                  <Console logs={logs} title="Process Log History" maxHeight="150px" />
                </div>
              </motion.div>
            )}

            {status === 'failed' && (
              <motion.div 
                key="failed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center space-y-6"
              >
                <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center border border-red-500/30">
                  <AlertCircle size={40} className="text-red-500" />
                </div>
                <div className="max-w-xs space-y-2">
                  <h3 className="text-xl font-bold text-red-400">Generation Failed</h3>
                  <p className="text-sm text-gray-500">The AI provider returned an error. This might be due to rate limiting or context length issues.</p>
                </div>
                <button 
                  onClick={() => setStatus('idle')}
                  className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-bold transition-colors"
                >
                  Reset Workspace
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
