import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Users, Gift, Target, Copy, Share, Plus, TrendingUp, Award, Star,
  ExternalLink, Calendar, MessageSquare, Trophy, ChevronUp, ChevronDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorldId } from "@/hooks/use-world-id";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { 
  ReferralDashboard as ReferralDashboardType,
  ReferralLeaderboardEntry,
  InviteCodeWithStats,
  ReferralWithDetails 
} from "@shared/schema";

// QR Code generation component (using a simple QR code library or placeholder)
function QRCodeDisplay({ value, size = 200 }: { value: string; size?: number }) {
  // For now, we'll use a placeholder. In a real app, you'd use a QR library like qrcode.js
  return (
    <div 
      className="border-2 border-dashed border-muted-foreground/20 rounded-lg flex items-center justify-center bg-muted/50"
      style={{ width: size, height: size }}
    >
      <div className="text-center space-y-2">
        <div className="text-2xl">📱</div>
        <p className="text-xs text-muted-foreground">QR Code</p>
        <p className="text-xs font-mono break-all px-2">{value}</p>
      </div>
    </div>
  );
}

// Component for creating new invite codes
function InviteGenerator() {
  const { toast } = useToast();
  const [customMessage, setCustomMessage] = useState("");
  const [maxUsage, setMaxUsage] = useState(100);
  const [isOpen, setIsOpen] = useState(false);

  const generateInviteMutation = useMutation({
    mutationFn: async (data: { customMessage?: string; maxUsage?: number }) => {
      const response = await apiRequest('POST', '/api/invites/generate', data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Invite code generated! 🎉",
        description: `Your new invite code ${data.code} is ready to share.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/invites/my-codes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/referrals/dashboard'] });
      setIsOpen(false);
      setCustomMessage("");
      setMaxUsage(100);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to generate invite code",
        variant: "destructive"
      });
    }
  });

  const handleGenerate = () => {
    generateInviteMutation.mutate({
      customMessage: customMessage.trim() || undefined,
      maxUsage
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" data-testid="button-generate-invite">
          <Plus className="h-4 w-4 mr-2" />
          Generate New Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Invite Code</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="message">Custom Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a personal message to your invite..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              maxLength={200}
              data-testid="input-custom-message"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {customMessage.length}/200 characters
            </p>
          </div>
          <div>
            <Label htmlFor="maxUsage">Maximum Usage</Label>
            <Input
              id="maxUsage"
              type="number"
              min={1}
              max={1000}
              value={maxUsage}
              onChange={(e) => setMaxUsage(parseInt(e.target.value) || 100)}
              data-testid="input-max-usage"
            />
            <p className="text-xs text-muted-foreground mt-1">
              How many people can use this invite code
            </p>
          </div>
          <Button 
            onClick={handleGenerate}
            disabled={generateInviteMutation.isPending}
            className="w-full"
            data-testid="button-confirm-generate"
          >
            {generateInviteMutation.isPending ? "Generating..." : "Generate Invite"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Component for displaying and sharing invite codes
function InviteCodeCard({ invite }: { invite: InviteCodeWithStats }) {
  const { toast } = useToast();
  const inviteUrl = `${window.location.origin}/invite/${invite.code}`;
  const usagePercentage = (invite.usageCount / invite.maxUsage) * 100;

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${type} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const shareInvite = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join World Mall",
          text: `${invite.customMessage || "Join me on World Mall - the bot-proof global chat!"}\n\nUse my invite code: ${invite.code}`,
          url: inviteUrl
        });
      } catch (error) {
        // User cancelled or error occurred
        copyToClipboard(inviteUrl, "Invite link");
      }
    } else {
      copyToClipboard(inviteUrl, "Invite link");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{invite.code}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Created {new Date(invite.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Badge variant={invite.isActive ? "default" : "secondary"}>
            {invite.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {invite.customMessage && (
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm italic">"{invite.customMessage}"</p>
          </div>
        )}

        {/* Usage Stats */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Usage</span>
            <span>{invite.usageCount} / {invite.maxUsage}</span>
          </div>
          <Progress value={usagePercentage} className="h-2" />
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold">{invite.totalClicks || 0}</div>
            <div className="text-xs text-muted-foreground">Clicks</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{invite.conversions || 0}</div>
            <div className="text-xs text-muted-foreground">Joins</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{invite.conversionRate || 0}%</div>
            <div className="text-xs text-muted-foreground">Rate</div>
          </div>
        </div>

        {/* Sharing Options */}
        <div className="flex space-x-2">
          <Button 
            onClick={() => copyToClipboard(invite.code, "Invite code")}
            variant="outline" 
            size="sm" 
            className="flex-1"
            data-testid={`button-copy-code-${invite.code}`}
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy Code
          </Button>
          <Button 
            onClick={shareInvite}
            variant="outline" 
            size="sm" 
            className="flex-1"
            data-testid={`button-share-invite-${invite.code}`}
          >
            <Share className="h-3 w-3 mr-1" />
            Share Link
          </Button>
        </div>

        {/* QR Code (in a small format) */}
        <div className="flex justify-center">
          <QRCodeDisplay value={inviteUrl} size={120} />
        </div>
      </CardContent>
    </Card>
  );
}

// Component for referral history
function ReferralHistory({ referrals }: { referrals: ReferralWithDetails[] }) {
  if (referrals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No referrals yet</p>
        <p className="text-sm">Share your invite codes to start earning rewards!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {referrals.map((referral) => (
        <Card key={referral.id}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-xs">
                    {referral.inviteeHandle?.slice(0, 2).toUpperCase() || 'HU'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{referral.inviteeHandle || 'New Human'}</p>
                  <p className="text-xs text-muted-foreground">
                    via {referral.inviteCode} • {new Date(referral.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={referral.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                  {referral.status}
                </Badge>
                {referral.pointsEarned && (
                  <p className="text-xs text-muted-foreground mt-1">
                    +{referral.pointsEarned} points
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Component for milestones and achievements
function MilestonesCard({ dashboard }: { dashboard: ReferralDashboardType }) {
  const milestones = dashboard.milestones || [];
  const nextMilestone = dashboard.nextMilestone;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="h-5 w-5" />
          <span>Milestones & Achievements</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Progress */}
        {nextMilestone && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Next Milestone</span>
              <Badge variant="outline">{nextMilestone.level} referrals</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span>{nextMilestone.progress} / {nextMilestone.level}</span>
              </div>
              <Progress value={(nextMilestone.progress / nextMilestone.level) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {nextMilestone.remaining} more referrals for {nextMilestone.reward} bonus points
              </p>
            </div>
          </div>
        )}

        {/* Achieved Milestones */}
        {milestones.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-3">Achievements</h4>
              <div className="space-y-2">
                {milestones.slice(0, 5).map((milestone) => (
                  <div key={milestone.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">{milestone.level} Referrals</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      +{milestone.pointsRewarded} points
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Leaderboard component
function LeaderboardCard() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'all_time'>('all_time');

  const { data: leaderboard, isLoading } = useQuery<ReferralLeaderboardEntry[]>({
    queryKey: ['/api/referrals/leaderboard', { period, limit: 10 }]
  });

  const periodLabels = {
    daily: 'Today',
    weekly: 'This Week',
    monthly: 'This Month',
    all_time: 'All Time'
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Award className="h-5 w-5" />
          <span>Leaderboard</span>
        </CardTitle>
        <div className="flex space-x-1">
          {Object.entries(periodLabels).map(([key, label]) => (
            <Button
              key={key}
              variant={period === key ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(key as any)}
              data-testid={`button-leaderboard-${key}`}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="w-6 h-6 bg-muted rounded"></div>
                <div className="w-8 h-8 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-1">
                  <div className="w-20 h-4 bg-muted rounded"></div>
                  <div className="w-16 h-3 bg-muted rounded"></div>
                </div>
                <div className="w-12 h-4 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard?.map((entry, index) => (
              <div 
                key={entry.humanId} 
                className={`flex items-center space-x-3 p-2 rounded-lg ${
                  entry.isCurrentUser ? 'bg-primary/10' : ''
                }`}
              >
                <div className="flex items-center justify-center w-6 h-6">
                  {index < 3 ? (
                    <div className={`text-lg ${
                      index === 0 ? 'text-yellow-500' : 
                      index === 1 ? 'text-gray-400' : 'text-amber-600'
                    }`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">{entry.rank}</span>
                  )}
                </div>
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-xs">
                    {entry.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {entry.handle} {entry.isCurrentUser && "(You)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.referralCount} referrals • {entry.pointsEarned} points
                  </p>
                </div>
                <div className="flex items-center space-x-1">
                  {entry.trend === 'up' && <ChevronUp className="h-4 w-4 text-green-500" />}
                  {entry.trend === 'down' && <ChevronDown className="h-4 w-4 text-red-500" />}
                  {entry.badges.map((badge) => (
                    <Badge key={badge} variant="secondary" className="text-xs">
                      {badge}
                    </Badge>
                  ))}
                </div>
              </div>
            )) || (
              <div className="text-center text-muted-foreground py-4">
                No leaderboard data available
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Main referral dashboard component
export default function ReferralDashboard() {
  const { humanId, isVerified } = useWorldId();

  // Query for dashboard data
  const { data: dashboard, isLoading: dashboardLoading } = useQuery<ReferralDashboardType>({
    queryKey: ['/api/referrals/dashboard'],
    enabled: !!humanId && isVerified
  });

  // Query for invite codes
  const { data: inviteCodes, isLoading: codesLoading } = useQuery<InviteCodeWithStats[]>({
    queryKey: ['/api/invites/my-codes'],
    enabled: !!humanId && isVerified
  });

  if (!isVerified) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 p-4">
        <div className="text-6xl">🔐</div>
        <h2 className="text-xl font-semibold">Verification Required</h2>
        <p className="text-muted-foreground text-center">
          Please verify with World ID to access your referral dashboard.
        </p>
      </div>
    );
  }

  if (dashboardLoading || codesLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Loading your referral dashboard...</p>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 p-4">
        <div className="text-6xl">❌</div>
        <h2 className="text-xl font-semibold">Dashboard Unavailable</h2>
        <p className="text-muted-foreground text-center">
          Unable to load your referral dashboard. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Referral Dashboard</h1>
        <p className="text-muted-foreground">
          Share World Mall and earn rewards for growing our community
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-primary">{dashboard.totalReferrals}</div>
            <div className="text-sm text-muted-foreground">Total Referrals</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-green-600">{dashboard.successfulReferrals}</div>
            <div className="text-sm text-muted-foreground">Successful</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{dashboard.conversionRate}%</div>
            <div className="text-sm text-muted-foreground">Conversion Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{dashboard.totalPointsEarned}</div>
            <div className="text-sm text-muted-foreground">Points Earned</div>
          </CardContent>
        </Card>
      </div>

      {/* Rank and Generate Invite */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <div className="text-xl font-bold">#{dashboard.currentRank || 'N/A'}</div>
            <div className="text-sm text-muted-foreground">Global Rank</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <InviteGenerator />
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="invites" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="invites">My Invites</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="invites" className="space-y-4">
          {inviteCodes && inviteCodes.length > 0 ? (
            <div className="grid gap-4">
              {inviteCodes.map((invite) => (
                <InviteCodeCard key={invite.id} invite={invite} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <Gift className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="font-semibold">No invite codes yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Generate your first invite code to start earning referral rewards
                  </p>
                </div>
                <InviteGenerator />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="referrals">
          <ReferralHistory referrals={dashboard.recentReferrals} />
        </TabsContent>

        <TabsContent value="milestones">
          <MilestonesCard dashboard={dashboard} />
        </TabsContent>

        <TabsContent value="leaderboard">
          <LeaderboardCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}