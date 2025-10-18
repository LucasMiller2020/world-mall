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

  const connect = () => {
    // Skip WebSocket connection in Mini App, use polling instead
    if (isInMiniApp) {
      console.log('[WebSocket] Running in Mini App - using polling strategy');
      setIsConnected(true); // Mark as "connected" for polling mode
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        
        // Send authentication message if humanId is available
        if (humanId) {
          ws.send(JSON.stringify({
            type: 'auth',
            humanId: humanId
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
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
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000;
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
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

  // Polling function for Mini App
  const pollMessages = async () => {
    try {
      // Build query params
      const params = new URLSearchParams();
      if (lastMessageIdRef.current) {
        params.append('since', lastMessageIdRef.current);
      }
      
      const response = await fetch(`/api/messages/${room}?${params}`);
      if (response.ok) {
        const messages = await response.json();
        
        if (Array.isArray(messages) && messages.length > 0) {
          // Update last message ID for next poll
          const latestMessage = messages[messages.length - 1];
          if (latestMessage?.id) {
            lastMessageIdRef.current = latestMessage.id;
          }
          
          // Invalidate queries to update UI
          queryClient.invalidateQueries({ queryKey: ['/api/messages', room] });
        }
      }
    } catch (error) {
      console.error('[Polling] Error fetching messages:', error);
    }
  };

  useEffect(() => {
    if (isInMiniApp) {
      // Set up polling for Mini App
      const pollInterval = getMiniAppPollInterval();
      console.log(`[Polling] Starting polling with interval: ${pollInterval}ms`);
      
      // Initial poll
      pollMessages();
      
      // Set up recurring polls
      pollIntervalRef.current = setInterval(pollMessages, pollInterval);
      
      // Mark as connected for polling mode
      setIsConnected(true);
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
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [humanId, room, isInMiniApp]);

  // Start polling as fallback when WebSocket is disconnected (for web only)
  useEffect(() => {
    if (!isConnected && !isInMiniApp) {
      const pollInterval = setInterval(() => {
        // Invalidate queries to trigger polling fallback
        queryClient.invalidateQueries({ queryKey: ['/api/messages', room] });
        queryClient.invalidateQueries({ queryKey: ['/api/presence'] });
      }, 2000);

      return () => clearInterval(pollInterval);
    }
  }, [isConnected, queryClient, isInMiniApp]);

  return { isConnected };
}
