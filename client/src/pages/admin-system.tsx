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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  Settings,
  Server,
  Database,
  Activity,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Zap,
  HardDrive,
  Cpu,
  MemoryStick,
  Globe,
  Users,
  MessageSquare,
  ArrowLeft,
  RefreshCw,
  Download,
  Upload,
  Save,
  RotateCcw,
  Power,
  AlertOctagon,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  Edit,
  Trash2,
  Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorldId } from "@/hooks/use-world-id";

interface SystemConfig {
  key: string;
  value: string;
  category: string;
  description?: string;
  dataType: 'string' | 'number' | 'boolean' | 'json';
  isSecret: boolean;
  updatedAt: Date;
  updatedBy: string;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  responseTime: number;
  errorRate: number;
  activeUsers: number;
  databaseHealth: string;
  queueSizes: { [key: string]: number };
}

interface HealthMetric {
  id: string;
  metricType: string;
  value: number;
  unit: string;
  status: string;
  details?: any;
  recordedAt: Date;
}

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  isEnabled: boolean;
  rolloutPercentage: number;
  targetGroups: string[];
  createdAt: Date;
  updatedAt: Date;
}

export default function AdminSystem() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { humanId } = useWorldId();
  const queryClient = useQueryClient();
  
  // State management
  const [newConfigKey, setNewConfigKey] = useState('');
  const [newConfigValue, setNewConfigValue] = useState('');
  const [newConfigCategory, setNewConfigCategory] = useState('');
  const [newConfigDescription, setNewConfigDescription] = useState('');
  const [newConfigType, setNewConfigType] = useState<'string' | 'number' | 'boolean' | 'json'>('string');
  const [newConfigSecret, setNewConfigSecret] = useState(false);
  
  const [editingConfig, setEditingConfig] = useState<SystemConfig | null>(null);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [newFlagName, setNewFlagName] = useState('');
  const [newFlagKey, setNewFlagKey] = useState('');
  const [newFlagDescription, setNewFlagDescription] = useState('');

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
              You need admin credentials to access system administration.
            </p>
            <Button onClick={() => setLocation('/admin')} className="w-full">
              Back to Admin Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch system configurations
  const { data: configs = [], isLoading: configsLoading, refetch: refetchConfigs } = useQuery<SystemConfig[]>({
    queryKey: ['/api/admin/system/config'],
    queryFn: async () => {
      const res = await fetch('/api/admin/system/config', {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch system configurations');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Fetch system health
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery<SystemHealth>({
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
    refetchInterval: 5000,
    enabled: !!adminKey && !!humanId
  });

  // Fetch health metrics
  const { data: metrics = [], isLoading: metricsLoading } = useQuery<HealthMetric[]>({
    queryKey: ['/api/admin/system/metrics'],
    queryFn: async () => {
      const res = await fetch('/api/admin/system/metrics?limit=50', {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch health metrics');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Fetch feature flags
  const { data: featureFlags = [], isLoading: flagsLoading, refetch: refetchFlags } = useQuery<FeatureFlag[]>({
    queryKey: ['/api/admin/system/feature-flags'],
    queryFn: async () => {
      const res = await fetch('/api/admin/system/feature-flags', {
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch feature flags');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Config mutations
  const createConfigMutation = useMutation({
    mutationFn: async (config: Omit<SystemConfig, 'updatedAt' | 'updatedBy'>) => {
      const res = await fetch('/api/admin/system/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        },
        body: JSON.stringify(config)
      });
      if (!res.ok) throw new Error('Failed to create configuration');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Created",
        description: "System configuration has been created successfully"
      });
      refetchConfigs();
      setNewConfigKey('');
      setNewConfigValue('');
      setNewConfigCategory('');
      setNewConfigDescription('');
      setNewConfigType('string');
      setNewConfigSecret(false);
    }
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ key, updates }: { key: string; updates: Partial<SystemConfig> }) => {
      const res = await fetch(`/api/admin/system/config/${key}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to update configuration');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Updated",
        description: "System configuration has been updated successfully"
      });
      refetchConfigs();
      setEditingConfig(null);
    }
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch(`/api/admin/system/config/${key}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to delete configuration');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuration Deleted",
        description: "System configuration has been deleted successfully"
      });
      refetchConfigs();
    }
  });

  // Feature flag mutations
  const toggleFeatureFlagMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const res = await fetch(`/api/admin/system/feature-flags/${key}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        },
        body: JSON.stringify({ isEnabled: enabled })
      });
      if (!res.ok) throw new Error('Failed to toggle feature flag');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Feature Flag Updated",
        description: "Feature flag has been updated successfully"
      });
      refetchFlags();
    }
  });

  const createFeatureFlagMutation = useMutation({
    mutationFn: async (flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>) => {
      const res = await fetch('/api/admin/system/feature-flags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey,
          'x-world-id-proof': humanId || 'demo'
        },
        body: JSON.stringify(flag)
      });
      if (!res.ok) throw new Error('Failed to create feature flag');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Feature Flag Created",
        description: "Feature flag has been created successfully"
      });
      refetchFlags();
      setNewFlagName('');
      setNewFlagKey('');
      setNewFlagDescription('');
    }
  });

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Minus className="h-5 w-5 text-gray-500" />;
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

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
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
              <Settings className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">System Administration</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchConfigs();
                refetchHealth();
                refetchFlags();
              }}
              data-testid="button-refresh-system"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* System Health Overview */}
        {health && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
                {getHealthStatusIcon(health.status)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getHealthStatusColor(health.status)}`}>
                  {health.status.toUpperCase()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Uptime: {formatUptime(health.uptime)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-response-time">
                  {health.responseTime}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Average response time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-active-users">
                  {health.activeUsers}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently online
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                <AlertTriangle className={`h-4 w-4 ${health.errorRate > 5 ? 'text-red-500' : 'text-green-500'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${health.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                  {health.errorRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Error rate
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="health" className="space-y-4">
          <TabsList>
            <TabsTrigger value="health">Health Monitoring</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="features">Feature Flags</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          </TabsList>

          <TabsContent value="health" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Database Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Status</span>
                      <Badge variant={health?.databaseHealth === 'healthy' ? 'default' : 'destructive'}>
                        {health?.databaseHealth || 'unknown'}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Connection Pool</span>
                        <span>8/10 active</span>
                      </div>
                      <Progress value={80} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Query Performance</span>
                        <span>Good</span>
                      </div>
                      <Progress value={85} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Queue Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Queue Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {health?.queueSizes && Object.entries(health.queueSizes).map(([queue, size]) => (
                      <div key={queue} className="flex items-center justify-between">
                        <span className="capitalize">{queue.replace('_', ' ')}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{size}</span>
                          <Badge variant={size > 100 ? 'destructive' : size > 50 ? 'secondary' : 'default'}>
                            {size > 100 ? 'High' : size > 50 ? 'Medium' : 'Low'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* System Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Health Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recorded</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.slice(0, 10).map((metric) => (
                      <TableRow key={metric.id}>
                        <TableCell className="font-medium">
                          {metric.metricType.replace('_', ' ').toUpperCase()}
                        </TableCell>
                        <TableCell>
                          {metric.value} {metric.unit}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            metric.status === 'healthy' ? 'default' :
                            metric.status === 'warning' ? 'secondary' :
                            metric.status === 'critical' ? 'destructive' : 'outline'
                          }>
                            {metric.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(metric.recordedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {metric.details && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Metric Details</DialogTitle>
                                </DialogHeader>
                                <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                                  {JSON.stringify(metric.details, null, 2)}
                                </pre>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            {/* Add New Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Add New Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="config-key">Key</Label>
                    <Input
                      id="config-key"
                      placeholder="CONFIG_KEY"
                      value={newConfigKey}
                      onChange={(e) => setNewConfigKey(e.target.value)}
                      data-testid="input-config-key"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="config-category">Category</Label>
                    <Select value={newConfigCategory} onValueChange={setNewConfigCategory}>
                      <SelectTrigger data-testid="select-config-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="security">Security</SelectItem>
                        <SelectItem value="api">API</SelectItem>
                        <SelectItem value="features">Features</SelectItem>
                        <SelectItem value="performance">Performance</SelectItem>
                        <SelectItem value="notifications">Notifications</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="config-type">Data Type</Label>
                    <Select value={newConfigType} onValueChange={(value) => setNewConfigType(value as any)}>
                      <SelectTrigger data-testid="select-config-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label htmlFor="config-value">Value</Label>
                    <Input
                      id="config-value"
                      placeholder="Configuration value"
                      value={newConfigValue}
                      onChange={(e) => setNewConfigValue(e.target.value)}
                      data-testid="input-config-value"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="config-secret"
                      checked={newConfigSecret}
                      onCheckedChange={setNewConfigSecret}
                      data-testid="switch-config-secret"
                    />
                    <Label htmlFor="config-secret">Secret Value</Label>
                  </div>
                  
                  <div className="md:col-span-3">
                    <Label htmlFor="config-description">Description</Label>
                    <Textarea
                      id="config-description"
                      placeholder="Configuration description..."
                      value={newConfigDescription}
                      onChange={(e) => setNewConfigDescription(e.target.value)}
                      rows={2}
                      data-testid="textarea-config-description"
                    />
                  </div>
                  
                  <div className="md:col-span-3">
                    <Button
                      onClick={() => createConfigMutation.mutate({
                        key: newConfigKey,
                        value: newConfigValue,
                        category: newConfigCategory,
                        description: newConfigDescription,
                        dataType: newConfigType,
                        isSecret: newConfigSecret
                      })}
                      disabled={!newConfigKey || !newConfigValue || !newConfigCategory || createConfigMutation.isPending}
                      data-testid="button-create-config"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Configuration
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Configuration List */}
            <Card>
              <CardHeader>
                <CardTitle>System Configurations</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configs.map((config) => (
                      <TableRow key={config.key}>
                        <TableCell className="font-mono font-medium">
                          {config.key}
                          {config.isSecret && (
                            <Badge variant="outline" className="ml-2">Secret</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{config.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{config.dataType}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate font-mono text-sm">
                            {config.isSecret ? '••••••••' : config.value}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(config.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setEditingConfig(config)}
                                  data-testid={`button-edit-config-${config.key}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Edit Configuration</DialogTitle>
                                </DialogHeader>
                                {editingConfig && (
                                  <div className="space-y-4">
                                    <div>
                                      <Label>Key</Label>
                                      <Input value={editingConfig.key} disabled />
                                    </div>
                                    <div>
                                      <Label>Value</Label>
                                      <Input
                                        value={editingConfig.value}
                                        onChange={(e) => setEditingConfig({...editingConfig, value: e.target.value})}
                                        type={editingConfig.isSecret ? 'password' : 'text'}
                                        data-testid="input-edit-config-value"
                                      />
                                    </div>
                                    <div>
                                      <Label>Description</Label>
                                      <Textarea
                                        value={editingConfig.description || ''}
                                        onChange={(e) => setEditingConfig({...editingConfig, description: e.target.value})}
                                        rows={3}
                                        data-testid="textarea-edit-config-description"
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => setEditingConfig(null)}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        onClick={() => updateConfigMutation.mutate({
                                          key: editingConfig.key,
                                          updates: {
                                            value: editingConfig.value,
                                            description: editingConfig.description
                                          }
                                        })}
                                        disabled={updateConfigMutation.isPending}
                                        data-testid="button-save-config"
                                      >
                                        <Save className="h-4 w-4 mr-2" />
                                        Save Changes
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" data-testid={`button-delete-config-${config.key}`}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Configuration</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the configuration "{config.key}". This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteConfigMutation.mutate(config.key)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features" className="space-y-4">
            {/* Add New Feature Flag */}
            <Card>
              <CardHeader>
                <CardTitle>Create Feature Flag</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="flag-name">Display Name</Label>
                    <Input
                      id="flag-name"
                      placeholder="Feature Name"
                      value={newFlagName}
                      onChange={(e) => setNewFlagName(e.target.value)}
                      data-testid="input-flag-name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="flag-key">Key</Label>
                    <Input
                      id="flag-key"
                      placeholder="feature_flag_key"
                      value={newFlagKey}
                      onChange={(e) => setNewFlagKey(e.target.value)}
                      data-testid="input-flag-key"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <Label htmlFor="flag-description">Description</Label>
                    <Textarea
                      id="flag-description"
                      placeholder="Feature flag description..."
                      value={newFlagDescription}
                      onChange={(e) => setNewFlagDescription(e.target.value)}
                      rows={2}
                      data-testid="textarea-flag-description"
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <Button
                      onClick={() => createFeatureFlagMutation.mutate({
                        key: newFlagKey,
                        name: newFlagName,
                        description: newFlagDescription,
                        isEnabled: false,
                        rolloutPercentage: 0,
                        targetGroups: []
                      })}
                      disabled={!newFlagName || !newFlagKey || createFeatureFlagMutation.isPending}
                      data-testid="button-create-flag"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Feature Flag
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Feature Flags List */}
            <Card>
              <CardHeader>
                <CardTitle>Feature Flags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {featureFlags.map((flag) => (
                    <div key={flag.key} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{flag.name}</h3>
                          <p className="text-sm text-muted-foreground font-mono">{flag.key}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm">
                            Rollout: {flag.rolloutPercentage}%
                          </div>
                          <Switch
                            checked={flag.isEnabled}
                            onCheckedChange={(enabled) => toggleFeatureFlagMutation.mutate({
                              key: flag.key,
                              enabled
                            })}
                            data-testid={`switch-flag-${flag.key}`}
                          />
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">
                        {flag.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={flag.isEnabled ? 'default' : 'secondary'}>
                            {flag.isEnabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          {flag.targetGroups.length > 0 && (
                            <Badge variant="outline">
                              {flag.targetGroups.length} target groups
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          Updated: {new Date(flag.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {featureFlags.length === 0 && (
                    <div className="text-center py-8">
                      <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Feature Flags</h3>
                      <p className="text-muted-foreground">
                        Create your first feature flag to start A/B testing.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* System Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    System Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Cache Management</h4>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid="button-clear-cache">
                        Clear Cache
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-warm-cache">
                        Warm Cache
                      </Button>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Background Jobs</h4>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid="button-restart-jobs">
                        Restart Workers
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-clear-queue">
                        Clear Queue
                      </Button>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Database Maintenance</h4>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid="button-optimize-db">
                        Optimize Tables
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-vacuum-db">
                        Vacuum Database
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Backup & Export */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Backup & Export
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">System Backup</h4>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid="button-create-backup">
                        Create Backup
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-download-backup">
                        Download Latest
                      </Button>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Data Export</h4>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid="button-export-users">
                        Export Users
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-export-content">
                        Export Content
                      </Button>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Logs</h4>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid="button-download-logs">
                        Download Logs
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-clear-logs">
                        Clear Old Logs
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Maintenance Schedule */}
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Maintenance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Scheduled Maintenance</h3>
                  <p className="text-muted-foreground">
                    System is running normally with no scheduled maintenance windows.
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