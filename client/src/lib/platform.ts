/**
 * Platform detection utilities for World Mall
 * Detects whether the app is running inside World App as a Mini App
 */

/**
 * Detects if the current device is a mobile device
 * Used as fallback when World App objects aren't available
 */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  const userAgent = navigator.userAgent || '';
  
  // Check for mobile indicators in user agent
  const mobileIndicators = ['iPhone', 'iPad', 'iPod', 'Android', 'Mobile'];
  const isMobileUA = mobileIndicators.some(indicator => userAgent.includes(indicator));
  
  // Check screen width as secondary indicator
  const isSmallScreen = window.innerWidth < 768;
  
  return isMobileUA || isSmallScreen;
}

/**
 * Checks if the app is running as a Mini App inside World App
 * Uses window.WorldApp object which World App sets on initialization
 * Falls back to mobile device detection if World App objects aren't available
 * @returns true if running as Mini App or on mobile device, false if running in regular browser
 */
export function isMiniApp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  const globalAny = window as any;
  
  // Primary detection: World App sets window.WorldApp object when loading mini apps
  // This is available immediately, unlike MiniKit.isInstalled() which requires install() first
  const hasWorldApp = !!globalAny.WorldApp;
  
  if (hasWorldApp) {
    console.log('[Platform] Detected as Mini App - window.WorldApp is present');
    return true;
  }
  
  // Fallback detection: If we're on a mobile device, assume it might be World App
  // This handles cases where World App doesn't set the expected objects
  const isMobile = isMobileDevice();
  
  if (isMobile) {
    console.log('[Platform] Detected mobile device - forcing polling mode for reliability');
    return true;
  }
  
  // Not a Mini App and not mobile - use WebSocket for real-time sync
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