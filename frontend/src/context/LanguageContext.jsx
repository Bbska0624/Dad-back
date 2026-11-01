import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const LanguageContext = createContext(null);

function readLang() {
  try {
    return localStorage.getItem('mc-lang') || 'mn';
  } catch {
    return 'mn';
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(readLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'mn' ? 'en' : 'mn';
      try {
        localStorage.setItem('mc-lang', next);
      } catch {
        /* localStorage боломжгүй бол зөвхөн санах ойд хадгална */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ lang, toggleLang, t: (mn, en) => (lang === 'mn' ? mn : en) }),
    [lang, toggleLang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider');
  return ctx;
}
