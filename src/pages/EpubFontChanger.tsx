import React, { useState, useCallback } from 'react';
import { Type, Upload, FileText, Trash2, Wand2, Download, AlertTriangle, CheckCircle2, Search, Info, Settings, Zap, Terminal, Replace } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Console, { LogEntry } from '../components/ui/Console';

const fonts = [
  { id: 'original', name: 'Keep Original Font', description: 'Do not change the font, only apply text replacements.' },
  { id: 'merriweather', name: 'Merriweather', description: 'Elegant serif font for screens.' },
  { id: 'opendyslexic', name: 'OpenDyslexic', description: 'Designed to increase readability for dyslexia.' },
  { id: 'fira-sans', name: 'Fira Sans', description: 'Modern sans-serif with excellent legibility.' },
  { id: 'roboto', name: 'Roboto', description: "Google's signature Material Design font." },
  { id: 'lato', name: 'Lato', description: 'A friendly and balanced sans-serif typeface.' },
  { id: 'montserrat', name: 'Montserrat', description: 'Geometric sans-serif with wide utility.' },
  { id: 'playfair', name: 'Playfair Display', description: 'High-contrast serif, great for headings.' },
  { id: 'Open Sans', name: 'Open Sans', description: 'Classic Google sans-serif.' },
  { id: 'Roboto Mono', name: 'Roboto Mono', description: 'Clean monospace font.' },
  { id: 'Ubuntu', name: 'Ubuntu', description: 'Modern and distinctive sans-serif.' },
  { id: 'Poppins', name: 'Poppins', description: 'Geometric sans-serif with a friendly feel.' },
];

