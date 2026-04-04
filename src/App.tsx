import React from 'react';
import { FirebaseProvider } from './components/FirebaseProvider';
import ErrorBoundary from './components/ErrorBoundary';
import Nav from './components/ui/Nav';
import Footer from './components/ui/Footer';
import Router from './components/Router';
import Home from './pages/Home';
import Services from './pages/Services';
import EpubFontChanger from './pages/EpubFontChanger';
import MangaScript from './pages/MangaScript';
import MangaImage from './pages/MangaImage';
import Docs from './pages/Docs';

const routes = [
  { path: '/', component: Home },
  { path: '/services', component: Services },
  { path: '/services/epub-font-changer', component: EpubFontChanger },
  { path: '/services/manga-script', component: MangaScript },
  { path: '/services/manga-image', component: MangaImage },
  { path: '/docs', component: Docs },
  { path: '/404', component: () => <div className="flex-grow flex items-center justify-center text-2xl font-bold">404 - Page Not Found</div> }
];

export default function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <div className="min-h-screen flex flex-col font-sans text-gray-900 bg-white">
          <Nav />
          <main className="flex-grow flex flex-col">
            <Router routes={routes} />
          </main>
          <Footer />
        </div>
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
