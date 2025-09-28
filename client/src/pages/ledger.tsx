import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { ArrowLeft, Info, TrendingUp, Users, Coins, Award, Calendar, Zap } from "lucide-react";
import type { LedgerEntry, DistributionEvent, LeaderboardEntry, UserPointHistory } from "@shared/schema";

export default function Ledger() {
  const [, setLocation] = useLocation();

  // Fetch distribution events (new point system)
  const { data: distributions = [], isLoading: distributionsLoading } = useQuery<DistributionEvent[]>({
    queryKey: ['/api/points/distributions'],
    queryFn: async () => {
      const res = await fetch('/api/points/distributions');
      if (!res.ok) throw new Error('Failed to fetch distributions');
      return res.json();
    },
  });

  // Fetch leaderboard
  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/points/leaderboard'],
    queryFn: async () => {
      const res = await fetch('/api/points/leaderboard?period=all&limit=10');
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json();
    },
  });

  // Fetch user point history (requires authentication)
  const { data: userHistory, isLoading: historyLoading } = useQuery<UserPointHistory>({
    queryKey: ['/api/points/history'],
    queryFn: async () => {
      const res = await fetch('/api/points/history', {
        headers: {
          'x-world-id-proof': 'demo-proof-for-testing'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch point history');
      return res.json();
    },
  });

  // Fetch legacy ledger entries
  const { data: legacyEntries = [], isLoading: legacyLoading } = useQuery<LedgerEntry[]>({
    queryKey: ['/api/ledger'],
    queryFn: async () => {
      const res = await fetch('/api/ledger');
      if (!res.ok) throw new Error('Failed to fetch ledger entries');
      return res.json();
    },
  });

  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center gap-3 mb-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLocation('/room/global')}
            data-testid="button-go-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground" data-testid="text-page-title">
            Room Rain Ledger
          </h1>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">
          Transparent points distribution history and leaderboards
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <Tabs defaultValue="distributions" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="distributions" data-testid="tab-distributions">
              <Calendar className="h-4 w-4 mr-2" />
              Distributions
            </TabsTrigger>
            <TabsTrigger value="leaderboard" data-testid="tab-leaderboard">
              <Award className="h-4 w-4 mr-2" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="my-points" data-testid="tab-my-points">
              <Coins className="h-4 w-4 mr-2" />
              My Points
            </TabsTrigger>
            <TabsTrigger value="legacy" data-testid="tab-legacy">
              <Info className="h-4 w-4 mr-2" />
              Legacy
            </TabsTrigger>
          </TabsList>

          {/* Distribution Events Tab */}
          <TabsContent value="distributions" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Total Distributed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="text-total-distributed">
                    {distributions.reduce((sum, d) => sum + d.totalPoints, 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">points across all events</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Recipients
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-recipients">
                    {distributions.reduce((sum, d) => sum + d.participantCount, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">total participation events</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Latest Event
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-latest-event">
                    {distributions.length > 0 ? formatTimeAgo(distributions[0].executedAt) : 'None'}
                  </div>
                  <p className="text-xs text-muted-foreground">most recent distribution</p>
                </CardContent>
              </Card>
            </div>

            {distributionsLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonLoader key={i} />)
            ) : distributions.length > 0 ? (
              <div className="space-y-4" data-testid="list-distribution-events">
                {distributions.map((event) => (
                  <Card key={event.id} data-testid={`distribution-event-${event.id}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base" data-testid="text-event-title">
                          {event.title}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant={event.type === 'daily_rain' ? 'default' : 'secondary'}>
                            {event.type === 'daily_rain' ? 'Daily' : 'Weekly'}
                          </Badge>
                          <span className="text-xs text-muted-foreground" data-testid="text-event-timestamp">
                            {formatTimeAgo(event.executedAt)}
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4" data-testid="text-event-description">
                        {event.description}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Total Points</p>
                          <p className="font-semibold text-green-600" data-testid="text-event-points">
                            {event.totalPoints.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Recipients</p>
                          <p className="font-semibold" data-testid="text-event-participants">
                            {event.participantCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Room</p>
                          <p className="font-semibold capitalize" data-testid="text-event-room">
                            {event.room}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Avg per User</p>
                          <p className="font-semibold" data-testid="text-event-average">
                            {event.participantCount > 0 ? Math.round(event.totalPoints / event.participantCount) : 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground" data-testid="text-no-distributions">
                    No point distributions yet
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Top Point Earners
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboardLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonLoader key={i} />)
                ) : leaderboard.length > 0 ? (
                  <div className="space-y-3" data-testid="list-leaderboard">
                    {leaderboard.map((entry, index) => (
                      <div key={entry.humanId} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50" data-testid={`leaderboard-entry-${entry.rank}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index === 0 ? 'bg-yellow-500 text-white' :
                            index === 1 ? 'bg-gray-400 text-white' :
                            index === 2 ? 'bg-amber-600 text-white' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {entry.rank}
                          </div>
                          <div>
                            <p className="font-medium" data-testid="text-leaderboard-handle">{entry.handle}</p>
                            <p className="text-xs text-muted-foreground">{entry.initials}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600" data-testid="text-leaderboard-points">
                            {entry.points.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">points</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8" data-testid="text-no-leaderboard">
                    No leaderboard data yet
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Points Tab */}
          <TabsContent value="my-points" className="space-y-4 mt-6">
            {historyLoading ? (
              Array.from({ length: 3 }).map((_, i) => <SkeletonLoader key={i} />)
            ) : userHistory ? (
              <>
                {/* Point Balance Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Current Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600" data-testid="text-current-balance">
                        {userHistory.currentBalance.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">points available</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Lifetime Earned</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold" data-testid="text-lifetime-earned">
                        {userHistory.totalEarned.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">total points earned</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Points Spent</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold" data-testid="text-total-spent">
                        {userHistory.totalSpent.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">lifetime spending</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Point Sources Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Point Sources</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3" data-testid="list-point-breakdown">
                      {userHistory.breakdown.map((item) => (
                        <div key={item.source} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                          <div>
                            <p className="font-medium capitalize" data-testid="text-breakdown-source">
                              {item.source.replace('_', ' ')}
                            </p>
                            <p className="text-xs text-muted-foreground" data-testid="text-breakdown-description">
                              {item.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600" data-testid="text-breakdown-points">
                              {item.points.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.count} {item.count === 1 ? 'time' : 'times'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Transactions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2" data-testid="list-recent-transactions">
                      {userHistory.transactions.slice(0, 10).map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-2 rounded border">
                          <div className="flex-1">
                            <p className="text-sm font-medium" data-testid="text-transaction-description">
                              {transaction.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTimeAgo(transaction.createdAt)}
                            </p>
                          </div>
                          <div className={`font-bold ${transaction.type === 'earn' ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.type === 'earn' ? '+' : '-'}{transaction.points}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground" data-testid="text-no-point-history">
                    No point history available. Start participating to earn points!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Legacy Tab */}
          <TabsContent value="legacy" className="space-y-4 mt-6">
            {legacyLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonLoader key={i} />)
            ) : legacyEntries.length > 0 ? (
              <div className="space-y-4" data-testid="list-legacy-entries">
                {legacyEntries.map((entry) => (
                  <Card key={entry.id} data-testid={`legacy-entry-${entry.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-foreground" data-testid="text-legacy-title">
                          {entry.title}
                        </h3>
                        <span className="text-xs text-muted-foreground" data-testid="text-legacy-timestamp">
                          {formatTimeAgo(entry.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3" data-testid="text-legacy-description">
                        {entry.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-green-600 font-medium" data-testid="text-legacy-points">
                          {entry.totalPoints.toLocaleString()} points
                        </span>
                        <span className="text-xs text-muted-foreground" data-testid="text-legacy-participants">
                          {entry.participantCount} recipients
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground" data-testid="text-no-legacy">
                    No legacy entries found
                  </p>
                </CardContent>
              </Card>
            )}
            
            {/* Info Note */}
            <Card className="bg-secondary/50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground" data-testid="text-info-note">
                    Real ERC-20 transfers will use Permit2 and sponsored gas in future versions. 
                    Current system uses points for demonstration.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
