import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface AuthState {
  humanId: string | null;
  role: 'guest' | 'verified' | 'admin';
  isVerified: boolean;
  limits: {
    maxChars: number;
    cooldownSec?: number;
    maxPerDay?: number;
    features: string[];
  };
  joinedAt: Date | null;
  capsuleSeen: boolean;
}

interface PolicyData {
  guestMode: {
    enabled: boolean;
    maxChars: number;
    cooldownSec: number;
    maxPerDay: number;
  };
  verified: {
    maxChars: number;
    features: string[];
  };
  rateLimits: any;
}

export function useAuthRole() {
  const [authState, setAuthState] = useState<AuthState>({
    humanId: null,
    role: 'guest', // Default until verified
    isVerified: false,
    limits: {
      maxChars: 240, // World ID verified users only
      features: [] // No features until verified
    },
    joinedAt: null,
    capsuleSeen: false
  });

  // Fetch policy configuration
  const { data: policy } = useQuery<PolicyData>({
    queryKey: ['/api/policy'],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Fetch current user info
  const { data: userInfo, refetch: refetchUserInfo } = useQuery<AuthState>({
    queryKey: ['/api/me'],
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (userInfo) {
      // Merge userInfo with policy data for accurate limits
      let updatedInfo = { ...userInfo };
      
      // Guest mode enabled - everyone gets full access
      if (policy) {
        updatedInfo.limits = {
          ...userInfo.limits,
          maxChars: userInfo.role === 'verified' || userInfo.role === 'admin' 
            ? (policy.verified.maxChars || 240)
            : 240, // Guests get same as verified
          features: ['global_room', 'star', 'report', 'work_mode', 'connect'] // Full access for everyone
        };
      }
      
      setAuthState(updatedInfo);
    }
  }, [userInfo, policy]);

  const isGuest = () => authState.role === 'guest';
  const isVerified = () => authState.role === 'verified' || authState.role === 'admin';
  const isAdmin = () => authState.role === 'admin';
  
  const canStar = () => authState.limits.features.includes('star'); // All users can star
  const canReport = () => authState.limits.features.includes('report'); // All users can report
  const canWorkMode = () => authState.limits.features.includes('work_mode'); // All users can access work mode
  const canConnect = () => authState.limits.features.includes('connect'); // All users can connect

  const verifyWithWorldId = async (proof: any) => {
    try {
      // Get session ID for header
      const { getSessionId } = await import('@/lib/session');
      const sessionId = await getSessionId();
      
      const response = await fetch('/api/verify/worldid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session': sessionId,
        },
        credentials: 'include',
        body: JSON.stringify(proof),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update local state immediately if we got the data
        if (result.ok && result.role === 'verified') {
          setAuthState(prev => ({
            ...prev,
            humanId: result.humanId,
            role: 'verified',
            isVerified: true,
            limits: {
              maxChars: 240,
              features: ['global_room', 'star', 'report', 'work_mode', 'connect']
            }
          }));
          
          // Store in localStorage for persistence
          localStorage.setItem('wm_uid', result.humanId);
          localStorage.setItem('wm_role', 'verified');
        }
        
        // Refetch user info after successful verification
        await refetchUserInfo();
        return result;
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Verification failed');
      }
    } catch (error) {
      console.error('World ID verification error:', error);
      throw error;
    }
  };

  return {
    ...authState,
    policy,
    isGuest,
    isVerified,
    isAdmin,
    canStar,
    canReport,
    canWorkMode,
    canConnect,
    verifyWithWorldId,
    refetchUserInfo,
  };
}