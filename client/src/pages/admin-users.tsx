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
  Users,
  Search,
  Filter,
  MoreHorizontal,
  UserCheck,
  UserX,
  UserPlus,
  Shield,
  AlertTriangle,
  Clock,
  Calendar,
  Activity,
  MessageSquare,
  Star,
  TrendingUp,
  ArrowLeft,
  RefreshCw,
  Download,
  Upload,
  Settings,
  Eye,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  XCircle,
  AlertOctagon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorldId } from "@/hooks/use-world-id";

interface UserProfile {
  humanId: string;
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
  isVerified: boolean;
  verificationLevel: string;
  accountStatus: string;
  trustLevel: string;
  reputationScore: number;
  totalMessages: number;
  totalStars: number;
  helpfulMessages: number;
  reportedMessages: number;
  daysActive: number;
  streakDays: number;
  warningsCount: number;
  suspensionsCount: number;
  lastViolation?: Date;
  moderationNotes?: string;
  notes?: string;
  tags: string[];
  lastReviewedBy?: string;
  lastReviewedAt?: Date;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  // Additional fields from join
  human: {
    id: string;
    joinedAt: Date;
    preferredLanguage: string;
  };
  trustScore?: {
    overallScore: number;
    trustLevel: string;
    violationCount: number;
    daysWithoutViolation: number;
  };
  recentActivity?: {
    lastMessage: Date;
    messagesLast24h: number;
  };
}

interface UserManagementFilters {
  search?: string;
  trustLevel?: string;
  accountStatus?: string;
  verificationLevel?: string;
  dateRange?: { start: string; end: string };
  hasViolations?: boolean;
  isOnline?: boolean;
}

interface BulkOperation {
  id: string;
  operationType: string;
  targetType: string;
  status: string;
  totalTargets: number;
  processedTargets: number;
  successfulTargets: number;
  failedTargets: number;
  createdAt: Date;
}