export default function EpubFontChanger() {
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; size: number; raw?: File }[]>([]);
  const [selectedFont, setSelectedFont] = useState("merriweather");
  const [customFont, setCustomFont] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [fontSearch, setFontSearch] = useState("");
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<{ originalName: string; downloadUrl: string; filename: string; modifiedCount?: number; textReplacedCount?: number; offlineSupport?: boolean }[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    const id = Math.random().toString(36).substr(2, 9);
    setLogs(prev => [...prev, { id, timestamp, message, type }]);
  }, []);

  const filteredFonts = fonts.filter(f => 
    f.name.toLowerCase().includes(fontSearch.toLowerCase()) || 
    f.description.toLowerCase().includes(fontSearch.toLowerCase())
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files).map((file: File) => ({
        name: file.name,
        size: file.size,
        raw: file
      }));
      setSelectedFiles(prev => [...prev, ...newFiles]);
      setStatus('idle');
      setLogs([]);
      setMatchCount(null);
      setResults([]);
    }
  };

  const handleFindAll = async () => {
    if (selectedFiles.length === 0 || !findText) return;

    setIsSearching(true);
    setMatchCount(null);
    addLog(`Searching ${selectedFiles.length} EPUB(s) for "${findText}"...`, 'info');

    try {
      let totalMatchCount = 0;
      for (const fileObj of selectedFiles) {
        if (!fileObj.raw) continue;
        const formData = new FormData();
        formData.append('file', fileObj.raw);
        formData.append('findText', findText);
        formData.append('useRegex', String(useRegex));
        formData.append('caseSensitive', String(caseSensitive));
        formData.append('wholeWord', String(wholeWord));

        const response = await fetch('/api/epub/search', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) throw new Error(`Search failed for ${fileObj.name}`);

        const data = await response.json();
        totalMatchCount += data.matchCount;
      }
      setMatchCount(totalMatchCount);
      addLog(`Found ${totalMatchCount} occurrences across all selected EPUBs.`, 'success');
    } catch (error) {
      addLog(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return;

    setStatus('processing');
    setProgress(0);
    setLogs([]);
    setResults([]);

    const finalFont = customFont || selectedFont;

    addLog(`Initializing EPUB Transformation Engine for ${selectedFiles.length} file(s)...`, 'system');
    addLog(`Selected Font: ${finalFont}`, 'info');
    if (findText) {
      addLog(`Find & Replace active: "${findText}" -> "${replaceText}"`, 'warning');
    }

    const newResults = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const fileObj = selectedFiles[i];
      if (!fileObj.raw) continue;

      try {
        addLog(`[${i + 1}/${selectedFiles.length}] Analyzing EPUB structure for ${fileObj.name}...`, 'info');
        await new Promise(resolve => setTimeout(resolve, 400));
        
        addLog(`[${i + 1}/${selectedFiles.length}] Extracting internal XHTML and CSS assets...`, 'info');
        await new Promise(resolve => setTimeout(resolve, 400));
        
        if (finalFont !== 'original') {
          addLog(`[${i + 1}/${selectedFiles.length}] Preparing to inject font: ${finalFont}...`, 'info');
          await new Promise(resolve => setTimeout(resolve, 400));
        }
        
        if (findText) {
          addLog(`[${i + 1}/${selectedFiles.length}] Compiling search patterns for text replacement...`, 'info');
          await new Promise(resolve => setTimeout(resolve, 400));
        }

        addLog(`[${i + 1}/${selectedFiles.length}] Uploading and executing server-side transformations...`, 'system');

        const formData = new FormData();
        formData.append('file', fileObj.raw);
        formData.append('font', finalFont);
        formData.append('findText', findText);
        formData.append('replaceText', replaceText);
        formData.append('useRegex', String(useRegex));
        formData.append('caseSensitive', String(caseSensitive));
        formData.append('wholeWord', String(wholeWord));

        const response = await fetch('/api/epub/transform', {
          method: 'POST',
          body: formData
        });

        addLog(`[${i + 1}/${selectedFiles.length}] Server processing complete. Parsing results...`, 'info');

        const contentType = response.headers.get('content-type');
        if (!response.ok) {
          let errorMsg = `Failed to process ${fileObj.name}`;
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg;
          } else {
            const text = await response.text();
            errorMsg = text.substring(0, 100) || errorMsg;
          }
          throw new Error(errorMsg);
        }

        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          throw new Error(`Server returned non-JSON response for ${fileObj.name}: ${text.substring(0, 100)}`);
        }

        const data = await response.json();
        
        addLog(`[${i + 1}/${selectedFiles.length}] Success: ${data.modifiedCount} files modified.`, 'success');
        
        newResults.push({
          originalName: fileObj.name,
          downloadUrl: data.downloadUrl,
          filename: data.filename,
          modifiedCount: data.modifiedCount,
          textReplacedCount: data.textReplacedCount,
          offlineSupport: data.offlineSupport
        });
        
        setProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      } catch (error) {
        console.error(`Transformation failed for ${fileObj.name}:`, error);
        const msg = error instanceof Error ? error.message : "An unknown error occurred";
        addLog(`ERROR on ${fileObj.name}: ${msg}`, 'error');
      }
    }

    setResults(newResults);
    if (newResults.length > 0) {
      setStatus('success');
      addLog(`Process completed. Successfully transformed ${newResults.length}/${selectedFiles.length} files.`, 'system');
    } else {
      setStatus('error');
      setErrorMessage("All files failed to process.");
    }
  };

  const getButtonText = () => {
    if (status === 'processing') return 'Processing...';
    
    const isOriginal = selectedFont === 'original' && !customFont;
    const hasFindText = findText.trim().length > 0;
    const fileCount = selectedFiles.length;
    const epubText = fileCount > 1 ? `${fileCount} EPUBs` : 'EPUB';

    if (isOriginal && hasFindText) {
      return `Replace All in ${epubText}`;
    } else if (!isOriginal && hasFindText) {
      return `Change Font & Replace Text in ${epubText}`;
    } else if (!isOriginal && !hasFindText) {
      return `Change Font in ${epubText}`;
    } else {
      return `Repackage ${epubText} (No Changes)`;
    }
  };

  return (
    <div className="py-12 bg-gray-50 flex-grow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap -mx-4">
          {/* Main Content */}
          <div className="w-full lg:w-2/3 px-4 mb-8">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
              <div className="p-8">
                <div className="flex items-center space-x-4 mb-8">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                    <Type size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">EPUB Font Changer</h2>
                    <p className="text-gray-500">Personalize your reading experience by changing fonts.</p>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">
                      1. Upload EPUB Files
                    </label>
                    
                    {selectedFiles.length === 0 ? (
                      <div 
                        className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group"
                        onClick={() => document.getElementById('file-input')?.click()}
                      >
                        <Upload size={48} className="mx-auto text-gray-300 group-hover:text-blue-400 mb-4 transition-colors" />
                        <p className="text-gray-600 font-medium">Click to upload or drag and drop</p>
                        <p className="text-xs text-gray-400 mt-2 uppercase tracking-widest">Maximum file size: 100MB (EPUB only)</p>
                        <input 
                          type="file" 
                          id="file-input" 
                          className="hidden" 
                          accept=".epub" 
                          multiple
                          onChange={handleFileChange} 
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedFiles.map((file, idx) => (
                          <div key={idx} className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="p-2 bg-blue-500 text-white rounded-lg shadow-md">
                                <FileText size={20} />
                              </div>
                              <div>
                                <div className="font-bold text-gray-900 text-sm">{file.name}</div>
                                <div className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </div>
                              </div>
                            </div>
                            <button 
                              className="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-colors"
                              onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                        <div 
                          className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group"
                          onClick={() => document.getElementById('file-input-more')?.click()}
                        >
                          <p className="text-sm font-bold text-gray-500 group-hover:text-blue-500">+ Add More EPUBs</p>
                          <input 
                            type="file" 
                            id="file-input-more" 
                            className="hidden" 
                            accept=".epub" 
                            multiple
                            onChange={handleFileChange} 
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Font Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">
                        2. Select Target Font
                      </label>
                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="Search fonts..."
                          className="pl-8 pr-4 py-1.5 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          value={fontSearch}
                          onChange={(e) => setFontSearch(e.target.value)}
                        />
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-80 overflow-y-auto p-1 custom-scrollbar mb-4">
                      {filteredFonts.map((font) => (
                        <div 
                          key={font.id}
                          className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col ${
                            selectedFont === font.id && !customFont
                              ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-50' 
                              : 'border-gray-100 hover:border-gray-200 bg-white'
                          }`}
                          onClick={() => {
                            setSelectedFont(font.id);
                            setCustomFont("");
                          }}
                        >
                          <div className={`font-bold text-lg mb-1 ${selectedFont === font.id && !customFont ? 'text-blue-700' : 'text-gray-900'}`}>
                            {font.name}
                          </div>
                          <div className="text-sm text-gray-500 leading-relaxed">{font.description}</div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Or Use Custom Google Font</label>
                      <input 
                        type="text" 
                        placeholder="Enter Google Font Name (e.g. 'Bebas Neue')"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        value={customFont}
                        onChange={(e) => setCustomFont(e.target.value)}
                      />
                      <p className="text-[10px] text-gray-400 mt-2">Enter the exact name from fonts.google.com</p>
                    </div>
                  </div>

                  {/* Find and Replace */}
                  <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100/50">
                    <div className="flex items-center space-x-2 mb-4">
                      <Replace size={18} className="text-blue-600" />
                      <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">
                        3. Find and Replace (Optional)
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase">Find Text</label>
                        <input 
                          type="text" 
                          placeholder="Text to find..."
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                          value={findText}
                          onChange={(e) => setFindText(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase">Replace With</label>
                        <input 
                          type="text" 
                          placeholder="Replacement text..."
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                          value={replaceText}
                          onChange={(e) => setReplaceText(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center space-x-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={useRegex} 
                          onChange={(e) => setUseRegex(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold text-gray-600 uppercase group-hover:text-blue-600 transition-colors">Use Regex</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={caseSensitive} 
                          onChange={(e) => setCaseSensitive(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold text-gray-600 uppercase group-hover:text-blue-600 transition-colors">Case Sensitive</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={wholeWord} 
                          onChange={(e) => setWholeWord(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-xs font-bold text-gray-600 uppercase group-hover:text-blue-600 transition-colors">Whole Word</span>
                      </label>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <button 
                        onClick={handleFindAll}
                        disabled={selectedFiles.length === 0 || !findText || isSearching}
                        className="px-4 py-2 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 text-xs font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {isSearching ? (
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Search size={14} />
                        )}
                        <span>Find All in EPUB</span>
                      </button>
                      
                      {matchCount !== null && (
                        <div className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg">
                          {matchCount} match{matchCount !== 1 ? 'es' : ''} found
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <div className="pt-4">
                    <button 
                      className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 text-lg"
                      onClick={handleSubmit}
                      disabled={selectedFiles.length === 0 || status === 'processing'}
                    >
                      {status === 'processing' ? (
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        >
                          <Settings size={24} />
                        </motion.div>
                      ) : (
                        <Wand2 size={24} />
                      )}
                      <span>{getButtonText()}</span>
                    </button>
                  </div>

                  {/* Progress */}
                  <AnimatePresence>
                    {status === 'processing' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-6"
                      >
                        <div className="space-y-3">
                          <div className="flex justify-between text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-widest">
                            <span>Processing...</span>
                            <span className="text-blue-600">{progress}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner border border-gray-200">
                            <motion.div 
                              className="bg-blue-600 h-full rounded-full shadow-lg shadow-blue-200"
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                        </div>
                        
                        <Console logs={logs} title="EPUB Transformation Stream" maxHeight="200px" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Success */}
                  <AnimatePresence>
                    {status === 'success' && results.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-8 bg-green-50 border border-green-100 rounded-3xl text-center shadow-sm"
                      >
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                          <CheckCircle2 size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Transformation Complete!</h3>
                        <p className="text-gray-600 mb-6 max-w-md mx-auto">
                          Successfully processed {results.length} EPUB{results.length !== 1 ? 's' : ''}.
                        </p>
                        
                        <div className="space-y-3 mb-8">
                          {results.map((res, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-xl border border-green-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                              <div className="text-left">
                                <div className="font-bold text-gray-900 text-sm">{res.originalName}</div>
                                <div className="text-[10px] text-green-600 font-mono uppercase tracking-widest mt-1">
                                  Mods: {res.modifiedCount} | Rep: {res.textReplacedCount}
                                </div>
                              </div>
                              <a 
                                href={res.downloadUrl}
                                download={res.filename}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-all shadow-md shadow-green-200 flex items-center space-x-2 whitespace-nowrap"
                              >
                                <Download size={16} />
                                <span>Download</span>
                              </a>
                            </div>
                          ))}
                        </div>

                        <div className="max-w-xl mx-auto mb-8">
                          <Console logs={logs} title="Process Log History" maxHeight="150px" />
                        </div>
                        
                        <button 
                          onClick={() => {
                            setStatus('idle');
                            setSelectedFiles([]);
                            setResults([]);
                            setProgress(0);
                            setLogs([]);
                          }}
                          className="text-green-700 font-bold hover:text-green-800 underline underline-offset-4"
                        >
                          Process more files
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Error */}
                  <AnimatePresence>
                    {status === 'error' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-start space-x-4 text-red-700 shadow-sm"
                      >
                        <AlertTriangle size={24} className="flex-shrink-0 mt-1" />
                        <div>
                          <div className="font-bold text-lg">Processing Failed</div>
                          <div className="text-sm opacity-90">{errorMessage}</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-1/3 px-4">
            <div className="space-y-6 sticky top-24">
                    <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
                <h4 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                  <Info size={20} className="mr-2 text-blue-500" />
                  About This Service
                </h4>
                <p className="text-gray-600 text-sm leading-relaxed mb-6">
                  This tool allows you to change the fonts in your EPUB e-books. Perfect for improving readability or personalizing your reading experience.
                </p>
                <div className="bg-blue-50 p-4 rounded-xl mb-6">
                  <p className="text-xs text-blue-700 font-bold uppercase tracking-widest mb-2 flex items-center">
                    <Zap size={12} className="mr-1 fill-current" />
                    Pro Tip: Fixed Fonts
                  </p>
                  <p className="text-xs text-blue-600 leading-relaxed">
                    We use <strong>Deep Injection</strong> to override hardcoded "fixed" fonts in your EPUB by applying styles with <code>!important</code> priority.
                  </p>
                </div>
                <ul className="space-y-4">
                  {[
                    'Supports EPUB 2 and 3',
                    'Chunked upload support',
                    'Open source fonts only',
                    'Maintains original formatting'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center text-sm text-gray-700 font-medium">
                      <CheckCircle2 size={16} className="text-green-500 mr-3 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden group">
                <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                  <Type size={160} />
                </div>
                <h4 className="text-xl font-bold mb-4 relative z-10">Need Help?</h4>
                <p className="text-blue-100 text-sm mb-8 leading-relaxed relative z-10">
                  Check out our documentation for more information on how to use our tools and API.
                </p>
                <a 
                  href="#/docs" 
                  className="block w-full py-4 bg-white text-blue-600 text-center font-bold rounded-xl hover:bg-blue-50 transition-all relative z-10 shadow-lg"
                >
                  Read Documentation
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
