'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';

// Export the Language type
export type Language = 'en' | 'id';

interface LanguageContextProps {
  language: Language;
  setLanguage: Dispatch<SetStateAction<Language>>;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('en'); // Default to 'en' on server and initial client render
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // This effect runs only on the client
    const storedLang = localStorage.getItem('appLanguage');
    if (storedLang === 'id' || storedLang === 'en') {
      setLanguage(storedLang);
    }
    setIsHydrated(true); // Signal that hydration is complete
  }, []);

  // Persist language changes to localStorage
  useEffect(() => {
      if (isHydrated) { // Only run after initial hydration
         localStorage.setItem('appLanguage', language);
      }
  }, [language, isHydrated]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextProps => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
