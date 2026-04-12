import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Gamepad2, Plus, Edit3, Globe, Lock, Trash2, Loader2, BookOpen, Play } from 'lucide-react';
import { useFirebase } from '../components/FirebaseProvider';
import { getLocalNovels, saveLocalNovel, deleteLocalNovel, pullFromServer } from '../lib/db';

interface VisualNovel {
  id: string;
  title: string;
  description: string;
  isPublic: boolean;
  createdAt: string;
}

export default function VisualNovels() {
  const { user, profile } = useFirebase();
  const [novels, setNovels] = useState<VisualNovel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (user) {
      loadNovels();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const loadNovels = async () => {
    if (!user) return;
    try {
      // Pull from server to sync, then get from local DB
      await pullFromServer(user.uid);
      const loadedNovels = await getLocalNovels(user.uid);
      
      // Sort by createdAt descending
      loadedNovels.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNovels(loadedNovels as VisualNovel[]);
    } catch (error) {
      console.error("Error loading novels:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = async () => {
    if (!user) return;
    setIsCreating(true);
    try {
      const newNovel = {
        id: crypto.randomUUID(),
        userId: user.uid,
        authorName: profile?.displayName || user.displayName || 'Anonymous',
        title: 'Untitled Visual Novel',
        description: '',
        script: 'label start:\n    "Hello, world!"\n    return',
        isPublic: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await saveLocalNovel(newNovel);
      window.location.hash = `#/services/visual-novels/${newNovel.id}`;
    } catch (error) {
      console.error("Error creating novel:", error);
      alert("Failed to create visual novel.");
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this visual novel?")) return;
    try {
      await deleteLocalNovel(id);
      setNovels(novels.filter(n => n.id !== id));
    } catch (error) {
      console.error("Error deleting novel:", error);
      alert("Failed to delete visual novel.");
    }
  };

  if (!user) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-4 text-center">
        <Gamepad2 size={64} className="text-indigo-200 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Visual Novel Studio</h2>
        <p className="text-gray-600 max-w-md">Please log in to create and manage your visual novels.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-12 px-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
              <Gamepad2 size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-1 tracking-tight">Visual Novel CMS</h1>
              <p className="text-indigo-100 text-lg">Manage your visual novels and publish them to the world.</p>
            </div>
          </div>
          <div className="mt-6 md:mt-0 flex space-x-3">
            <a 
              href="#/visual-novels"
              className="px-6 py-3 bg-indigo-500 text-white font-bold rounded-xl shadow-md hover:bg-indigo-400 transition-all flex items-center space-x-2"
            >
              <BookOpen size={18} />
              <span>Public Gallery</span>
            </a>
            <button 
              onClick={handleCreateNew}
              disabled={isCreating}
              className="px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl shadow-md hover:bg-indigo-50 transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              <span>Create New</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12 w-full">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : novels.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Gamepad2 size={32} className="text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Visual Novels Yet</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              You haven't created any visual novels. Click the button below to start your first interactive story.
            </p>
            <button 
              onClick={handleCreateNew}
              disabled={isCreating}
              className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all inline-flex items-center space-x-2"
            >
              <Plus size={20} />
              <span>Create Your First VN</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {novels.map((novel) => (
              <motion.div 
                key={novel.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow"
              >
                <div className="p-6 flex-grow">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-gray-900 line-clamp-2">{novel.title}</h3>
                    <div className="flex items-center space-x-1 px-2 py-1 rounded-md bg-gray-50 border border-gray-100 text-xs font-medium text-gray-600">
                      {novel.isPublic ? <Globe size={12} className="text-green-500" /> : <Lock size={12} className="text-gray-400" />}
                      <span>{novel.isPublic ? 'Public' : 'Private'}</span>
                    </div>
                  </div>
                  <p className="text-gray-500 text-sm line-clamp-3 mb-4">
                    {novel.description || "No description provided."}
                  </p>
                  <div className="text-xs text-gray-400">
                    Created: {new Date(novel.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <a 
                      href={`#/services/visual-novels/${novel.id}`}
                      className="inline-flex items-center text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
                    >
                      <Edit3 size={16} className="mr-2" />
                      <span>Edit</span>
                    </a>
                    <a 
                      href={`#/visual-novels/play/${novel.id}`}
                      className="inline-flex items-center text-green-600 font-bold hover:text-green-700 transition-colors"
                    >
                      <Play size={16} className="mr-2" />
                      <span>Play</span>
                    </a>
                  </div>
                  <button 
                    onClick={() => handleDelete(novel.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
