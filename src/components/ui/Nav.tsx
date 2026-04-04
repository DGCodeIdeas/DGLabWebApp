import React, { useState } from 'react';
import { FlaskConical, Home, Wrench, Book, Code, Github, LogIn, LogOut, User, Menu, X } from 'lucide-react';
import { useFirebase } from '../FirebaseProvider';
import { auth, signOut } from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';

export default function Nav() {
  const { user, profile, openLoginModal } = useFirebase();
  const [isOpen, setIsOpen] = useState(false);

  const handleLoginClick = () => {
    openLoginModal();
    setIsOpen(false); // Close mobile menu if open
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const navLinks = [
    { name: 'Home', href: '#/', icon: Home },
    { name: 'Services', href: '#/services', icon: Wrench },
    { name: 'Docs', href: '#/docs', icon: Book },
  ];

  return (
    <nav className="bg-blue-600 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <a href="#/" className="flex-shrink-0 flex items-center space-x-2">
              <div className="bg-white text-blue-600 p-1.5 rounded-full">
                <FlaskConical size={24} />
              </div>
              <span className="font-bold text-xl tracking-tight">DGLab</span>
            </a>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-500 transition-colors flex items-center space-x-1"
                  >
                    <link.icon size={16} />
                    <span>{link.name}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6 space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full border-2 border-white" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-blue-400 flex items-center justify-center border-2 border-white">
                        <User size={16} />
                      </div>
                    )}
                    <span className="text-sm font-medium">{profile?.displayName || user.displayName}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-md hover:bg-blue-500 transition-colors"
                    title="Logout"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleLoginClick}
                  className="flex items-center space-x-2 px-4 py-2 rounded-md bg-white text-blue-600 font-bold hover:bg-blue-50 transition-colors"
                >
                  <LogIn size={18} />
                  <span>Login</span>
                </button>
              )}
              <a
                href="https://github.com/dglab/pwa"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-md hover:bg-blue-500 transition-colors"
              >
                <Github size={20} />
              </a>
            </div>
          </div>
          <div className="-mr-2 flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md hover:bg-blue-500 focus:outline-none"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-blue-700"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-600 flex items-center space-x-2"
                  onClick={() => setIsOpen(false)}
                >
                  <link.icon size={18} />
                  <span>{link.name}</span>
                </a>
              ))}
              {user ? (
                <button
                  onClick={() => { handleLogout(); setIsOpen(false); }}
                  className="w-full text-left block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-600 flex items-center space-x-2"
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              ) : (
                <button
                  onClick={handleLoginClick}
                  className="w-full text-left block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-600 flex items-center space-x-2"
                >
                  <LogIn size={18} />
                  <span>Login</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
