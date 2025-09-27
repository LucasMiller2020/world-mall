import { useState, useEffect, useCallback } from "react";
import { useMiniKit } from "@worldcoin/minikit-js/minikit-provider";
import { VerificationLevel, VerifyCommandInput, MiniKit } from "@worldcoin/minikit-js";
import crypto from "crypto";

export function useWorldId() {
  const [humanId, setHumanId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const { isInstalled } = useMiniKit();

  // Load saved verification state from localStorage
  useEffect(() => {
    const savedHumanId = localStorage.getItem('humans_square_human_id');
    const savedVerification = localStorage.getItem('humans_square_verified');
    
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
      const verifyPayload: VerifyCommandInput = {
        action: 'verify_human',
        verification_level: VerificationLevel.Orb,
        signal: crypto.randomUUID(), // Random signal for this verification
      };

      const result = await MiniKit.commandsAsync.verify(verifyPayload);
      
      if (result.finalPayload.status === 'success') {
        // Create deterministic human ID from nullifier hash
        const nullifierHash = result.finalPayload.nullifier_hash;
        const generatedHumanId = crypto
          .createHash('sha256')
          .update(nullifierHash + 'humans_square_salt')
          .digest('hex');

        setHumanId(generatedHumanId);
        setIsVerified(true);

        // Persist verification state
        localStorage.setItem('humans_square_human_id', generatedHumanId);
        localStorage.setItem('humans_square_verified', 'true');

        console.log('World ID verification successful');
        return generatedHumanId;
      } else {
        throw new Error('Verification failed');
      }
    } catch (error) {
      console.error('World ID verification error:', error);
      throw error;
    } finally {
      setIsVerifying(false);
    }
  }, [isInstalled, isVerifying]);

  const clearVerification = useCallback(() => {
    setHumanId(null);
    setIsVerified(false);
    localStorage.removeItem('humans_square_human_id');
    localStorage.removeItem('humans_square_verified');
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
