// src/context/LanguageContext.tsx
'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getDictionary } from '@/lib/translations';

// Define a type for the dictionary structure by using one of the dictionaries as a base
type Dictionary = ReturnType<typeof getDictionary>;

export type Language = 'en' | 'id';

interface LanguageContextProps {
  language: Language;
  setLanguage: Dispatch<SetStateAction<Language>>;
}

interface DictionaryContextProps {
  dict: Dictionary;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);
const DictionaryContext = createContext<DictionaryContextProps | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('en');
  const [isHydrated, setIsHydrated] = useState(false);
  const [dict, setDict] = useState<Dictionary>(getDictionary('en')); // Initial default

  useEffect(() => {
    // This effect runs only on the client
    const storedLang = localStorage.getItem('appLanguage');
    if (storedLang === 'id' || storedLang === 'en') {
      setLanguage(storedLang);
    }
    setIsHydrated(true); // Signal that hydration is complete
  }, []);

  // Persist language changes to localStorage and update dictionary
  useEffect(() => {
      if (isHydrated) { // Only run after initial hydration
         localStorage.setItem('appLanguage', language);
         setDict(getDictionary(language));
      }
  }, [language, isHydrated]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <DictionaryContext.Provider value={{ dict }}>
        {children}
      </DictionaryContext.Provider>
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

export const useDictionary = (): DictionaryContextProps['dict'] => {
  const context = useContext(DictionaryContext);
  if (context === undefined) {
    throw new Error('useDictionary must be used within a LanguageProvider');
  }
  return context.dict;
};
