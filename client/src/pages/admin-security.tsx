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
  Shield,
  AlertTriangle,
  Eye,
  Lock,
  Key,
  UserCheck,
  FileText,
  Download,
  Search,
  Filter,
  Clock,
  Activity,
  Settings,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertOctagon,
  Users,
  Database,
  Server,
  Globe,
  Fingerprint,
  Monitor,
  CreditCard,
  Wifi,
  Smartphone,
  Laptop,
  Calendar,
  MapPin,
  Flag
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorldId } from "@/hooks/use-world-id";

interface AdminActionLog {
  id: string;
  adminId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  adminName?: string;
}

interface SecurityAlert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  affectedResource: string;
  detectedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
}

interface AdminRole {
  id: string;
  name: string;
  permissions: string[];
  userCount: number;
  description?: string;
  createdAt: Date;
}

interface AdminSession {
  id: string;
  adminId: string;
  adminName: string;
  ipAddress: string;
  userAgent: string;
  loginTime: Date;
  lastActivity: Date;
  isActive: boolean;
  location?: string;
}

interface SecurityReport {
  totalSecurityEvents: number;
  activeAlerts: number;
  resolvedThisWeek: number;
  failedLoginAttempts: number;
  suspiciousActivities: number;
  topRisks: Array<{
    type: string;
    count: number;
    severity: string;
  }>;
}

