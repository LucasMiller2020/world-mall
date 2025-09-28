import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WorkPostItem } from "@/components/work-post-item";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { ProfileModal } from "@/components/profile-modal";
import { ReportModal } from "@/components/report-modal";
import { ArrowLeft, MessageCircle, Users } from "lucide-react";
import { useWorldId } from "@/hooks/use-world-id";
import { useToast } from "@/hooks/use-toast";
import { filterContent } from "@/lib/content-filter";
import type { MessageWithAuthor } from "@shared/schema";

type WorkCategory = 'help' | 'advice' | 'collab';

export default function WorkMode() {
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<WorkCategory>('help');
  const [link, setLink] = useState("");
  const [geoScope, setGeoScope] = useState("Global");
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [reportingMessage, setReportingMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { humanId, isVerified, verify } = useWorldId();

  // Fetch work messages
  const { data: workPosts = [], isLoading } = useQuery<MessageWithAuthor[]>({
    queryKey: ['/api/messages/work'],
    queryFn: async () => {
      const res = await fetch('/api/messages/work');
      if (!res.ok) throw new Error('Failed to fetch work posts');
      return res.json();
    },
  });

  // Send work post mutation
  const sendWorkPostMutation = useMutation({
    mutationFn: async (postData: { 
      text: string; 
      room: string; 
      category: WorkCategory; 
      link?: string; 
      geoScope: string;
    }) => {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-World-ID-Proof': humanId || '',
        },
        body: JSON.stringify(postData),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to send work post');
      }
      
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      setLink("");
      setGeoScope("Global");
      queryClient.invalidateQueries({ queryKey: ['/api/messages/work'] });
      toast({
        title: "Work Post Sent",
        description: "Your request has been posted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Star message mutation
  const starMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await fetch('/api/stars', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-World-ID-Proof': humanId || '',
        },
        body: JSON.stringify({ messageId }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to star message');
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages/work'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Report message mutation
  const reportMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-World-ID-Proof': humanId || '',
        },
        body: JSON.stringify({ messageId }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to report message');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      setReportingMessage(null);
      toast({
        title: "Report Submitted",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendWorkPost = async () => {
    if (!isVerified) {
      await verify();
      return;
    }

    const trimmedMessage = message.trim();
    const contentCheck = filterContent(trimmedMessage);
    
    if (!contentCheck.isValid) {
      toast({
        title: "Post Filtered",
        description: contentCheck.reason,
        variant: "destructive",
      });
      return;
    }

    // Validate URL if provided
    if (link && !isValidUrl(link)) {
      toast({
        title: "Invalid Link",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    sendWorkPostMutation.mutate({
      text: trimmedMessage,
      room: 'work',
      category: selectedCategory,
      link: link || undefined,
      geoScope,
    });
  };

  const handleStarMessage = (messageId: string) => {
    if (!isVerified) {
      verify();
      return;
    }
    starMessageMutation.mutate(messageId);
  };

  const handleReportMessage = (messageId: string) => {
    if (!isVerified) {
      verify();
      return;
    }
    setReportingMessage(messageId);
  };

  const confirmReport = () => {
    if (reportingMessage) {
      reportMessageMutation.mutate(reportingMessage);
    }
  };

  const characterCount = message.length;
  const canSend = isVerified && message.trim().length > 0 && message.length <= 240;

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLocation('/room/global')}
            data-testid="button-back-to-global"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground" data-testid="text-page-title">
            Work Mode
          </h1>
          <div className="flex items-center space-x-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation('/referrals')}
              data-testid="button-referrals"
            >
              <Users className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation('/room/global')}
              data-testid="button-toggle-global-mode"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground text-center" data-testid="text-page-subtitle">
          Short job offers, requests & collaboration
        </p>
      </div>

      {/* Work Posts Feed */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" data-testid="list-work-posts">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLoader key={i} />
          ))
        ) : workPosts.length > 0 ? (
          workPosts.map((post) => (
            <WorkPostItem
              key={post.id}
              post={post}
              onProfileClick={() => setSelectedProfile(post.authorHumanId)}
              onStarClick={() => handleStarMessage(post.id)}
              onReportClick={() => handleReportMessage(post.id)}
              data-testid={`work-post-item-${post.id}`}
            />
          ))
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground" data-testid="text-empty-state">
                No requests yet. Ask for help or offer your skills.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Work Composer */}
      <div className="bg-background border-t border-border p-6">
        {!isVerified ? (
          <Card className="mb-4">
            <CardContent className="pt-4 text-center">
              <p className="text-sm text-muted-foreground mb-3" data-testid="text-verification-gate">
                Posting is human-only. Verify once with World ID.
              </p>
              <Button onClick={verify} className="w-full" data-testid="button-verify-world-id">
                Verify with World ID
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Category Selection */}
            <div className="flex gap-2">
              <Button
                variant={selectedCategory === 'help' ? 'default' : 'secondary'}
                size="sm"
                className="flex-1"
                onClick={() => setSelectedCategory('help')}
                data-testid="button-category-help"
              >
                Help Wanted
              </Button>
              <Button
                variant={selectedCategory === 'advice' ? 'default' : 'secondary'}
                size="sm"
                className="flex-1"
                onClick={() => setSelectedCategory('advice')}
                data-testid="button-category-advice"
              >
                Advice
              </Button>
              <Button
                variant={selectedCategory === 'collab' ? 'default' : 'secondary'}
                size="sm"
                className="flex-1"
                onClick={() => setSelectedCategory('collab')}
                data-testid="button-category-collab"
              >
                Collab
              </Button>
            </div>

            {/* Message Input */}
            <Textarea
              placeholder="Describe your request or offer..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-none"
              rows={3}
              maxLength={240}
              data-testid="input-work-message"
            />

            {/* Optional Fields */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="url"
                placeholder="Link (optional)"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                data-testid="input-work-link"
              />
              <Select value={geoScope} onValueChange={setGeoScope}>
                <SelectTrigger data-testid="select-geo-scope">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Global">Global</SelectItem>
                  <SelectItem value="United States">United States</SelectItem>
                  <SelectItem value="San Francisco">San Francisco</SelectItem>
                  <SelectItem value="New York">New York</SelectItem>
                  <SelectItem value="London">London</SelectItem>
                  <SelectItem value="Berlin">Berlin</SelectItem>
                  <SelectItem value="Tokyo">Tokyo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Character Count and Submit */}
            <div className="flex items-center justify-between">
              <span className={`text-xs ${characterCount > 240 ? 'text-destructive' : 'text-muted-foreground'}`} data-testid="text-character-count">
                {characterCount}/240
              </span>
              <Button 
                onClick={handleSendWorkPost}
                disabled={!canSend || sendWorkPostMutation.isPending}
                data-testid="button-post-work-request"
              >
                {sendWorkPostMutation.isPending ? 'Posting...' : 'Post Request'}
              </Button>
            </div>

            {/* Rate Limit Notice */}
            <p className="text-xs text-muted-foreground text-center" data-testid="text-rate-limit-notice">
              Link posts: 2 per 10min, 4 per hour limit
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedProfile && (
        <ProfileModal
          humanId={selectedProfile}
          onClose={() => setSelectedProfile(null)}
        />
      )}

      {reportingMessage && (
        <ReportModal
          onConfirm={confirmReport}
          onCancel={() => setReportingMessage(null)}
          isLoading={reportMessageMutation.isPending}
        />
      )}
    </div>
  );
}
