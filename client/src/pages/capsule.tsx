import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Heart, Shield } from "lucide-react";
import { useWorldId } from "@/hooks/use-world-id";
import { useToast } from "@/hooks/use-toast";

export default function Capsule() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const { humanId, verify } = useWorldId();
  const { toast } = useToast();

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

  const handleNextStep = () => {
    if (currentStep < 3) {
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
      // If verification succeeds, mark capsule as seen
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

  const steps = [
    {
      icon: Users,
      title: "Welcome to Humans Square",
      description: "You're entering a real-human space.",
      color: "text-primary",
      bgColor: "bg-primary/10",
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
          {[1, 2, 3].map((step) => (
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
          
          {/* Additional info for step 3 */}
          {currentStep === 3 && (
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
          {currentStep === 3 ? (
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
          ) : currentStep === 1 ? (
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
                Skip
              </Button>
            </>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
