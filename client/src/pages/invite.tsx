import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Users, Gift, Target, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorldId } from "@/hooks/use-world-id";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { InviteCodeValidation } from "@shared/schema";

interface InvitePageProps {
  params: { code: string };
}

// Component for displaying invite code validation and invitation details
function InviteValidation({ code }: { code: string }) {
  const { toast } = useToast();
  const { humanId, isVerified } = useWorldId();
  const [, setLocation] = useLocation();

  // Query to validate the invite code
  const { data: validation, isLoading, error } = useQuery<InviteCodeValidation>({
    queryKey: ['/api/invites/validate', code],
    enabled: !!code
  });

  // Mutation to process the referral
  const processReferralMutation = useMutation({
    mutationFn: async (inviteCode: string) => {
      const response = await apiRequest('POST', `/api/invites/process-referral`, { inviteCode });
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/referrals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invites'] });
      
      toast({
        title: "Welcome to Humans Square! 🎉",
        description: `You've successfully joined via ${data.inviteCode || 'invite'}. Enjoy your rewards!`,
      });

      // Redirect to capsule for onboarding
      setLocation("/capsule");
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || "Failed to process invite";
      
      if (error.response?.data?.code === 'ALREADY_REFERRED') {
        toast({
          title: "Already referred",
          description: "You've already used an invite code. Welcome back!",
          variant: "destructive"
        });
        setLocation("/capsule");
      } else if (error.response?.data?.code === 'SELF_REFERRAL') {
        toast({
          title: "Invalid invite",
          description: "You cannot use your own invite code.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    }
  });

  const handleJoinWithInvite = () => {
    if (!isVerified) {
      toast({
        title: "Verification required",
        description: "Please verify with World ID first to join via invite.",
        variant: "destructive"
      });
      return;
    }

    if (!validation?.valid || !validation.inviteCode) {
      toast({
        title: "Invalid invite",
        description: "This invite code is not valid or has expired.",
        variant: "destructive"
      });
      return;
    }

    processReferralMutation.mutate(code);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Validating invite code...</p>
      </div>
    );
  }

  if (error || !validation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="text-6xl">❌</div>
        <h2 className="text-xl font-semibold text-destructive">Invalid Invite</h2>
        <p className="text-muted-foreground text-center">
          This invite code is invalid, expired, or has been used up.
        </p>
        <Button onClick={() => setLocation("/")} variant="outline">
          Go to Home
        </Button>
      </div>
    );
  }

  if (!validation.valid) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="text-6xl">⏰</div>
        <h2 className="text-xl font-semibold text-destructive">Invite Unavailable</h2>
        <p className="text-muted-foreground text-center">
          {validation.reason}
        </p>
        <Button onClick={() => setLocation("/")} variant="outline">
          Go to Home
        </Button>
      </div>
    );
  }

  const inviteCode = validation.inviteCode!;
  const usagePercentage = (inviteCode.usageCount / inviteCode.maxUsage) * 100;
  const timeLeft = inviteCode.expiresAt 
    ? Math.max(0, new Date(inviteCode.expiresAt).getTime() - Date.now())
    : null;

  const formatTimeLeft = (ms: number): string => {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return "Less than 1 hour";
  };

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="text-6xl">🎉</div>
        <h1 className="text-2xl font-bold">You're Invited!</h1>
        <p className="text-muted-foreground">
          Join Humans Square, the bot-proof global chat platform
        </p>
      </div>

      {/* Invite Details Card */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Inviter Info */}
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {inviteCode.creatorHandle?.slice(0, 2).toUpperCase() || 'HU'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{inviteCode.creatorHandle || 'Fellow Human'}</p>
              <p className="text-sm text-muted-foreground">invited you to join</p>
            </div>
          </div>

          {/* Custom Message */}
          {inviteCode.customMessage && (
            <>
              <Separator />
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm italic">"{inviteCode.customMessage}"</p>
              </div>
            </>
          )}

          {/* Invite Code Stats */}
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Invite Code</span>
              <Badge variant="secondary" className="font-mono">
                {inviteCode.code}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Usage</span>
                <span>{inviteCode.usageCount} / {inviteCode.maxUsage}</span>
              </div>
              <Progress value={usagePercentage} className="h-2" />
            </div>

            {timeLeft && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Expires in</span>
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formatTimeLeft(timeLeft)}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Benefits Card */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">What you'll get:</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">Join verified humans</p>
                <p className="text-sm text-muted-foreground">Bot-proof chat via World ID</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <Gift className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">Welcome bonus</p>
                <p className="text-sm text-muted-foreground">100 points to get started</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <Target className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium">Referral rewards</p>
                <p className="text-sm text-muted-foreground">Both you and your inviter get bonus points</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button 
          onClick={handleJoinWithInvite}
          disabled={processReferralMutation.isPending || !isVerified}
          className="w-full"
          size="lg"
          data-testid="button-join-with-invite"
        >
          {processReferralMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </>
          ) : (
            <>
              <Gift className="h-4 w-4 mr-2" />
              Join with this invite
            </>
          )}
        </Button>

        {!isVerified && (
          <p className="text-sm text-center text-muted-foreground">
            World ID verification required to join
          </p>
        )}

        <Button 
          onClick={() => setLocation("/")}
          variant="outline"
          className="w-full"
          data-testid="button-join-normally"
        >
          Join without invite code
        </Button>
      </div>
    </div>
  );
}

// Main invite page component
export default function InvitePage() {
  const [match, params] = useRoute("/invite/:code");
  
  if (!match || !params?.code) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="text-6xl">🔗</div>
        <h2 className="text-xl font-semibold">Invalid Invite Link</h2>
        <p className="text-muted-foreground text-center">
          This invite link is malformed or missing the invite code.
        </p>
        <Button onClick={() => window.location.href = "/"} variant="outline">
          Go to Home
        </Button>
      </div>
    );
  }

  return <InviteValidation code={params.code} />;
}