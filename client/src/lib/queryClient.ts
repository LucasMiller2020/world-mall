import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getSessionId } from "./session";
import { fetchWithXHR } from "./xhr-fetch";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}


export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: HeadersInit = data ? { "Content-Type": "application/json" } : {};
  
  // Add X-Session header for World App WebView fallback
  // We want BOTH cookie and header for redundancy
  headers['X-Session'] = await getSessionId();
  
  // FIX 1 & 3: Add aggressive cache busting and cache headers
  headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0';
  headers['Pragma'] = 'no-cache';
  
  // Add cache busting to URL
  const timestamp = Date.now();
  const cacheBustUrl = url.includes('?') 
    ? `${url}&_t=${timestamp}&_r=${Math.random()}`
    : `${url}?_t=${timestamp}&_r=${Math.random()}`;
  
  // FIX 2: Use XMLHttpRequest for better WebView support
  const res = await fetchWithXHR(cacheBustUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Keep for cookie support
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = queryKey.join("/") as string;
    const timestamp = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    
    // FIX 1: Aggressive cache busting
    const cacheBustUrl = baseUrl.includes('?')
      ? `${baseUrl}&_t=${timestamp}&_r=${Math.random()}&_req=${requestId}`
      : `${baseUrl}?_t=${timestamp}&_r=${Math.random()}&_req=${requestId}`;
    
    // FIX 9: Debug logging
    console.log(`[Query ${requestId}] Fetching: ${cacheBustUrl}`);
    
    // FIX 2 & 3: Use XMLHttpRequest with cache headers
    const res = await fetchWithXHR(cacheBustUrl, {
      credentials: "include",
      headers: {
        'X-Session': await getSessionId(),
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Request-ID': requestId
      }
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log(`[Query ${requestId}] 401 - returning null`);
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();
    console.log(`[Query ${requestId}] Success - got data:`, data);
    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
