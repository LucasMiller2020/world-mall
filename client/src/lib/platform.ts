/**
 * Platform detection utilities for World Mall
 * 
 * Universal Polling Approach:
 * All platforms (desktop, mobile, World App) use polling for maximum reliability.
 * This eliminates WebSocket connection issues and ensures consistent sync everywhere.
 */

/**
 * Always returns true to enable universal polling mode
 * This ensures reliable message sync across all platforms without complex detection
 * @returns true - all platforms use polling
 */
export function isMiniApp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  console.log('[Platform] Universal polling mode enabled for all platforms');
  return true;
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