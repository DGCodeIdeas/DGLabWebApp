import React, { useState, useCallback } from 'react';
import { Type, Upload, FileText, Trash2, Wand2, Download, AlertTriangle, CheckCircle2, Search, Info, Settings, Zap, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Console, { LogEntry } from '../components/ui/Console';

const fonts = [
  { id: 'merriweather', name: 'Merriweather', description: 'Elegant serif font for screens.' },
  { id: 'opendyslexic', name: 'OpenDyslexic', description: 'Designed to increase readability for dyslexia.' },
  { id: 'fira-sans', name: 'Fira Sans', description: 'Modern sans-serif with excellent legibility.' },
  { id: 'roboto', name: 'Roboto', description: "Google's signature Material Design font." },
  { id: 'lato', name: 'Lato', description: 'A friendly and balanced sans-serif typeface.' },
  { id: 'montserrat', name: 'Montserrat', description: 'Geometric sans-serif with wide utility.' },
  { id: 'playfair', name: 'Playfair Display', description: 'High-contrast serif, great for headings.' },
];

export default function EpubFontChanger() {
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number; raw?: File } | null>(null);
  const [selectedFont, setSelectedFont] = useState("merriweather");
  const [fontSearch, setFontSearch] = useState("");
  const [result, setResult] = useState<{ downloadUrl: string; filename: string; modifiedCount?: number } | null>(null);
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
      const file = files[0];
      setSelectedFile({
        name: file.name,
        size: file.size,
        raw: file
      });
      setStatus('idle');
      setLogs([]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !selectedFile.raw) return;

    setStatus('processing');
    setProgress(10);
    setLogs([]);

    addLog(`Initializing EPUB Transformation Engine...`, 'system');
    addLog(`Target File: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)`, 'info');
    addLog(`Selected Font: ${selectedFont}`, 'info');

    try {
      addLog(`Preparing multipart/form-data payload...`, 'info');
      const formData = new FormData();
      formData.append('file', selectedFile.raw);
      formData.append('font', selectedFont);

      setProgress(30);
      addLog(`Uploading to DGLab Processing Node...`, 'info');

      const response = await fetch('/api/epub/transform', {
        method: 'POST',
        body: formData
      });

      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        let errorMsg = 'Failed to process EPUB';
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } else {
          const text = await response.text();
          errorMsg = text.substring(0, 100) || errorMsg;
        }
        throw new Error(errorMsg);
      }

      addLog(`Upload complete. Server-side processing initiated...`, 'success');
      addLog(`Executing Deep Injection algorithm...`, 'info');
      addLog(`Scanning internal CSS and XHTML structures...`, 'info');

      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      
      addLog(`Deep Injection successful: ${data.modifiedCount} files modified.`, 'success');
      addLog(`Re-packaging EPUB container...`, 'info');
      addLog(`Generating secure download link...`, 'info');

      setProgress(100);
      setResult({
        downloadUrl: data.downloadUrl,
        filename: data.filename,
        modifiedCount: data.modifiedCount
      });
      setStatus('success');
      addLog(`Process completed successfully.`, 'system');
    } catch (error) {
      console.error("Transformation failed:", error);
      const msg = error instanceof Error ? error.message : "An unknown error occurred";
      addLog(`CRITICAL ERROR: ${msg}`, 'error');
      setErrorMessage(msg);
      setStatus('error');
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
                      1. Upload EPUB File
                    </label>
                    
                    {!selectedFile ? (
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
                          onChange={handleFileChange} 
                        />
                      </div>
                    ) : (
                      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="p-3 bg-blue-500 text-white rounded-xl shadow-md">
                            <FileText size={24} />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900">{selectedFile.name}</div>
                            <div className="text-xs text-blue-600 font-semibold uppercase tracking-wider">
                              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                          </div>
                        </div>
                        <button 
                          className="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-colors"
                          onClick={() => setSelectedFile(null)}
                        >
                          <Trash2 size={20} />
                        </button>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-80 overflow-y-auto p-1 custom-scrollbar">
                      {filteredFonts.map((font) => (
                        <div 
                          key={font.id}
                          className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col ${
                            selectedFont === font.id 
                              ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-50' 
                              : 'border-gray-100 hover:border-gray-200 bg-white'
                          }`}
                          onClick={() => setSelectedFont(font.id)}
                        >
                          <div className={`font-bold text-lg mb-1 ${selectedFont === font.id ? 'text-blue-700' : 'text-gray-900'}`}>
                            {font.name}
                          </div>
                          <div className="text-sm text-gray-500 leading-relaxed">{font.description}</div>
                        </div>
                      ))}
                      {filteredFonts.length === 0 && (
                        <div className="col-span-2 py-12 text-center text-gray-400 italic">
                          No fonts found matching "{fontSearch}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <div className="pt-4">
                    <button 
                      className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 text-lg"
                      onClick={handleSubmit}
                      disabled={!selectedFile || status === 'processing'}
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
                      <span>{status === 'processing' ? 'Processing...' : 'Transform EPUB'}</span>
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
                          <div className="flex justify-between text-sm font-bold text-gray-700 uppercase tracking-widest">
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
                    {status === 'success' && result && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-8 bg-green-50 border border-green-100 rounded-3xl text-center shadow-sm"
                      >
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                          <CheckCircle2 size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Transformation Complete!</h3>
                        <p className="text-gray-600 mb-2 max-w-md mx-auto">
                          Your EPUB has been successfully updated with the {fonts.find(f => f.id === selectedFont)?.name} font.
                        </p>
                        <p className="text-xs text-blue-500 font-mono mb-8 uppercase tracking-widest">
                          Deep Injection: {result.modifiedCount} files modified
                        </p>
                        <a 
                          href={result.downloadUrl} 
                          download={result.filename}
                          className="inline-flex items-center space-x-3 px-10 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl shadow-lg shadow-green-200 transition-all transform hover:scale-105 mb-8"
                        >
                          <Download size={24} />
                          <span>Download EPUB</span>
                        </a>

                        <div className="max-w-xl mx-auto">
                          <Console logs={logs} title="Process Log History" maxHeight="150px" />
                        </div>
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
