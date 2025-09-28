import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, Heart, Shield, Gift, UserPlus } from "lucide-react";
import { useWorldId } from "@/hooks/use-world-id";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { InviteCodeValidation } from "@shared/schema";

export default function Capsule() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [inviteCode, setInviteCode] = useState("");
  const [hasInviteCode, setHasInviteCode] = useState(false);
  const [validatedInvite, setValidatedInvite] = useState<InviteCodeValidation | null>(null);
  const { humanId, verify } = useWorldId();
  const { toast } = useToast();

  // Check URL for invite code parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteFromUrl = urlParams.get('invite');
    if (inviteFromUrl) {
      setInviteCode(inviteFromUrl);
      setHasInviteCode(true);
    }
  }, []);

  // Validate invite code when it changes
  const { data: inviteValidation, isLoading: validatingInvite } = useQuery<InviteCodeValidation>({
    queryKey: ['/api/invites/validate', inviteCode],
    enabled: !!inviteCode && inviteCode.length >= 6,
    retry: false
  });

  useEffect(() => {
    if (inviteValidation) {
      setValidatedInvite(inviteValidation);
    }
  }, [inviteValidation]);

  // Process referral mutation
  const processReferralMutation = useMutation({
    mutationFn: async (inviteCode: string) => {
      return apiRequest('/api/invites/process-referral', {
        method: 'POST',
        body: { inviteCode }
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/referrals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invites'] });
      
      toast({
        title: "Welcome! 🎉",
        description: `You've successfully joined via ${data.referral?.inviteCode}. Bonus rewards added!`,
      });
    },
    onError: (error: any) => {
      const errorCode = error.response?.data?.code;
      if (errorCode === 'ALREADY_REFERRED') {
        toast({
          title: "Already referred",
          description: "You've already used an invite code. Welcome back!",
          variant: "destructive"
        });
      } else if (errorCode === 'SELF_REFERRAL') {
        toast({
          title: "Invalid invite",
          description: "You cannot use your own invite code.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: error.response?.data?.message || "Failed to process invite",
          variant: "destructive"
        });
      }
    }
  });

  // Mark capsule as seen
  const markCapsuleSeenMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/capsule-seen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-World-ID-Proof': humanId || '',
        },
      });
      
      if (!res.ok) {
        throw new Error('Failed to mark capsule as seen');
      }
      
      return res.json();
    },
    onSuccess: () => {
      // Navigate to global square after successful verification
      setLocation('/room/global');
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to complete onboarding",
        variant: "destructive",
      });
    },
  });

  const totalSteps = 4;

  const handleNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkipOnboarding = () => {
    setLocation('/room/global');
  };

  const handleStartVerification = async () => {
    try {
      await verify();
      
      // If user has a valid invite code, process it first
      if (humanId && validatedInvite?.valid && validatedInvite.inviteCode && inviteCode) {
        try {
          await processReferralMutation.mutateAsync(inviteCode);
        } catch (error) {
          // Continue even if referral processing fails
          console.error('Referral processing failed:', error);
        }
      }

      // Mark capsule as seen
      if (humanId) {
        markCapsuleSeenMutation.mutate();
      } else {
        setLocation('/room/global');
      }
    } catch (error) {
      toast({
        title: "Verification Failed",
        description: "Please try again or skip for now",
        variant: "destructive",
      });
    }
  };

  const handleInviteSkip = () => {
    setHasInviteCode(false);
    setInviteCode("");
    setValidatedInvite(null);
    handleNextStep();
  };

  const steps = [
    {
      icon: Users,
      title: "Welcome to World Mall",
      description: "You're entering a real-human space.",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: UserPlus,
      title: "Join with Invite Code",
      description: "Got an invite code? Enter it to earn bonus rewards.",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      icon: Heart,
      title: "Community Guidelines",
      description: "Be kind. No spam. No NSFW. No scams.",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      icon: Shield,
      title: "Human Verification",
      description: "Post as a human: verify once with World ID.",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  const currentStepData = steps[currentStep - 1];
  const StepIcon = currentStepData.icon;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Progress Indicator */}
      <div className="px-6 pt-6">
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`h-2 flex-1 rounded-full ${
                step <= currentStep ? 'bg-primary' : 'bg-muted'
              }`}
              data-testid={`progress-step-${step}`}
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 flex flex-col justify-center px-6">
        <div className="text-center mb-12">
          <div className={`w-20 h-20 ${currentStepData.bgColor} rounded-full flex items-center justify-center mx-auto mb-6`}>
            <StepIcon className={`h-8 w-8 ${currentStepData.color}`} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-4" data-testid="text-step-title">
            {currentStepData.title}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed" data-testid="text-step-description">
            {currentStepData.description}
          </p>
          
          {/* Invite Code Input for step 2 */}
          {currentStep === 2 && (
            <Card className="mt-6">
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">Invite Code</Label>
                  <Input
                    id="inviteCode"
                    placeholder="Enter your invite code here..."
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="text-center font-mono"
                    data-testid="input-invite-code"
                  />
                  {validatingInvite && (
                    <p className="text-sm text-muted-foreground">Validating...</p>
                  )}
                  {validatedInvite && !validatingInvite && (
                    <div className="space-y-2">
                      {validatedInvite.valid ? (
                        <div className="flex items-center space-x-2 text-green-600">
                          <Gift className="h-4 w-4" />
                          <span className="text-sm">Valid invite code!</span>
                        </div>
                      ) : (
                        <div className="text-sm text-red-600">
                          {validatedInvite.reason}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {validatedInvite?.valid && validatedInvite.inviteCode && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">From:</span>
                      <Badge variant="secondary">
                        {validatedInvite.inviteCode.creatorHandle || 'Fellow Human'}
                      </Badge>
                    </div>
                    {validatedInvite.inviteCode.customMessage && (
                      <p className="text-sm italic">"{validatedInvite.inviteCode.customMessage}"</p>
                    )}
                    <div className="text-sm text-green-600">
                      ✨ You'll earn 100 bonus points for joining!
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Additional info for step 4 (verification) */}
          {currentStep === 4 && (
            <Card className="mt-6">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground" data-testid="text-privacy-notice">
                  Your identity stays private. We only store a unique, anonymous proof that you're human.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Step Actions */}
        <div className="space-y-4">
          {currentStep === 1 ? (
            <>
              <Button 
                onClick={handleNextStep}
                className="w-full py-4 font-medium"
                size="lg"
                data-testid="button-continue"
              >
                Continue
              </Button>
              <Button 
                variant="ghost"
                onClick={handleSkipOnboarding}
                className="w-full"
                data-testid="button-skip"
              >
                Skip Onboarding
              </Button>
            </>
          ) : currentStep === 2 ? (
            <>
              <Button 
                onClick={handleNextStep}
                className="w-full py-4 font-medium"
                size="lg"
                disabled={validatedInvite && !validatedInvite.valid && inviteCode.length > 0}
                data-testid="button-continue-with-invite"
              >
                {validatedInvite?.valid ? (
                  <>
                    <Gift className="h-4 w-4 mr-2" />
                    Continue with Invite
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
              <Button 
                variant="ghost"
                onClick={handleInviteSkip}
                className="w-full"
                data-testid="button-skip-invite"
              >
                Skip Invite Code
              </Button>
              <Button 
                variant="ghost"
                onClick={handlePreviousStep}
                className="w-full"
                data-testid="button-back"
              >
                Back
              </Button>
            </>
          ) : currentStep === 3 ? (
            <>
              <Button 
                onClick={handleNextStep}
                className="w-full py-4 font-medium"
                size="lg"
                data-testid="button-i-understand"
              >
                I Understand
              </Button>
              <Button 
                variant="ghost"
                onClick={handlePreviousStep}
                className="w-full"
                data-testid="button-back"
              >
                Back
              </Button>
            </>
          ) : currentStep === 4 ? (
            <>
              <Button 
                onClick={handleStartVerification}
                className="w-full py-4 font-medium"
                size="lg"
                data-testid="button-verify-and-continue"
              >
                <Shield className="h-4 w-4 mr-2" />
                Verify & Continue
              </Button>
              <Button 
                variant="ghost"
                onClick={handlePreviousStep}
                className="w-full"
                data-testid="button-previous-step"
              >
                Back
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