export default function AdminUsers() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { humanId } = useWorldId();
  const queryClient = useQueryClient();
  
  // State management
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<UserManagementFilters>({});
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [bulkReason, setBulkReason] = useState<string>('');
  const [editingNotes, setEditingNotes] = useState<string>('');
  const [editingTags, setEditingTags] = useState<string>('');
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
              You need admin credentials to access user management.
            </p>
            <Button onClick={() => setLocation('/admin')} className="w-full">
              Back to Admin Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch users
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ['/api/admin/users', filters, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.trustLevel) params.append('trustLevel', filters.trustLevel);
      if (filters.accountStatus) params.append('accountStatus', filters.accountStatus);
      if (filters.verificationLevel) params.append('verificationLevel', filters.verificationLevel);
      if (filters.hasViolations !== undefined) params.append('hasViolations', filters.hasViolations.toString());
      if (filters.isOnline !== undefined) params.append('isOnline', filters.isOnline.toString());
      if (filters.dateRange?.start) params.append('startDate', filters.dateRange.start);
      if (filters.dateRange?.end) params.append('endDate', filters.dateRange.end);
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    refetchInterval: 30000,
    enabled: !!adminKey && !!humanId
  });

  // Fetch bulk operations
  const { data: bulkOperations = [], isLoading: bulkLoading } = useQuery<BulkOperation[]>({
    queryKey: ['/api/admin/bulk-operations', 'users'],
    queryFn: async () => {
      const res = await fetch('/api/admin/bulk-operations?targetType=users&limit=10', {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch bulk operations');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // User action mutations
  const userActionMutation = useMutation({
    mutationFn: async ({ action, userId, reason, duration }: { 
      action: string; 
      userId: string; 
      reason: string; 
      duration?: number 
    }) => {
      const res = await fetch(`/api/admin/users/${userId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        },
        body: JSON.stringify({ action, reason, duration })
      });
      if (!res.ok) throw new Error('Failed to execute user action');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Action Completed",
        description: "User action has been executed successfully"
      });
      refetchUsers();
      setSelectedUser(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to execute user action",
        variant: "destructive"
      });
    }
  });

  // Bulk action mutation
  const bulkActionMutation = useMutation({
    mutationFn: async ({ action, userIds, reason }: { 
      action: string; 
      userIds: string[]; 
      reason: string 
    }) => {
      const res = await fetch('/api/admin/users/bulk-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        },
        body: JSON.stringify({ action, userIds, reason })
      });
      if (!res.ok) throw new Error('Failed to execute bulk action');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Bulk Action Started",
        description: "Bulk action has been queued for processing"
      });
      setSelectedUsers(new Set());
      setBulkAction('');
      setBulkReason('');
      refetchUsers();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/bulk-operations'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to execute bulk action",
        variant: "destructive"
      });
    }
  });

  // Update user notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async ({ userId, notes, tags }: { 
      userId: string; 
      notes: string; 
      tags: string[] 
    }) => {
      const res = await fetch(`/api/admin/users/${userId}/notes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        },
        body: JSON.stringify({ notes, tags })
      });
      if (!res.ok) throw new Error('Failed to update user notes');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Notes Updated",
        description: "User notes have been updated successfully"
      });
      refetchUsers();
      setSelectedUser(null);
    }
  });

  const users = usersData?.users || [];
  const totalUsers = usersData?.total || 0;
  const totalPages = Math.ceil(totalUsers / limit);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'warned': return 'secondary';
      case 'restricted': return 'outline';
      case 'suspended': return 'destructive';
      case 'banned': return 'destructive';
      default: return 'outline';
    }
  };

  const getTrustLevelColor = (level: string) => {
    switch (level) {
      case 'new': return 'outline';
      case 'basic': return 'secondary';
      case 'trusted': return 'default';
      case 'veteran': return 'default';
      case 'moderator': return 'destructive';
      default: return 'outline';
    }
  };

  const getVerificationIcon = (level: string) => {
    switch (level) {
      case 'none': return null;
      case 'basic': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'enhanced': return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'premium': return <CheckCircle className="h-4 w-4 text-purple-500" />;
      default: return null;
    }
  };

  const handleSelectUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.humanId)));
    }
  };

  const handleBulkAction = () => {
    if (selectedUsers.size === 0 || !bulkAction || !bulkReason.trim()) {
      toast({
        title: "Invalid Action",
        description: "Please select users, action, and provide a reason",
        variant: "destructive"
      });
      return;
    }

    bulkActionMutation.mutate({
      action: bulkAction,
      userIds: Array.from(selectedUsers),
      reason: bulkReason
    });
  };

  const handleUserAction = (action: string, reason: string, duration?: number) => {
    if (!selectedUser) return;
    
    userActionMutation.mutate({
      action,
      userId: selectedUser.humanId,
      reason,
      duration
    });
  };

  const handleUpdateNotes = () => {
    if (!selectedUser) return;
    
    const tags = editingTags.split(',').map(t => t.trim()).filter(Boolean);
    updateNotesMutation.mutate({
      userId: selectedUser.humanId,
      notes: editingNotes,
      tags
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
              <Users className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">User Management</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchUsers()}
              disabled={usersLoading}
              data-testid="button-refresh-users"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${usersLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-users"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">
                {totalUsers.toLocaleString()}
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
                {users.filter(u => u.accountStatus === 'active').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trusted Users</CardTitle>
              <Shield className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="text-trusted-users">
                {users.filter(u => ['trusted', 'veteran', 'moderator'].includes(u.trustLevel)).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Flagged Users</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600" data-testid="text-flagged-users">
                {users.filter(u => ['warned', 'restricted', 'suspended'].includes(u.accountStatus)).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified Users</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-verified-users">
                {users.filter(u => u.isVerified).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">User Directory</TabsTrigger>
            <TabsTrigger value="bulk-ops">Bulk Operations</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
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
                    <Label htmlFor="search">Search Users</Label>
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="search"
                        placeholder="Search by name, ID, or email..."
                        value={filters.search || ''}
                        onChange={(e) => setFilters({...filters, search: e.target.value})}
                        className="pl-9"
                        data-testid="input-search-users"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="trust-level">Trust Level</Label>
                    <Select value={filters.trustLevel || ''} onValueChange={(value) => setFilters({...filters, trustLevel: value || undefined})}>
                      <SelectTrigger data-testid="select-trust-level">
                        <SelectValue placeholder="All trust levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All trust levels</SelectItem>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="trusted">Trusted</SelectItem>
                        <SelectItem value="veteran">Veteran</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="account-status">Account Status</Label>
                    <Select value={filters.accountStatus || ''} onValueChange={(value) => setFilters({...filters, accountStatus: value || undefined})}>
                      <SelectTrigger data-testid="select-account-status">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="warned">Warned</SelectItem>
                        <SelectItem value="restricted">Restricted</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="banned">Banned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="verification">Verification</Label>
                    <Select value={filters.verificationLevel || ''} onValueChange={(value) => setFilters({...filters, verificationLevel: value || undefined})}>
                      <SelectTrigger data-testid="select-verification">
                        <SelectValue placeholder="All verification levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All verification levels</SelectItem>
                        <SelectItem value="none">Unverified</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="enhanced">Enhanced</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bulk Actions */}
            {selectedUsers.size > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Bulk Actions ({selectedUsers.size} users selected)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Select value={bulkAction} onValueChange={setBulkAction}>
                      <SelectTrigger className="w-48" data-testid="select-bulk-action">
                        <SelectValue placeholder="Select action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warn">Warn Users</SelectItem>
                        <SelectItem value="suspend">Suspend Users</SelectItem>
                        <SelectItem value="verify">Verify Users</SelectItem>
                        <SelectItem value="unverify">Remove Verification</SelectItem>
                        <SelectItem value="export">Export Data</SelectItem>
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
                          disabled={!bulkAction || !bulkReason.trim() || bulkActionMutation.isPending}
                          data-testid="button-execute-bulk-action"
                        >
                          Execute Action
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirm Bulk Action</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will execute "{bulkAction}" on {selectedUsers.size} selected users. 
                            This action cannot be undone easily. Are you sure you want to continue?
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
                      onClick={() => setSelectedUsers(new Set())}
                      data-testid="button-clear-selection"
                    >
                      Clear Selection
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Users Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Users ({totalUsers} total)</span>
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
                          checked={selectedUsers.size === users.length && users.length > 0}
                          onCheckedChange={handleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Trust</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.humanId}>
                        <TableCell>
                          <Checkbox
                            checked={selectedUsers.has(user.humanId)}
                            onCheckedChange={() => handleSelectUser(user.humanId)}
                            data-testid={`checkbox-user-${user.humanId}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              {getVerificationIcon(user.verificationLevel)}
                              <div className="font-medium">
                                {user.displayName || `User ${user.humanId.slice(0, 8)}`}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ID: {user.humanId.slice(0, 12)}...
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(user.accountStatus)}>
                            {user.accountStatus}
                          </Badge>
                          {user.warningsCount > 0 && (
                            <Badge variant="outline" className="ml-1">
                              {user.warningsCount} warns
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getTrustLevelColor(user.trustLevel)}>
                            {user.trustLevel}
                          </Badge>
                          <div className="text-sm text-muted-foreground mt-1">
                            Score: {user.reputationScore}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{user.totalMessages} messages</div>
                            <div className="text-muted-foreground">
                              {user.totalStars} stars • {user.daysActive} days
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {new Date(user.human.joinedAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setEditingNotes(user.notes || '');
                                  setEditingTags(user.tags.join(', '));
                                }}
                                data-testid={`button-view-user-${user.humanId}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>User Profile Management</DialogTitle>
                              </DialogHeader>
                              {selectedUser && (
                                <div className="space-y-6">
                                  {/* User Info */}
                                  <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                      <div>
                                        <Label>Display Name</Label>
                                        <p className="text-sm">{selectedUser.displayName || 'Not set'}</p>
                                      </div>
                                      <div>
                                        <Label>Human ID</Label>
                                        <p className="text-sm font-mono">{selectedUser.humanId}</p>
                                      </div>
                                      <div>
                                        <Label>Account Status</Label>
                                        <div className="flex items-center gap-2">
                                          <Badge variant={getStatusColor(selectedUser.accountStatus)}>
                                            {selectedUser.accountStatus}
                                          </Badge>
                                          {getVerificationIcon(selectedUser.verificationLevel)}
                                        </div>
                                      </div>
                                      <div>
                                        <Label>Trust Level</Label>
                                        <Badge variant={getTrustLevelColor(selectedUser.trustLevel)}>
                                          {selectedUser.trustLevel}
                                        </Badge>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-4">
                                      <div>
                                        <Label>Activity Statistics</Label>
                                        <div className="text-sm space-y-1">
                                          <div>Messages: {selectedUser.totalMessages}</div>
                                          <div>Stars: {selectedUser.totalStars}</div>
                                          <div>Helpful: {selectedUser.helpfulMessages}</div>
                                          <div>Reported: {selectedUser.reportedMessages}</div>
                                          <div>Days Active: {selectedUser.daysActive}</div>
                                          <div>Streak: {selectedUser.streakDays} days</div>
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <Label>Moderation History</Label>
                                        <div className="text-sm space-y-1">
                                          <div>Warnings: {selectedUser.warningsCount}</div>
                                          <div>Suspensions: {selectedUser.suspensionsCount}</div>
                                          {selectedUser.lastViolation && (
                                            <div>Last Violation: {new Date(selectedUser.lastViolation).toLocaleDateString()}</div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Admin Notes */}
                                  <div className="space-y-2">
                                    <Label htmlFor="admin-notes">Admin Notes</Label>
                                    <Textarea
                                      id="admin-notes"
                                      value={editingNotes}
                                      onChange={(e) => setEditingNotes(e.target.value)}
                                      placeholder="Add notes about this user..."
                                      rows={3}
                                      data-testid="textarea-admin-notes"
                                    />
                                  </div>
                                  
                                  {/* Tags */}
                                  <div className="space-y-2">
                                    <Label htmlFor="user-tags">Tags</Label>
                                    <Input
                                      id="user-tags"
                                      value={editingTags}
                                      onChange={(e) => setEditingTags(e.target.value)}
                                      placeholder="Enter tags separated by commas..."
                                      data-testid="input-user-tags"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Current tags: {selectedUser.tags.join(', ') || 'None'}
                                    </p>
                                  </div>
                                  
                                  {/* Actions */}
                                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                                    <Button
                                      onClick={handleUpdateNotes}
                                      disabled={updateNotesMutation.isPending}
                                      data-testid="button-save-notes"
                                    >
                                      Save Notes & Tags
                                    </Button>
                                    
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="outline" data-testid="button-warn-user">
                                          <AlertTriangle className="h-4 w-4 mr-1" />
                                          Warn User
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Warn User</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Send a warning to this user. Please provide a reason.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleUserAction('warn', 'Policy violation warning')}>
                                            Send Warning
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                    
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="outline" data-testid="button-suspend-user">
                                          <Clock className="h-4 w-4 mr-1" />
                                          Suspend User
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Suspend User</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Temporarily suspend this user's account. This will prevent them from posting messages.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleUserAction('suspend', 'Account suspended for violations', 24)}>
                                            Suspend for 24h
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                    
                                    {selectedUser.accountStatus !== 'banned' && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="destructive" data-testid="button-ban-user">
                                            <Ban className="h-4 w-4 mr-1" />
                                            Ban User
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Ban User</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Permanently ban this user from the platform. This action should only be used for serious violations.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleUserAction('ban', 'Permanently banned for severe violations')}>
                                              Ban User
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                    
                                    {!selectedUser.isVerified && (
                                      <Button 
                                        variant="outline"
                                        onClick={() => handleUserAction('verify', 'Manual verification by admin')}
                                        data-testid="button-verify-user"
                                      >
                                        <UserCheck className="h-4 w-4 mr-1" />
                                        Verify User
                                      </Button>
                                    )}
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
                
                {users.length === 0 && !usersLoading && (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Users Found</h3>
                    <p className="text-muted-foreground">
                      No users match your current filters.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bulk-ops" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Bulk Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bulkOperations.map((operation) => (
                    <div key={operation.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{operation.operationType}</Badge>
                          <Badge variant={
                            operation.status === 'completed' ? 'default' :
                            operation.status === 'failed' ? 'destructive' :
                            operation.status === 'processing' ? 'secondary' : 'outline'
                          }>
                            {operation.status}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(operation.createdAt).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{operation.processedTargets}/{operation.totalTargets}</span>
                        </div>
                        <Progress 
                          value={(operation.processedTargets / operation.totalTargets) * 100} 
                          className="h-2"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Successful: {operation.successfulTargets}</span>
                          <span>Failed: {operation.failedTargets}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {bulkOperations.length === 0 && (
                    <div className="text-center py-8">
                      <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Bulk Operations</h3>
                      <p className="text-muted-foreground">
                        No recent bulk operations found.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Management Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Configure user management preferences and defaults.
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label>Default Trust Level for New Users</Label>
                    <Select defaultValue="new">
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Auto-verification Rules</Label>
                    <div className="text-sm text-muted-foreground">
                      Automatically verify users based on activity and trust score.
                    </div>
                  </div>
                  
                  <div>
                    <Label>Bulk Operation Limits</Label>
                    <div className="text-sm text-muted-foreground">
                      Maximum number of users that can be processed in a single bulk operation: 1000
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