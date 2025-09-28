import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system' | 'sun';
export type ActiveTheme = 'light' | 'dark';

interface UseThemeReturn {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  activeTheme: ActiveTheme;
}

const STORAGE_KEY = 'wm_theme_mode';

export function useTheme(): UseThemeReturn {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as ThemeMode) || 'system';
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
      case 'sun':
        const now = new Date();
        const hours = now.getHours();
        // Simple sunrise/sunset logic (7 AM to 7 PM)
        // This will be enhanced in the provider with geolocation
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