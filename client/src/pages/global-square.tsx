import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageItem } from "@/components/message-item";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { ProfileModal } from "@/components/profile-modal";
import { ReportModal } from "@/components/report-modal";
import { ArrowLeft, Briefcase, Shield, Users } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useWorldId } from "@/hooks/use-world-id";
import { useToast } from "@/hooks/use-toast";
import { filterContent } from "@/lib/content-filter";
import type { MessageWithAuthor, OnlinePresence, Theme, Topic } from "@shared/schema";

export default function GlobalSquare() {
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [reportingMessage, setReportingMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { humanId, isVerified, verify } = useWorldId();
  const { isConnected } = useWebSocket(humanId);

  // Fetch messages
  const { data: messages = [], isLoading } = useQuery<MessageWithAuthor[]>({
    queryKey: ['/api/messages/global'],
    queryFn: async () => {
      const res = await fetch('/api/messages/global');
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
  });

  // Fetch today's topic
  const { data: theme } = useQuery<Theme>({
    queryKey: ['/api/theme'],
  });

  // Fetch current active topic with enhanced details
  const { data: currentTopic } = useQuery<Topic>({
    queryKey: ['/api/topics/current'],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Fetch online presence
  const { data: presence } = useQuery<OnlinePresence>({
    queryKey: ['/api/presence'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { text: string; room: string }) => {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-World-ID-Proof': humanId || '',
        },
        body: JSON.stringify(messageData),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to send message');
      }
      
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/messages/global'] });
    },
    onError: (error: any) => {
      if (error.message.includes('cooldown') || error.message.includes('Take a breath')) {
        const match = error.message.match(/(\d+)\s*sec/);
        const seconds = match ? parseInt(match[1]) : 30;
        setCooldownSeconds(seconds);
        
        // Start countdown
        const interval = setInterval(() => {
          setCooldownSeconds(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
      
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
      queryClient.invalidateQueries({ queryKey: ['/api/messages/global'] });
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

  const handleSendMessage = async () => {
    if (!isVerified) {
      await verify();
      return;
    }

    if (cooldownSeconds > 0) {
      toast({
        title: "Cooldown Active",
        description: `Please wait ${cooldownSeconds} seconds before sending another message`,
        variant: "destructive",
      });
      return;
    }

    const trimmedMessage = message.trim();
    const contentCheck = filterContent(trimmedMessage);
    
    if (!contentCheck.isValid) {
      toast({
        title: "Message Filtered",
        description: contentCheck.reason,
        variant: "destructive",
      });
      return;
    }

    sendMessageMutation.mutate({
      text: trimmedMessage,
      room: 'global'
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
  const canSend = isVerified && message.trim().length > 0 && message.length <= 240 && cooldownSeconds === 0;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLocation('/')}
            data-testid="button-go-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground" data-testid="text-page-title">
            Global Square
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
              onClick={() => setLocation('/room/work')}
              data-testid="button-toggle-work-mode"
            >
              <Briefcase className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-center space-y-2">
          {currentTopic ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-base font-semibold text-foreground" data-testid="text-topic-title">
                  {currentTopic.title}
                </h2>
                {currentTopic.isSpecial && (
                  <Badge variant="destructive" className="text-xs">
                    Special
                  </Badge>
                )}
              </div>
              {currentTopic.description && (
                <p className="text-sm text-muted-foreground" data-testid="text-topic-description">
                  {currentTopic.description}
                </p>
              )}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {currentTopic.category}
                </Badge>
                {currentTopic.authorName && (
                  <span className="text-xs text-muted-foreground">
                    by {currentTopic.authorName}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="text-todays-topic">
              {theme?.topicText || "What are you building today?"}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 mt-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'} ${isConnected ? 'animate-pulse' : ''}`} />
          <span className="text-xs text-muted-foreground" data-testid="text-online-count">
            {presence?.roundedCount || '0'} humans online
          </span>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" data-testid="list-messages">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLoader key={i} />
          ))
        ) : messages.length > 0 ? (
          messages.map((msg) => (
            <MessageItem
              key={msg.id}
              message={msg}
              onProfileClick={() => setSelectedProfile(msg.authorHumanId)}
              onStarClick={() => handleStarMessage(msg.id)}
              onReportClick={() => handleReportMessage(msg.id)}
              onMuteClick={() => {}}
              data-testid={`message-item-${msg.id}`}
            />
          ))
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground" data-testid="text-empty-state">
                Be the first to say hi today 👋
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Composer Section */}
      <div className="bg-background border-t border-border p-6">
        {!isVerified ? (
          <Card className="mb-4">
            <CardContent className="pt-4 text-center">
              <p className="text-sm text-muted-foreground mb-3" data-testid="text-verification-gate">
                Posting is human-only. Verify once with World ID.
              </p>
              <Button onClick={verify} className="w-full" data-testid="button-verify-world-id">
                <Shield className="h-4 w-4 mr-2" />
                Verify with World ID
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {cooldownSeconds > 0 && (
              <Card className="bg-destructive/10 border-destructive/20">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-destructive" data-testid="text-cooldown-notice">
                    You're sending messages fast. Take a breath—back in {cooldownSeconds} sec.
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="relative">
              <Textarea
                placeholder="Say something useful, kind, or curious…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="resize-none"
                rows={3}
                maxLength={240}
                disabled={cooldownSeconds > 0}
                data-testid="input-message-composer"
              />
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs ${characterCount > 240 ? 'text-destructive' : 'text-muted-foreground'}`} data-testid="text-character-count">
                  {characterCount}/240
                </span>
                <Button 
                  onClick={handleSendMessage}
                  disabled={!canSend || sendMessageMutation.isPending}
                  size="sm"
                  data-testid="button-send-message"
                >
                  {sendMessageMutation.isPending ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </div>
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
