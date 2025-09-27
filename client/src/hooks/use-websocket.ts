import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useWebSocket(humanId?: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
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
              queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
              break;
              
            case 'message_starred':
              // Update specific message star count
              queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
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

  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [humanId]);

  // Start polling as fallback when WebSocket is disconnected
  useEffect(() => {
    if (!isConnected) {
      const pollInterval = setInterval(() => {
        // Invalidate queries to trigger polling fallback
        queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
        queryClient.invalidateQueries({ queryKey: ['/api/presence'] });
      }, 2000);

      return () => clearInterval(pollInterval);
    }
  }, [isConnected, queryClient]);

  return { isConnected };
}
