import { useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export function useHeartbeat(enabled: boolean = true) {
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Send initial heartbeat
    const sendHeartbeat = async () => {
      try {
        await apiRequest('/api/heartbeat', 'POST', {});
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    };

    sendHeartbeat();

    // Set up interval for periodic heartbeats
    intervalRef.current = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled]);
}
