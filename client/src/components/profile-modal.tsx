import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserPlus, X, Coins, Award, TrendingUp } from "lucide-react";
import { useWorldId } from "@/hooks/use-world-id";
import { useToast } from "@/hooks/use-toast";
import type { HumanProfile } from "@shared/schema";

interface ProfileModalProps {
  humanId: string;
  onClose: () => void;
}

export function ProfileModal({ humanId, onClose }: ProfileModalProps) {
  const { humanId: currentHumanId, isVerified, verify } = useWorldId();
  const { toast } = useToast();

  // Fetch profile data
  const { data: profile, isLoading } = useQuery<HumanProfile>({
    queryKey: ['/api/profile', humanId],
    queryFn: async () => {
      const res = await fetch(`/api/profile/${humanId}`);
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
  });

  // Connect request mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-World-ID-Proof': currentHumanId || '',
        },
        body: JSON.stringify({ targetHumanId: humanId }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to send connect request');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Connect Request Sent",
        description: data.message,
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConnect = async () => {
    if (!isVerified) {
      await verify();
      return;
    }
    connectMutation.mutate();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (isLoading || !profile) {
    return (
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50"
        onClick={handleBackdropClick}
        data-testid="profile-modal-backdrop"
      >
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6">
            <div className="animate-pulse">
              <div className="w-16 h-16 bg-muted rounded-full mx-auto mb-4"></div>
              <div className="h-4 bg-muted rounded mb-4"></div>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded"></div>
                <div className="h-3 bg-muted rounded"></div>
                <div className="h-3 bg-muted rounded"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50"
      onClick={handleBackdropClick}
      data-testid="profile-modal-backdrop"
    >
      <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <CardContent className="pt-6">
          {/* Close Button */}
          <div className="flex justify-end mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-testid="button-close-profile"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Profile Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-lg font-bold text-primary" data-testid="text-profile-initials">
                {profile.initials}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-foreground" data-testid="text-profile-handle">
              {profile.handle}
            </h2>
            {profile.leaderboardRank && (
              <div className="mt-2">
                <Badge variant="secondary" className="text-xs">
                  <Award className="h-3 w-3 mr-1" />
                  Rank #{profile.leaderboardRank}
                </Badge>
              </div>
            )}
          </div>

          {/* Profile Stats */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">First seen</span>
              <span className="text-sm text-foreground" data-testid="text-profile-first-seen">
                {profile.firstSeen}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total posts</span>
              <span className="text-sm text-foreground" data-testid="text-profile-total-posts">
                {profile.totalPosts}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Stars received</span>
              <span className="text-sm text-green-600" data-testid="text-profile-stars-received">
                {profile.starsReceived}
              </span>
            </div>
            
            {/* Point Information */}
            <div className="border-t pt-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Coins className="h-3 w-3" />
                  Point balance
                </span>
                <span className="text-sm font-semibold text-yellow-600" data-testid="text-profile-point-balance">
                  {profile.pointBalance.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Lifetime earned
                </span>
                <span className="text-sm text-green-600" data-testid="text-profile-lifetime-earned">
                  {profile.lifetimePointsEarned.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Today's points</span>
                <span className="text-sm text-blue-600" data-testid="text-profile-points-today">
                  +{profile.pointsEarnedToday.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {humanId !== currentHumanId && (
              <Button 
                onClick={handleConnect}
                disabled={connectMutation.isPending}
                className="w-full"
                data-testid="button-request-connect"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {connectMutation.isPending ? 'Sending...' : 'Request Connect'}
              </Button>
            )}
            <Button 
              variant="secondary"
              onClick={onClose}
              className="w-full"
              data-testid="button-close-profile-secondary"
            >
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
