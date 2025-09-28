import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Calendar,
  Play,
  Pause,
  Plus,
  Edit,
  Trash2,
  Clock,
  CheckCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorldId } from "@/hooks/use-world-id";
import type { Topic, TopicSchedule } from "@shared/schema";

export default function AdminSchedules() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { humanId } = useWorldId();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days from now
  });
  const [isCreating, setIsCreating] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    topicId: "",
    date: new Date().toISOString().split('T')[0],
    rotationType: "daily" as const
  });
  
  const adminKey = localStorage.getItem('admin_key');

  // Fetch schedules
  const { data: schedules = [], isLoading } = useQuery<TopicSchedule[]>({
    queryKey: ['/api/admin/schedules', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end
      });
      
      const res = await fetch(`/api/admin/schedules?${params}`, {
        headers: {
          'x-admin-key': adminKey || '',
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch schedules');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Fetch topics for scheduling
  const { data: topics = [] } = useQuery<Topic[]>({
    queryKey: ['/api/admin/topics', 'approved'],
    queryFn: async () => {
      const res = await fetch('/api/admin/topics?status=approved', {
        headers: {
          'x-admin-key': adminKey || '',
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to fetch topics');
      return res.json();
    },
    enabled: !!adminKey && !!humanId
  });

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (data: typeof newSchedule) => {
      const res = await fetch('/api/admin/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey || '',
          'x-world-id-proof': humanId || 'demo'
        },
        body: JSON.stringify({
          topicId: data.topicId,
          scheduledDate: data.date,
          rotationType: data.rotationType
        })
      });
      if (!res.ok) throw new Error('Failed to create schedule');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Schedule created successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/schedules'] });
      setIsCreating(false);
      setNewSchedule({
        topicId: "",
        date: new Date().toISOString().split('T')[0],
        rotationType: "daily"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create schedule",
        variant: "destructive"
      });
    }
  });

  // Activate schedule mutation
  const activateScheduleMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const res = await fetch(`/api/admin/schedules/${scheduleId}/activate`, {
        method: 'POST',
        headers: {
          'x-admin-key': adminKey || '',
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to activate schedule');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Schedule activated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/schedules'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to activate schedule",
        variant: "destructive"
      });
    }
  });

  // Deactivate schedule mutation
  const deactivateScheduleMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      const res = await fetch(`/api/admin/schedules/${scheduleId}/deactivate`, {
        method: 'POST',
        headers: {
          'x-admin-key': adminKey || '',
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to deactivate schedule');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Schedule deactivated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/schedules'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to deactivate schedule",
        variant: "destructive"
      });
    }
  });

  // Quick schedule mutation (from topics)
  const quickScheduleMutation = useMutation({
    mutationFn: async ({ topicId, date }: { topicId: string; date: string }) => {
      const res = await fetch(`/api/admin/topics/${topicId}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey || '',
          'x-world-id-proof': humanId || 'demo'
        },
        body: JSON.stringify({ date })
      });
      if (!res.ok) throw new Error('Failed to schedule topic');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Topic scheduled successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/schedules'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to schedule topic",
        variant: "destructive"
      });
    }
  });

  const getTopicForSchedule = (schedule: TopicSchedule) => {
    return topics.find(topic => topic.id === schedule.topicId);
  };

  const isToday = (date: string) => {
    return date === new Date().toISOString().split('T')[0];
  };

  const isPast = (date: string) => {
    return date < new Date().toISOString().split('T')[0];
  };

  const isFuture = (date: string) => {
    return date > new Date().toISOString().split('T')[0];
  };

  if (!adminKey) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/')} className="w-full">
              Back to App
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <h1 className="text-2xl font-bold">Schedule Management</h1>
          </div>
          <Button
            onClick={() => setIsCreating(true)}
            data-testid="button-create-schedule"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Schedule
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Date Range Filter */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  data-testid="input-end-date"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  variant="outline"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/schedules'] })}
                >
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedules Grid */}
        <div className="grid gap-4">
          {schedules
            .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
            .map((schedule) => {
              const topic = getTopicForSchedule(schedule);
              const today = isToday(schedule.scheduledDate);
              const past = isPast(schedule.scheduledDate);
              const future = isFuture(schedule.scheduledDate);

              return (
                <Card key={schedule.id} className={today ? "border-primary" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{schedule.scheduledDate}</span>
                          {today && <Badge variant="default">Today</Badge>}
                          {past && <Badge variant="outline">Past</Badge>}
                          {future && <Badge variant="secondary">Upcoming</Badge>}
                        </div>
                        
                        {topic ? (
                          <div className="space-y-2">
                            <h3 className="font-semibold text-lg">{topic.title}</h3>
                            {topic.description && (
                              <p className="text-muted-foreground text-sm">
                                {topic.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{topic.category}</Badge>
                              <Badge variant={schedule.isActive ? "default" : "secondary"}>
                                {schedule.isActive ? "Active" : "Scheduled"}
                              </Badge>
                              <Badge variant="outline">{schedule.rotationType}</Badge>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-muted-foreground">Topic not found (ID: {schedule.topicId})</p>
                            <Badge variant="destructive">Invalid Topic</Badge>
                          </div>
                        )}

                        {schedule.activatedAt && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Activated: {new Date(schedule.activatedAt).toLocaleString()}
                          </p>
                        )}
                        {schedule.deactivatedAt && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Deactivated: {new Date(schedule.deactivatedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {schedule.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deactivateScheduleMutation.mutate(schedule.id)}
                            disabled={deactivateScheduleMutation.isPending}
                            data-testid={`button-deactivate-${schedule.id}`}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => activateScheduleMutation.mutate(schedule.id)}
                            disabled={activateScheduleMutation.isPending}
                            data-testid={`button-activate-${schedule.id}`}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

          {schedules.length === 0 && !isLoading && (
            <Card>
              <CardContent className="pt-4 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No schedules found</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Create your first schedule to start managing topic rotations.
                </p>
                <Button onClick={() => setIsCreating(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Schedule
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Create Schedule Dialog */}
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Schedule</DialogTitle>
              <DialogDescription>
                Schedule a topic for a specific date.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="topic-select">Topic</Label>
                <Select 
                  value={newSchedule.topicId} 
                  onValueChange={(value) => setNewSchedule(prev => ({ ...prev, topicId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.title} ({topic.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="schedule-date">Date</Label>
                <Input
                  id="schedule-date"
                  type="date"
                  value={newSchedule.date}
                  onChange={(e) => setNewSchedule(prev => ({ ...prev, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <Label htmlFor="rotation-type">Rotation Type</Label>
                <Select 
                  value={newSchedule.rotationType} 
                  onValueChange={(value: "daily" | "weekly" | "special") => 
                    setNewSchedule(prev => ({ ...prev, rotationType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="special">Special</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => createScheduleMutation.mutate(newSchedule)}
                disabled={!newSchedule.topicId || !newSchedule.date || createScheduleMutation.isPending}
                data-testid="button-create-schedule-confirm"
              >
                Create Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}