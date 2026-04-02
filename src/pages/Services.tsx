import React from 'react';
import { Type, BookOpen, Code, FileText, Settings, ArrowRight, Info, Zap } from 'lucide-react';
import { motion } from 'motion/react';

const services = [
  {
    id: 'epub-font-changer',
    name: 'EPUB Font Changer',
    description: 'Inject custom fonts (like OpenDyslexic) into your EPUB books for better readability.',
    icon: Type,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    supportsChunking: true
  },
  {
    id: 'manga-script',
    name: 'MangaScript Studio',
    description: 'Convert novels and stories into professional manga scripts using specialized AI models.',
    icon: BookOpen,
    color: 'text-purple-500',
    bg: 'bg-purple-50',
    supportsChunking: false
  },
  {
    id: 'asset-bundler',
    name: 'PHP Asset Bundler',
    description: 'Pure-PHP dependency resolution and bundling for JavaScript and CSS assets.',
    icon: Code,
    color: 'text-green-500',
    bg: 'bg-green-50',
    supportsChunking: false
  },
  {
    id: 'audit-viewer',
    name: 'System Audit Viewer',
    description: 'Real-time monitoring and analysis of system events and processing logs.',
    icon: FileText,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    supportsChunking: false
  }
];

export default function Services() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <section className="bg-blue-600 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Services</h1>
            <p className="text-blue-100 text-lg">Browse and use our collection of digital processing tools.</p>
          </div>
          <div className="mt-4 md:mt-0">
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500 bg-opacity-30 text-white font-medium border border-blue-400 border-opacity-30">
              <Settings size={18} className="mr-2" />
              {services.length} Available
            </span>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="py-16 px-4 flex-grow bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((svc, i) => (
              <motion.div
                key={svc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col"
              >
                <div className="p-8 flex-grow">
                  <div className="flex items-center justify-between mb-6">
                    <div className={`${svc.bg} ${svc.color} p-4 rounded-2xl`}>
                      <svc.icon size={28} />
                    </div>
                    {svc.supportsChunking && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold uppercase tracking-wider">
                        <Zap size={12} className="mr-1 fill-current" />
                        Fast Upload
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{svc.name}</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    {svc.description}
                  </p>
                </div>
                <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <a 
                    href={`#/services/${svc.id}`}
                    className="inline-flex items-center text-blue-600 font-bold hover:text-blue-700 transition-colors"
                  >
                    <span>Use Service</span>
                    <ArrowRight size={18} className="ml-2" />
                  </a>
                  <button className="text-gray-400 hover:text-gray-600 transition-colors" title="More Info">
                    <Info size={20} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto bg-blue-50 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between">
          <div className="mb-8 md:mb-0 text-center md:text-left">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Build Your Own Integration</h2>
            <p className="text-gray-600 text-lg">Access all services programmatically through our RESTful API.</p>
          </div>
          <a 
            href="#/api" 
            className="px-8 py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center space-x-2"
          >
            <Code size={20} />
            <span>API Documentation</span>
          </a>
        </div>
      </section>
    </div>
  );
}
