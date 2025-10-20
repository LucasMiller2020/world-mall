import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isMiniApp, getMiniAppPollInterval } from "@/lib/platform";
import { fetchWithXHR } from "@/lib/xhr-fetch";

export function useWebSocket(humanId?: string | null, room: string = 'global') {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const pollIntervalRef = useRef<NodeJS.Timeout>();
  const lastMessageIdRef = useRef<string | null>(null);
  const isInMiniApp = isMiniApp();
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout>();
  const lastHeartbeatRef = useRef<number>(Date.now());
  const [usePollingFallback, setUsePollingFallback] = useState(false);
  const rafIdRef = useRef<number>();
  const pollCountRef = useRef(0);
  const lastMessageHashRef = useRef<string>('');
  
  // Debug logging to diagnose platform detection issues
  useEffect(() => {
    console.log('[Platform Detection]', {
      isInMiniApp,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      hasMinikit: typeof window !== 'undefined' && !!(window as any).minikit,
      willUseWebSocket: !isInMiniApp,
      willUsePolling: isInMiniApp
    });
  }, []);

  const connect = () => {
    console.log('[WebSocket] Connect function called', {
      isInMiniApp,
      currentConnection: wsRef.current?.readyState,
      timestamp: new Date().toISOString()
    });
    
    // Skip WebSocket connection in Mini App, use polling instead
    if (isInMiniApp) {
      console.log('[WebSocket] Running in Mini App - polling handled by useEffect');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected, skipping');
      return;
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log('[WebSocket] Attempting to connect to:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      console.log('[WebSocket] WebSocket object created');

      ws.onopen = () => {
        setIsConnected(true);
        setUsePollingFallback(false);
        reconnectAttemptsRef.current = 0;
        lastHeartbeatRef.current = Date.now();
        
        // Send authentication message if humanId is available
        if (humanId) {
          ws.send(JSON.stringify({
            type: 'auth',
            humanId: humanId
          }));
        }

        // Start heartbeat monitoring
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }
        heartbeatTimeoutRef.current = setTimeout(checkHeartbeat, 5000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Update heartbeat timestamp on any message
          lastHeartbeatRef.current = Date.now();
          
          switch (message.type) {
            case 'ping':
              // Server sent a ping, respond with pong to acknowledge
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'pong' }));
              }
              break;
              
            case 'new_message':
              // Invalidate messages query to refetch
              queryClient.invalidateQueries({ queryKey: ['/api/messages', message.room] });
              break;
              
            case 'message_starred':
              // Update specific message star count
              queryClient.invalidateQueries({ queryKey: ['/api/messages', message.room] });
              break;

            case 'message_edited':
              // Update edited message
              queryClient.invalidateQueries({ queryKey: ['/api/messages', message.room] });
              break;

            case 'message_deleted':
              // Remove deleted message
              queryClient.invalidateQueries({ queryKey: ['/api/messages', message.room] });
              break;
              
            case 'presence_update':
              // Update presence count
              queryClient.setQueryData(['/api/presence'], message.data);
              break;
              
            default:
              console.log('Unknown WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        
        // Clear heartbeat timeout
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
        }
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000;
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          // Max reconnect attempts reached, switch to polling
          console.log('[WebSocket] Max reconnect attempts reached, switching to polling fallback');
          setUsePollingFallback(true);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
      
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      setIsConnected(false);
    }
  };

  // Heartbeat check function
  const checkHeartbeat = () => {
    const now = Date.now();
    const timeSinceLastHeartbeat = now - lastHeartbeatRef.current;
    
    // If no message received in 15 seconds, connection might be stale
    if (timeSinceLastHeartbeat > 15000) {
      console.log('[WebSocket] No heartbeat detected, connection may be stale');
      if (wsRef.current) {
        wsRef.current.close();
      }
    } else {
      // Schedule next heartbeat check
      heartbeatTimeoutRef.current = setTimeout(checkHeartbeat, 5000);
    }
  };

  // AGGRESSIVE POLLING WITH ALL FIXES - ENHANCED WITH SYNC DIAGNOSTICS
  const pollMessages = async (source: string = 'interval') => {
    const pollId = ++pollCountRef.current;
    const timestamp = Date.now();
    const sessionId = localStorage.getItem('wm_sid') || 'NO_SESSION';
    
    console.log(`[POLL #${pollId}] ========== STARTING POLL FROM ${source.toUpperCase()} ==========`);
    console.log(`[POLL #${pollId}] 🕐 Timestamp: ${new Date(timestamp).toISOString()}`);
    console.log(`[POLL #${pollId}] 🔑 Session ID: ${sessionId.substring(0, 20)}...`);
    console.log(`[POLL #${pollId}] 📍 Room: ${room}`);
    
    // Get current local state count before poll
    const currentLocalMessages = queryClient.getQueryData(['/api/messages', room]) as any[];
    const localCount = currentLocalMessages?.length || 0;
    console.log(`[POLL #${pollId}] 📊 Local state: ${localCount} messages`);
    
    try {
      // FIX 1 & 2: Cache busting + XMLHttpRequest with ABSOLUTE URL
      const messagesUrl = `/api/messages/${room}?t=${timestamp}&r=${Math.random()}&poll=${pollId}&src=${source}`;
      const fullMessagesUrl = `${window.location.protocol}//${window.location.host}${messagesUrl}`;
      const presenceUrl = `/api/presence?t=${timestamp}&r=${Math.random()}&poll=${pollId}`;
      const fullPresenceUrl = `${window.location.protocol}//${window.location.host}${presenceUrl}`;
      
      console.log(`[POLL #${pollId}] 📡 Fetching messages from: ${fullMessagesUrl}`);
      console.log(`[POLL #${pollId}] About to call fetchWithXHR...`);
      
      let messagesResponse;
      let messages;
      
      try {
        // Try XHR first
        messagesResponse = await fetchWithXHR(messagesUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Poll-ID': String(pollId),
            'X-Source': source
          }
        });
        console.log(`[POLL #${pollId}] fetchWithXHR completed, status: ${messagesResponse.status}`);
        
        if (messagesResponse.ok) {
          messages = await messagesResponse.json();
          console.log(`[POLL #${pollId}] ✅ XHR SUCCESS - Fetched ${messages?.length || 0} messages`);
        } else {
          console.error(`[POLL #${pollId}] ❌ XHR failed with status ${messagesResponse.status}`);
        }
      } catch (xhrError) {
        console.error(`[POLL #${pollId}] ❌ XHR FAILED:`, xhrError);
        console.log(`[POLL #${pollId}] 🔄 FALLBACK - Trying native fetch...`);
        
        // FALLBACK TO NATIVE FETCH
        try {
          const nativeResponse = await fetch(fullMessagesUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'X-Poll-ID': String(pollId),
              'X-Source': source + '-fallback'
            }
          });
          
          console.log(`[POLL #${pollId}] Native fetch status: ${nativeResponse.status}`);
          
          if (nativeResponse.ok) {
            messages = await nativeResponse.json();
            console.log(`[POLL #${pollId}] ✅ NATIVE FETCH SUCCESS - Fetched ${messages?.length || 0} messages`);
          } else {
            console.error(`[POLL #${pollId}] ❌ Native fetch failed with status ${nativeResponse.status}`);
          }
        } catch (fetchError) {
          console.error(`[POLL #${pollId}] ❌ BOTH XHR AND NATIVE FETCH FAILED:`, fetchError);
          
          // Last resort: localStorage
          const cached = localStorage.getItem(`wm_messages_${room}`);
          if (cached) {
            messages = JSON.parse(cached);
            console.log(`[POLL #${pollId}] 📦 Using cached messages (${messages?.length || 0} items)`);
          }
        }
      }
      
      // Process messages if we got any
      if (messages) {
        // ENHANCED DIAGNOSTICS: Log full response details
        const backendCount = messages.length;
        const messageIds = messages.map((m: any) => m.id.substring(0, 8)).join(', ');
        const messageAuthors = messages.map((m: any) => {
          const author = m.authorHumanId?.substring(0, 20) || 'unknown';
          const isOtherSession = m.authorHumanId && m.authorHumanId !== sessionId && !m.authorHumanId.includes(sessionId);
          return `${author}${isOtherSession ? '*' : ''}`;
        }).join(', ');
        
        console.log(`[POLL #${pollId}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`[POLL #${pollId}] 📊 SYNC COMPARISON:`);
        console.log(`[POLL #${pollId}]    Local State:  ${localCount} messages`);
        console.log(`[POLL #${pollId}]    Backend API:  ${backendCount} messages`);
        console.log(`[POLL #${pollId}]    Diff:         ${backendCount - localCount > 0 ? '+' : ''}${backendCount - localCount}`);
        console.log(`[POLL #${pollId}] 🆔 Message IDs: ${messageIds || 'none'}`);
        console.log(`[POLL #${pollId}] 👤 Authors (* = other session): ${messageAuthors || 'none'}`);
        console.log(`[POLL #${pollId}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        
        console.log(`[POLL #${pollId}] 📝 Updating query cache with ${messages.length} messages`);
        
        // FIX 4: Manual cache manipulation
        queryClient.setQueryData(['/api/messages', room], messages);
        
        // FIX 7: LocalStorage sync
        const messageHash = JSON.stringify(messages?.slice(0, 5)?.map((m: any) => m.id));
        if (messageHash !== lastMessageHashRef.current) {
          console.log(`[POLL #${pollId}] 🆕 NEW MESSAGES DETECTED! Hash changed`);
          console.log(`[POLL #${pollId}]    Previous hash: ${lastMessageHashRef.current.substring(0, 50)}...`);
          console.log(`[POLL #${pollId}]    New hash:      ${messageHash.substring(0, 50)}...`);
          lastMessageHashRef.current = messageHash;
          localStorage.setItem(`wm_messages_${room}`, JSON.stringify(messages));
          localStorage.setItem(`wm_messages_time_${room}`, String(timestamp));
          localStorage.setItem('wm_last_poll_success', String(timestamp));
          
          // Trigger storage event
          window.dispatchEvent(new StorageEvent('storage', {
            key: `wm_messages_${room}`,
            newValue: JSON.stringify(messages),
            url: window.location.href
          }));
        } else {
          console.log(`[POLL #${pollId}] ℹ️ No new messages detected (hash unchanged)`);
        }
      } else {
        console.error(`[POLL #${pollId}] ⚠️ No messages received from any source`);
      }
      
      // Fetch presence with similar fallback logic
      console.log(`[POLL #${pollId}] 📡 Fetching presence from: ${fullPresenceUrl}`);
      
      try {
        const presenceResponse = await fetchWithXHR(presenceUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (presenceResponse.ok) {
          const presence = await presenceResponse.json();
          console.log(`[POLL #${pollId}] ✅ Presence fetched successfully`);
          queryClient.setQueryData(['/api/presence'], presence);
          localStorage.setItem('wm_presence', JSON.stringify(presence));
        }
      } catch (presenceError) {
        console.error(`[POLL #${pollId}] ❌ Presence fetch failed:`, presenceError);
        
        // Try native fetch for presence
        try {
          const nativePresence = await fetch(fullPresenceUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (nativePresence.ok) {
            const presence = await nativePresence.json();
            console.log(`[POLL #${pollId}] ✅ Presence fetched via native fetch`);
            queryClient.setQueryData(['/api/presence'], presence);
            localStorage.setItem('wm_presence', JSON.stringify(presence));
          }
        } catch (e) {
          console.error(`[POLL #${pollId}] ❌ Presence native fetch also failed:`, e);
        }
      }
      
      // Also do traditional refetch as backup
      console.log(`[POLL #${pollId}] 🔄 Running traditional refetch as backup...`);
      await Promise.all([
        queryClient.refetchQueries({ 
          queryKey: ['/api/messages', room],
          type: 'active'
        }),
        queryClient.refetchQueries({ 
          queryKey: ['/api/presence'],
          type: 'active'
        })
      ]);
      
      console.log(`[POLL #${pollId}] ✅ POLL COMPLETED from ${source}`);
      return true;
    } catch (error) {
      console.error(`[POLL #${pollId}] ❌ CRITICAL ERROR in polling from ${source}:`, error);
      console.error(`[POLL #${pollId}] Stack trace:`, (error as Error).stack);
      return false;
    }
  };
  
  // FIX 6: RequestAnimationFrame polling (runs in parallel)
  const rafPolling = () => {
    const now = Date.now();
    const lastPoll = parseInt(localStorage.getItem('wm_last_raf_poll') || '0');
    
    // Poll every 2 seconds using RAF
    if (now - lastPoll > 2000) {
      localStorage.setItem('wm_last_raf_poll', String(now));
      pollMessages('raf').then(() => {
        // Continue RAF polling
        if (isInMiniApp || usePollingFallback) {
          rafIdRef.current = requestAnimationFrame(rafPolling);
        }
      });
    } else {
      // Continue checking
      if (isInMiniApp || usePollingFallback) {
        rafIdRef.current = requestAnimationFrame(rafPolling);
      }
    }
  };

  useEffect(() => {
    if (isInMiniApp || usePollingFallback) {
      // Set up polling for Mini App or when WebSocket has failed
      const pollInterval = isInMiniApp ? getMiniAppPollInterval() : 1500; // 1.5s for fallback, 2.5s for MiniApp
      const source = isInMiniApp ? 'Mini App' : 'WebSocket fallback';
      console.log(`[Polling] Starting polling (${source}) with interval: ${pollInterval}ms`);
      
      // Mark as using polling fallback for status badge
      setUsePollingFallback(true);
      
      // Initial poll
      pollMessages();
      
      // Set up recurring polls with more aggressive approach
      let pollCount = 0;
      const startPolling = () => {
        // Clear any existing interval
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        
        pollIntervalRef.current = setInterval(() => {
          pollCount++;
          console.log(`[Polling] Poll #${pollCount} triggered`);
          pollMessages();
        }, pollInterval);
      };
      
      startPolling();
      
      // FIX 6: Start RequestAnimationFrame polling
      rafPolling();
      
      // Add visibility/focus handlers to restart polling when app comes back
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log('[Polling] App became visible, forcing immediate poll');
          pollMessages('visibility');
          startPolling(); // Restart interval
        } else {
          console.log('[Polling] App hidden, pausing polls');
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        }
      };
      
      const handleFocus = () => {
        console.log('[Polling] Window focused, forcing immediate poll');
        pollMessages('focus');
        startPolling();
      };
      
      // FIX 7: Listen for storage events from other tabs
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === `wm_messages_${room}` && e.newValue) {
          console.log('[Storage] Messages updated from another tab');
          try {
            const messages = JSON.parse(e.newValue);
            queryClient.setQueryData(['/api/messages', room], messages);
          } catch (err) {
            console.error('[Storage] Failed to parse messages:', err);
          }
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('storage', handleStorageChange);
      
      // Mark as connected for polling mode
      setIsConnected(true);
      
      // If in fallback mode (but NOT Mini App), periodically try to reconnect WebSocket
      // Mini App should NEVER try to reconnect WebSocket - polling only
      if (usePollingFallback && !isInMiniApp) {
        const reconnectInterval = setInterval(() => {
          console.log('[WebSocket] Attempting to reconnect from fallback mode...');
          reconnectAttemptsRef.current = 0; // Reset attempts
          setUsePollingFallback(false); // Try WebSocket again
        }, 30000); // Try every 30 seconds
        
        return () => {
          clearInterval(reconnectInterval);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
      }
      
      // For Mini App, return cleanup function to clear polling on unmount
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('storage', handleStorageChange);
      };
    } else {
      // Use WebSocket for regular web
      connect();
    }

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [humanId, room, isInMiniApp, usePollingFallback]);

  // Additional aggressive polling when WebSocket is disconnected (for web only)
  // This ensures messages still come through even when WebSocket is temporarily down
  useEffect(() => {
    if (!isConnected && !isInMiniApp && !usePollingFallback) {
      console.log('[Polling] WebSocket disconnected, starting temporary polling');
      const pollInterval = setInterval(() => {
        // Invalidate queries to trigger polling fallback
        queryClient.invalidateQueries({ queryKey: ['/api/messages', room] });
        queryClient.invalidateQueries({ queryKey: ['/api/presence'] });
      }, 1500); // Poll every 1.5 seconds when disconnected

      return () => clearInterval(pollInterval);
    }
  }, [isConnected, queryClient, isInMiniApp, usePollingFallback, room]);

  return { isConnected, usePollingFallback };
}
