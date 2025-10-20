/**
 * Platform detection utilities for World Mall
 * Detects whether the app is running inside World App as a Mini App
 */

/**
 * Checks if the app is running as a Mini App inside World App
 * Uses window.WorldApp object which World App sets on initialization
 * This works immediately without waiting for MiniKit.install()
 * @returns true if running as Mini App, false if running in regular browser
 */
export function isMiniApp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  const globalAny = window as any;
  
  // World App sets window.WorldApp object when loading mini apps
  // This is available immediately, unlike MiniKit.isInstalled() which requires install() first
  const hasWorldApp = !!globalAny.WorldApp;
  
  if (hasWorldApp) {
    console.log('[Platform] Detected as Mini App - window.WorldApp is present');
    return true;
  }
  
  // Not a Mini App - use WebSocket for real-time sync
  return false;
}

/**
 * Gets the polling interval for Mini App mode
 * @returns polling interval in milliseconds
 */
export function getMiniAppPollInterval(): number {
  // Check for environment variable first (converted from process.env to import.meta.env for Vite)
  if (typeof import.meta !== 'undefined' && 
      import.meta.env && 
      import.meta.env.VITE_POLL_INTERVAL_MS) {
    const interval = parseInt(import.meta.env.VITE_POLL_INTERVAL_MS, 10);
    if (!isNaN(interval) && interval > 0) {
      return interval;
    }
  }
  
  // Default to 2.5 seconds
  return 2500;
}

/**
 * Provides a debug string for the current platform
 * Useful for debugging platform detection
 */
export function getPlatformDebugInfo(): string {
  const info: string[] = [];
  
  if (typeof window !== 'undefined') {
    const globalAny = window as any;
    // Primary detection method
    info.push(`window.WorldApp: ${!!globalAny.WorldApp}`);
    // Other potential indicators
    info.push(`window.minikit: ${!!globalAny.minikit}`);
    info.push(`window.isWorldApp: ${!!globalAny.isWorldApp}`);
    info.push(`window.worldapp: ${!!globalAny.worldapp}`);
  }
  
  if (typeof navigator !== 'undefined') {
    info.push(`UserAgent: ${navigator.userAgent}`);
  }
  
  info.push(`Detected as Mini App: ${isMiniApp()}`);
  info.push(`Poll interval: ${getMiniAppPollInterval()}ms`);
  
  return info.join('\n');
}