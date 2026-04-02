import React from 'react';
import { Book, FileText, Code, Shield, Terminal, Zap, ChevronRight, Rocket } from 'lucide-react';
import { motion } from 'motion/react';

export default function Docs() {
  const sections = [
    {
      title: 'Getting Started',
      icon: Rocket,
      items: ['Introduction', 'Core Concepts', 'Quick Start Guide']
    },
    {
      title: 'Services',
      icon: Zap,
      items: ['EPUB Font Changer', 'MangaScript Studio', 'Asset Bundler']
    },
    {
      title: 'API Reference',
      icon: Code,
      items: ['Authentication', 'Endpoints', 'Webhooks', 'Rate Limits']
    },
    {
      title: 'Security',
      icon: Shield,
      items: ['Data Sovereignty', 'Encryption', 'Audit Logging']
    }
  ];

  return (
    <div className="flex-grow bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col md:flex-row gap-12">
          {/* Sidebar */}
          <aside className="w-full md:w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-8">
              {sections.map((section, i) => (
                <div key={i}>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                    {section.title}
                  </h3>
                  <ul className="space-y-2">
                    {section.items.map((item, j) => (
                      <li key={j}>
                        <a href="#" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors flex items-center group">
                          <ChevronRight size={14} className="mr-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                          {item}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </aside>

          {/* Content */}
          <main className="flex-grow max-w-3xl">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="prose prose-blue max-w-none"
            >
              <h1 className="text-4xl font-extrabold text-gray-900 mb-6 tracking-tight">Documentation</h1>
              <p className="text-xl text-gray-600 mb-12 leading-relaxed">
                Welcome to the DGLab documentation. Here you'll find everything you need to know about our digital processing tools and how to integrate them into your workflow.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-16">
                <div className="p-8 bg-blue-50 rounded-2xl border border-blue-100 group hover:bg-blue-100 transition-colors cursor-pointer">
                  <Terminal size={32} className="text-blue-600 mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">CLI Tools</h3>
                  <p className="text-sm text-gray-600">Learn how to use our command-line utilities for batch processing.</p>
                </div>
                <div className="p-8 bg-purple-50 rounded-2xl border border-purple-100 group hover:bg-purple-100 transition-colors cursor-pointer">
                  <Code size={32} className="text-purple-600 mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">SDKs</h3>
                  <p className="text-sm text-gray-600">Official libraries for JavaScript, Python, and Go.</p>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-6">Core Philosophy</h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                DGLab is built on the principle of <strong>Architectural Honesty</strong>. We don't simulate infrastructure; we build real integrations. Whether it's connecting to your own AI provider or managing complex file transformations, our tools are designed for production use.
              </p>

              <div className="bg-gray-900 rounded-2xl p-8 text-white mb-12 shadow-xl">
                <h3 className="text-lg font-bold mb-4 flex items-center">
                  <Shield size={20} className="mr-2 text-blue-400" />
                  Privacy & Security
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  All file processing happens in isolated environments. We use AES-256 encryption for data at rest and TLS 1.3 for data in transit. Our audit logging system ensures every action is traceable and verifiable.
                </p>
                <div className="flex space-x-4">
                  <span className="px-3 py-1 bg-gray-800 rounded-full text-[10px] font-bold uppercase tracking-widest text-blue-400 border border-blue-400/20">SOC2 Compliant</span>
                  <span className="px-3 py-1 bg-gray-800 rounded-full text-[10px] font-bold uppercase tracking-widest text-green-400 border border-green-400/20">GDPR Ready</span>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-6">Need more help?</h2>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Can't find what you're looking for? Our community is here to help. Join our Discord server or open an issue on GitHub.
              </p>
              <div className="flex space-x-4">
                <button className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all">
                  Join Discord
                </button>
                <button className="px-6 py-3 bg-gray-100 text-gray-900 font-bold rounded-xl hover:bg-gray-200 transition-all">
                  GitHub Issues
                </button>
              </div>
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}


