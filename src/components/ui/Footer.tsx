import React from 'react';
import { FlaskConical, Github, Twitter, MessageSquare, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="bg-blue-600 text-white p-1.5 rounded-full">
                <FlaskConical size={20} />
              </div>
              <span className="font-bold text-xl text-white tracking-tight">DGLab</span>
            </div>
            <p className="text-sm leading-relaxed">
              A collection of web-based utilities for file processing and digital content manipulation. Built with modern web technologies.
            </p>
            <div className="flex space-x-4 mt-6">
              <a href="https://github.com/dglab/pwa" className="hover:text-white transition-colors" aria-label="GitHub">
                <Github size={20} />
              </a>
              <a href="#" className="hover:text-white transition-colors" aria-label="Twitter">
                <Twitter size={20} />
              </a>
              <a href="#" className="hover:text-white transition-colors" aria-label="Discord">
                <MessageSquare size={20} />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-4">Services</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#/services/epub-font-changer" className="hover:text-white transition-colors">EPUB Font Changer</a></li>
              <li><a href="#/services/manga-script" className="hover:text-white transition-colors">MangaScript Studio</a></li>
              <li><a href="#/services" className="hover:text-white transition-colors">All Services</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-4">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#/docs" className="hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#/api" className="hover:text-white transition-colors">API Reference</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Add a Service</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Licenses</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-xs">
          <p>&copy; {new Date().getFullYear()} DGLab. All rights reserved.</p>
          <p className="flex items-center mt-4 md:mt-0">
            Made with <Heart size={12} className="mx-1 text-red-500 fill-current" /> for the community
          </p>
        </div>
      </div>
    </footer>
  );
}
