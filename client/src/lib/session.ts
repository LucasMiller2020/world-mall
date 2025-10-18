// Session management for WebView compatibility and cookie fallback

/**
 * Helper function to read a cookie value by name
 */
function getCookie(name: string): string | null {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

/**
 * Get or create a session ID for the current user.
 * This provides fallback support for WebView where cookies may be blocked.
 * 
 * Priority:
 * 1. Check wm_sid cookie (set by backend)
 * 2. If not found, check localStorage for existing session
 * 3. If not found, call POST /api/session to get/create server session
 * 4. Store in localStorage for future use
 * 
 * @returns The session ID string
 */
export async function getSessionId(): Promise<string> {
  // First, try to read from the cookie (this is what the backend uses)
  let sid = getCookie('wm_sid');
  
  // Fallback to localStorage if cookie not found (for WebView compatibility)
  if (!sid) {
    sid = localStorage.getItem('wm_sid');
  }
  
  if (!sid) {
    try {
      // Call server to create/retrieve session
      const res = await fetch('/api/session', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        sid = data.sid;
        
        // Store in localStorage for future use (WebView fallback)
        if (sid) {
          localStorage.setItem('wm_sid', sid);
        }
      }
    } catch (error) {
      console.error('[Session] Failed to create session:', error);
    }
    
    // Fallback: Generate a client-side session ID if server call fails
    if (!sid) {
      sid = 'guest_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('wm_sid', sid);
    }
  }
  
  return sid;
}

/**
 * Synchronous version that reads the session ID from cookie or localStorage.
 * Does NOT create a new session if one doesn't exist.
 * Use this when you need immediate access to the session ID.
 * 
 * @returns The session ID string or null if not found
 */
export function getSessionIdSync(): string | null {
  // First, try to read from the cookie (this is what the backend uses)
  let sid = getCookie('wm_sid');
  
  // Fallback to localStorage if cookie not found (for WebView compatibility)
  if (!sid) {
    sid = localStorage.getItem('wm_sid');
  }
  
  return sid;
}
