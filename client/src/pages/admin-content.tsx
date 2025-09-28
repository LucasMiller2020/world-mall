import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  MessageSquare,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Calendar,
  Activity,
  Star,
  TrendingUp,
  ArrowLeft,
  RefreshCw,
  Download,
  Upload,
  Settings,
  FileText,
  Tag,
  Users,
  Flag,
  Shield,
  Hash,
  Link,
  Image,
  Video,
  Mic
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorldId } from "@/hooks/use-world-id";

interface ContentItem {
  id: string;
  room: string;
  text: string;
  authorHumanId: string;
  createdAt: Date;
  starsCount: number;
  reportsCount: number;
  isHidden: boolean;
  category?: string;
  link?: string;
  geoScope?: string;
  // Additional fields from joins
  author: {
    id: string;
    joinedAt: Date;
    profile?: {
      displayName?: string;
      trustLevel: string;
      accountStatus: string;
      reputationScore: number;
    };
  };
  reports?: {
    id: string;
    reason: string;
    reporterHumanId: string;
    createdAt: Date;
    status: string;
  }[];
  moderationAnalysis?: {
    riskScore: number;
    flaggedReasons: string[];
    isAutoFlagged: boolean;
    language: string;
    toxicityScore: number;
    spamScore: number;
  };
}

interface ContentFilters {
  search?: string;
  room?: string;
  category?: string;
  status?: string;
  dateRange?: { start: string; end: string };
  authorTrustLevel?: string;
  hasReports?: boolean;
  starCount?: { min?: number; max?: number };
}

interface ContentAnalytics {
  totalMessages: number;
  approvedMessages: number;
  flaggedMessages: number;
  deletedMessages: number;
  avgEngagementScore: number;
  topCategories: { category: string; count: number }[];
  trendinTopics: { topic: string; engagement: number }[];
}

