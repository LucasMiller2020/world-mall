/**
 * XMLHttpRequest replacement for fetch() to bypass WebView caching issues
 * Mobile WebViews often cache or block fetch() requests
 * XMLHttpRequest has better compatibility and cache control
 */

interface XHROptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  credentials?: 'include' | 'same-origin' | 'omit';
  timeout?: number;
}

// Global request counter for debugging
let requestCounter = 0;

/**
 * Fetch replacement using XMLHttpRequest for better WebView support
 * Includes aggressive cache busting and debug logging
 */
export function fetchWithXHR(url: string, options: XHROptions = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const requestId = ++requestCounter;
    const startTime = Date.now();
    
    console.log(`[XHR #${requestId}] ========== NEW REQUEST ==========`);
    
    try {
      // FIX 1: Ensure we have a proper base URL (not relative)
      let fullUrl = url;
      if (url.startsWith('/')) {
        const protocol = window.location.protocol;
        const host = window.location.host;
        fullUrl = `${protocol}//${host}${url}`;
        console.log(`[XHR #${requestId}] Converted relative URL to absolute: ${fullUrl}`);
      }
      
      // AGGRESSIVE CACHE BUSTING - add timestamp and random to URL
      const cacheBustUrl = fullUrl.includes('?') 
        ? `${fullUrl}&_t=${Date.now()}&_r=${Math.random()}&_req=${requestId}`
        : `${fullUrl}?_t=${Date.now()}&_r=${Math.random()}&_req=${requestId}`;
      
      console.log(`[XHR #${requestId}] Full URL with cache-bust: ${cacheBustUrl}`);
      console.log(`[XHR #${requestId}] Method: ${options.method || 'GET'}`);
      console.log(`[XHR #${requestId}] Headers:`, options.headers);
      
      const xhr = new XMLHttpRequest();
      
      // Log XHR state changes
      xhr.onreadystatechange = () => {
        console.log(`[XHR #${requestId}] ReadyState changed to: ${xhr.readyState} (0=UNSENT, 1=OPENED, 2=HEADERS_RECEIVED, 3=LOADING, 4=DONE)`);
        if (xhr.readyState === 2) {
          console.log(`[XHR #${requestId}] Response headers received, status: ${xhr.status}`);
        }
      };
      
      // Set method (default GET)
      console.log(`[XHR #${requestId}] Calling xhr.open()`);
      xhr.open(options.method || 'GET', cacheBustUrl, true);
      console.log(`[XHR #${requestId}] xhr.open() completed`);
      
      // FORCE AGGRESSIVE CACHE HEADERS
      console.log(`[XHR #${requestId}] Setting request headers...`);
      xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      xhr.setRequestHeader('Pragma', 'no-cache');
      xhr.setRequestHeader('Expires', '0');
      xhr.setRequestHeader('X-Request-ID', `${requestId}`);
      xhr.setRequestHeader('X-Timestamp', `${Date.now()}`);
      
      // Set custom headers
      if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          console.log(`[XHR #${requestId}] Setting header: ${key}=${value}`);
          xhr.setRequestHeader(key, value);
        });
      }
      console.log(`[XHR #${requestId}] All headers set`);
      
      // Handle credentials
      if (options.credentials === 'include') {
        console.log(`[XHR #${requestId}] Setting withCredentials=true`);
        xhr.withCredentials = true;
      }
      
      // Set timeout (default 10 seconds)
      xhr.timeout = options.timeout || 10000;
      console.log(`[XHR #${requestId}] Timeout set to: ${xhr.timeout}ms`);
    
      // Handle response
      xhr.onload = () => {
        const elapsed = Date.now() - startTime;
        console.log(`[XHR #${requestId}] ✅ ONLOAD - Completed in ${elapsed}ms - Status: ${xhr.status}`);
        console.log(`[XHR #${requestId}] Response text preview:`, xhr.responseText?.substring(0, 200));
        
        // Create a Response-like object
        const response = {
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          statusText: xhr.statusText,
          headers: {
            get: (name: string) => xhr.getResponseHeader(name)
          },
          text: () => Promise.resolve(xhr.responseText),
          json: () => {
            try {
              const data = JSON.parse(xhr.responseText);
              console.log(`[XHR #${requestId}] ✅ Parsed JSON response, ${Array.isArray(data) ? data.length + ' items' : 'object'}`);
              return Promise.resolve(data);
            } catch (e) {
              console.error(`[XHR #${requestId}] ❌ Failed to parse JSON:`, e);
              return Promise.reject(e);
            }
          }
        } as Response;
        
        resolve(response);
      };
      
      // Handle errors
      xhr.onerror = (event) => {
        const elapsed = Date.now() - startTime;
        console.error(`[XHR #${requestId}] ❌ ONERROR - Network error after ${elapsed}ms`, event);
        console.error(`[XHR #${requestId}] XHR State: readyState=${xhr.readyState}, status=${xhr.status}`);
        
        // FALLBACK TO NATIVE FETCH
        console.log(`[XHR #${requestId}] 🔄 Falling back to native fetch...`);
        
        // Build fetch options
        const fetchOptions: RequestInit = {
          method: options.method || 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache',
            ...(options.headers || {})
          },
          credentials: options.credentials === 'include' ? 'include' : 'same-origin'
        };
        
        if (options.body) {
          fetchOptions.body = typeof options.body === 'string' 
            ? options.body 
            : JSON.stringify(options.body);
        }
        
        // Use native fetch as fallback
        fetch(cacheBustUrl, fetchOptions)
          .then(response => {
            console.log(`[XHR #${requestId}] ✅ Native fetch succeeded! Status: ${response.status}`);
            resolve(response);
          })
          .catch(fetchError => {
            console.error(`[XHR #${requestId}] ❌ Native fetch also failed:`, fetchError);
            reject(new Error(`Both XHR and fetch failed for request #${requestId}: ${fetchError.message}`));
          });
      };
      
      // Handle timeout
      xhr.ontimeout = () => {
        const elapsed = Date.now() - startTime;
        console.error(`[XHR #${requestId}] ⏱️ TIMEOUT after ${xhr.timeout}ms (elapsed: ${elapsed}ms)`);
        
        // FALLBACK TO NATIVE FETCH
        console.log(`[XHR #${requestId}] 🔄 Timeout - Falling back to native fetch...`);
        
        const fetchOptions: RequestInit = {
          method: options.method || 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            ...(options.headers || {})
          },
          credentials: options.credentials === 'include' ? 'include' : 'same-origin'
        };
        
        if (options.body) {
          fetchOptions.body = typeof options.body === 'string' 
            ? options.body 
            : JSON.stringify(options.body);
        }
        
        fetch(cacheBustUrl, fetchOptions)
          .then(response => {
            console.log(`[XHR #${requestId}] ✅ Native fetch succeeded after timeout! Status: ${response.status}`);
            resolve(response);
          })
          .catch(fetchError => {
            console.error(`[XHR #${requestId}] ❌ Native fetch also failed after timeout:`, fetchError);
            reject(new Error(`Request #${requestId} timed out and fallback failed`));
          });
      };
      
      // Send request
      console.log(`[XHR #${requestId}] Preparing to send request...`);
      if (options.body) {
        const bodyToSend = typeof options.body === 'string' 
          ? options.body 
          : JSON.stringify(options.body);
        console.log(`[XHR #${requestId}] Sending with body (${bodyToSend.length} chars)`);
        xhr.send(bodyToSend);
      } else {
        console.log(`[XHR #${requestId}] Sending without body`);
        xhr.send();
      }
      
      console.log(`[XHR #${requestId}] ✅ xhr.send() called successfully`);
      
    } catch (error) {
      // CATCH ANY ERRORS IN XHR SETUP
      console.error(`[XHR #${requestId}] ❌ CRITICAL ERROR in XHR setup:`, error);
      console.log(`[XHR #${requestId}] 🔄 Falling back to native fetch due to setup error...`);
      
      // Try native fetch as last resort
      const fetchOptions: RequestInit = {
        method: options.method || 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          ...(options.headers || {})
        },
        credentials: options.credentials === 'include' ? 'include' : 'same-origin'
      };
      
      if (options.body) {
        fetchOptions.body = typeof options.body === 'string' 
          ? options.body 
          : JSON.stringify(options.body);
      }
      
      // Fallback URL with cache busting
      const fallbackUrl = url.includes('?')
        ? `${url}&_t=${Date.now()}&_r=${Math.random()}`
        : `${url}?_t=${Date.now()}&_r=${Math.random()}`;
      
      fetch(fallbackUrl, fetchOptions)
        .then(response => {
          console.log(`[XHR #${requestId}] ✅ Emergency fetch succeeded! Status: ${response.status}`);
          resolve(response);
        })
        .catch(fetchError => {
          console.error(`[XHR #${requestId}] ❌ Emergency fetch failed:`, fetchError);
          reject(fetchError);
        });
    }
  });
}

/**
 * Get request counter for debugging
 */
export function getRequestCount(): number {
  return requestCounter;
}

/**
 * Reset request counter
 */
export function resetRequestCount(): void {
  requestCounter = 0;
}