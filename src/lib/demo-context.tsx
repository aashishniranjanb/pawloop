'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useDemoEngine } from './demo-engine';

type DemoContextType = {
  demoMode: boolean;
  setDemoMode: (val: boolean) => void;
  demoEngine: ReturnType<typeof useDemoEngine>;
};

const DemoContext = createContext<DemoContextType | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [demoMode, setDemoMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('pawloop-demo-mode') === 'true';
  });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('pawloop-demo-mode', String(demoMode));
  }, [demoMode]);

  const demoEngine = useDemoEngine(demoMode);

  return (
    <DemoContext.Provider value={{ demoMode, setDemoMode, demoEngine }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemoContext() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemoContext must be used within a DemoProvider');
  }
  return context;
}