export default function AdminContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { humanId } = useWorldId();
  const queryClient = useQueryClient();
  
  // State management
  const [selectedContent, setSelectedContent] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<ContentFilters>({});
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [bulkReason, setBulkReason] = useState<string>('');
  const [moderationNotes, setModerationNotes] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(25);

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
              You need admin credentials to access content management.
            </p>
            <Button onClick={() => setLocation('/admin')} className="w-full">
              Back to Admin Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch content for moderation
  const { data: contentData, isLoading: contentLoading, refetch: refetchContent } = useQuery({
    queryKey: ['/api/admin/content', filters, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.room) params.append('room', filters.room);
      if (filters.category) params.append('category', filters.category);
      if (filters.status) params.append('status', filters.status);
      if (filters.authorTrustLevel) params.append('authorTrustLevel', filters.authorTrustLevel);
      if (filters.hasReports !== undefined) params.append('hasReports', filters.hasReports.toString());
      if (filters.starCount?.min) params.append('minStars', filters.starCount.min.toString());
      if (filters.starCount?.max) params.append('maxStars', filters.starCount.max.toString());
      if (filters.dateRange?.start) params.append('startDate', filters.dateRange.start);
      if (filters.dateRange?.end) params.append('endDate', filters.dateRange.end);
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      
      const res = await fetch(`/api/admin/content?${params}`, {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch content');
      return res.json();
    },
    refetchInterval: 30000,
    enabled: !!adminKey && !!humanId
  });

  // Fetch content analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery<ContentAnalytics>({
    queryKey: ['/api/admin/content/analytics'],
    queryFn: async () => {
      const res = await fetch('/api/admin/content/analytics', {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch content analytics');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Content action mutations
  const contentActionMutation = useMutation({
    mutationFn: async ({ action, contentIds, reason, notes }: { 
      action: string; 
      contentIds: string[]; 
      reason: string;
      notes?: string;
    }) => {
      const res = await fetch('/api/admin/content/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        },
        body: JSON.stringify({ action, contentIds, reason, notes })
      });
      if (!res.ok) throw new Error('Failed to execute content action');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Action Completed",
        description: "Content action has been executed successfully"
      });
      refetchContent();
      setSelectedContent(new Set());
      setBulkAction('');
      setBulkReason('');
      setSelectedItem(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to execute content action",
        variant: "destructive"
      });
    }
  });

  const content = contentData?.messages || [];
  const totalContent = contentData?.total || 0;
  const totalPages = Math.ceil(totalContent / limit);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'flagged': return 'destructive';
      case 'hidden': return 'secondary';
      case 'pending': return 'outline';
      default: return 'outline';
    }
  };

  const getRoomColor = (room: string) => {
    switch (room) {
      case 'global': return 'default';
      case 'work': return 'secondary';
      default: return 'outline';
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'help': return <Users className="h-4 w-4" />;
      case 'advice': return <MessageSquare className="h-4 w-4" />;
      case 'collab': return <Activity className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const handleSelectContent = (contentId: string) => {
    const newSelected = new Set(selectedContent);
    if (newSelected.has(contentId)) {
      newSelected.delete(contentId);
    } else {
      newSelected.add(contentId);
    }
    setSelectedContent(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedContent.size === content.length) {
      setSelectedContent(new Set());
    } else {
      setSelectedContent(new Set(content.map(c => c.id)));
    }
  };

  const handleBulkAction = () => {
    if (selectedContent.size === 0 || !bulkAction || !bulkReason.trim()) {
      toast({
        title: "Invalid Action",
        description: "Please select content, action, and provide a reason",
        variant: "destructive"
      });
      return;
    }

    contentActionMutation.mutate({
      action: bulkAction,
      contentIds: Array.from(selectedContent),
      reason: bulkReason,
      notes: moderationNotes
    });
  };

  const handleSingleAction = (action: string, reason: string) => {
    if (!selectedItem) return;
    
    contentActionMutation.mutate({
      action,
      contentIds: [selectedItem.id],
      reason,
      notes: moderationNotes
    });
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
              <MessageSquare className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Content Management</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchContent()}
              disabled={contentLoading}
              data-testid="button-refresh-content"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${contentLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-content"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-messages">
                  {analytics.totalMessages.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approved</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-approved-messages">
                  {analytics.approvedMessages.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Flagged</CardTitle>
                <Flag className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600" data-testid="text-flagged-messages">
                  {analytics.flaggedMessages.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hidden</CardTitle>
                <Eye className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600" data-testid="text-hidden-messages">
                  {analytics.deletedMessages.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Engagement</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600" data-testid="text-engagement-score">
                  {Math.round(analytics.avgEngagementScore)}%
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="content" className="space-y-4">
          <TabsList>
            <TabsTrigger value="content">Content Review</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="trends">Trending Topics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Search & Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="search">Search Content</Label>
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search messages, links, or content..."
                        value={filters.search || ''}
                        onChange={(e) => setFilters({...filters, search: e.target.value})}
                        className="pl-9"
                        data-testid="input-search-content"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="room">Room</Label>
                    <Select value={filters.room || ''} onValueChange={(value) => setFilters({...filters, room: value || undefined})}>
                      <SelectTrigger data-testid="select-room">
                        <SelectValue placeholder="All rooms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All rooms</SelectItem>
                        <SelectItem value="global">Global</SelectItem>
                        <SelectItem value="work">Work</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={filters.category || ''} onValueChange={(value) => setFilters({...filters, category: value || undefined})}>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All categories</SelectItem>
                        <SelectItem value="help">Help</SelectItem>
                        <SelectItem value="advice">Advice</SelectItem>
                        <SelectItem value="collab">Collaboration</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={filters.status || ''} onValueChange={(value) => setFilters({...filters, status: value || undefined})}>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All statuses</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="flagged">Flagged</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                        <SelectItem value="pending">Pending Review</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="author-trust">Author Trust Level</Label>
                    <Select value={filters.authorTrustLevel || ''} onValueChange={(value) => setFilters({...filters, authorTrustLevel: value || undefined})}>
                      <SelectTrigger data-testid="select-author-trust">
                        <SelectValue placeholder="All trust levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All trust levels</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="trusted">Trusted</SelectItem>
                        <SelectItem value="veteran">Veteran</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      id="has-reports"
                      checked={filters.hasReports || false}
                      onCheckedChange={(checked) => setFilters({...filters, hasReports: checked as boolean})}
                      data-testid="checkbox-has-reports"
                    />
                    <Label htmlFor="has-reports">Has Reports</Label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="min-stars">Min Stars</Label>
                      <Input
                        id="min-stars"
                        type="number"
                        placeholder="0"
                        value={filters.starCount?.min || ''}
                        onChange={(e) => setFilters({
                          ...filters, 
                          starCount: { ...filters.starCount, min: parseInt(e.target.value) || undefined }
                        })}
                        data-testid="input-min-stars"
                      />
                    </div>
                    <div>
                      <Label htmlFor="max-stars">Max Stars</Label>
                      <Input
                        id="max-stars"
                        type="number"
                        placeholder="∞"
                        value={filters.starCount?.max || ''}
                        onChange={(e) => setFilters({
                          ...filters, 
                          starCount: { ...filters.starCount, max: parseInt(e.target.value) || undefined }
                        })}
                        data-testid="input-max-stars"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bulk Actions */}
            {selectedContent.size > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Bulk Actions ({selectedContent.size} items selected)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Select value={bulkAction} onValueChange={setBulkAction}>
                        <SelectTrigger className="w-48" data-testid="select-bulk-action">
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approve">Approve Content</SelectItem>
                          <SelectItem value="hide">Hide Content</SelectItem>
                          <SelectItem value="delete">Delete Content</SelectItem>
                          <SelectItem value="flag">Flag as Violation</SelectItem>
                          <SelectItem value="export">Export Content</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Input
                        placeholder="Reason for action..."
                        value={bulkReason}
                        onChange={(e) => setBulkReason(e.target.value)}
                        className="flex-1"
                        data-testid="input-bulk-reason"
                      />
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            disabled={!bulkAction || !bulkReason.trim() || contentActionMutation.isPending}
                            data-testid="button-execute-bulk-action"
                          >
                            Execute Action
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will execute "{bulkAction}" on {selectedContent.size} selected content items. 
                              This action cannot be easily undone. Are you sure you want to continue?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBulkAction}>
                              Execute
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      
                      <Button 
                        variant="outline" 
                        onClick={() => setSelectedContent(new Set())}
                        data-testid="button-clear-selection"
                      >
                        Clear Selection
                      </Button>
                    </div>
                    
                    <div>
                      <Label htmlFor="moderation-notes">Moderation Notes</Label>
                      <Textarea
                        id="moderation-notes"
                        placeholder="Add notes about this moderation action..."
                        value={moderationNotes}
                        onChange={(e) => setModerationNotes(e.target.value)}
                        rows={2}
                        data-testid="textarea-moderation-notes"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Content Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Content ({totalContent} total)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedContent.size === content.length && content.length > 0}
                          onCheckedChange={handleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead>Author</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Engagement</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {content.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedContent.has(item.id)}
                            onCheckedChange={() => handleSelectContent(item.id)}
                            data-testid={`checkbox-content-${item.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 max-w-md">
                            <div className="flex items-center gap-1">
                              {getCategoryIcon(item.category)}
                              <p className="text-sm font-medium line-clamp-2">
                                {item.text.substring(0, 100)}
                                {item.text.length > 100 && '...'}
                              </p>
                            </div>
                            {item.link && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Link className="h-3 w-3" />
                                <a href={item.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                  {item.link.substring(0, 40)}...
                                </a>
                              </div>
                            )}
                            {item.category && (
                              <Badge variant="outline" className="text-xs">
                                {item.category}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {item.author.profile?.displayName || `User ${item.authorHumanId.slice(0, 8)}`}
                            </p>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">
                                {item.author.profile?.trustLevel || 'new'}
                              </Badge>
                              {item.author.profile?.reputationScore !== undefined && (
                                <span className="text-xs text-muted-foreground">
                                  {item.author.profile.reputationScore}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoomColor(item.room)}>
                            {item.room}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-amber-500" />
                              <span className="text-sm">{item.starsCount}</span>
                            </div>
                            {item.reportsCount > 0 && (
                              <div className="flex items-center gap-1">
                                <Flag className="h-3 w-3 text-red-500" />
                                <span className="text-sm text-red-600">{item.reportsCount}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant={getStatusColor(item.isHidden ? 'hidden' : 'approved')}>
                              {item.isHidden ? 'hidden' : 'approved'}
                            </Badge>
                            {item.moderationAnalysis?.isAutoFlagged && (
                              <Badge variant="destructive" className="text-xs">
                                Auto-flagged
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setModerationNotes('');
                                }}
                                data-testid={`button-view-content-${item.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Content Review</DialogTitle>
                              </DialogHeader>
                              {selectedItem && (
                                <div className="space-y-6">
                                  {/* Content Display */}
                                  <div className="space-y-4">
                                    <div>
                                      <Label>Content</Label>
                                      <div className="p-3 bg-muted rounded border">
                                        <p className="whitespace-pre-wrap">{selectedItem.text}</p>
                                        {selectedItem.link && (
                                          <div className="mt-2 pt-2 border-t">
                                            <div className="flex items-center gap-2">
                                              <Link className="h-4 w-4 text-muted-foreground" />
                                              <a 
                                                href={selectedItem.link} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-blue-500 hover:underline"
                                              >
                                                {selectedItem.link}
                                              </a>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <Label>Author</Label>
                                        <div className="space-y-1">
                                          <p className="text-sm font-medium">
                                            {selectedItem.author.profile?.displayName || 'Anonymous User'}
                                          </p>
                                          <p className="text-xs text-muted-foreground font-mono">
                                            ID: {selectedItem.authorHumanId}
                                          </p>
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline">
                                              {selectedItem.author.profile?.trustLevel || 'new'}
                                            </Badge>
                                            <Badge variant={getStatusColor(selectedItem.author.profile?.accountStatus || 'active')}>
                                              {selectedItem.author.profile?.accountStatus || 'active'}
                                            </Badge>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <Label>Metadata</Label>
                                        <div className="space-y-1 text-sm">
                                          <div>Room: <Badge variant={getRoomColor(selectedItem.room)}>{selectedItem.room}</Badge></div>
                                          {selectedItem.category && (
                                            <div>Category: <Badge variant="outline">{selectedItem.category}</Badge></div>
                                          )}
                                          {selectedItem.geoScope && (
                                            <div>Scope: {selectedItem.geoScope}</div>
                                          )}
                                          <div>Created: {new Date(selectedItem.createdAt).toLocaleString()}</div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Engagement Stats */}
                                  <div>
                                    <Label>Engagement</Label>
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                      <div className="flex items-center gap-2">
                                        <Star className="h-4 w-4 text-amber-500" />
                                        <span>{selectedItem.starsCount} stars</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Flag className="h-4 w-4 text-red-500" />
                                        <span>{selectedItem.reportsCount} reports</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                        <span>{selectedItem.isHidden ? 'Hidden' : 'Visible'}</span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Moderation Analysis */}
                                  {selectedItem.moderationAnalysis && (
                                    <div>
                                      <Label>AI Analysis</Label>
                                      <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                          <div>Risk Score: {selectedItem.moderationAnalysis.riskScore}%</div>
                                          <div>Toxicity: {selectedItem.moderationAnalysis.toxicityScore}%</div>
                                          <div>Spam Score: {selectedItem.moderationAnalysis.spamScore}%</div>
                                        </div>
                                        <div>
                                          <div>Language: {selectedItem.moderationAnalysis.language}</div>
                                          <div>Auto-flagged: {selectedItem.moderationAnalysis.isAutoFlagged ? 'Yes' : 'No'}</div>
                                          {selectedItem.moderationAnalysis.flaggedReasons.length > 0 && (
                                            <div>
                                              Reasons: {selectedItem.moderationAnalysis.flaggedReasons.join(', ')}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Reports */}
                                  {selectedItem.reports && selectedItem.reports.length > 0 && (
                                    <div>
                                      <Label>Reports ({selectedItem.reports.length})</Label>
                                      <div className="space-y-2">
                                        {selectedItem.reports.map((report) => (
                                          <div key={report.id} className="p-2 border rounded text-sm">
                                            <div className="flex justify-between">
                                              <span className="font-medium">{report.reason}</span>
                                              <span className="text-muted-foreground">
                                                {new Date(report.createdAt).toLocaleDateString()}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Moderation Notes */}
                                  <div>
                                    <Label htmlFor="review-notes">Moderation Notes</Label>
                                    <Textarea
                                      id="review-notes"
                                      placeholder="Add notes about your decision..."
                                      value={moderationNotes}
                                      onChange={(e) => setModerationNotes(e.target.value)}
                                      rows={3}
                                      data-testid="textarea-review-notes"
                                    />
                                  </div>
                                  
                                  {/* Actions */}
                                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                                    <Button
                                      onClick={() => handleSingleAction('approve', 'Content approved by admin')}
                                      disabled={contentActionMutation.isPending}
                                      data-testid="button-approve-content"
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      Approve
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      onClick={() => handleSingleAction('hide', 'Content hidden by admin')}
                                      disabled={contentActionMutation.isPending}
                                      data-testid="button-hide-content"
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      Hide
                                    </Button>
                                    
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="destructive" data-testid="button-delete-content">
                                          <Trash2 className="h-4 w-4 mr-1" />
                                          Delete
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Content</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This will permanently delete this content. This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleSingleAction('delete', 'Content deleted for policy violation')}>
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                    
                                    <Button
                                      variant="outline"
                                      onClick={() => handleSingleAction('flag', 'Content flagged for review')}
                                      disabled={contentActionMutation.isPending}
                                      data-testid="button-flag-content"
                                    >
                                      <Flag className="h-4 w-4 mr-1" />
                                      Flag
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {content.length === 0 && !contentLoading && (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Content Found</h3>
                    <p className="text-muted-foreground">
                      No content matches your current filters.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Content Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics?.topCategories.map((category) => (
                      <div key={category.category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(category.category)}
                          <span className="capitalize">{category.category || 'General'}</span>
                        </div>
                        <Badge variant="secondary">{category.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              {/* Trending Topics */}
              <Card>
                <CardHeader>
                  <CardTitle>Trending Topics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics?.trendinTopics.map((topic, index) => (
                      <div key={topic.topic} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span>{topic.topic}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{topic.engagement}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Content Trends Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Detailed trend analysis and topic modeling will be available here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Content Management Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Configure content management preferences and moderation rules.
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label>Auto-moderation Sensitivity</Label>
                    <Select defaultValue="medium">
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Content Retention Policy</Label>
                    <div className="text-sm text-muted-foreground">
                      How long to retain deleted content for audit purposes: 90 days
                    </div>
                  </div>
                  
                  <div>
                    <Label>Bulk Action Limits</Label>
                    <div className="text-sm text-muted-foreground">
                      Maximum number of items that can be processed in a single bulk operation: 500
                    </div>
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