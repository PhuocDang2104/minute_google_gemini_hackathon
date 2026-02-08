import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, getTranslation, type Language, type TranslationKeys } from '../i18n';
import { applyLegacyAutoTranslation } from '../i18n/legacyLiterals';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  translations: TranslationKeys;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'minute_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Check localStorage first
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'vi' || saved === 'en') {
      return saved;
    }
    // Check browser language
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('vi')) {
      return 'vi';
    }
    return 'vi'; // Default to Vietnamese
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, []);

  // Set document language on mount
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Compatibility layer: auto-translate remaining hard-coded literals in legacy pages.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return;

    let applying = false;
    const run = () => {
      if (applying) return;
      applying = true;
      try {
        applyLegacyAutoTranslation(document.body, language);
      } finally {
        applying = false;
      }
    };

    run();
    const observer = new MutationObserver(() => run());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label'],
    });

    return () => observer.disconnect();
  }, [language]);

  const t = useCallback(
    (key: string): string => {
      return getTranslation(translations[language], key);
    },
    [language]
  );

  const value: LanguageContextType = {
    language,
    setLanguage,
    t,
    translations: translations[language],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Shorthand hook for just the translation function
export function useTranslation() {
  const { t, language } = useLanguage();
  return { t, language };
}
