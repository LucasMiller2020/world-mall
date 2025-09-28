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
import { ArrowLeft, Briefcase, Shield, Users, Sun, Moon, Settings } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useWorldId } from "@/hooks/use-world-id";
import { useAuthRole } from "@/hooks/use-auth-role";
import { useToast } from "@/hooks/use-toast";
import { useThemeContext } from "@/theme/ThemeProvider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { filterContent } from "@/lib/content-filter";
import type { MessageWithAuthor, OnlinePresence, Theme, Topic } from "@shared/schema";

export default function GlobalSquare() {
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [reportingMessage, setReportingMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mode, setMode, activeTheme, sunTimes } = useThemeContext();
  
  const { humanId, isVerified, verify } = useWorldId();
  const { isConnected } = useWebSocket(humanId);
  const { role, limits, isGuest, canStar, canReport, policy } = useAuthRole();

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
        // Include status code and error code in error for better handling
        const err = new Error(error.message || 'Failed to send message');
        (err as any).status = res.status;
        (err as any).code = error.code;
        throw err;
      }
      
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/messages/global'] });
    },
    onError: (error: any) => {
      // Handle 429 rate limit errors
      if (error.status === 429 || error.message.includes('cooldown') || error.message.includes('Take a breath')) {
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
      
      // Handle 403 guest limit errors with user-friendly message
      let errorMessage = error.message;
      let errorTitle = "Error";
      if (error.status === 403 && error.code === 'GUEST_LIMIT_EXCEEDED') {
        errorTitle = "Character Limit";
        // Use the server's friendly message directly
      } else if (error.status === 429) {
        errorTitle = "Slow Down";
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
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
    // Check message length based on user role
    const maxChars = limits?.maxChars || (isGuest() ? 60 : 240);
    if (message.length > maxChars) {
      toast({
        title: "Message too long",
        description: isGuest() 
          ? `Guest messages limited to ${maxChars} characters. Verify to unlock full chat!`
          : `Message exceeds ${maxChars} character limit`,
        variant: "destructive",
      });
      return;
    }

    if (!isGuest() && !isVerified) {
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
    if (!canStar()) {
      setShowVerifyPrompt(true);
      toast({
        title: "Verification Required",
        description: "Verify with World ID to star messages",
        variant: "destructive",
      });
      return;
    }
    starMessageMutation.mutate(messageId);
  };

  const handleReportMessage = (messageId: string) => {
    if (!canReport()) {
      setShowVerifyPrompt(true);
      toast({
        title: "Verification Required",
        description: "Verify with World ID to report messages",
        variant: "destructive",
      });
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
  const maxChars = limits?.maxChars || (isGuest() ? 60 : 240);
  const canSend = message.trim().length > 0 && message.length <= maxChars && cooldownSeconds === 0;

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
              onClick={() => {
                // Quick toggle between light and dark
                if (mode === 'light') {
                  setMode('dark');
                } else if (mode === 'dark') {
                  setMode('light');
                } else {
                  // If in system or sun mode, switch to the opposite of current theme
                  setMode(activeTheme === 'light' ? 'dark' : 'light');
                }
              }}
              data-testid="button-theme-toggle"
            >
              {activeTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Sheet open={themeSheetOpen} onOpenChange={setThemeSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="button-theme-settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Theme Settings</SheetTitle>
                  <SheetDescription>
                    Choose how you'd like the app to appear.
                  </SheetDescription>
                </SheetHeader>
                <div className="py-4">
                  <RadioGroup value={mode} onValueChange={(value) => setMode(value as any)}>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="system" id="system" />
                        <Label htmlFor="system" className="flex-1">
                          <div className="font-medium">System</div>
                          <div className="text-xs text-muted-foreground">Match your device settings</div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="light" id="light" />
                        <Label htmlFor="light" className="flex-1">
                          <div className="font-medium">Light</div>
                          <div className="text-xs text-muted-foreground">Always use light theme</div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dark" id="dark" />
                        <Label htmlFor="dark" className="flex-1">
                          <div className="font-medium">Dark</div>
                          <div className="text-xs text-muted-foreground">Always use dark theme</div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sun" id="sun" />
                        <Label htmlFor="sun" className="flex-1">
                          <div className="font-medium">Auto (Sunrise→Sunset)</div>
                          <div className="text-xs text-muted-foreground">
                            {sunTimes.sunrise && sunTimes.sunset ? (
                              <span>
                                Light from {sunTimes.sunrise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to{' '}
                                {sunTimes.sunset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span>Light during daytime hours (7 AM - 7 PM)</span>
                            )}
                          </div>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                  {mode === 'sun' && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        {activeTheme === 'light' ? (
                          <Sun className="h-4 w-4 text-warning" />
                        ) : (
                          <Moon className="h-4 w-4 text-primary" />
                        )}
                        <span className="text-sm">
                          Currently: {activeTheme === 'light' ? 'Daytime' : 'Nighttime'} mode
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
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

      {/* Guest Mode Banner */}
      {isGuest() && (
        <div className="bg-muted/50 border-t border-border px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Guest Mode
              </Badge>
              <span className="text-xs text-muted-foreground">
                60 chars • 10/day • 30s cooldown
              </span>
            </div>
            <Button 
              onClick={verify} 
              size="sm" 
              variant="outline"
              data-testid="button-verify-banner"
            >
              <Shield className="h-3 w-3 mr-1" />
              Verify
            </Button>
          </div>
        </div>
      )}

      {/* Composer Section */}
      <div className="bg-background border-t border-border p-6">
        {showVerifyPrompt ? (
          <Card className="mb-4">
            <CardContent className="pt-4 text-center">
              <p className="text-sm text-muted-foreground mb-3" data-testid="text-verification-prompt">
                Unlock full features with World ID verification
              </p>
              <div className="space-y-2 mb-3 text-left">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  <span>Send messages up to 240 characters</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  <span>Star and report messages</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  <span>Access Work Mode for collaboration</span>
                </div>
              </div>
              <Button onClick={() => { setShowVerifyPrompt(false); verify(); }} className="w-full" data-testid="button-verify-world-id">
                <Shield className="h-4 w-4 mr-2" />
                Verify with World ID
              </Button>
              <Button 
                onClick={() => setShowVerifyPrompt(false)} 
                variant="ghost" 
                size="sm" 
                className="w-full mt-2"
                data-testid="button-continue-as-guest"
              >
                Continue as Guest
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
                placeholder={isGuest() ? "Say hello 👋 (verify to unlock full chat)" : "Say something useful, kind, or curious…"}
                value={message}
                onChange={(e) => {
                  if (isGuest() && e.target.value.length > maxChars) {
                    return; // Prevent typing beyond limit for guests
                  }
                  setMessage(e.target.value);
                }}
                className="resize-none"
                rows={3}
                maxLength={maxChars}
                disabled={cooldownSeconds > 0}
                data-testid="input-message-composer"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${characterCount > maxChars ? 'text-destructive' : 'text-muted-foreground'}`} data-testid="text-character-count">
                    {characterCount}/{maxChars}
                  </span>
                  {isGuest() && characterCount > maxChars / 2 && (
                    <Badge variant="outline" className="text-xs">
                      Guest limit
                    </Badge>
                  )}
                </div>
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
