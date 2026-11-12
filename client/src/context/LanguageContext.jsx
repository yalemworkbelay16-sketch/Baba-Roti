import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { translations } from '../i18n/translations';

export const LanguageContext = createContext(null);

const STORAGE_KEY = 'baba_roti_lang';

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'am' || saved === 'en') return saved;
      // Check browser default language preference
      if (typeof navigator !== 'undefined' && navigator.language?.startsWith('am')) {
        return 'am';
      }
    } catch (e) {
      console.warn('Could not read saved language from localStorage:', e);
    }
    return 'en';
  });

  const setLanguage = useCallback((langOrFn) => {
    setLanguageState((prev) => {
      const next = typeof langOrFn === 'function' ? langOrFn(prev) : langOrFn;
      const valid = next === 'am' ? 'am' : 'en';
      try {
        localStorage.setItem(STORAGE_KEY, valid);
        document.documentElement.lang = valid;
        window.dispatchEvent(new Event('languagechange'));
      } catch (e) {
        console.warn('Could not persist language to localStorage:', e);
      }
      return valid;
    });
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === 'am' ? 'en' : 'am'));
  }, [setLanguage]);

  // Keep <html lang="..."> attribute updated
  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch (_) {}
  }, [language]);

  /**
   * Translate a dotted path like 'nav.dashboard' or 'common.save'.
   * Falls back gracefully to English, then to the path itself.
   * Interpolates {param} tags if params object is supplied.
   */
  const t = useCallback((path, params = {}) => {
    if (!path) return '';

    const resolve = (langObj, keyPath) => {
      const parts = keyPath.split('.');
      let cur = langObj;
      for (const p of parts) {
        if (!cur || typeof cur !== 'object') return undefined;
        cur = cur[p];
      }
      return typeof cur === 'string' ? cur : undefined;
    };

    // 1. Try current language
    let text = resolve(translations[language], path);

    // 2. Fallback to English
    if (text === undefined && language !== 'en') {
      text = resolve(translations.en, path);
    }

    // 3. Fallback to raw path or last segment
    if (text === undefined) {
      return path;
    }

    // 4. Parameter interpolation
    if (params && typeof params === 'object') {
      Object.keys(params).forEach((paramKey) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), params[paramKey]);
      });
    }

    return text;
  }, [language]);

  const value = useMemo(() => ({
    language,
    isAmharic: language === 'am',
    isEnglish: language === 'en',
    setLanguage,
    toggleLanguage,
    t,
  }), [language, setLanguage, toggleLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback if rendered outside provider
    return {
      language: 'en',
      isAmharic: false,
      isEnglish: true,
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (path) => path?.split('.').pop() || '',
    };
  }
  return context;
}

