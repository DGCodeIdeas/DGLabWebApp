import React from 'react';
import { Rocket, Book, Shield, Zap, Cpu, Globe } from 'lucide-react';
import { motion } from 'motion/react';

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="bg-blue-600 text-white py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight"
          >
            Digital Lab Tools
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl md:text-2xl mb-10 text-blue-100 max-w-3xl mx-auto"
          >
            A collection of powerful web-based utilities for processing files and manipulating digital content. Fast, secure, and privacy-focused.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-4"
          >
            <a 
              href="#/services" 
              className="px-8 py-4 bg-white text-blue-600 font-bold rounded-lg shadow-lg hover:bg-blue-50 transition-all transform hover:scale-105 flex items-center space-x-2"
            >
              <Rocket size={20} />
              <span>Get Started</span>
            </a>
            <a 
              href="#/docs" 
              className="px-8 py-4 bg-blue-700 text-white font-bold rounded-lg shadow-lg hover:bg-blue-800 transition-all flex items-center space-x-2"
            >
              <Book size={20} />
              <span>Documentation</span>
            </a>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why DGLab?</h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-lg">
              We build tools that empower creators and researchers to handle digital assets with ease.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Privacy First',
                desc: 'Your files are processed securely. We prioritize data sovereignty and local-first processing where possible.',
                icon: Shield,
                color: 'text-green-500',
                bg: 'bg-green-100'
              },
              {
                title: 'High Performance',
                desc: 'Leveraging modern web technologies and cloud-native scaling to handle massive files and complex tasks.',
                icon: Zap,
                color: 'text-yellow-500',
                bg: 'bg-yellow-100'
              },
              {
                title: 'AI Powered',
                desc: 'Intelligent routing to the best LLM providers for specialized tasks like MangaScript generation.',
                icon: Cpu,
                color: 'text-purple-500',
                bg: 'bg-purple-100'
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -5 }}
                className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100"
              >
                <div className={`${feature.bg} ${feature.color} w-12 h-12 rounded-xl flex items-center justify-center mb-6`}>
                  <feature.icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-white px-4 border-t border-gray-100">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: 'Services', value: '10+' },
            { label: 'Uptime', value: '99.9%' },
            { label: 'Open Source', value: '100%' },
            { label: 'Global Edge', value: '20+' }
          ].map((stat, i) => (
            <div key={i}>
              <div className="text-4xl font-extrabold text-blue-600 mb-2">{stat.value}</div>
              <div className="text-gray-500 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