export default function AdminSecurity() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { humanId } = useWorldId();
  const queryClient = useQueryClient();
  
  // State management
  const [auditFilters, setAuditFilters] = useState({
    adminId: '',
    action: '',
    resourceType: '',
    severity: '',
    dateRange: { start: '', end: '' }
  });
  const [selectedLog, setSelectedLog] = useState<AdminActionLog | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

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
              You need admin credentials to access security management.
            </p>
            <Button onClick={() => setLocation('/admin')} className="w-full">
              Back to Admin Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch audit logs
  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['/api/admin/security/audit-logs', auditFilters, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (auditFilters.adminId) params.append('adminId', auditFilters.adminId);
      if (auditFilters.action) params.append('action', auditFilters.action);
      if (auditFilters.resourceType) params.append('resourceType', auditFilters.resourceType);
      if (auditFilters.severity) params.append('severity', auditFilters.severity);
      if (auditFilters.dateRange.start) params.append('startDate', auditFilters.dateRange.start);
      if (auditFilters.dateRange.end) params.append('endDate', auditFilters.dateRange.end);
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      
      const res = await fetch(`/api/admin/security/audit-logs?${params}`, {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Fetch security alerts
  const { data: alerts = [], isLoading: alertsLoading, refetch: refetchAlerts } = useQuery<SecurityAlert[]>({
    queryKey: ['/api/admin/security/alerts'],
    queryFn: async () => {
      const res = await fetch('/api/admin/security/alerts', {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch security alerts');
      return res.json();
    },
    refetchInterval: 30000,
    enabled: !!adminKey && !!humanId
  });

  // Fetch admin roles
  const { data: roles = [], isLoading: rolesLoading } = useQuery<AdminRole[]>({
    queryKey: ['/api/admin/security/roles'],
    queryFn: async () => {
      const res = await fetch('/api/admin/security/roles', {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch admin roles');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Fetch active sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<AdminSession[]>({
    queryKey: ['/api/admin/security/sessions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/security/sessions', {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch admin sessions');
      return res.json();
    },
    refetchInterval: 60000,
    enabled: !!adminKey && !!humanId
  });

  // Fetch security report
  const { data: securityReport } = useQuery<SecurityReport>({
    queryKey: ['/api/admin/security/report'],
    queryFn: async () => {
      const res = await fetch('/api/admin/security/report', {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch security report');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Security alert actions
  const alertActionMutation = useMutation({
    mutationFn: async ({ alertId, action, notes }: { alertId: string; action: string; notes?: string }) => {
      const res = await fetch(`/api/admin/security/alerts/${alertId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        },
        body: JSON.stringify({ action, notes })
      });
      if (!res.ok) throw new Error('Failed to execute alert action');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Alert Updated",
        description: "Security alert has been updated successfully"
      });
      refetchAlerts();
      setSelectedAlert(null);
    }
  });

  // Session management
  const terminateSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/admin/security/sessions/${sessionId}/terminate`, {
        method: 'POST',
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to terminate session');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Session Terminated",
        description: "Admin session has been terminated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/security/sessions'] });
    }
  });

  const auditLogs = auditData?.logs || [];
  const totalLogs = auditData?.total || 0;
  const totalPages = Math.ceil(totalLogs / limit);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'default';
      case 'medium': return 'secondary';
      case 'high': return 'destructive';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info': return 'default';
      case 'warning': return 'secondary';
      case 'critical': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'destructive';
      case 'investigating': return 'secondary';
      case 'resolved': return 'default';
      case 'false_positive': return 'outline';
      default: return 'outline';
    }
  };

  const getDeviceIcon = (userAgent: string) => {
    if (userAgent.includes('Mobile')) return <Smartphone className="h-4 w-4" />;
    if (userAgent.includes('Tablet')) return <Smartphone className="h-4 w-4" />;
    return <Laptop className="h-4 w-4" />;
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
              <h1 className="text-2xl font-bold">Security & Audit</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchAudit();
                refetchAlerts();
              }}
              data-testid="button-refresh-security"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-export-audit"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Security Overview */}
        {securityReport && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Security Events</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-security-events">
                  {securityReport.totalSecurityEvents.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600" data-testid="text-active-alerts">
                  {securityReport.activeAlerts}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resolved This Week</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600" data-testid="text-resolved-alerts">
                  {securityReport.resolvedThisWeek}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
                <Lock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600" data-testid="text-failed-logins">
                  {securityReport.failedLoginAttempts}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Suspicious Activity</CardTitle>
                <AlertOctagon className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600" data-testid="text-suspicious-activity">
                  {securityReport.suspiciousActivities}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="alerts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
            <TabsTrigger value="roles">Role Management</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="space-y-4">
            {/* Active Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Security Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {alerts.filter(alert => alert.status === 'active').map((alert) => (
                    <div key={alert.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={getAlertSeverityColor(alert.severity)}>
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <Badge variant={getStatusColor(alert.status)}>
                            {alert.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(alert.detectedAt).toLocaleString()}
                        </span>
                      </div>
                      
                      <h3 className="font-semibold mb-1">{alert.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Affected: {alert.affectedResource}
                      </p>
                      
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedAlert(alert)}
                              data-testid={`button-investigate-alert-${alert.id}`}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Investigate
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Security Alert Investigation</DialogTitle>
                            </DialogHeader>
                            {selectedAlert && (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Alert Type</Label>
                                    <p className="text-sm">{selectedAlert.type}</p>
                                  </div>
                                  <div>
                                    <Label>Severity</Label>
                                    <Badge variant={getAlertSeverityColor(selectedAlert.severity)}>
                                      {selectedAlert.severity}
                                    </Badge>
                                  </div>
                                  <div>
                                    <Label>Status</Label>
                                    <Badge variant={getStatusColor(selectedAlert.status)}>
                                      {selectedAlert.status}
                                    </Badge>
                                  </div>
                                  <div>
                                    <Label>Detected At</Label>
                                    <p className="text-sm">{new Date(selectedAlert.detectedAt).toLocaleString()}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <Label>Description</Label>
                                  <p className="text-sm">{selectedAlert.description}</p>
                                </div>
                                
                                <div>
                                  <Label>Affected Resource</Label>
                                  <p className="text-sm font-mono">{selectedAlert.affectedResource}</p>
                                </div>
                                
                                <div className="flex gap-2 pt-4 border-t">
                                  <Button
                                    onClick={() => alertActionMutation.mutate({
                                      alertId: selectedAlert.id,
                                      action: 'mark_investigating'
                                    })}
                                    disabled={alertActionMutation.isPending}
                                    data-testid="button-mark-investigating"
                                  >
                                    Mark Investigating
                                  </Button>
                                  
                                  <Button
                                    variant="outline"
                                    onClick={() => alertActionMutation.mutate({
                                      alertId: selectedAlert.id,
                                      action: 'mark_resolved'
                                    })}
                                    disabled={alertActionMutation.isPending}
                                    data-testid="button-mark-resolved"
                                  >
                                    Mark Resolved
                                  </Button>
                                  
                                  <Button
                                    variant="outline"
                                    onClick={() => alertActionMutation.mutate({
                                      alertId: selectedAlert.id,
                                      action: 'false_positive'
                                    })}
                                    disabled={alertActionMutation.isPending}
                                    data-testid="button-false-positive"
                                  >
                                    False Positive
                                  </Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => alertActionMutation.mutate({
                            alertId: alert.id,
                            action: 'mark_investigating'
                          })}
                          disabled={alertActionMutation.isPending}
                          data-testid={`button-quick-investigate-${alert.id}`}
                        >
                          Quick Investigate
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {alerts.filter(alert => alert.status === 'active').length === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Active Alerts</h3>
                      <p className="text-muted-foreground">
                        System is secure with no active security alerts.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            {/* Audit Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Audit Log Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="admin-filter">Admin</Label>
                    <Input
                      id="admin-filter"
                      placeholder="Admin ID or name..."
                      value={auditFilters.adminId}
                      onChange={(e) => setAuditFilters({...auditFilters, adminId: e.target.value})}
                      data-testid="input-filter-admin"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="action-filter">Action</Label>
                    <Select value={auditFilters.action} onValueChange={(value) => setAuditFilters({...auditFilters, action: value})}>
                      <SelectTrigger data-testid="select-filter-action">
                        <SelectValue placeholder="All actions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All actions</SelectItem>
                        <SelectItem value="login">Login</SelectItem>
                        <SelectItem value="logout">Logout</SelectItem>
                        <SelectItem value="user_ban">User Ban</SelectItem>
                        <SelectItem value="user_unban">User Unban</SelectItem>
                        <SelectItem value="content_delete">Content Delete</SelectItem>
                        <SelectItem value="config_update">Config Update</SelectItem>
                        <SelectItem value="role_assign">Role Assign</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="resource-filter">Resource Type</Label>
                    <Select value={auditFilters.resourceType} onValueChange={(value) => setAuditFilters({...auditFilters, resourceType: value})}>
                      <SelectTrigger data-testid="select-filter-resource">
                        <SelectValue placeholder="All resources" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All resources</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="content">Content</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="config">Configuration</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="severity-filter">Severity</Label>
                    <Select value={auditFilters.severity} onValueChange={(value) => setAuditFilters({...auditFilters, severity: value})}>
                      <SelectTrigger data-testid="select-filter-severity">
                        <SelectValue placeholder="All severities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All severities</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Audit Logs Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Audit Logs ({totalLogs} total)</span>
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
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log: AdminActionLog) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{log.adminName || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground font-mono">{log.adminId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{log.resourceType}</p>
                            <p className="text-xs text-muted-foreground font-mono">{log.resourceId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getSeverityColor(log.severity)}>
                            {log.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.ipAddress}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setSelectedLog(log)}
                                data-testid={`button-view-log-${log.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Audit Log Details</DialogTitle>
                              </DialogHeader>
                              {selectedLog && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Timestamp</Label>
                                      <p className="text-sm">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <Label>Admin</Label>
                                      <p className="text-sm">{selectedLog.adminName || 'Unknown'}</p>
                                      <p className="text-xs text-muted-foreground font-mono">{selectedLog.adminId}</p>
                                    </div>
                                    <div>
                                      <Label>Action</Label>
                                      <p className="text-sm">{selectedLog.action}</p>
                                    </div>
                                    <div>
                                      <Label>Severity</Label>
                                      <Badge variant={getSeverityColor(selectedLog.severity)}>
                                        {selectedLog.severity}
                                      </Badge>
                                    </div>
                                    <div>
                                      <Label>Resource Type</Label>
                                      <p className="text-sm">{selectedLog.resourceType}</p>
                                    </div>
                                    <div>
                                      <Label>Resource ID</Label>
                                      <p className="text-sm font-mono">{selectedLog.resourceId}</p>
                                    </div>
                                    <div>
                                      <Label>IP Address</Label>
                                      <p className="text-sm font-mono">{selectedLog.ipAddress}</p>
                                    </div>
                                    <div>
                                      <Label>User Agent</Label>
                                      <p className="text-sm truncate">{selectedLog.userAgent}</p>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <Label>Details</Label>
                                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                                      {JSON.stringify(selectedLog.details, null, 2)}
                                    </pre>
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Active Admin Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admin</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Login Time</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{session.adminName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{session.adminId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getDeviceIcon(session.userAgent)}
                            <div>
                              <p className="text-sm font-mono">{session.ipAddress}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-32">
                                {session.userAgent}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{session.location || 'Unknown'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(session.loginTime).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(session.lastActivity).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={session.isActive ? 'default' : 'secondary'}>
                            {session.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {session.isActive && session.adminId !== humanId && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  data-testid={`button-terminate-session-${session.id}`}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Terminate Session</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will immediately terminate the admin session for {session.adminName}. 
                                    They will need to log in again to continue using admin functions.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => terminateSessionMutation.mutate(session.id)}>
                                    Terminate
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Admin Roles & Permissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {roles.map((role) => (
                    <div key={role.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{role.name}</h3>
                        <Badge variant="outline">{role.userCount} users</Badge>
                      </div>
                      
                      {role.description && (
                        <p className="text-sm text-muted-foreground mb-3">{role.description}</p>
                      )}
                      
                      <div className="space-y-2">
                        <Label>Permissions</Label>
                        <div className="flex flex-wrap gap-1">
                          {role.permissions.map((permission) => (
                            <Badge key={permission} variant="secondary" className="text-xs">
                              {permission}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="mt-4 text-xs text-muted-foreground">
                        Created: {new Date(role.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Compliance Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button variant="outline" data-testid="button-generate-gdpr-report">
                      <Download className="h-4 w-4 mr-2" />
                      Generate GDPR Report
                    </Button>
                    
                    <Button variant="outline" data-testid="button-generate-audit-report">
                      <Download className="h-4 w-4 mr-2" />
                      Generate Audit Report
                    </Button>
                    
                    <Button variant="outline" data-testid="button-generate-security-report">
                      <Download className="h-4 w-4 mr-2" />
                      Generate Security Report
                    </Button>
                    
                    <Button variant="outline" data-testid="button-export-user-data">
                      <Download className="h-4 w-4 mr-2" />
                      Export User Data
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="font-medium mb-2">Data Retention Policies</h4>
                    <div className="text-sm space-y-1">
                      <div>• Audit logs: Retained for 7 years</div>
                      <div>• User data: Retained as per user preference</div>
                      <div>• Security logs: Retained for 2 years</div>
                      <div>• Admin sessions: Retained for 90 days</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Privacy Compliance</h4>
                    <div className="text-sm space-y-1">
                      <div>• GDPR compliant data processing</div>
                      <div>• Right to be forgotten implementation</div>
                      <div>• Data portability features</div>
                      <div>• Consent management system</div>
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