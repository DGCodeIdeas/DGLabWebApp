import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, Play, Save, Code, Image as ImageIcon, Music, MessageSquare, Download, Loader2, ArrowLeft, Globe, Lock, X, Sparkles, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useFirebase } from '../components/FirebaseProvider';
import { pullSingleFromServer, getLocalNovel, saveLocalNovel } from '../lib/db';

export default function VisualNovelEditor() {
  const { user } = useFirebase();
  const [novelId, setNovelId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [script, setScript] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [originalNovel, setOriginalNovel] = useState<any>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // AI Assistant State
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [unfilteredMode, setUnfilteredMode] = useState(false);
  const [assistantResult, setAssistantResult] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/\/services\/visual-novels\/(.+)/);
    if (match && match[1]) {
      setNovelId(match[1]);
      loadNovel(match[1]);
    }
  }, []);

  const loadNovel = async (id: string) => {
    try {
      await pullSingleFromServer(id);
      const data = await getLocalNovel(id);
      if (data) {
        setOriginalNovel(data);
        setTitle(data.title || '');
        setDescription(data.description || '');
        setScript(data.script || '');
        setIsPublic(data.isPublic || false);
      } else {
        alert("Visual Novel not found!");
        window.location.hash = '#/services/visual-novels';
      }
    } catch (error) {
      console.error("Error loading novel:", error);
      alert("Failed to load visual novel.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!novelId || !user || !originalNovel) return;
    setIsSaving(true);
    try {
      const updatedNovel = {
        ...originalNovel,
        title,
        description,
        script,
        isPublic,
        updatedAt: new Date().toISOString()
      };
      await saveLocalNovel(updatedNovel);
      setOriginalNovel(updatedNovel);
    } catch (error) {
      console.error("Error saving novel:", error);
      alert("Failed to save visual novel.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!assistantPrompt.trim()) return;
    setIsGenerating(true);
    setAssistantResult('');
    try {
      const res = await fetch('/api/visual-novel/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: assistantPrompt,
          context: script.slice(-2000), // Send last 2000 chars as context
          unfiltered: unfilteredMode
        })
      });
      const data = await res.json();
      if (data.success) {
        setAssistantResult(data.script);
      } else {
        setAssistantResult(`Error: ${data.error}`);
      }
    } catch (err) {
      setAssistantResult('Failed to connect to AI Assistant.');
    } finally {
      setIsGenerating(false);
    }
  };

  const insertGeneratedScript = () => {
    setScript(prev => prev + (prev.endsWith('\n') ? '' : '\n') + assistantResult);
    setAssistantResult('');
    setIsAssistantOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-6 px-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <a href="#/services/visual-novels" className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <ArrowLeft size={24} />
            </a>
            <div>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)}
                className="text-2xl md:text-3xl font-bold mb-1 tracking-tight bg-transparent border-b border-transparent hover:border-white/50 focus:border-white focus:outline-none transition-colors"
                placeholder="Untitled Visual Novel"
              />
              <div className="flex items-center space-x-2 text-indigo-100 text-sm">
                <button 
                  onClick={() => setIsPublic(!isPublic)}
                  className="flex items-center space-x-1 hover:text-white transition-colors"
                >
                  {isPublic ? <Globe size={14} /> : <Lock size={14} />}
                  <span>{isPublic ? 'Public' : 'Private'}</span>
                </button>
              </div>
            </div>
          </div>
          <div className="flex space-x-3">
            <a 
              href={`#/visual-novels/play/${novelId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 bg-white text-indigo-600 font-bold rounded-xl shadow-md hover:bg-indigo-50 transition-all flex items-center space-x-2"
            >
              <Play size={18} />
              <span>Play</span>
            </a>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-indigo-500 text-white font-bold rounded-xl shadow-md hover:bg-indigo-400 transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 w-full grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Assets & Tools */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <Code size={20} className="text-indigo-600" />
              <span>Project Assets</span>
            </h2>
            <div className="space-y-2">
              {[
                { name: 'Characters', icon: MessageSquare, count: 0 },
                { name: 'Backgrounds', icon: ImageIcon, count: 0 },
                { name: 'Music & SFX', icon: Music, count: 0 },
              ].map((asset) => (
                <button key={asset.name} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-indigo-50 transition-colors group">
                  <div className="flex items-center space-x-3 text-gray-700 group-hover:text-indigo-600">
                    <asset.icon size={18} />
                    <span className="font-medium">{asset.name}</span>
                  </div>
                  <span className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-full group-hover:bg-indigo-100 group-hover:text-indigo-600">
                    {asset.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <Download size={20} className="text-indigo-600" />
              <span>Quick Actions</span>
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <button className="p-4 bg-gray-50 rounded-xl hover:bg-indigo-50 transition-colors flex flex-col items-center justify-center space-y-2 border border-transparent hover:border-indigo-100">
                <ImageIcon size={20} className="text-indigo-600" />
                <span className="text-xs font-bold text-gray-600">Add BG</span>
              </button>
              <button className="p-4 bg-gray-50 rounded-xl hover:bg-indigo-50 transition-colors flex flex-col items-center justify-center space-y-2 border border-transparent hover:border-indigo-100">
                <MessageSquare size={20} className="text-indigo-600" />
                <span className="text-xs font-bold text-gray-600">Add Char</span>
              </button>
            </div>
          </div>
        </div>

        {/* Editor Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px]">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex space-x-1">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <span className="text-sm font-mono text-gray-500">main.rpy</span>
              </div>
              <div className="flex items-center space-x-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <span>Ren'Py Script</span>
              </div>
            </div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="flex-grow p-8 font-mono text-sm text-gray-800 bg-white resize-none focus:outline-none leading-relaxed"
              spellCheck={false}
              placeholder="label start:\n    'Hello, world!'\n    return"
            />
          </div>

          <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white/10 p-3 rounded-xl">
                <Code size={24} className="text-indigo-300" />
              </div>
              <div>
                <h3 className="font-bold text-lg">AI Script Assistant</h3>
                <p className="text-indigo-200 text-sm">Let AI help you write dialogue and branch choices.</p>
              </div>
            </div>
            <button 
              onClick={() => setIsAssistantOpen(true)}
              className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl transition-all shadow-lg"
            >
              Open Assistant
            </button>
          </div>
        </div>
      </div>

      {/* AI Assistant Modal */}
      <AnimatePresence>
        {isAssistantOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-50">
                <div className="flex items-center space-x-3">
                  <div className="bg-indigo-600 p-2 rounded-lg">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">AI Script Assistant</h2>
                </div>
                <button onClick={() => setIsAssistantOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 flex-grow overflow-y-auto space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">What happens next?</label>
                  <textarea
                    value={assistantPrompt}
                    onChange={(e) => setAssistantPrompt(e.target.value)}
                    placeholder="e.g. Aiko gets angry and storms out of the classroom..."
                    className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none h-24"
                  />
                </div>

                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center space-x-3">
                    {unfilteredMode ? (
                      <ShieldAlert size={20} className="text-amber-500" />
                    ) : (
                      <ShieldCheck size={20} className="text-green-500" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {unfilteredMode ? 'Unfiltered Mode' : 'Filtered Mode'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {unfilteredMode 
                          ? 'Safety filters disabled. May generate mature content.' 
                          : 'Standard safety filters applied.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setUnfilteredMode(!unfilteredMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${unfilteredMode ? 'bg-amber-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${unfilteredMode ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {assistantResult && (
                  <div className="mt-4">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Generated Script:</label>
                    <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
                      <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                        {assistantResult}
                      </pre>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button 
                        onClick={insertGeneratedScript}
                        className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Insert into Script
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
                <button 
                  onClick={() => setIsAssistantOpen(false)}
                  className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleGenerateScript}
                  disabled={isGenerating || !assistantPrompt.trim()}
                  className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  <span>{isGenerating ? 'Generating...' : 'Generate'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
