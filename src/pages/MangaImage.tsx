import React, { useState, useCallback, useEffect } from 'react';
import { BookOpen, Send, Sparkles, Loader2, CheckCircle2, AlertCircle, Download, FileJson, FileText, Settings, Cpu, Layers, Terminal, LogIn, LogOut, Replace, Search, Upload, ChevronRight, Check, X, Edit3, Eye, Cloud } from 'lucide-react';
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
  translatedContent?: string;
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

export default function MangaImage() {
  const { user, loading, openLoginModal } = useFirebase();
  const [view, setView] = useState<ViewState>('project_list');
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
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
    const q = query(collection(db, 'manga_image_projects'), where('userId', '==', user.uid));
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
    const q = query(collection(db, `manga_image_projects/${currentProject.id}/chapters`), orderBy('order', 'asc'));
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
      const projectId = 'proj_' + Math.random().toString(36).substr(2, 9);
      const newProject: Project = {
        id: projectId,
        userId: user.uid,
        title: file.name.replace('.epub', ''),
        status: 'parsing',
        createdAt: new Date().toISOString(),
        fileName: file.name
      };
      await setDoc(doc(db, 'manga_image_projects', projectId), newProject);
      setCurrentProject(newProject);

      // 2. Send to backend for parsing
      addLog(`Parsing EPUB structure...`, 'system');
      const formData = new FormData();
      formData.append('file', file);
      
      const tokens = localStorage.getItem('google_tokens');
      if (tokens) {
        formData.append('googleTokens', tokens);
      }

      const response = await fetch('/api/mangascript/parse', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse EPUB' }));
        throw new Error(errorData.error || 'Failed to parse EPUB');
      }
      const data = await response.json();
      
      addLog(`Found ${data.chapters.length} chapters. Saving to database...`, 'success');

      // 3. Save chapters to Firestore
      for (const chap of data.chapters) {
        const chapterId = 'chap_' + Math.random().toString(36).substr(2, 9);
        const newChap: Chapter = {
          ...chap,
          projectId: projectId,
          status: 'pending'
        };
        await setDoc(doc(db, `manga_image_projects/${projectId}/chapters`, chapterId), newChap);
      }

      // 4. Update project status
      await updateDoc(doc(db, 'manga_image_projects', projectId), { 
        status: 'ready',
        driveFileId: data.driveFileId || null,
        driveLink: data.driveLink || null
      });
      addLog(`Project ready! ${data.driveLink ? '(Stored in Google Drive)' : ''}`, 'success');
      setView('project_view');

    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
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

  const startMangaGeneration = async (chapter: Chapter) => {
    if (!currentProject) return;
    setIsProcessing(true);
    setGenerationProgress(0);
    setCurrentChapter(chapter);
    setView('chapter_view');
    setLogs([]);
    
    try {
      addLog(`Starting Manga Generation for ${chapter.title}...`, 'system');
      await updateDoc(doc(db, `manga_image_projects/${currentProject.id}/chapters`, chapter.id!), {
        status: 'ai_processing'
      });

      // Simulate AI processing (chunking if needed)
      addLog(`Analyzing chapter length (${chapter.content.length} chars)...`, 'info');
      setGenerationProgress(10);
      if (chapter.content.length > 10000) {
        addLog(`Chapter is large. Applying chunky transformation strategy...`, 'warning');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      setGenerationProgress(30);
      addLog(`Generating manga panels...`, 'info');
      
      // Simulate progress updates
      for (let i = 40; i <= 90; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setGenerationProgress(i);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setGenerationProgress(100);
      
      // Mock translated content
      const mockTranslated = `<h1>[Generated Manga] ${chapter.title}</h1>\n<p>This is the AI generated manga content.</p>\n<hr/>\n` + chapter.content;
      
      await updateDoc(doc(db, `manga_image_projects/${currentProject.id}/chapters`, chapter.id!), {
        status: 'human_proofread',
        translatedContent: mockTranslated
      });
      
      setEditedContent(mockTranslated);
      addLog(`AI Processing complete. Ready for Human Proofread.`, 'success');
    } catch (error) {
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsProcessing(false);
      setGenerationProgress(0);
    }
  };

  const handleApproveChapter = async () => {
    if (!currentProject || !currentChapter) return;
    try {
      await updateDoc(doc(db, `manga_image_projects/${currentProject.id}/chapters`, currentChapter.id!), {
        status: 'approved',
        translatedContent: editedContent
      });
      setView('project_view');
      setCurrentChapter(null);
    } catch (error) {
      console.error("Failed to approve:", error);
    }
  };

  const handleRegenerate = () => {
    if (currentChapter) {
      startMangaGeneration(currentChapter);
    }
  };

  const handlePackManga = async () => {
    if (!currentProject) return;
    try {
      addLog(`Packing Manga...`, 'system');
      await updateDoc(doc(db, 'manga_image_projects', currentProject.id), { status: 'packing' });
      
      // Simulate packing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await updateDoc(doc(db, 'manga_image_projects', currentProject.id), { 
        status: 'completed',
        downloadUrl: '#' // Mock URL
      });
      addLog(`Manga Packed successfully!`, 'success');
    } catch (error) {
      console.error("Failed to pack:", error);
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
            <h2 className="text-3xl font-bold mb-4">MangaImage Studio</h2>
            <p className="text-gray-400 mb-8 leading-relaxed">
              AI-powered EPUB to Manga generation workflow. Sign in to manage your projects.
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
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-4 cursor-pointer" onClick={() => setView('project_list')}>
          <div className="bg-purple-600 p-2 rounded-lg shadow-lg shadow-purple-500/20">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">MangaImage Studio</h1>
            <div className="flex items-center space-x-2 text-xs text-gray-400 font-medium uppercase tracking-wider">
              <span className="text-purple-400">Workflow</span>
              {currentProject && (
                <>
                  <span>\</span>
                  <span className="truncate max-w-[150px]">{currentProject.title}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-3 mr-4 border-r border-gray-700 pr-4">
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
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-grow flex overflow-hidden">
        {view === 'project_list' && (
          <div className="w-full max-w-5xl mx-auto p-8 overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Your Projects</h2>
              <button 
                onClick={() => setView('upload')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-lg transition-all flex items-center space-x-2"
              >
                <Upload size={18} />
                <span>New Project</span>
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="text-center py-20 bg-gray-800/50 rounded-3xl border border-gray-700 border-dashed">
                <BookOpen size={48} className="mx-auto text-gray-600 mb-4" />
                <h3 className="text-xl font-bold text-gray-400 mb-2">No projects yet</h3>
                <p className="text-gray-500">Upload an EPUB to start generating manga.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map(proj => (
                  <div 
                    key={proj.id} 
                    onClick={() => { setCurrentProject(proj); setView('project_view'); }}
                    className="bg-gray-800 border border-gray-700 rounded-2xl p-6 hover:border-purple-500 cursor-pointer transition-all group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-gray-900 p-3 rounded-xl text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <BookOpen size={24} />
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                        proj.status === 'completed' ? 'bg-green-900/50 text-green-400 border border-green-800' :
                        proj.status === 'ready' ? 'bg-blue-900/50 text-blue-400 border border-blue-800' :
                        'bg-yellow-900/50 text-yellow-400 border border-yellow-800'
                      }`}>
                        {proj.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg mb-1 truncate">{proj.title}</h3>
                    <p className="text-xs text-gray-500 truncate">{proj.fileName}</p>
                    <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center text-xs text-gray-400">
                      <span>{new Date(proj.createdAt).toLocaleDateString()}</span>
                      <ChevronRight size={16} className="group-hover:text-purple-400 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'upload' && (
          <div className="w-full max-w-2xl mx-auto p-8 flex flex-col items-center justify-center">
            <h2 className="text-3xl font-bold mb-2 text-center">Upload EPUB</h2>
            <p className="text-gray-400 mb-8 text-center">Upload a translated EPUB to begin the manga generation workflow.</p>
            
            <div className="w-full mb-8 p-4 bg-gray-800/50 border border-gray-700 rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${isDriveConnected ? 'bg-green-500/20 text-green-500' : 'bg-gray-700 text-gray-400'}`}>
                  <Cloud size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold">{isDriveConnected ? 'Google Drive Connected' : 'Google Drive Not Connected'}</div>
                  <div className="text-[10px] text-gray-500">
                    {isDriveConnected ? 'Files will be automatically backed up to your Drive.' : 'Connect to store your EPUBs in Google Drive.'}
                  </div>
                </div>
              </div>
              <button 
                onClick={isDriveConnected ? handleDisconnectDrive : handleConnectDrive}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isDriveConnected 
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' 
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {isDriveConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>

            <label 
              className="w-full h-64 border-2 border-dashed border-gray-600 hover:border-purple-500 rounded-3xl flex flex-col items-center justify-center cursor-pointer bg-gray-800/50 hover:bg-gray-800 transition-all group"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                <Upload size={32} className="text-purple-500" />
              </div>
              <span className="text-lg font-bold text-gray-300 group-hover:text-purple-400 transition-colors">Select EPUB File</span>
              <span className="text-sm text-gray-500 mt-2">or drag and drop here</span>
              <input type="file" accept=".epub" className="hidden" onChange={handleFileUpload} />
            </label>
            <button onClick={() => setView('project_list')} className="mt-6 text-gray-500 hover:text-white transition-colors">Cancel</button>
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
          <div className="w-full flex overflow-hidden">
            {/* Sidebar: Chapters */}
            <div className="w-1/3 border-r border-gray-800 flex flex-col bg-gray-900">
              <div className="p-4 border-b border-gray-800 bg-gray-800/50">
                <h2 className="font-bold text-lg truncate">{currentProject.title}</h2>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-400">{chapters.length} Chapters</span>
                  <button 
                    onClick={handlePackManga}
                    disabled={currentProject.status === 'packing' || chapters.some(c => c.status !== 'approved')}
                    className="px-3 py-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-bold rounded flex items-center space-x-1 transition-colors"
                  >
                    <Download size={14} />
                    <span>Pack Manga</span>
                  </button>
                </div>
              </div>
              <div className="flex-grow overflow-y-auto custom-scrollbar p-2 space-y-1">
                {chapters.map(chap => (
                  <div 
                    key={chap.id}
                    onClick={() => {
                      if (chap.status === 'pending') {
                        startMangaGeneration(chap);
                      } else {
                        setCurrentChapter(chap);
                        setEditedContent(chap.translatedContent || chap.content);
                        setView('chapter_view');
                      }
                    }}
                    className={`p-3 rounded-lg cursor-pointer border transition-all flex items-center justify-between ${
                      currentChapter?.id === chap.id ? 'bg-purple-900/30 border-purple-500/50' : 'bg-gray-800 border-transparent hover:border-gray-600'
                    }`}
                  >
                    <div className="flex flex-col overflow-hidden pr-2">
                      <span className="text-sm font-medium truncate">{chap.title}</span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{chap.type}</span>
                    </div>
                    <div className="flex-shrink-0">
                      {chap.status === 'approved' && <CheckCircle2 size={16} className="text-green-500" />}
                      {chap.status === 'human_proofread' && <Edit3 size={16} className="text-yellow-500" />}
                      {chap.status === 'ai_processing' && <Loader2 size={16} className="text-purple-500 animate-spin" />}
                      {chap.status === 'pending' && <Sparkles size={16} className="text-gray-600" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Area: Overview or Packing */}
            <div className="w-2/3 p-8 flex flex-col items-center justify-center bg-gray-950">
              {currentProject.status === 'packing' ? (
                <div className="text-center space-y-6">
                  <Loader2 size={64} className="animate-spin text-green-500 mx-auto" />
                  <h2 className="text-2xl font-bold">Packing Final Manga...</h2>
                  <Console logs={logs} title="Packing Logs" maxHeight="200px" />
                </div>
              ) : currentProject.status === 'completed' ? (
                <div className="text-center space-y-6">
                  <div className="w-24 h-24 bg-green-900/30 rounded-full flex items-center justify-center mx-auto border border-green-500/50">
                    <CheckCircle2 size={48} className="text-green-500" />
                  </div>
                  <h2 className="text-3xl font-bold text-white">Manga Ready!</h2>
                  <p className="text-gray-400">All chapters have been approved and packed.</p>
                  <a 
                    href={currentProject.downloadUrl}
                    className="inline-flex items-center space-x-2 px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg transition-all"
                  >
                    <Download size={20} />
                    <span>Download Generated Manga</span>
                  </a>
                </div>
              ) : (
                <div className="text-center max-w-md">
                  <BookOpen size={64} className="text-gray-700 mx-auto mb-6" />
                  <h2 className="text-2xl font-bold mb-2">Project Overview</h2>
                  <p className="text-gray-500 mb-8">Select a chapter from the sidebar to begin Manga generation and proofreading.</p>
                  
                  <div className="grid grid-cols-2 gap-4 text-left">
                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                      <div className="text-2xl font-bold text-white">{chapters.filter(c => c.status === 'approved').length}</div>
                      <div className="text-xs text-gray-500 uppercase tracking-widest">Approved</div>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                      <div className="text-2xl font-bold text-white">{chapters.filter(c => c.status === 'pending').length}</div>
                      <div className="text-xs text-gray-500 uppercase tracking-widest">Pending</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'chapter_view' && currentChapter && (
          <div className="w-full flex flex-col h-full">
            {/* Toolbar */}
            <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-4">
                <button onClick={() => setView('project_view')} className="text-gray-400 hover:text-white flex items-center space-x-1">
                  <ChevronRight size={20} className="rotate-180" />
                  <span>Back</span>
                </button>
                <div className="h-6 w-px bg-gray-700"></div>
                <h2 className="font-bold">{currentChapter.title}</h2>
                <span className="text-[10px] bg-gray-700 px-2 py-1 rounded uppercase tracking-wider text-gray-300">{currentChapter.status.replace('_', ' ')}</span>
              </div>
              
              <div className="flex items-center space-x-3">
                {currentChapter.status === 'human_proofread' && (
                  <>
                    <button 
                      onClick={() => setShowFindReplace(!showFindReplace)}
                      className={`p-2 rounded-lg transition-all ${showFindReplace ? 'bg-purple-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
                      title="Find and Replace"
                    >
                      <Replace size={18} />
                    </button>
                    <button 
                      onClick={handleRegenerate}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <Replace size={16} />
                      <span>Regenerate</span>
                    </button>
                    <button 
                      onClick={handleApproveChapter}
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-green-500/20 transition-all flex items-center space-x-2"
                    >
                      <Check size={16} />
                      <span>Approve & Queue</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Find and Replace Panel */}
            <AnimatePresence>
              {showFindReplace && currentChapter.status === 'human_proofread' && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-gray-900 border-b border-gray-800 p-4 flex items-center space-x-4 overflow-hidden"
                >
                  <div className="flex-grow grid grid-cols-2 gap-4">
                    <div className="relative">
                      <input 
                        type="text" 
                        value={findText}
                        onChange={(e) => setFindText(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-purple-500 outline-none"
                        placeholder="Find..."
                      />
                      <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                    <input 
                      type="text" 
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-purple-500 outline-none"
                      placeholder="Replace with..."
                    />
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} className="w-3 h-3 text-purple-600 border-gray-700 rounded bg-gray-800 focus:ring-purple-500" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase group-hover:text-purple-400 transition-colors">Regex</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} className="w-3 h-3 text-purple-600 border-gray-700 rounded bg-gray-800 focus:ring-purple-500" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase group-hover:text-purple-400 transition-colors">Case</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} className="w-3 h-3 text-purple-600 border-gray-700 rounded bg-gray-800 focus:ring-purple-500" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase group-hover:text-purple-400 transition-colors">Word</span>
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    {matchCount !== null && (
                      <span className="text-[10px] font-mono text-purple-400 mr-2">
                        {matchCount} match{matchCount !== 1 ? 'es' : ''}
                      </span>
                    )}
                    <button onClick={handleFindAll} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-lg transition-all border border-gray-700">
                      Find All
                    </button>
                    <button onClick={handleReplaceAll} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-purple-500/20">
                      Replace All
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Editor Area */}
            <div className="flex-grow flex overflow-hidden">
              {isProcessing ? (
                <div className="w-full flex flex-col items-center justify-center bg-gray-950 p-8">
                  <Loader2 size={48} className="animate-spin text-purple-500 mb-6" />
                  <h3 className="text-xl font-bold mb-4">Manga Generation in Progress...</h3>
                  
                  {/* Progress Bar */}
                  <div className="w-full max-w-md mb-8">
                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                      <span>Progress</span>
                      <span>{generationProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden border border-gray-700">
                      <motion.div 
                        className="bg-purple-500 h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${generationProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                  
                  <div className="w-full max-w-2xl">
                    <Console logs={logs} title="AI Processing Stream" maxHeight="300px" />
                  </div>
                </div>
              ) : (
                <>
                  {/* Original Content */}
                  <div className="w-1/2 border-r border-gray-800 flex flex-col bg-gray-900">
                    <div className="p-2 bg-gray-800/50 border-b border-gray-800 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">
                      Original Source
                    </div>
                    <div className="flex-grow p-6 overflow-y-auto custom-scrollbar font-serif text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {/* In a real app, we'd render HTML safely or strip it. For now, just show text */}
                      {currentChapter.content.replace(/<[^>]+>/g, '')}
                    </div>
                  </div>
                  
                  {/* Translated/Edited Content */}
                  <div className="w-1/2 flex flex-col bg-gray-950">
                    <div className="p-2 bg-gray-800/50 border-b border-gray-800 text-xs font-bold text-purple-400 uppercase tracking-widest text-center flex justify-between items-center px-4">
                      <span>Human Proofread</span>
                      <Eye size={14} className="text-gray-500" />
                    </div>
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      disabled={currentChapter.status === 'approved'}
                      className="flex-grow p-6 bg-transparent border-none outline-none resize-none font-serif text-lg text-white leading-relaxed custom-scrollbar"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
