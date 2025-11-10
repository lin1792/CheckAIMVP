'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translate, type Locale, type TranslationKey } from '@/lib/i18n';

const STORAGE_KEY = 'checkai-locale';

type ContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<ContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('zh');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? (window.localStorage.getItem(STORAGE_KEY) as Locale | null) : null;
    if (stored === 'zh' || stored === 'en') {
      setLocale(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }
  }, [locale]);

  const value = useMemo<ContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars)
    }),
    [locale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within LanguageProvider');
  }
  return ctx;
}
