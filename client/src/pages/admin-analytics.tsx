import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  Star,
  Activity,
  Calendar,
  Globe,
  Target,
  Award,
  Clock,
  Hash,
  ArrowLeft,
  RefreshCw,
  Download,
  Filter,
  Eye,
  CheckCircle,
  AlertTriangle,
  Zap,
  Heart,
  Share,
  Flag,
  Shield
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorldId } from "@/hooks/use-world-id";

interface AnalyticsOverview {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  totalMessages: number;
  messagesPerDay: number;
  avgEngagementRate: number;
  topCategories: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  userGrowthRate: number;
  contentGrowthRate: number;
}

interface UserGrowthMetrics {
  date: string;
  newUsers: number;
  activeUsers: number;
  retentionRate: number;
  churnRate: number;
}

interface ContentMetrics {
  date: string;
  totalMessages: number;
  approvedMessages: number;
  flaggedMessages: number;
  deletedMessages: number;
  avgStarsPerMessage: number;
  topTopics: string[];
}

interface EngagementMetrics {
  dailyActiveUsers: number;
  avgSessionDuration: number;
  messagesPerUser: number;
  starsGiven: number;
  reportsSubmitted: number;
  topContributors: Array<{
    userId: string;
    displayName: string;
    messageCount: number;
    starsReceived: number;
    helpfulness: number;
  }>;
}

interface ModerationMetrics {
  totalReports: number;
  resolvedReports: number;
  avgResolutionTime: number;
  topViolationTypes: Array<{
    type: string;
    count: number;
  }>;
  moderationEffectiveness: number;
  falsePositiveRate: number;
}

interface CommunityHealth {
  healthScore: number;
  toxicityRate: number;
  helpfulnessRate: number;
  collaborationIndex: number;
  diversityIndex: number;
  sentimentScore: number;
  riskFactors: Array<{
    factor: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}

export default function AdminAnalytics() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { humanId } = useWorldId();
  
  // State management
  const [dateRange, setDateRange] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('overview');

