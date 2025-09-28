// Session management for WebView compatibility and cookie fallback

/**
 * Get or create a session ID for the current user.
 * This provides fallback support for WebView where cookies may be blocked.
 * 
 * Priority:
 * 1. Check localStorage for existing session
 * 2. If not found, call POST /api/session to get/create server session
 * 3. Store in localStorage for future use
 * 
 * @returns The session ID string
 */
export async function getSessionId(): Promise<string> {
  // Check localStorage for existing session
  let sid = localStorage.getItem('wm_sid');
  
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
        
        // Store in localStorage for future use
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