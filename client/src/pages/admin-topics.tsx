import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
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
  Plus, 
  Edit,
  Trash2,
  Calendar,
  Star,
  MessageSquare,
  Eye,
  Settings,
  Save,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorldId } from "@/hooks/use-world-id";
import type { Topic, InsertTopic } from "@shared/schema";

const topicCategories = [
  "general",
  "tech", 
  "collaboration",
  "inspiration",
  "creativity",
  "learning",
  "community",
  "wellness"
];

const topicStatuses = [
  "draft",
  "approved", 
  "active",
  "archived"
];

const topicFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  description: z.string().max(500, "Description too long").optional(),
  category: z.enum(["general", "tech", "collaboration", "inspiration", "creativity", "learning", "community", "wellness"]),
  status: z.enum(["draft", "approved", "active", "archived"]).default("draft"),
  priority: z.number().min(0).max(100).default(0),
  tags: z.array(z.string()).default([]),
  isSpecial: z.boolean().default(false),
  authorName: z.string().max(50, "Author name too long").optional(),
});

type TopicFormData = z.infer<typeof topicFormSchema>;

export default function AdminTopics() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { humanId } = useWorldId();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [filter, setFilter] = useState({
    category: "",
    status: "",
    search: ""
  });
  
  const adminKey = localStorage.getItem('admin_key');

  // Fetch topics
  const { data: topics = [], isLoading } = useQuery<Topic[]>({
    queryKey: ['/api/admin/topics', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.category) params.append('category', filter.category);
      if (filter.status) params.append('status', filter.status);
      
      const res = await fetch(`/api/admin/topics?${params}`, {
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

  // Filter topics by search
  const filteredTopics = topics.filter(topic => 
    topic.title.toLowerCase().includes(filter.search.toLowerCase()) ||
    (topic.description && topic.description.toLowerCase().includes(filter.search.toLowerCase()))
  );

  // Form for creating/editing topics
  const form = useForm<TopicFormData>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "general",
      status: "draft",
      priority: 0,
      tags: [],
      isSpecial: false,
      authorName: "",
    },
  });

  // Create topic mutation
  const createTopicMutation = useMutation({
    mutationFn: async (data: TopicFormData) => {
      const res = await fetch('/api/admin/topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey || '',
          'x-world-id-proof': humanId || 'demo'
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create topic');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Topic created successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/topics'] });
      setIsCreating(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create topic",
        variant: "destructive"
      });
    }
  });

  // Update topic mutation
  const updateTopicMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TopicFormData> }) => {
      const res = await fetch(`/api/admin/topics/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey || '',
          'x-world-id-proof': humanId || 'demo'
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update topic');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Topic updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/topics'] });
      setEditingTopic(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update topic",
        variant: "destructive"
      });
    }
  });

  // Delete topic mutation
  const deleteTopicMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/topics/${id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': adminKey || '',
          'x-world-id-proof': humanId || 'demo'
        }
      });
      if (!res.ok) throw new Error('Failed to delete topic');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Topic deleted successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/topics'] });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to delete topic",
        variant: "destructive"
      });
    }
  });

  // Schedule topic mutation
  const scheduleTopicMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ['/api/admin/topics'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to schedule topic",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: TopicFormData) => {
    if (editingTopic) {
      updateTopicMutation.mutate({ id: editingTopic.id, data });
    } else {
      createTopicMutation.mutate(data);
    }
  };

  const startEditing = (topic: Topic) => {
    setEditingTopic(topic);
    form.reset({
      title: topic.title,
      description: topic.description || "",
      category: topic.category,
      status: topic.status,
      priority: topic.priority,
      tags: topic.tags,
      isSpecial: topic.isSpecial,
      authorName: topic.authorName || "",
    });
    setIsCreating(true);
  };

  const cancelEditing = () => {
    setEditingTopic(null);
    setIsCreating(false);
    form.reset();
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
            <h1 className="text-2xl font-bold">Topic Management</h1>
          </div>
          <Button
            onClick={() => setIsCreating(true)}
            data-testid="button-create-topic"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Topic
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search topics..."
                  value={filter.search}
                  onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                  data-testid="input-search-topics"
                />
              </div>
              <Select 
                value={filter.category} 
                onValueChange={(value) => setFilter(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  {topicCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select 
                value={filter.status} 
                onValueChange={(value) => setFilter(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  {topicStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Topics List */}
        <div className="grid gap-4">
          {filteredTopics.map((topic) => (
            <Card key={topic.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{topic.title}</h3>
                      {topic.isSpecial && (
                        <Star className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    {topic.description && (
                      <p className="text-muted-foreground mb-3">
                        {topic.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{topic.category}</Badge>
                      <Badge variant={
                        topic.status === 'approved' ? 'default' :
                        topic.status === 'active' ? 'default' :
                        topic.status === 'draft' ? 'secondary' : 'secondary'
                      }>
                        {topic.status}
                      </Badge>
                      <Badge variant="outline">Priority: {topic.priority}</Badge>
                    </div>
                    {topic.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {topic.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {topic.authorName && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Author: {topic.authorName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Calendar className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Schedule Topic</DialogTitle>
                          <DialogDescription>
                            Choose a date to schedule "{topic.title}"
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="schedule-date">Date</Label>
                            <Input
                              id="schedule-date"
                              type="date"
                              min={new Date().toISOString().split('T')[0]}
                              onBlur={(e) => {
                                if (e.target.value) {
                                  scheduleTopicMutation.mutate({
                                    topicId: topic.id,
                                    date: e.target.value
                                  });
                                }
                              }}
                            />
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => startEditing(topic)}
                      data-testid={`button-edit-topic-${topic.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteTopicMutation.mutate(topic.id)}
                      data-testid={`button-delete-topic-${topic.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTopic ? 'Edit Topic' : 'Create New Topic'}
              </DialogTitle>
              <DialogDescription>
                {editingTopic ? 'Update the topic details below.' : 'Fill in the details to create a new topic.'}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter topic title..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter topic description..." 
                          className="resize-none"
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {topicCategories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category.charAt(0).toUpperCase() + category.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {topicStatuses.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority (0-100)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            max="100" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="authorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Author Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Optional author name..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="isSpecial"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Special Topic</FormLabel>
                        <FormDescription>
                          Mark this as a special or featured topic
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={cancelEditing}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createTopicMutation.isPending || updateTopicMutation.isPending}
                    data-testid="button-save-topic"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {editingTopic ? 'Update' : 'Create'} Topic
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}