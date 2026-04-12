import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Gamepad2, Search, Globe, Loader2, User, Play } from 'lucide-react';
import { pullFromServer, getLocalNovels } from '../lib/db';

interface VisualNovel {
  id: string;
  title: string;
  description: string;
  authorName: string;
  createdAt: string;
}

export default function VisualNovelGallery() {
  const [novels, setNovels] = useState<VisualNovel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPublicNovels();
  }, []);

  const loadPublicNovels = async () => {
    try {
      await pullFromServer(undefined, true);
      const loadedNovels = await getLocalNovels(undefined, true);
      loadedNovels.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNovels(loadedNovels as VisualNovel[]);
    } catch (error) {
      console.error("Error loading public novels:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredNovels = novels.filter(novel => 
    novel.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (novel.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (novel.authorName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-16 px-4 shadow-lg">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center justify-center bg-white/20 p-4 rounded-3xl backdrop-blur-sm mb-6">
            <Globe size={48} className="text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">Visual Novel Gallery</h1>
          <p className="text-xl text-indigo-100 max-w-2xl mx-auto mb-8">
            Discover and play interactive stories created by the community.
          </p>
          
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, author, or description..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl text-gray-900 shadow-xl focus:ring-4 focus:ring-indigo-300 focus:outline-none transition-all"
            />
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12 w-full">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          </div>
        ) : filteredNovels.length === 0 ? (
          <div className="text-center py-20">
            <Gamepad2 size={64} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Novels Found</h3>
            <p className="text-gray-500">
              {searchQuery ? "Try adjusting your search terms." : "There are no public visual novels available yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredNovels.map((novel, i) => (
              <motion.div 
                key={novel.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-xl transition-all group"
              >
                <div className="h-40 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center relative overflow-hidden">
                  <Gamepad2 size={48} className="text-indigo-200 group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/10 transition-colors" />
                </div>
                <div className="p-6 flex-grow flex flex-col">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">{novel.title}</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
                    <User size={14} />
                    <span>{novel.authorName || 'Anonymous'}</span>
                  </div>
                  <p className="text-gray-600 text-sm line-clamp-3 mb-6 flex-grow">
                    {novel.description || "No description provided."}
                  </p>
                  <a 
                    href={`#/visual-novels/play/${novel.id}`}
                    className="w-full py-3 bg-indigo-50 text-indigo-700 font-bold rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors flex items-center justify-center space-x-2"
                  >
                    <Play size={18} />
                    <span>Play Now</span>
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
