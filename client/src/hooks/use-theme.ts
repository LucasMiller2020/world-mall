import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system' | 'autoSun';
export type ActiveTheme = 'light' | 'dark';

interface UseThemeReturn {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  activeTheme: ActiveTheme;
}

const STORAGE_KEY = 'wm_theme';

export function useTheme(): UseThemeReturn {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as ThemeMode) || 'light';
  });

  const [activeTheme, setActiveTheme] = useState<ActiveTheme>('light');

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  // Compute active theme based on mode
  const computeActiveTheme = useCallback((currentMode: ThemeMode): ActiveTheme => {
    switch (currentMode) {
      case 'light':
        return 'light';
      case 'dark':
        return 'dark';
      case 'system':
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      case 'autoSun':
        const now = new Date();
        const hours = now.getHours();
        // Simple time-based: light from 7:00-19:00, dark otherwise
        return hours >= 7 && hours < 19 ? 'light' : 'dark';
      default:
        return 'light';
    }
  }, []);

  // Update active theme when mode changes
  useEffect(() => {
    const theme = computeActiveTheme(mode);
    setActiveTheme(theme);
  }, [mode, computeActiveTheme]);

  return {
    mode,
    setMode,
    activeTheme
  };
}