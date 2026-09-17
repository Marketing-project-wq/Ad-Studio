'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Lang, Theme } from '@/lib/types';
import { getDictionary, type Dictionary } from '@/i18n';

interface AppContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dictionary;
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  toast: (msg: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const LANG_KEY = '20fit_lang';
const THEME_KEY = '20fit_theme';

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('id');
  const [theme, setTheme] = useState<Theme>('light');
  const [toastMsg, setToastMsg] = useState('');
  const [toastShow, setToastShow] = useState(false);

  // Hydrate persisted preferences on mount.
  useEffect(() => {
    try {
      const savedLang = window.localStorage.getItem(LANG_KEY) as Lang | null;
      if (savedLang === 'id' || savedLang === 'en') setLangState(savedLang);
      const savedTheme = window.localStorage.getItem(THEME_KEY) as Theme | null;
      const resolved: Theme = savedTheme === 'dark' ? 'dark' : 'light';
      setTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    window.setTimeout(() => setToastShow(false), 2200);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      lang,
      setLang,
      t: getDictionary(lang),
      theme,
      isDark: theme === 'dark',
      toggleTheme,
      toast,
    }),
    [lang, setLang, theme, toggleTheme, toast],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className={`toast${toastShow ? ' show' : ''}`}>{toastMsg}</div>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
