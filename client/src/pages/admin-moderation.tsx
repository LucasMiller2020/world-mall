import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { 
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  MessageSquare,
  TrendingUp,
  BarChart3,
  Filter,
  Search,
  RefreshCw,
  ArrowLeft,
  Eye,
  Ban,
  UserCheck,
  AlertOctagon,
  Gavel,
  FileText,
  Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorldId } from "@/hooks/use-world-id";

interface ModerationDashboard {
  totalMessages: number;
  flaggedContent: number;
  pendingReviews: number;
  autoApproved: number;
  falsePositives: number;
  trustedUsers: number;
  bannedUsers: number;
  appealsSubmitted: number;
  appealsApproved: number;
  todayStats: {
    messagesProcessed: number;
    violationsDetected: number;
    actionsApplied: number;
  };
}

interface ModerationQueueItem {
  id: string;
  type: 'message' | 'user' | 'appeal';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_review' | 'resolved';
  contentId: string;
  content: string;
  userId: string;
  flagReason: string;
  confidence: number;
  assignedTo?: string;
  createdAt: string;
  reviewNotes?: string;
}

interface ModerationAnalytics {
  accuracyRate: number;
  falsePositiveRate: number;
  responseTimeAvg: number;
  topViolationTypes: Array<{ type: string; count: number }>;
  moderationTrends: Array<{ date: string; processed: number; violations: number }>;
  languageBreakdown: Array<{ language: string; count: number }>;
}

interface UserTrustScore {
  userId: string;
  username: string;
  overallTrustScore: number;
  trustLevel: string;
  totalMessages: number;
  violationCount: number;
  daysWithoutViolation: number;
  lastActivity: string;
}

