import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Route {
  path: string;
  component: React.ComponentType<any>;
}

interface RouterProps {
  routes: Route[];
  defaultPath?: string;
}

export default function Router({ routes, defaultPath = '/' }: RouterProps) {
  const [currentPath, setCurrentPath] = useState(window.location.hash.replace('#', '') || defaultPath);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPath(window.location.hash.replace('#', '') || defaultPath);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [defaultPath]);

  const route = routes.find(r => {
    if (r.path.includes(':')) {
      const pattern = new RegExp('^' + r.path.replace(/:[^\s/]+/g, '([\\w-]+)') + '$');
      return pattern.test(currentPath);
    }
    return r.path === currentPath;
  }) || routes.find(r => r.path === '/404') || routes[0];

  const getParams = () => {
    if (!route.path.includes(':')) return {};
    const pattern = new RegExp('^' + route.path.replace(/:[^\s/]+/g, '([\\w-]+)') + '$');
    const match = currentPath.match(pattern);
    if (!match) return {};
    
    const paramNames = (route.path.match(/:[^\s/]+/g) || []).map(p => p.substring(1));
    const params: Record<string, string> = {};
    paramNames.forEach((name, i) => {
      params[name] = match[i + 1];
    });
    return params;
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentPath}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        transition={{ duration: 0.2 }}
        className="flex-grow flex flex-col"
      >
        <route.component params={getParams()} />
      </motion.div>
    </AnimatePresence>
  );
}