  // Check admin access
  const adminKey = localStorage.getItem('admin_key');
  if (!adminKey) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              You need admin credentials to access analytics.
            </p>
            <Button onClick={() => setLocation('/admin')} className="w-full">
              Back to Admin Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch analytics overview
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery<AnalyticsOverview>({
    queryKey: ['/api/admin/analytics/overview', dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/overview?period=${dateRange}`, {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch analytics overview');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Fetch user growth metrics
  const { data: userGrowth = [], isLoading: userGrowthLoading } = useQuery<UserGrowthMetrics[]>({
    queryKey: ['/api/admin/analytics/user-growth', dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/user-growth?period=${dateRange}`, {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch user growth metrics');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Fetch content metrics
  const { data: contentMetrics = [], isLoading: contentLoading } = useQuery<ContentMetrics[]>({
    queryKey: ['/api/admin/analytics/content', dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/content?period=${dateRange}`, {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch content metrics');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Fetch engagement metrics
  const { data: engagement, isLoading: engagementLoading } = useQuery<EngagementMetrics>({
    queryKey: ['/api/admin/analytics/engagement', dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/engagement?period=${dateRange}`, {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch engagement metrics');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Fetch moderation metrics
  const { data: moderation, isLoading: moderationLoading } = useQuery<ModerationMetrics>({
    queryKey: ['/api/admin/analytics/moderation', dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/moderation?period=${dateRange}`, {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch moderation metrics');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Fetch community health
  const { data: communityHealth, isLoading: healthLoading } = useQuery<CommunityHealth>({
    queryKey: ['/api/admin/analytics/community-health', dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/community-health?period=${dateRange}`, {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch community health');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <div className="h-4 w-4" />; // Neutral
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthBadgeVariant = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  const getRiskSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation('/admin')}
              data-testid="button-back-to-admin"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-32" data-testid="select-date-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchOverview()}
              data-testid="button-refresh-analytics"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-analytics"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Overview Cards */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-users">
                  {overview.totalUsers.toLocaleString()}
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  {getTrendIcon(overview.userGrowthRate)}
                  <span className="ml-1">{formatPercentage(overview.userGrowthRate)} from last period</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-active-users">
                  {overview.activeUsers.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview.newUsersToday} new today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
                <MessageSquare className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600" data-testid="text-total-messages">
                  {overview.totalMessages.toLocaleString()}
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  {getTrendIcon(overview.contentGrowthRate)}
                  <span className="ml-1">{formatPercentage(overview.contentGrowthRate)} from last period</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                <Heart className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600" data-testid="text-engagement-rate">
                  {overview.avgEngagementRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview.messagesPerDay.toFixed(0)} messages/day
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="engagement">Engagement</TabsTrigger>
            <TabsTrigger value="moderation">Moderation</TabsTrigger>
            <TabsTrigger value="health">Community Health</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Categories */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hash className="h-5 w-5" />
                    Top Categories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {overview?.topCategories.map((category, index) => (
                      <div key={category.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span className="capitalize">{category.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-20">
                            <Progress value={category.percentage} className="h-2" />
                          </div>
                          <Badge variant="secondary">{category.count}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* Community Health Score */}
              {communityHealth && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Community Health
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className={`text-4xl font-bold ${getHealthColor(communityHealth.healthScore)}`}>
                          {communityHealth.healthScore}
                        </div>
                        <Badge variant={getHealthBadgeVariant(communityHealth.healthScore)} className="mt-2">
                          {communityHealth.healthScore >= 80 ? 'Excellent' : 
                           communityHealth.healthScore >= 60 ? 'Good' : 'Needs Attention'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="flex justify-between">
                            <span>Toxicity Rate</span>
                            <span className="font-medium">{communityHealth.toxicityRate.toFixed(1)}%</span>
                          </div>
                          <Progress value={communityHealth.toxicityRate} className="h-1 mt-1" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between">
                            <span>Helpfulness</span>
                            <span className="font-medium">{communityHealth.helpfulnessRate.toFixed(1)}%</span>
                          </div>
                          <Progress value={communityHealth.helpfulnessRate} className="h-1 mt-1" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between">
                            <span>Collaboration</span>
                            <span className="font-medium">{communityHealth.collaborationIndex.toFixed(1)}%</span>
                          </div>
                          <Progress value={communityHealth.collaborationIndex} className="h-1 mt-1" />
                        </div>
                        
                        <div>
                          <div className="flex justify-between">
                            <span>Diversity</span>
                            <span className="font-medium">{communityHealth.diversityIndex.toFixed(1)}%</span>
                          </div>
                          <Progress value={communityHealth.diversityIndex} className="h-1 mt-1" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Growth Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>User Growth Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {userGrowth.slice(-7).map((day, index) => (
                      <div key={day.date} className="flex items-center justify-between">
                        <span className="text-sm">{new Date(day.date).toLocaleDateString()}</span>
                        <div className="flex items-center gap-4">
                          <div className="text-sm">
                            <span className="text-green-600">{day.newUsers}</span> new
                          </div>
                          <div className="text-sm">
                            <span className="text-blue-600">{day.activeUsers}</span> active
                          </div>
                          <div className="text-sm">
                            <span className="text-purple-600">{day.retentionRate.toFixed(1)}%</span> retention
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* User Engagement */}
              {engagement && (
                <Card>
                  <CardHeader>
                    <CardTitle>User Engagement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Daily Active Users</Label>
                          <div className="text-2xl font-bold text-blue-600">
                            {engagement.dailyActiveUsers.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <Label>Avg Session</Label>
                          <div className="text-2xl font-bold text-green-600">
                            {formatDuration(engagement.avgSessionDuration)}
                          </div>
                        </div>
                        <div>
                          <Label>Messages per User</Label>
                          <div className="text-2xl font-bold text-purple-600">
                            {engagement.messagesPerUser.toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <Label>Stars Given</Label>
                          <div className="text-2xl font-bold text-amber-600">
                            {engagement.starsGiven.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            
            {/* Top Contributors */}
            {engagement && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Top Contributors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {engagement.topContributors.map((contributor, index) => (
                      <div key={contributor.userId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-bold">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium">{contributor.displayName}</p>
                            <p className="text-xs text-muted-foreground">{contributor.userId.slice(0, 12)}...</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-center">
                            <div className="font-medium">{contributor.messageCount}</div>
                            <div className="text-muted-foreground">messages</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">{contributor.starsReceived}</div>
                            <div className="text-muted-foreground">stars</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">{contributor.helpfulness.toFixed(1)}%</div>
                            <div className="text-muted-foreground">helpful</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Content Volume */}
              <Card>
                <CardHeader>
                  <CardTitle>Content Volume Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {contentMetrics.slice(-7).map((day) => (
                      <div key={day.date} className="flex items-center justify-between">
                        <span className="text-sm">{new Date(day.date).toLocaleDateString()}</span>
                        <div className="flex items-center gap-4">
                          <div className="text-sm">
                            <span className="text-blue-600">{day.totalMessages}</span> total
                          </div>
                          <div className="text-sm">
                            <span className="text-green-600">{day.approvedMessages}</span> approved
                          </div>
                          <div className="text-sm">
                            <span className="text-red-600">{day.flaggedMessages}</span> flagged
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* Content Quality */}
              <Card>
                <CardHeader>
                  <CardTitle>Content Quality Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Approval Rate</span>
                        <span className="font-medium">
                          {contentMetrics.length > 0 ? 
                            ((contentMetrics[contentMetrics.length - 1].approvedMessages / contentMetrics[contentMetrics.length - 1].totalMessages) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <Progress 
                        value={contentMetrics.length > 0 ? 
                          (contentMetrics[contentMetrics.length - 1].approvedMessages / contentMetrics[contentMetrics.length - 1].totalMessages) * 100 : 0} 
                        className="h-2" 
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Average Stars per Message</span>
                        <span className="font-medium">
                          {contentMetrics.length > 0 ? contentMetrics[contentMetrics.length - 1].avgStarsPerMessage.toFixed(1) : 0}
                        </span>
                      </div>
                      <Progress 
                        value={contentMetrics.length > 0 ? contentMetrics[contentMetrics.length - 1].avgStarsPerMessage * 20 : 0} 
                        className="h-2" 
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Deletion Rate</span>
                        <span className="font-medium">
                          {contentMetrics.length > 0 ? 
                            ((contentMetrics[contentMetrics.length - 1].deletedMessages / contentMetrics[contentMetrics.length - 1].totalMessages) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                      <Progress 
                        value={contentMetrics.length > 0 ? 
                          (contentMetrics[contentMetrics.length - 1].deletedMessages / contentMetrics[contentMetrics.length - 1].totalMessages) * 100 : 0} 
                        className="h-2" 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Trending Topics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Trending Topics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {contentMetrics.length > 0 && contentMetrics[contentMetrics.length - 1].topTopics.map((topic, index) => (
                    <Badge key={topic} variant="outline" className="justify-center">
                      #{topic}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="engagement" className="space-y-4">
            {engagement && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Daily Active Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-dau">
                      {engagement.dailyActiveUsers.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Session Duration</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-session-duration">
                      {formatDuration(engagement.avgSessionDuration)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Messages per User</CardTitle>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-messages-per-user">
                      {engagement.messagesPerUser.toFixed(1)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Stars Given</CardTitle>
                    <Star className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600" data-testid="text-stars-given">
                      {engagement.starsGiven.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="moderation" className="space-y-4">
            {moderation && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Moderation Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Moderation Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Total Reports</Label>
                        <div className="text-2xl font-bold">{moderation.totalReports}</div>
                      </div>
                      <div>
                        <Label>Resolved Reports</Label>
                        <div className="text-2xl font-bold text-green-600">{moderation.resolvedReports}</div>
                      </div>
                      <div>
                        <Label>Avg Resolution Time</Label>
                        <div className="text-2xl font-bold text-blue-600">{formatDuration(moderation.avgResolutionTime)}</div>
                      </div>
                      <div>
                        <Label>Effectiveness</Label>
                        <div className="text-2xl font-bold text-purple-600">{moderation.moderationEffectiveness.toFixed(1)}%</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Top Violation Types */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Violation Types</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {moderation.topViolationTypes.map((violation) => (
                        <div key={violation.type} className="flex items-center justify-between">
                          <span className="capitalize">{violation.type.replace('_', ' ')}</span>
                          <Badge variant="destructive">{violation.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="health" className="space-y-4">
            {communityHealth && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Health Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-5 w-5" />
                      Community Health Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className={`text-6xl font-bold ${getHealthColor(communityHealth.healthScore)}`}>
                          {communityHealth.healthScore}
                        </div>
                        <p className="text-muted-foreground">Overall Health Score</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Sentiment Score</Label>
                          <div className="text-xl font-bold text-green-600">
                            {communityHealth.sentimentScore.toFixed(1)}
                          </div>
                        </div>
                        <div>
                          <Label>Toxicity Rate</Label>
                          <div className="text-xl font-bold text-red-600">
                            {communityHealth.toxicityRate.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <Label>Helpfulness Rate</Label>
                          <div className="text-xl font-bold text-blue-600">
                            {communityHealth.helpfulnessRate.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <Label>Collaboration Index</Label>
                          <div className="text-xl font-bold text-purple-600">
                            {communityHealth.collaborationIndex.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Risk Factors */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Risk Factors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {communityHealth.riskFactors.map((risk, index) => (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{risk.factor}</span>
                            <Badge variant={
                              risk.severity === 'high' ? 'destructive' :
                              risk.severity === 'medium' ? 'secondary' : 'outline'
                            }>
                              {risk.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{risk.description}</p>
                        </div>
                      ))}
                      
                      {communityHealth.riskFactors.length === 0 && (
                        <div className="text-center py-4">
                          <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">No significant risk factors identified</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}