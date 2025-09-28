import { useState, useEffect, useCallback } from "react";
import { useMiniKit } from "@worldcoin/minikit-js/minikit-provider";
import { VerificationLevel, VerifyCommandInput, MiniKit } from "@worldcoin/minikit-js";
import { useQueryClient } from "@tanstack/react-query";
import { getSessionId } from "@/lib/session";

export function useWorldId() {
  const [humanId, setHumanId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { isInstalled } = useMiniKit();
  const queryClient = useQueryClient();

  // Load saved verification state from localStorage
  useEffect(() => {
    const savedHumanId = localStorage.getItem('wm_human_id');
    const savedVerification = localStorage.getItem('wm_verified');
    
    if (savedHumanId && savedVerification === 'true') {
      setHumanId(savedHumanId);
      setIsVerified(true);
    }
  }, []);

  const verify = useCallback(async () => {
    if (!isInstalled) {
      throw new Error('World App not detected. Please open this app in World App.');
    }

    if (isVerifying) {
      return;
    }

    setIsVerifying(true);

    try {
      // Generate a random signal for this verification session
      const signal = crypto.randomUUID();
      
      // Use WORLD_ID_ACTION from environment or fallback
      const action = import.meta.env.VITE_WORLD_ID_ACTION || 'world-mall/verify';
      
      const verifyPayload: VerifyCommandInput = {
        action: action,
        verification_level: VerificationLevel.Orb,
        signal: signal,
      };

      const result = await MiniKit.commandsAsync.verify(verifyPayload);
      
      if (result.finalPayload.status === 'success') {
        // Get session ID for header
        const sessionId = await getSessionId();
        
        // POST the proof to our backend
        const verificationData = {
          nullifier_hash: result.finalPayload.nullifier_hash,
          proof: result.finalPayload.proof,
          merkle_root: result.finalPayload.merkle_root,
          verification_level: result.finalPayload.verification_level || 'orb',
          action: action,
          signal: signal,
        };
        
        const response = await fetch('/api/verify/worldid', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session': sessionId,
          },
          credentials: 'include', // Include cookies for session
          body: JSON.stringify(verificationData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Verification failed on server');
        }

        const serverResult = await response.json();
        
        // Check if verification was successful
        if (serverResult.ok && serverResult.role === 'verified') {
          // Update local state with server response
          const verifiedHumanId = serverResult.humanId;
          setHumanId(verifiedHumanId);
          setIsVerified(true);

          // Persist verification state with new naming convention
          localStorage.setItem('wm_human_id', verifiedHumanId);
          localStorage.setItem('wm_verified', 'true');
          localStorage.setItem('wm_role', serverResult.role);
          localStorage.setItem('wm_uid', verifiedHumanId);

          // Refetch user data and policy to get updated permissions
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['/api/me'] }),
            queryClient.invalidateQueries({ queryKey: ['/api/policy'] }),
          ]);

          console.log('World ID verification successful');
          return verifiedHumanId;
        } else {
          throw new Error(serverResult.message || 'Verification failed');
        }
      } else {
        throw new Error('Verification failed');
      }
    } catch (error) {
      console.error('World ID verification error:', error);
      throw error;
    } finally {
      setIsVerifying(false);
    }
  }, [isInstalled, isVerifying, queryClient]);

  const clearVerification = useCallback(() => {
    setHumanId(null);
    setIsVerified(false);
    localStorage.removeItem('wm_human_id');
    localStorage.removeItem('wm_verified');
    localStorage.removeItem('wm_role');
  }, []);

  return {
    humanId,
    isVerified,
    isVerifying,
    isInstalled,
    verify,
    clearVerification,
  };
}

// Hook that only provides MiniKit installation status for components that don't need full verification
export function useMiniKitStatus() {
  const { isInstalled } = useMiniKit();
  
  return {
    isInstalled,
  };
}