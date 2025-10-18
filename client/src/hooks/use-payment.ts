import { useState, useCallback, useEffect } from "react";
import { useMiniKit } from "@worldcoin/minikit-js/minikit-provider";
import { MiniKit, PayCommandInput, PaymentResult } from "@worldcoin/minikit-js";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export interface PaymentHookResult {
  isPaying: boolean;
  payForPremium: () => Promise<void>;
  paymentError: string | null;
}

export function usePayment(): PaymentHookResult {
  const [isPaying, setIsPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const { isInstalled } = useMiniKit();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const payForPremium = useCallback(async () => {
    if (!isInstalled) {
      const error = 'World App not detected. Please open this app in World App to make payments.';
      setPaymentError(error);
      toast({
        title: "World App Required",
        description: error,
        variant: "destructive",
      });
      throw new Error(error);
    }

    if (isPaying) {
      return;
    }

    setIsPaying(true);
    setPaymentError(null);

    try {
      // Generate a unique reference for this payment
      const reference = `premium_${Date.now()}_${crypto.randomUUID()}`;
      
      // Create payment request for exactly 1 WLD
      const payPayload: PayCommandInput = {
        // Token ID for WLD (Worldcoin)
        token: "WLD",
        // Amount in smallest unit (1 WLD = 1e18 units for ERC20 tokens)
        // For simplicity, we'll use 1 as the amount since MiniKit handles the conversion
        amount: "1",
        // Description for the payment
        description: "Mall Space Premium - Lifetime Access",
        // Reference ID for tracking
        reference: reference,
      };

      console.log('Initiating payment with MiniKit:', payPayload);

      // Execute payment command
      const result = await MiniKit.commandsAsync.pay(payPayload);
      
      console.log('Payment result:', result);

      // Check if payment was successful
      if (result.finalPayload?.status === 'success') {
        const paymentData = result.finalPayload as PaymentResult;
        
        // Send payment confirmation to backend
        const response = await fetch('/api/premium/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            transactionId: paymentData.transaction_hash || reference,
            paymentProof: JSON.stringify(paymentData),
            amount: 1,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to activate premium');
        }

        const premiumResult = await response.json();
        
        // Success! Invalidate queries to refresh user data
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['/api/me'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/premium/status'] }),
        ]);

        toast({
          title: "Premium Activated! 🎉",
          description: "Welcome to Mall Space Premium. Enjoy unlimited messages and exclusive features!",
        });

        console.log('Premium activated successfully:', premiumResult);
      } else {
        // Payment was cancelled or failed
        const errorMsg = result.finalPayload?.error_message || 'Payment was cancelled';
        setPaymentError(errorMsg);
        
        toast({
          title: "Payment Failed",
          description: errorMsg,
          variant: "destructive",
        });
        
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      
      const errorMessage = error.message || 'Payment failed. Please try again.';
      setPaymentError(errorMessage);
      
      // Don't show duplicate toast if already shown
      if (!error.message?.includes('cancelled')) {
        toast({
          title: "Payment Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
      
      throw error;
    } finally {
      setIsPaying(false);
    }
  }, [isInstalled, isPaying, queryClient, toast]);

  return {
    isPaying,
    payForPremium,
    paymentError,
  };
}

// Hook to check premium status
export function usePremiumStatus() {
  const { isInstalled } = useMiniKit();
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkPremiumStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/premium/status', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsPremium(data.isPremium);
      }
    } catch (error) {
      console.error('Error checking premium status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check status on mount - properly using useEffect
  useEffect(() => {
    checkPremiumStatus();
  }, [checkPremiumStatus]);

  return {
    isPremium,
    isLoading,
    isInstalled,
    checkPremiumStatus,
  };
}