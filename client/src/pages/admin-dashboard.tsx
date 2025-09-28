import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  Calendar, 
  Plus, 
  Settings, 
  TrendingUp, 
  Users, 
  MessageSquare,
  Star,
  RefreshCw,
  ArrowLeft,
  Edit,
  Trash2,
  Play,
  Pause,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Server,
  Eye,
  Flag,
  UserCheck,
  Lock,
  Heart,
  Zap,
  Globe,
  Monitor,
  Bell
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorldId } from "@/hooks/use-world-id";
import type { Topic, AdminTopicSummary, TopicAnalytics, TopicSchedule } from "@shared/schema";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { humanId, isVerified, verify } = useWorldId();
  const queryClient = useQueryClient();
  
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
              You need admin credentials to access this area.
            </p>
            <Button onClick={() => setLocation('/')} className="w-full">
              Back to App
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch comprehensive admin dashboard data
  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['/api/admin/dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dashboard', {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch admin dashboard data');
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds for real-time monitoring
    enabled: !!adminKey && !!humanId
  });

  // Fetch system health
  const { data: systemHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['/api/admin/system/health'],
    queryFn: async () => {
      const res = await fetch('/api/admin/system/health', {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch system health');
      return res.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds for health monitoring
    enabled: !!adminKey && !!humanId
  });

  // Fetch security alerts
  const { data: securityAlerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['/api/admin/security/alerts'],
    queryFn: async () => {
      const res = await fetch('/api/admin/security/alerts?status=active&limit=5', {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch security alerts');
      return res.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds for security monitoring
    enabled: !!adminKey && !!humanId
  });

  // Fetch recent admin actions
  const { data: recentActions = [], isLoading: actionsLoading } = useQuery({
    queryKey: ['/api/admin/security/audit-logs'],
    queryFn: async () => {
      const res = await fetch('/api/admin/security/audit-logs?limit=10', {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch recent actions');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Manual topic rotation mutation
  const rotateTopicsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/rotate-topics', {
        method: 'POST',
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to rotate topics');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Topics rotated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/summary'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to rotate topics",
        variant: "destructive"
      });
    }
  });

  const isLoading = dashboardLoading || healthLoading || alertsLoading;
  
  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-amber-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
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
              onClick={() => setLocation('/')}
              data-testid="button-back-to-app"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to App
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Admin Control Center</h1>
            </div>
            {systemHealth && (
              <div className="flex items-center gap-2 ml-4">
                {getHealthStatusIcon(systemHealth.status)}
                <span className={`text-sm font-medium ${getHealthStatusColor(systemHealth.status)}`}>
                  System {systemHealth.status.toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchDashboard()}
              disabled={isLoading}
              data-testid="button-refresh-dashboard"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {securityAlerts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation('/admin/security')}
                className="text-red-600 border-red-200 hover:bg-red-50"
                data-testid="button-security-alerts"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                {securityAlerts.length} Alert{securityAlerts.length > 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="border-b bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/admin/users')}
              data-testid="button-nav-users"
            >
              <Users className="h-4 w-4 mr-2" />
              User Management
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/admin/content')}
              data-testid="button-nav-content"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Content Management
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/admin/system')}
              data-testid="button-nav-system"
            >
              <Settings className="h-4 w-4 mr-2" />
              System Admin
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/admin/security')}
              data-testid="button-nav-security"
            >
              <Lock className="h-4 w-4 mr-2" />
              Security & Audit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/admin/analytics')}
              data-testid="button-nav-analytics"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/admin/moderation')}
              data-testid="button-nav-moderation"
            >
              <Shield className="h-4 w-4 mr-2" />
              Moderation Center
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Real-time Overview Cards */}
        {dashboardData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-users">
                  {dashboardData.totalUsers?.toLocaleString() || '0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {dashboardData.newUsersToday || 0} new today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-active-users">
                  {systemHealth?.activeUsers || '0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently online
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages</CardTitle>
                <MessageSquare className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600" data-testid="text-total-messages">
                  {dashboardData.totalMessages?.toLocaleString() || '0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {dashboardData.messagesPerDay || 0}/day avg
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Security</CardTitle>
                <Shield className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-security-status">
                  {securityAlerts.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {securityAlerts.length === 0 ? 'All clear' : `Active alert${securityAlerts.length > 1 ? 's' : ''}`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                <Zap className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600" data-testid="text-response-time">
                  {systemHealth?.responseTime || '0'}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg response
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                <Server className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-600" data-testid="text-uptime">
                  {systemHealth?.uptime ? formatUptime(systemHealth.uptime) : '0m'}
                </div>
                <p className="text-xs text-muted-foreground">
                  System uptime
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="system">System Health</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
            <TabsTrigger value="analytics">Quick Analytics</TabsTrigger>
            <TabsTrigger value="actions">Quick Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Categories */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Categories</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {summary?.topCategories.map((category, index) => (
                    <div key={category.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="capitalize">{category.category}</span>
                      </div>
                      <Badge variant="secondary">{category.count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {summary?.recentActivity.slice(0, 5).map((activity, index) => (
                    <div key={activity.topicId} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.totalMessages} messages • {activity.totalStars} stars
                        </p>
                      </div>
                      <Badge 
                        variant={activity.performanceScore > 50 ? "default" : "secondary"}
                        className="ml-2"
                      >
                        {activity.performanceScore}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="topics" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Recent Topics</h3>
              <Button
                variant="outline"
                onClick={() => setLocation('/admin/topics')}
                data-testid="button-manage-topics"
              >
                Manage All Topics
              </Button>
            </div>
            
            <div className="grid gap-4">
              {topics.slice(0, 5).map((topic) => (
                <Card key={topic.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{topic.title}</h4>
                        {topic.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {topic.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">{topic.category}</Badge>
                          <Badge variant={topic.status === 'approved' ? 'default' : 'secondary'}>
                            {topic.status}
                          </Badge>
                          {topic.isSpecial && (
                            <Badge variant="destructive">Special</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setLocation(`/admin/topics/${topic.id}/edit`)}
                          data-testid={`button-edit-topic-${topic.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="schedules" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Upcoming Schedules</h3>
              <Button
                variant="outline"
                onClick={() => setLocation('/admin/schedules')}
                data-testid="button-manage-schedules"
              >
                Manage All Schedules
              </Button>
            </div>
            
            <div className="grid gap-4">
              {schedules.map((schedule) => {
                const topic = topics.find(t => t.id === schedule.topicId);
                return (
                  <Card key={schedule.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{schedule.scheduledDate}</span>
                            {schedule.isActive ? (
                              <Badge variant="default">Active</Badge>
                            ) : (
                              <Badge variant="outline">Scheduled</Badge>
                            )}
                          </div>
                          {topic && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {topic.title}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{schedule.rotationType}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="moderation" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Moderation Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Content Moderation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Advanced AI-powered moderation system protecting community safety.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Auto-moderated messages</span>
                      <Badge variant="secondary">24/7 Active</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Multi-language support</span>
                      <Badge variant="secondary">10 Languages</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">ML-based filtering</span>
                      <Badge variant="secondary">Adaptive</Badge>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4" 
                    onClick={() => setLocation('/admin/moderation')}
                    data-testid="button-open-moderation-center"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Open Moderation Center
                  </Button>
                </CardContent>
              </Card>

              {/* Moderation Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Security Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">98%</div>
                      <div className="text-xs text-muted-foreground">Accuracy Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">0</div>
                      <div className="text-xs text-muted-foreground">Pending Reviews</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">0</div>
                      <div className="text-xs text-muted-foreground">Violations Today</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600">0</div>
                      <div className="text-xs text-muted-foreground">Appeals</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Detailed analytics will show topic performance, engagement metrics, and trends.
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setLocation('/admin/analytics')}
                  data-testid="button-view-analytics"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Detailed Analytics
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}