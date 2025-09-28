/**
 * Platform detection utilities for World Mall
 * Detects whether the app is running inside World App as a Mini App
 */

/**
 * Checks if the app is running as a Mini App inside World App
 * @returns true if running as Mini App, false if running in regular browser
 */
export function isMiniApp(): boolean {
  // Primary check: MiniKit bridge is injected by World App
  if (typeof window !== 'undefined' && window.minikit) {
    return true;
  }

  // Fallback: User agent detection for World App
  if (typeof navigator !== 'undefined') {
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Check for World App user agent strings
    if (userAgent.includes('world app') || 
        userAgent.includes('worldapp') ||
        userAgent.includes('world-app')) {
      return true;
    }

    // Check for MiniKit in user agent
    if (userAgent.includes('minikit')) {
      return true;
    }
  }

  // Additional check: Look for World App specific properties
  if (typeof window !== 'undefined') {
    // Check for any World App specific global properties that might be set
    const globalAny = window as any;
    if (globalAny.isWorldApp || globalAny.worldapp || globalAny.WorldApp) {
      return true;
    }
  }

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