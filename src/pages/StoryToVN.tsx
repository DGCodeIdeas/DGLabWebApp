import React, { useState, useCallback, useEffect } from 'react';
import { BookOpen, Send, Sparkles, Loader2, CheckCircle2, AlertCircle, Download, FileJson, FileText, Settings, Cpu, Layers, Terminal, LogIn, LogOut, Replace, Search, Upload, ChevronRight, Check, X, Edit3, Eye, Cloud, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Console, { LogEntry } from '../components/ui/Console';
import { useFirebase } from '../components/FirebaseProvider';
import { auth, signOut, db } from '../firebase';
import { collection, doc, setDoc, getDocs, query, where, orderBy, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import LoginModal from '../components/ui/LoginModal';

type ViewState = 'upload' | 'parsing' | 'project_list' | 'project_view' | 'chapter_view';

interface Chapter {
  id?: string;
  projectId: string;
  title: string;
  type: string;
  order: number;
  content: string;
  scriptContent?: string;
  status: 'pending' | 'ai_processing' | 'human_proofread' | 'approved' | 'packing';
  entryName: string;
}

interface Project {
  id: string;
  userId: string;
  title: string;
  status: 'uploading' | 'parsing' | 'ready' | 'packing' | 'completed';
  createdAt: string;
  fileName: string;
  downloadUrl?: string;
  driveFileId?: string;
  driveLink?: string;
}

export default function StoryToVN() {
  const { user, loading, openLoginModal } = useFirebase();
  const [view, setView] = useState<ViewState>('project_list');
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
  // Proofreading state
  const [editedContent, setEditedContent] = useState('');
  
  // Find and Replace state
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [isParsingError, setIsParsingError] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);

  const checkDriveStatus = async () => {
    try {
      const tokens = localStorage.getItem('google_tokens');
      if (tokens) {
        setIsDriveConnected(true);
        return;
      }

      const res = await fetch('/api/auth/google/status', { 
        credentials: 'include',
        headers: tokens ? { 'X-Google-Tokens': tokens } : {}
      });
      const data = await res.json();
      setIsDriveConnected(data.connected);
    } catch (e) {
      console.error("Error checking drive status:", e);
    }
  };

  useEffect(() => {
    checkDriveStatus();
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        if (event.data.tokens) {
          localStorage.setItem('google_tokens', JSON.stringify(event.data.tokens));
        }
        checkDriveStatus();
        addLog("Google Drive connected successfully!", "success");
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectDrive = async () => {
    try {
      const res = await fetch('/api/auth/google/url', { credentials: 'include' });
      const { url } = await res.json();
      window.open(url, 'google_oauth', 'width=600,height=700');
    } catch (e) {
      addLog("Failed to get Google Auth URL", "error");
    }
  };

  const handleDisconnectDrive = async () => {
    try {
      localStorage.removeItem('google_tokens');
      await fetch('/api/auth/google/disconnect', { method: 'POST', credentials: 'include' });
      setIsDriveConnected(false);
      addLog("Google Drive disconnected", "warning");
    } catch (e) {
      addLog("Failed to disconnect Google Drive", "error");
    }
  };

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    const id = Math.random().toString(36).substr(2, 9);
    setLogs(prev => [...prev, { id, timestamp, message, type }]);
  }, []);

  const handleSignIn = () => {
    openLoginModal();
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const getSearchRegex = () => {
    let flags = 'g';
    if (!caseSensitive) flags += 'i';
    
    let searchPattern = findText;
    if (!useRegex) {
      searchPattern = searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    if (wholeWord) {
      searchPattern = `\\b${searchPattern}\\b`;
    }

    return new RegExp(searchPattern, flags);
  };

  const handleFindAll = () => {
    if (!editedContent || !findText) {
      setMatchCount(0);
      return;
    }
    try {
      const regex = getSearchRegex();
      const matches = [...editedContent.matchAll(regex)];
      setMatchCount(matches.length);
    } catch (e) {
      console.error("Find failed:", e);
    }
  };

  const handleReplaceAll = () => {
    if (!editedContent || !findText) return;
    try {
      const regex = getSearchRegex();
      const matches = [...editedContent.matchAll(regex)];
      const newContent = editedContent.replace(regex, replaceText);
      setEditedContent(newContent);
      setMatchCount(null);
      addLog(`Replaced ${matches.length} occurrences of "${findText}"`, 'warning');
    } catch (e) {
      console.error("Replace failed:", e);
    }
  };

  // Fetch projects
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'vn_projects'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projs: Project[] = [];
      snapshot.forEach((doc) => {
        projs.push({ id: doc.id, ...doc.data() } as Project);
      });
      // Sort by createdAt descending
      projs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setProjects(projs);
    }, (error) => {
      if (error.message.includes('Missing or insufficient permissions')) {
        console.warn("Projects listener permission denied (likely signing out).");
      } else {
        console.error("Error fetching projects:", error);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch chapters for current project
  useEffect(() => {
    if (!currentProject) return;
    const q = query(collection(db, `vn_projects/${currentProject.id}/chapters`), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chaps: Chapter[] = [];
      snapshot.forEach((doc) => {
        chaps.push({ id: doc.id, ...doc.data() } as Chapter);
      });
      setChapters(chaps);
    }, (error) => {
      if (error.message.includes('Missing or insufficient permissions')) {
        console.warn("Chapters listener permission denied (likely signing out).");
      } else {
        console.error("Error fetching chapters:", error);
      }
    });
    return () => unsubscribe();
  }, [currentProject]);

  const processFile = async (file: File) => {
    if (!user) return;
    
    setUploadFile(file);
    setView('parsing');
    setIsParsingError(false);
    setLogs([]);
    addLog(`Uploading ${file.name}...`, 'info');

    try {
      // 1. Create Project in Firestore
      addLog(`Initializing project in database...`, 'system');
      const projectId = 'proj_' + Math.random().toString(36).substr(2, 9);
      const newProject: Project = {
        id: projectId,
        userId: user.uid,
        title: file.name.replace('.epub', ''),
        status: 'parsing',
        createdAt: new Date().toISOString(),
        fileName: file.name
      };
      await setDoc(doc(db, 'vn_projects', projectId), newProject);
      setCurrentProject(newProject);
      addLog(`Project ID: ${projectId}`, 'info');

      // 2. Send to backend for parsing
      addLog(`Connecting to backend parser...`, 'system');
      const formData = new FormData();
      formData.append('file', file);
      
      const tokens = localStorage.getItem('google_tokens');
      if (tokens) {
        addLog(`Attaching Google Drive tokens...`, 'info');
        formData.append('googleTokens', tokens);
      }

      addLog(`Sending file to /api/mangascript/parse...`, 'info');
      const response = await fetch('/api/mangascript/parse', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      addLog(`Server responded with status: ${response.status} ${response.statusText}`, response.ok ? 'success' : 'error');

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to parse EPUB');
        }
        
        addLog(`Found ${data.chapters.length} chapters. Saving to database...`, 'success');

        // 3. Save chapters to Firestore
        for (let i = 0; i < data.chapters.length; i++) {
          const chap = data.chapters[i];
          const chapterId = 'chap_' + Math.random().toString(36).substr(2, 9);
          const newChap: Chapter = {
            ...chap,
            projectId: projectId,
            status: 'pending'
          };
          addLog(`Saving chapter ${i + 1}/${data.chapters.length}: ${chap.title}`, 'system');
          await setDoc(doc(db, `vn_projects/${projectId}/chapters`, chapterId), newChap);
        }

        // 4. Update project status
        addLog(`Finalizing project status...`, 'system');
        await updateDoc(doc(db, 'vn_projects', projectId), { 
          status: 'ready',
          driveFileId: data.driveFileId || null,
          driveLink: data.driveLink || null
        });
        addLog(`Project ready! ${data.driveLink ? '(Stored in Google Drive)' : ''}`, 'success');
        setView('project_view');
      } else {
        const text = await response.text();
        addLog(`Received non-JSON response from server. First 100 chars: ${text.substring(0, 100)}`, 'error');
        throw new Error('Server returned an invalid response (likely an HTML error page). Check server logs.');
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addLog(`CRITICAL ERROR: ${errorMsg}`, 'error');
      setIsParsingError(true);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.epub') || file.type === 'application/epub+zip')) {
      processFile(file);
    }
  };

  const startAIConversion = async (chapter: Chapter) => {
    if (!currentProject) return;
    setIsProcessing(true);
    setCurrentChapter(chapter);
    setView('chapter_view');
    setLogs([]);
    
    try {
      addLog(`Starting AI Transformation for ${chapter.title}...`, 'system');
      await updateDoc(doc(db, `vn_projects/${currentProject.id}/chapters`, chapter.id!), {
        status: 'ai_processing'
      });

      addLog(`Analyzing chapter length (${chapter.content.length} chars)...`, 'info');
      if (chapter.content.length > 10000) {
        addLog(`Chapter is large. It may take longer to process...`, 'warning');
      }
      
      addLog(`Converting to RenPy script...`, 'info');
      
      const res = await fetch('/api/visual-novel/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentProject.title + ' - ' + chapter.title,
          source: chapter.content,
          modelId: 'gemini-3.1-pro-preview'
        })
      });

      if (!res.ok) {
        throw new Error('Failed to convert chapter');
      }

      const data = await res.json();
      const generatedScript = data.script;
      
      await updateDoc(doc(db, `vn_projects/${currentProject.id}/chapters`, chapter.id!), {
        status: 'human_proofread',
        scriptContent: generatedScript
      });
      
      setEditedContent(generatedScript);
      addLog(`AI Processing complete. Ready for Human Proofread.`, 'success');
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
      await updateDoc(doc(db, `vn_projects/${currentProject.id}/chapters`, chapter.id!), {
        status: 'pending'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveChapter = async () => {
    if (!currentProject || !currentChapter) return;
    try {
      await updateDoc(doc(db, `vn_projects/${currentProject.id}/chapters`, currentChapter.id!), {
        status: 'approved',
        scriptContent: editedContent
      });
      setView('project_view');
      setCurrentChapter(null);
    } catch (error) {
      console.error("Failed to approve:", error);
    }
  };

  const handleRegenerate = () => {
    if (currentChapter) {
      startAIConversion(currentChapter);
    }
  };

  const handlePackEpub = async () => {
    if (!currentProject) return;
    try {
      addLog(`Packing EPUB...`, 'system');
      await updateDoc(doc(db, 'vn_projects', currentProject.id), { status: 'packing' });
      
      // Simulate packing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await updateDoc(doc(db, 'vn_projects', currentProject.id), { 
        status: 'completed',
        downloadUrl: '#' // Mock URL
      });
      addLog(`EPUB Packed successfully!`, 'success');
    } catch (error) {
      console.error("Failed to pack:", error);
    }
  };

  const handleTransferToVisualNovelEditor = async () => {
    if (!currentProject || !user) return;
    try {
      addLog(`Transferring to VN Editor...`, 'system');
      
      const { saveLocalNovel, syncPendingNovels } = await import('../lib/db');
      
      // Concatenate all approved chapters into one script
      let fullScript = '';
      for (const chap of chapters) {
        if (chap.status === 'approved' && chap.scriptContent) {
          fullScript += `\n# --- ${chap.title} ---\n\n`;
          fullScript += chap.scriptContent;
          fullScript += `\n\n`;
        }
      }

      if (!fullScript) {
        throw new Error("No approved chapters to transfer.");
      }

      const newNovel = {
        id: 'vn_' + Math.random().toString(36).substr(2, 9),
        userId: user.uid,
        title: currentProject.title,
        description: 'Converted from EPUB: ' + currentProject.fileName,
        script: fullScript,
        isPublic: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authorName: user.displayName || 'Unknown',
      };
      
      await saveLocalNovel(newNovel);
      syncPendingNovels().catch(console.error); // Trigger sync in background
      
      addLog(`Transfer complete! Redirecting...`, 'success');
      setTimeout(() => {
        window.location.hash = '#/visual-novels';
      }, 1000);
      
    } catch (error) {
      console.error("Failed to transfer:", error);
      addLog(`Error transferring: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-purple-500" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full bg-gray-800 rounded-3xl p-8 border border-gray-700 text-center shadow-2xl"
          >
            <div className="bg-purple-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/20">
              <BookOpen size={40} />
            </div>
            <h2 className="text-3xl font-bold mb-4">StoryToVN Studio</h2>
            <p className="text-gray-400 mb-8 leading-relaxed">
              AI-powered EPUB to Visual Novel conversion workflow. Sign in to manage your projects.
            </p>
            <button 
              onClick={handleSignIn}
              className="w-full py-4 bg-white text-gray-900 font-bold rounded-2xl flex items-center justify-center space-x-3 hover:bg-gray-100 transition-all transform active:scale-95 shadow-xl"
            >
              <LogIn size={20} />
              <span>Sign In</span>
            </button>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-3 sm:space-x-4 cursor-pointer" onClick={() => setView('project_list')}>
          <div className="bg-purple-600 p-1.5 sm:p-2 rounded-lg shadow-lg shadow-purple-500/20">
            <BookOpen size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">StoryToVN</h1>
            <div className="flex items-center space-x-2 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
              <span className="text-purple-400 hidden xs:inline">Workflow</span>
              {currentProject && (
                <>
                  <span className="hidden xs:inline">\</span>
                  <span className="truncate max-w-[100px] sm:max-w-[150px]">{currentProject.title}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="hidden md:flex items-center space-x-3 mr-4 border-r border-gray-700 pr-4">
            <img 
              src={user.photoURL || ''} 
              alt="" 
              className="w-8 h-8 rounded-full border border-gray-600"
              referrerPolicy="no-referrer"
            />
            <div className="text-right">
              <div className="text-[10px] font-bold truncate max-w-[100px] text-gray-300">{user.displayName}</div>
              <div className="text-[8px] text-gray-500 truncate max-w-[100px]">{user.email}</div>
            </div>
          </div>
          <button 
            onClick={handleSignOut}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
            title="Sign Out"
          >
            <LogOut size={18} className="sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      <main className="flex-grow flex overflow-hidden">
        {view === 'project_list' && (
          <div className="w-full max-w-5xl mx-auto p-4 sm:p-8 overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
              <h2 className="text-xl sm:text-2xl font-bold">Your Projects</h2>
              <button 
                onClick={() => setView('upload')}
                className="w-full sm:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
              >
                <Upload size={18} />
                <span>New Project</span>
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="text-center py-16 sm:py-20 bg-gray-800/50 rounded-3xl border border-gray-700 border-dashed px-4">
                <BookOpen size={40} className="mx-auto text-gray-600 mb-4 sm:w-12 sm:h-12" />
                <h3 className="text-lg sm:text-xl font-bold text-gray-400 mb-2">No projects yet</h3>
                <p className="text-sm text-gray-500">Upload an EPUB to start translating and proofreading.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {projects.map(proj => (
                  <div 
                    key={proj.id} 
                    onClick={() => { setCurrentProject(proj); setView('project_view'); }}
                    className="bg-gray-800 border border-gray-700 rounded-2xl p-5 sm:p-6 hover:border-purple-500 cursor-pointer transition-all group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-gray-900 p-2.5 sm:p-3 rounded-xl text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <BookOpen size={20} className="sm:w-6 sm:h-6" />
                      </div>
                      <span className={`text-[9px] sm:text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                        proj.status === 'completed' ? 'bg-green-900/50 text-green-400 border border-green-800' :
                        proj.status === 'ready' ? 'bg-blue-900/50 text-blue-400 border border-blue-800' :
                        'bg-yellow-900/50 text-yellow-400 border border-yellow-800'
                      }`}>
                        {proj.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-base sm:text-lg mb-1 truncate">{proj.title}</h3>
                    <p className="text-[10px] sm:text-xs text-gray-500 truncate">{proj.fileName}</p>
                    <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center text-[10px] sm:text-xs text-gray-400">
                      <span>{new Date(proj.createdAt).toLocaleDateString()}</span>
                      <ChevronRight size={14} className="sm:w-4 sm:h-4 group-hover:text-purple-400 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'upload' && (
          <div className="w-full max-w-2xl mx-auto p-4 sm:p-8 flex flex-col items-center justify-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full bg-gray-800 rounded-3xl p-6 sm:p-10 border border-gray-700 text-center shadow-2xl"
            >
              <div className="bg-purple-600/20 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-purple-500/30">
                <Upload size={32} className="text-purple-400 sm:w-10 sm:h-10" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold mb-3">Upload Story EPUB</h2>
              <p className="text-sm sm:text-base text-gray-400 mb-8 leading-relaxed">
                Select an EPUB file to begin the conversion process. We'll parse the chapters and prepare them for AI processing.
              </p>
              
              <label className="block w-full">
                <input 
                  type="file" 
                  accept=".epub" 
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl cursor-pointer transition-all transform active:scale-95 shadow-xl flex items-center justify-center space-x-3">
                  <FileText size={20} />
                  <span>Choose EPUB File</span>
                </div>
              </label>
              
              <button 
                onClick={() => setView('project_list')}
                className="mt-6 text-gray-500 hover:text-gray-300 transition-colors text-sm font-medium"
              >
                Cancel and go back
              </button>
            </motion.div>
          </div>
        )}

        {view === 'parsing' && (
          <div className="w-full max-w-3xl mx-auto p-8 flex flex-col items-center justify-center">
            {isParsingError ? (
              <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mb-6">
                <AlertCircle size={32} className="text-red-500" />
              </div>
            ) : (
              <Loader2 size={64} className="animate-spin text-purple-500 mb-8" />
            )}
            <h2 className="text-2xl font-bold mb-8">
              {isParsingError ? 'Parsing Failed' : 'Parsing EPUB Structure...'}
            </h2>
            <div className="w-full mb-8">
              <Console logs={logs} title="Parsing Logs" maxHeight="300px" />
            </div>
            {isParsingError && (
              <button 
                onClick={() => setView('upload')}
                className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-purple-500/20"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {view === 'project_view' && currentProject && (
          <div className="flex flex-col md:flex-row w-full h-full overflow-hidden">
            {/* Sidebar - Chapter List */}
            <div className="w-full md:w-80 bg-gray-800 border-b md:border-b-0 md:border-r border-gray-700 flex flex-col h-64 md:h-full">
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400">Chapters</h3>
                <span className="bg-gray-900 px-2 py-0.5 rounded text-[10px] font-bold text-purple-400">
                  {chapters.length}
                </span>
              </div>
              <div className="flex-grow overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {chapters.map((chap) => (
                  <button
                    key={chap.id}
                    onClick={() => { setCurrentChapter(chap); setView('chapter_view'); }}
                    className="w-full text-left p-3 rounded-xl hover:bg-gray-700/50 transition-all group flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3 truncate">
                      <div className={`p-1.5 rounded-lg ${
                        chap.status === 'approved' ? 'bg-green-900/30 text-green-400' :
                        chap.status === 'ai_processing' ? 'bg-blue-900/30 text-blue-400' :
                        'bg-gray-900 text-gray-500'
                      }`}>
                        {chap.status === 'approved' ? <CheckCircle2 size={14} /> : <FileText size={14} />}
                      </div>
                      <span className={`text-sm font-medium truncate ${chap.status === 'approved' ? 'text-gray-300' : 'text-gray-400'}`}>
                        {chap.order + 1} - {chap.title.replace(/\s+/g, '')}
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
              <div className="p-4 bg-gray-900/50 border-t border-gray-700">
                <button 
                  onClick={handleTransferToVisualNovelEditor}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2"
                >
                  <Sparkles size={18} />
                  <span>Transfer to VN Editor</span>
                </button>
              </div>
            </div>

            {/* Main Content - Project Overview */}
            <div className="flex-grow p-4 sm:p-8 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                <div className="bg-gray-800 rounded-3xl p-6 sm:p-8 border border-gray-700 shadow-xl mb-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-bold mb-2">{currentProject.title}</h2>
                      <p className="text-gray-400 text-sm sm:text-base">Project created on {new Date(currentProject.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex space-x-2">
                      {currentProject.driveLink && (
                        <a 
                          href={currentProject.driveLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-3 bg-blue-600/20 text-blue-400 rounded-xl hover:bg-blue-600/30 transition-all border border-blue-500/30"
                          title="View in Google Drive"
                        >
                          <Cloud size={20} />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Chapters', value: chapters.length, color: 'text-purple-400' },
                      { label: 'Approved', value: chapters.filter(c => c.status === 'approved').length, color: 'text-green-400' },
                      { label: 'Pending', value: chapters.filter(c => c.status === 'pending').length, color: 'text-yellow-400' },
                      { label: 'Status', value: currentProject.status.toUpperCase(), color: 'text-blue-400' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-gray-900/50 p-4 rounded-2xl border border-gray-700">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{stat.label}</div>
                        <div className={`text-lg sm:text-xl font-bold ${stat.color}`}>{stat.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl">
                    <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
                      <Settings size={18} className="text-purple-400" />
                      <span>Project Settings</span>
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Google Drive Integration</label>
                        {isDriveConnected ? (
                          <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-800/30 rounded-xl">
                            <div className="flex items-center space-x-2 text-green-400">
                              <CheckCircle2 size={16} />
                              <span className="text-sm font-medium">Connected</span>
                            </div>
                            <button onClick={handleDisconnectDrive} className="text-xs text-red-400 hover:underline">Disconnect</button>
                          </div>
                        ) : (
                          <button 
                            onClick={handleConnectDrive}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2"
                          >
                            <Cloud size={18} />
                            <span>Connect Google Drive</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-xl">
                    <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
                      <Layers size={18} className="text-purple-400" />
                      <span>Quick Actions</span>
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      <button className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2">
                        <Download size={18} />
                        <span>Export Project Data</span>
                      </button>
                      <button className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2">
                        <Replace size={18} />
                        <span>Bulk Replace in All Chapters</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'chapter_view' && currentChapter && (
          <div className="flex flex-col w-full h-full overflow-hidden">
            {/* Chapter Header */}
            <div className="bg-gray-800 border-b border-gray-700 px-4 sm:px-6 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <button 
                  onClick={() => setView('project_view')}
                  className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h2 className="font-bold text-sm sm:text-base truncate max-w-[150px] sm:max-w-md">
                    {currentChapter.order + 1} - {currentChapter.title.replace(/\s+/g, '')}
                  </h2>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{currentChapter.status}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setShowFindReplace(!showFindReplace)}
                  className={`p-2 rounded-lg transition-colors ${showFindReplace ? 'bg-purple-600 text-white' : 'hover:bg-gray-700 text-gray-400'}`}
                  title="Find and Replace"
                >
                  <Search size={20} />
                </button>
                <button 
                  onClick={() => startAIConversion(currentChapter)}
                  disabled={isProcessing}
                  className="px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white font-bold rounded-lg shadow-lg transition-all flex items-center space-x-2"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  <span className="hidden sm:inline">AI Convert</span>
                </button>
                <button 
                  onClick={handleApproveChapter}
                  className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg transition-all flex items-center space-x-2"
                >
                  <Check size={16} />
                  <span className="hidden sm:inline">Approve</span>
                </button>
              </div>
            </div>

            {/* Find and Replace Bar */}
            <AnimatePresence>
              {showFindReplace && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-gray-800 border-b border-gray-700 overflow-hidden"
                >
                  <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 max-w-7xl mx-auto">
                    <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="Find text..."
                          value={findText}
                          onChange={(e) => setFindText(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-sm focus:border-purple-500 focus:outline-none"
                        />
                        {matchCount !== null && (
                          <span className="absolute right-3 top-2 text-[10px] font-bold text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                            {matchCount} matches
                          </span>
                        )}
                      </div>
                      <input 
                        type="text" 
                        placeholder="Replace with..."
                        value={replaceText}
                        onChange={(e) => setReplaceText(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-sm focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                      <button 
                        onClick={() => setUseRegex(!useRegex)}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-all flex-shrink-0 ${useRegex ? 'bg-purple-600 border-purple-500 text-white' : 'border-gray-700 text-gray-500'}`}
                      >.*</button>
                      <button 
                        onClick={() => setCaseSensitive(!caseSensitive)}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-all flex-shrink-0 ${caseSensitive ? 'bg-purple-600 border-purple-500 text-white' : 'border-gray-700 text-gray-500'}`}
                      >Aa</button>
                      <button 
                        onClick={() => setWholeWord(!wholeWord)}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-all flex-shrink-0 ${wholeWord ? 'bg-purple-600 border-purple-500 text-white' : 'border-gray-700 text-gray-500'}`}
                      >""</button>
                      <div className="h-6 w-px bg-gray-700 mx-2"></div>
                      <button 
                        onClick={handleFindAll}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-lg transition-all flex-shrink-0"
                      >Find All</button>
                      <button 
                        onClick={handleReplaceAll}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-all flex-shrink-0"
                      >Replace All</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Editor Area */}
            <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
              {/* Source Text */}
              <div className="w-full md:w-1/2 flex flex-col border-b md:border-b-0 md:border-r border-gray-700 h-1/2 md:h-full">
                <div className="bg-gray-900/50 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Source Chapter Content</span>
                  <div className="flex space-x-2">
                    <button className="p-1 hover:bg-gray-700 rounded text-gray-500" title="Copy Source"><Download size={14} /></button>
                  </div>
                </div>
                <div className="flex-grow overflow-y-auto p-4 sm:p-6 font-serif leading-relaxed text-gray-300 text-sm sm:text-base custom-scrollbar">
                  <div dangerouslySetInnerHTML={{ __html: currentChapter.content }} />
                </div>
              </div>

              {/* VN Script Editor */}
              <div className="w-full md:w-1/2 flex flex-col h-1/2 md:h-full">
                <div className="bg-gray-900/50 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Visual Novel Script (Ren'Py Format)</span>
                  <div className="flex items-center space-x-2">
                    {isProcessing && <span className="text-[10px] text-blue-400 animate-pulse font-bold">AI is writing...</span>}
                    <button className="p-1 hover:bg-gray-700 rounded text-gray-500" title="Expand Editor"><Settings size={14} /></button>
                  </div>
                </div>
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="flex-grow bg-gray-950 p-4 sm:p-6 font-mono text-xs sm:text-sm leading-relaxed text-purple-300 focus:outline-none resize-none custom-scrollbar"
                  placeholder="AI generated script will appear here..."
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
