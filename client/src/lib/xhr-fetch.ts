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
    
    // AGGRESSIVE CACHE BUSTING - add timestamp and random to URL
    const cacheBustUrl = url.includes('?') 
      ? `${url}&_t=${Date.now()}&_r=${Math.random()}&_req=${requestId}`
      : `${url}?_t=${Date.now()}&_r=${Math.random()}&_req=${requestId}`;
    
    console.log(`[XHR #${requestId}] Starting request to: ${cacheBustUrl}`);
    
    const xhr = new XMLHttpRequest();
    
    // Set method (default GET)
    xhr.open(options.method || 'GET', cacheBustUrl, true);
    
    // FORCE AGGRESSIVE CACHE HEADERS
    xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    xhr.setRequestHeader('Pragma', 'no-cache');
    xhr.setRequestHeader('Expires', '0');
    xhr.setRequestHeader('X-Request-ID', `${requestId}`);
    xhr.setRequestHeader('X-Timestamp', `${Date.now()}`);
    
    // Set custom headers
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
    }
    
    // Handle credentials
    if (options.credentials === 'include') {
      xhr.withCredentials = true;
    }
    
    // Set timeout (default 10 seconds)
    xhr.timeout = options.timeout || 10000;
    
    // Handle response
    xhr.onload = () => {
      const elapsed = Date.now() - startTime;
      console.log(`[XHR #${requestId}] Completed in ${elapsed}ms - Status: ${xhr.status}`);
      
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
            console.log(`[XHR #${requestId}] Parsed JSON response:`, data);
            return Promise.resolve(data);
          } catch (e) {
            console.error(`[XHR #${requestId}] Failed to parse JSON:`, e);
            return Promise.reject(e);
          }
        }
      } as Response;
      
      resolve(response);
    };
    
    // Handle errors
    xhr.onerror = () => {
      const elapsed = Date.now() - startTime;
      console.error(`[XHR #${requestId}] Network error after ${elapsed}ms`);
      reject(new Error(`Network error for request #${requestId}`));
    };
    
    // Handle timeout
    xhr.ontimeout = () => {
      console.error(`[XHR #${requestId}] Timeout after ${xhr.timeout}ms`);
      reject(new Error(`Request #${requestId} timed out`));
    };
    
    // Send request
    if (options.body) {
      if (typeof options.body === 'string') {
        xhr.send(options.body);
      } else {
        xhr.send(JSON.stringify(options.body));
      }
    } else {
      xhr.send();
    }
    
    console.log(`[XHR #${requestId}] Request sent with cache-bust params`);
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