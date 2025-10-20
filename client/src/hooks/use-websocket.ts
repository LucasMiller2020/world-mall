import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isMiniApp, getMiniAppPollInterval } from "@/lib/platform";

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
      console.log('[WebSocket] Running in Mini App - activating polling fallback');
      setUsePollingFallback(true);
      setIsConnected(true); // Mark as "connected" for polling mode
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

  // Polling function for Mini App and fallback
  const pollMessages = async () => {
    try {
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['/api/messages', room] });
      queryClient.invalidateQueries({ queryKey: ['/api/presence'] });
    } catch (error) {
      console.error('[Polling] Error polling messages:', error);
    }
  };

  useEffect(() => {
    if (isInMiniApp || usePollingFallback) {
      // Set up polling for Mini App or when WebSocket has failed
      const pollInterval = isInMiniApp ? getMiniAppPollInterval() : 1500; // 1.5s for fallback, 2.5s for MiniApp
      const source = isInMiniApp ? 'Mini App' : 'WebSocket fallback';
      console.log(`[Polling] Starting polling (${source}) with interval: ${pollInterval}ms`);
      
      // Initial poll
      pollMessages();
      
      // Set up recurring polls
      pollIntervalRef.current = setInterval(pollMessages, pollInterval);
      
      // Mark as connected for polling mode
      setIsConnected(true);
      
      // If in fallback mode, periodically try to reconnect WebSocket
      if (usePollingFallback) {
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