export default function AdminModeration() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { humanId } = useWorldId();
  const queryClient = useQueryClient();
  
  const [selectedQueueFilter, setSelectedQueueFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<ModerationQueueItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');

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
              You need admin credentials to access moderation tools.
            </p>
            <Button onClick={() => setLocation('/admin')} className="w-full">
              Back to Admin Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch moderation dashboard
  const { data: dashboard, isLoading: dashboardLoading } = useQuery<ModerationDashboard>({
    queryKey: ['/api/admin/moderation/dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/admin/moderation/dashboard', {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch moderation dashboard');
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: !!adminKey && !!humanId
  });

  // Fetch moderation queue
  const { data: queueItems = [], isLoading: queueLoading } = useQuery<ModerationQueueItem[]>({
    queryKey: ['/api/admin/moderation/queue', selectedQueueFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedQueueFilter !== 'all') {
        params.append('status', selectedQueueFilter);
      }
      params.append('limit', '50');
      
      const res = await fetch(`/api/admin/moderation/queue?${params}`, {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch moderation queue');
      return res.json();
    },
    refetchInterval: 15000, // Refresh every 15 seconds
    enabled: !!adminKey && !!humanId
  });

  // Fetch moderation analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery<ModerationAnalytics>({
    queryKey: ['/api/admin/moderation/analytics'],
    queryFn: async () => {
      const res = await fetch('/api/admin/moderation/analytics?period=week', {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch moderation analytics');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Process review mutation
  const processReviewMutation = useMutation({
    mutationFn: async ({ itemId, action, notes }: { itemId: string; action: string; notes: string }) => {
      const res = await fetch('/api/admin/moderation/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        },
        body: JSON.stringify({
          queueItemId: itemId,
          action,
          reviewNotes: notes,
          reviewerId: humanId
        })
      });
      if (!res.ok) throw new Error('Failed to process review');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Review Processed",
        description: "The moderation review has been completed successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/moderation/queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/moderation/dashboard'] });
      setSelectedItem(null);
      setReviewNotes('');
      setSelectedAction('');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process the review",
        variant: "destructive"
      });
    }
  });

  // Assign queue item mutation
  const assignQueueItemMutation = useMutation({
    mutationFn: async ({ itemId, assignedTo }: { itemId: string; assignedTo: string }) => {
      const res = await fetch(`/api/admin/moderation/queue/${itemId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        },
        body: JSON.stringify({ assignedTo })
      });
      if (!res.ok) throw new Error('Failed to assign queue item');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Item Assigned",
        description: "Queue item has been assigned for review"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/moderation/queue'] });
    }
  });

  const filteredQueueItems = queueItems.filter(item =>
    searchQuery === '' || 
    item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.flagReason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'in_review': return <Eye className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
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
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Moderation Center</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/admin/moderation'] });
              }}
              data-testid="button-refresh-moderation"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Dashboard Overview */}
        {dashboard && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600" data-testid="text-pending-reviews">
                  {dashboard.pendingReviews}
                </div>
                <p className="text-xs text-muted-foreground">
                  Requires manual review
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Auto Approved</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-auto-approved">
                  {dashboard.autoApproved}
                </div>
                <p className="text-xs text-muted-foreground">
                  Passed AI filtering
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Flagged Content</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600" data-testid="text-flagged-content">
                  {dashboard.flaggedContent}
                </div>
                <p className="text-xs text-muted-foreground">
                  Violations detected
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Accuracy Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600" data-testid="text-accuracy-rate">
                  {analytics ? Math.round(analytics.accuracyRate) : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Moderation accuracy
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="queue" className="space-y-4">
          <TabsList>
            <TabsTrigger value="queue">Moderation Queue</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="users">User Trust</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-4">
            {/* Queue Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search content, users, or reasons..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full sm:w-64"
                    data-testid="input-search-queue"
                  />
                </div>
                <Select value={selectedQueueFilter} onValueChange={setSelectedQueueFilter}>
                  <SelectTrigger className="w-40" data-testid="select-queue-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Queue Items */}
            <div className="space-y-3">
              {filteredQueueItems.map((item) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(item.status)}
                          <Badge variant={getPriorityColor(item.priority)}>
                            {item.priority} priority
                          </Badge>
                          <Badge variant="outline">{item.type}</Badge>
                          <span className="text-sm text-muted-foreground">
                            Confidence: {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-sm font-medium">
                            Reason: {item.flagReason}
                          </p>
                          <p className="text-sm text-muted-foreground break-words">
                            Content: "{item.content.substring(0, 150)}
                            {item.content.length > 150 ? '...' : ''}"
                          </p>
                          <p className="text-xs text-muted-foreground">
                            User: {item.userId} • Created: {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {item.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => assignQueueItemMutation.mutate({ 
                              itemId: item.id, 
                              assignedTo: humanId || 'admin' 
                            })}
                            disabled={assignQueueItemMutation.isPending}
                            data-testid={`button-assign-${item.id}`}
                          >
                            Assign to Me
                          </Button>
                        )}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedItem(item)}
                              data-testid={`button-review-${item.id}`}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Review Content</DialogTitle>
                            </DialogHeader>
                            {selectedItem && (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>Content</Label>
                                  <div className="p-3 bg-muted rounded border">
                                    {selectedItem.content}
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>User ID</Label>
                                    <p className="text-sm font-mono">{selectedItem.userId}</p>
                                  </div>
                                  <div>
                                    <Label>Violation Type</Label>
                                    <p className="text-sm">{selectedItem.flagReason}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <Label htmlFor="review-action">Action</Label>
                                  <Select value={selectedAction} onValueChange={setSelectedAction}>
                                    <SelectTrigger data-testid="select-review-action">
                                      <SelectValue placeholder="Select action" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="approve">Approve Content</SelectItem>
                                      <SelectItem value="flag">Flag as Violation</SelectItem>
                                      <SelectItem value="delete">Delete Content</SelectItem>
                                      <SelectItem value="warn_user">Warn User</SelectItem>
                                      <SelectItem value="ban_temporary">Temporary Ban</SelectItem>
                                      <SelectItem value="ban_permanent">Permanent Ban</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div>
                                  <Label htmlFor="review-notes">Review Notes</Label>
                                  <Textarea
                                    id="review-notes"
                                    placeholder="Add notes about your decision..."
                                    value={reviewNotes}
                                    onChange={(e) => setReviewNotes(e.target.value)}
                                    data-testid="textarea-review-notes"
                                  />
                                </div>
                                
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedItem(null);
                                      setReviewNotes('');
                                      setSelectedAction('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      if (selectedAction && selectedItem) {
                                        processReviewMutation.mutate({
                                          itemId: selectedItem.id,
                                          action: selectedAction,
                                          notes: reviewNotes
                                        });
                                      }
                                    }}
                                    disabled={!selectedAction || processReviewMutation.isPending}
                                    data-testid="button-submit-review"
                                  >
                                    Submit Review
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {filteredQueueItems.length === 0 && !queueLoading && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">All Clear!</h3>
                    <p className="text-muted-foreground">
                      No items in the moderation queue matching your filters.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            {analytics && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Accuracy Rate</span>
                        <span>{Math.round(analytics.accuracyRate)}%</span>
                      </div>
                      <Progress value={analytics.accuracyRate} className="h-2" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>False Positive Rate</span>
                        <span>{Math.round(analytics.falsePositiveRate)}%</span>
                      </div>
                      <Progress value={analytics.falsePositiveRate} className="h-2" />
                    </div>
                    
                    <div className="pt-2">
                      <p className="text-sm text-muted-foreground">
                        Average Response Time: {Math.round(analytics.responseTimeAvg)} minutes
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Violation Types</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.topViolationTypes.map((violation, index) => (
                        <div key={violation.type} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{violation.type}</span>
                          <Badge variant="secondary">{violation.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Language Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {analytics.languageBreakdown.map((lang) => (
                        <div key={lang.language} className="text-center">
                          <div className="text-2xl font-bold">{lang.count}</div>
                          <div className="text-sm text-muted-foreground uppercase">
                            {lang.language}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Trust Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  User trust scores and reputation management will be displayed here.
                  This includes trust levels, violation history, and reputation metrics.
                </p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {dashboard?.trustedUsers || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Trusted Users</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {dashboard?.bannedUsers || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Banned Users</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {dashboard?.appealsSubmitted || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Appeals Submitted</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Moderation Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Configure moderation thresholds, auto-moderation rules, and system preferences.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="auto-approve" />
                    <Label htmlFor="auto-approve">
                      Enable auto-approval for trusted users
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="strict-mode" />
                    <Label htmlFor="strict-mode">
                      Enable strict mode for work channels
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="ml-learning" />
                    <Label htmlFor="ml-learning">
                      Enable machine learning adaptation
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}