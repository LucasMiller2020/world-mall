import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system' | 'sun';
export type ActiveTheme = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  activeTheme: ActiveTheme;
  sunTimes: { sunrise: Date | null; sunset: Date | null };
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'wm_theme_mode';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as ThemeMode) || 'system';
  });

  const [activeTheme, setActiveTheme] = useState<ActiveTheme>('light');
  const [sunTimes, setSunTimes] = useState<{ sunrise: Date | null; sunset: Date | null }>({
    sunrise: null,
    sunset: null
  });
  const sunTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  // Calculate sunrise and sunset times
  const calculateSunTimes = useCallback((latitude?: number, longitude?: number): { sunrise: Date; sunset: Date } => {
    const now = new Date();
    
    // If we have geolocation, we could use a sunrise/sunset calculation library
    // For now, we'll use a simple approximation based on latitude
    if (latitude !== undefined) {
      // Simplified calculation - in production, use a proper library
      const summerOffset = Math.abs(latitude) / 90 * 2; // Max 2 hours offset
      const winterOffset = Math.abs(latitude) / 90 * 4; // Max 4 hours offset
      
      const month = now.getMonth();
      const isSummer = month >= 4 && month <= 9;
      const offset = isSummer ? summerOffset : winterOffset;
      
      const sunrise = new Date(now);
      sunrise.setHours(7 - (latitude > 0 ? offset : -offset), 0, 0, 0);
      
      const sunset = new Date(now);
      sunset.setHours(19 + (latitude > 0 ? offset : -offset), 0, 0, 0);
      
      return { sunrise, sunset };
    }
    
    // Default fallback times
    const sunrise = new Date(now);
    sunrise.setHours(7, 0, 0, 0);
    
    const sunset = new Date(now);
    sunset.setHours(19, 0, 0, 0);
    
    return { sunrise, sunset };
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
        if (sunTimes.sunrise && sunTimes.sunset) {
          const isDay = now >= sunTimes.sunrise && now < sunTimes.sunset;
          return isDay ? 'light' : 'dark';
        }
        // Fallback to simple time check
        const hours = now.getHours();
        return hours >= 7 && hours < 19 ? 'light' : 'dark';
      default:
        return 'light';
    }
  }, [sunTimes]);

  // Schedule next theme change for sun mode
  const scheduleNextSunChange = useCallback(() => {
    if (sunTimeoutRef.current) {
      clearTimeout(sunTimeoutRef.current);
      sunTimeoutRef.current = null;
    }

    if (mode !== 'sun') return;

    const now = new Date();
    const times = sunTimes.sunrise && sunTimes.sunset 
      ? sunTimes 
      : calculateSunTimes();

    let nextChange: Date;
    
    if (now < times.sunrise!) {
      nextChange = times.sunrise!;
    } else if (now < times.sunset!) {
      nextChange = times.sunset!;
    } else {
      // After sunset, schedule for tomorrow's sunrise
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(times.sunrise!.getHours(), times.sunrise!.getMinutes(), 0, 0);
      nextChange = tomorrow;
    }

    const timeout = nextChange.getTime() - now.getTime();
    
    if (timeout > 0) {
      sunTimeoutRef.current = setTimeout(() => {
        const theme = computeActiveTheme('sun');
        setActiveTheme(theme);
        scheduleNextSunChange(); // Schedule the next change
      }, Math.min(timeout, 2147483647)); // Max timeout value
    }
  }, [mode, sunTimes, calculateSunTimes, computeActiveTheme]);

  // Initialize sun times when mode is 'sun'
  useEffect(() => {
    if (mode === 'sun') {
      // Try to get user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const times = calculateSunTimes(latitude, longitude);
            setSunTimes(times);
          },
          () => {
            // Geolocation failed, use default times
            const times = calculateSunTimes();
            setSunTimes(times);
          },
          { timeout: 5000 }
        );
      } else {
        // No geolocation available
        const times = calculateSunTimes();
        setSunTimes(times);
      }
    }

    return () => {
      if (sunTimeoutRef.current) {
        clearTimeout(sunTimeoutRef.current);
      }
    };
  }, [mode, calculateSunTimes]);

  // Schedule sun mode changes
  useEffect(() => {
    scheduleNextSunChange();
  }, [scheduleNextSunChange]);

  // Handle system theme changes
  useEffect(() => {
    if (mode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      const theme = computeActiveTheme('system');
      setActiveTheme(theme);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } 
    // Legacy browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [mode, computeActiveTheme]);

  // Update active theme when mode changes
  useEffect(() => {
    const theme = computeActiveTheme(mode);
    setActiveTheme(theme);
  }, [mode, computeActiveTheme]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = activeTheme;
    
    // Update meta theme-color
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    
    // Set theme color based on active theme
    const themeColor = activeTheme === 'dark' ? '#000000' : '#E5E8D3';
    metaThemeColor.setAttribute('content', themeColor);
  }, [activeTheme]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, activeTheme, sunTimes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}