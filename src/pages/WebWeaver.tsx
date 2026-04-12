import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  Search, 
  BookOpen, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  RefreshCw,
  Settings,
  FileText,
  User,
  Type
} from 'lucide-react';
import { useFirebase } from '../components/FirebaseProvider';

interface Chapter {
  url: string;
  title: string;
  content?: string;
  status: 'discovered' | 'extracting' | 'extracted' | 'failed';
  order: number;
}

interface LogEntry {
  msg: string;
  type: 'info' | 'success' | 'error';
}

export default function WebWeaver() {
  const { user } = useFirebase();
  const [startUrl, setStartUrl] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isCrawling, setIsCrawling] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { msg, type }]);
  }, []);

  useEffect(() => {
    if (logsContainerRef.current) {
      const { scrollHeight, clientHeight } = logsContainerRef.current;
      logsContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: 'smooth'
      });
    }
  }, [logs]);

  const handleCrawl = () => {
    if (!startUrl) return;
    setIsCrawling(true);
    setLogs([]);
    setChapters([]);
    setDownloadUrl(null);
    addLog(`Starting crawl for: ${startUrl}`);
    
    const eventSource = new EventSource(`/api/webweaver/crawl-stream?startUrl=${encodeURIComponent(startUrl)}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        addLog(data.msg);
      } else if (data.type === 'result') {
        const discoveredChapters = data.chapters.map((ch: any, i: number) => ({
          ...ch,
          status: 'discovered',
          order: i
        }));
        setChapters(discoveredChapters);
        addLog(`Discovered ${discoveredChapters.length} chapters.`, 'success');
        
        if (!title && discoveredChapters.length > 0) {
          try {
            const domain = new URL(startUrl).hostname.replace('www.', '').split('.')[0];
            setTitle(`${domain.charAt(0).toUpperCase() + domain.slice(1)} Collection`);
          } catch (e) {
            setTitle("WebWeaver Collection");
          }
        }
        setIsCrawling(false);
        eventSource.close();
      } else if (data.type === 'error') {
        addLog(data.error, 'error');
        setIsCrawling(false);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      addLog("Connection lost or crawl failed.", 'error');
      setIsCrawling(false);
      eventSource.close();
    };
  };

  const handleExtract = async () => {
    if (chapters.length === 0) return;
    setIsExtracting(true);
    addLog(`Starting content extraction for ${chapters.length} chapters...`);
    
    const updatedChapters = [...chapters];
    
    for (let i = 0; i < updatedChapters.length; i++) {
      const ch = updatedChapters[i];
      if (ch.status === 'extracted') continue;

      updatedChapters[i] = { ...ch, status: 'extracting' };
      setChapters([...updatedChapters]);
      
      try {
        const res = await fetch('/api/webweaver/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: ch.url })
        });
        const data = await res.json();
        
        if (data.success) {
          updatedChapters[i] = { 
            ...ch, 
            status: 'extracted', 
            content: data.content,
            title: data.title || ch.title
          };
          addLog(`Extracted: ${updatedChapters[i].title}`, 'info');
        } else {
          updatedChapters[i] = { ...ch, status: 'failed' };
          addLog(`Failed to extract: ${ch.url}`, 'error');
        }
      } catch (e) {
        updatedChapters[i] = { ...ch, status: 'failed' };
        addLog(`Network error extracting: ${ch.url}`, 'error');
      }
      setChapters([...updatedChapters]);
    }
    
    setIsExtracting(false);
    addLog("Extraction complete.", 'success');
  };

  const handleBuild = async () => {
    if (!title || chapters.length === 0) return;
    setIsBuilding(true);
    addLog(`Building EPUB: ${title}...`);
    
    try {
      const extractedChapters = chapters.filter(ch => ch.status === 'extracted');
      if (extractedChapters.length === 0) {
        addLog("No extracted chapters to build EPUB from.", 'error');
        setIsBuilding(false);
        return;
      }

      const res = await fetch('/api/webweaver/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title, 
          author, 
          chapters: extractedChapters.map(ch => ({ title: ch.title, content: ch.content }))
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setDownloadUrl(data.downloadUrl);
        addLog("EPUB built successfully!", 'success');
      } else {
        addLog(data.error || "Build failed", 'error');
      }
    } catch (e) {
      addLog("Network error during build", 'error');
    } finally {
      setIsBuilding(false);
    }
  };

  const handleClear = () => {
    setStartUrl('');
    setTitle('');
    setAuthor('');
    setChapters([]);
    setDownloadUrl(null);
    setLogs([]);
  };

  if (!user) {
    return (
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="text-center">
          <Globe className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign in to use WebWeaver</h2>
          <p className="text-gray-600">You need to be logged in to crawl and build EPUBs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">WebWeaver</h1>
          <p className="text-lg text-gray-600">Weave scattered web threads into a coherent EPUB.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <Globe className="h-5 w-5" />
          </div>
          <span className="font-medium text-gray-700">Web Crawler & EPUB Generator</span>
          <button 
            onClick={handleClear}
            className="ml-4 p-2 text-gray-400 hover:text-red-500 transition-colors"
            title="Clear All"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Input & Controls */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              Start Crawling
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Starting URL</label>
                <input 
                  type="url" 
                  value={startUrl}
                  onChange={(e) => setStartUrl(e.target.value)}
                  placeholder="https://example.com/novel-index"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <button 
                onClick={handleCrawl}
                disabled={isCrawling || !startUrl}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
              >
                {isCrawling ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                {isCrawling ? 'Discovering...' : 'Discover Chapters'}
              </button>
            </div>
          </section>

          {chapters.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-600" />
                EPUB Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Book Title</label>
                  <div className="relative">
                    <Type className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="My Awesome Novel"
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                      type="text" 
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="John Doe"
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="pt-2 space-y-3">
                  <button 
                    onClick={handleExtract}
                    disabled={isExtracting || chapters.length === 0}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                  >
                    {isExtracting ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
                    Extract Content
                  </button>
                  <button 
                    onClick={handleBuild}
                    disabled={isBuilding || !title || !chapters.some(c => c.status === 'extracted')}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                  >
                    {isBuilding ? <Loader2 className="h-5 w-5 animate-spin" /> : <BookOpen className="h-5 w-5" />}
                    Build EPUB
                  </button>
                </div>
              </div>
            </section>
          )}

          {downloadUrl && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center"
            >
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-emerald-900 mb-2">EPUB Ready!</h3>
              <a 
                href={downloadUrl}
                download
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
              >
                <Download className="h-5 w-5" />
                Download EPUB
              </a>
            </motion.div>
          )}
        </div>

        {/* Middle/Right Column: Chapter List & Logs */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                Chapter List
                {chapters.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                    {chapters.length}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  Extracted
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  Discovered
                </div>
              </div>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-2">
              {chapters.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                  <Globe className="h-16 w-16 opacity-20" />
                  <p>Enter a URL to discover chapters</p>
                </div>
              ) : (
                <AnimatePresence>
                  {chapters.map((chapter, idx) => (
                    <motion.div 
                      key={chapter.url}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(idx * 0.05, 1) }}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        chapter.status === 'extracted' ? 'bg-emerald-50 border-emerald-100' : 
                        chapter.status === 'extracting' ? 'bg-blue-50 border-blue-100 animate-pulse' :
                        'bg-white border-gray-100 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-gray-400 w-6">{idx + 1}</span>
                        <div className="truncate">
                          <p className="font-medium text-gray-900 truncate">{chapter.title}</p>
                          <p className="text-xs text-gray-500 truncate">{chapter.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {chapter.status === 'extracted' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                        {chapter.status === 'extracting' && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
                        {chapter.status === 'failed' && <AlertCircle className="h-5 w-5 text-red-500" />}
                        {chapter.status === 'discovered' && <ChevronRight className="h-5 w-5 text-gray-300" />}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </section>

          {/* Logs Section */}
          <section className="bg-gray-900 rounded-2xl p-6 shadow-inner h-80 overflow-hidden flex flex-col">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">System Console</h3>
            <div 
              ref={logsContainerRef}
              className="flex-grow overflow-y-auto font-mono text-sm space-y-1 scrollbar-hide"
            >
              {logs.length === 0 ? (
                <p className="text-gray-700 italic">Waiting for activity...</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`flex gap-2 ${
                    log.type === 'success' ? 'text-emerald-400' : 
                    log.type === 'error' ? 'text-red-400' : 
                    'text-gray-300'
                  }`}>
                    <span className="text-gray-600">[{new Date().toLocaleTimeString([], {hour12: false})}]</span>
                    <span>{log.msg}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
