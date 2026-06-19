import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, type ResolvedTheme, type ThemeMode } from './useTheme';

const THEME_STORAGE_KEY = 'wpd-theme-mode';
const THEME_COLOR_META_SELECTOR = 'meta[name="theme-color"]';
const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)';

const THEME_COLORS = {
  light: '#f8fbff',
  dark: '#081321',
} as const;

function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedMode === 'light' || storedMode === 'dark' || storedMode === 'system'
    ? storedMode
    : 'system';
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.matchMedia(SYSTEM_THEME_QUERY).matches ? 'dark' : 'light';
}

function applyThemeToDocument(mode: ThemeMode, resolvedTheme: ResolvedTheme) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.dataset.theme = resolvedTheme;
  root.dataset.themeMode = mode;
  root.style.colorScheme = resolvedTheme;

  const themeColorMeta = document.querySelector<HTMLMetaElement>(THEME_COLOR_META_SELECTOR);
  if (themeColorMeta) {
    themeColorMeta.content = THEME_COLORS[resolvedTheme];
  }
}

const initialMode = getStoredThemeMode();
const initialResolvedTheme = initialMode === 'system' ? getSystemTheme() : initialMode;
applyThemeToDocument(initialMode, initialResolvedTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(initialResolvedTheme);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const resolvedTheme = mode === 'system' ? systemTheme : mode;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (mode === 'system') {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    applyThemeToDocument(mode, resolvedTheme);
  }, [mode, resolvedTheme]);

  const value = useMemo(
    () => ({
      mode,
      resolvedTheme,
      setMode,
    }),
    [mode, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
