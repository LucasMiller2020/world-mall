/**
 * Platform detection utilities for World Mall
 * Detects whether the app is running inside World App as a Mini App
 */

/**
 * Checks if the app is running as a Mini App inside World App
 * @returns true if running as Mini App, false if running in regular browser
 */
export function isMiniApp(): boolean {
  // ONLY trust the MiniKit bridge - this is the definitive way to detect World App
  // User agent checks and other heuristics cause false positives on Safari
  if (typeof window !== 'undefined' && window.minikit) {
    console.log('[Platform] Detected as Mini App - window.minikit is present');
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
    info.push(`window.minikit: ${!!window.minikit}`);
    
    const globalAny = window as any;
    info.push(`window.isWorldApp: ${!!globalAny.isWorldApp}`);
    info.push(`window.worldapp: ${!!globalAny.worldapp}`);
    info.push(`window.WorldApp: ${!!globalAny.WorldApp}`);
  }
  
  if (typeof navigator !== 'undefined') {
    info.push(`UserAgent: ${navigator.userAgent}`);
  }
  
  info.push(`Detected as Mini App: ${isMiniApp()}`);
  info.push(`Poll interval: ${getMiniAppPollInterval()}ms`);
  
  return info.join('\n');
}