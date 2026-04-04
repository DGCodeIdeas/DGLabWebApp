import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Github, Mail } from 'lucide-react';
import { auth, googleProvider, githubProvider, microsoftProvider, signInWithPopup } from '../../firebase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState<string | null>(null);

  const handleLogin = async (provider: any, providerName: string) => {
    setIsLoading(providerName);
    setError(null);
    try {
      await signInWithPopup(auth, provider);
      onClose();
    } catch (err: any) {
      console.error(`${providerName} login failed:`, err);
      if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed before completing the process.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('This domain is not authorized for OAuth operations. Please check your Firebase Console settings.');
      } else {
        setError(err.message || 'An error occurred during sign in.');
      }
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-gray-500 mb-8 text-center">
                Choose your preferred Single Sign-On (SSO) provider to continue.
              </p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => handleLogin(googleProvider, 'Google')}
                  disabled={!!isLoading}
                  className="w-full flex items-center justify-center space-x-3 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>{isLoading === 'Google' ? 'Signing in...' : 'Continue with Google'}</span>
                </button>

                <button
                  onClick={() => handleLogin(githubProvider, 'GitHub')}
                  disabled={!!isLoading}
                  className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-[#24292F] text-white rounded-xl font-medium hover:bg-[#24292F]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Github className="w-5 h-5" />
                  <span>{isLoading === 'GitHub' ? 'Signing in...' : 'Continue with GitHub'}</span>
                </button>

                <button
                  onClick={() => handleLogin(microsoftProvider, 'Microsoft')}
                  disabled={!!isLoading}
                  className="w-full flex items-center justify-center space-x-3 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" viewBox="0 0 21 21">
                    <path fill="#f25022" d="M1 1h9v9H1z" />
                    <path fill="#00a4ef" d="M1 11h9v9H1z" />
                    <path fill="#7fba00" d="M11 1h9v9h-9z" />
                    <path fill="#ffb900" d="M11 11h9v9h-9z" />
                  </svg>
                  <span>{isLoading === 'Microsoft' ? 'Signing in...' : 'Continue with Microsoft'}</span>
                </button>
              </div>

              <div className="mt-8 text-center text-xs text-gray-500">
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
