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
    role: 'guest',
    isVerified: false,
    limits: {
      maxChars: 10,
      features: ['global_room']
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
      setAuthState(userInfo);
    }
  }, [userInfo]);

  const isGuest = () => authState.role === 'guest';
  const isVerified = () => authState.role === 'verified' || authState.role === 'admin';
  const isAdmin = () => authState.role === 'admin';
  
  const canStar = () => authState.limits.features.includes('star');
  const canReport = () => authState.limits.features.includes('report');
  const canWorkMode = () => authState.limits.features.includes('work_mode');
  const canConnect = () => authState.limits.features.includes('connect');

  const verifyWithWorldId = async (proof: any) => {
    try {
      const response = await fetch('/api/verify/worldid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(proof),
      });

      if (response.ok) {
        const result = await response.json();
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