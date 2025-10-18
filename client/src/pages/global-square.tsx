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
import { ArrowLeft, Briefcase, Shield, Users, Sun, Moon, Settings, MoreVertical, UserPlus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { filterContent } from "@/lib/content-filter";
import { getSessionId } from "@/lib/session";
import type { MessageWithAuthor, OnlinePresence, Theme, Topic } from "@shared/schema";

export default function GlobalSquare() {
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [selectedProfileHandle, setSelectedProfileHandle] = useState<string | null>(null);
  const [reportingMessage, setReportingMessage] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  const [friendsDialogOpen, setFriendsDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mode, setMode, activeTheme, sunTimes } = useThemeContext();
  
  // Check if developer menu should be shown
  const showDevMenu = () => {
    const isDev = process.env.NODE_ENV !== 'production';
    const hasDevParam = window.location.search.includes('dev=1');
    return isDev || hasDevParam;
  };
  
  // Reset guest session
  const resetGuestSession = () => {
    console.log('[Dev] Resetting guest session...');
    // Clear localStorage
    localStorage.removeItem('wm_sid');
    // Clear session cookies
    document.cookie = 'wm_sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    // Reload the page to reset state
    window.location.reload();
  };
  
  const { humanId, isVerified, verify } = useWorldId();
  const { isConnected } = useWebSocket(humanId, 'global');
  const { role, limits, isGuest, canStar, canReport, policy } = useAuthRole();
  const [guestStats, setGuestStats] = useState<{ messagesRemaining: number; nextMessageIn: number } | null>(null);

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

  // Fetch user info including guest stats
  const { data: userInfo } = useQuery<any>({
    queryKey: ['/api/me'],
    refetchInterval: 60000, // Refresh every minute to get updated guest stats
  });

  // Update guest stats from userInfo
  useEffect(() => {
    if (userInfo?.guestStats) {
      setGuestStats({
        messagesRemaining: userInfo.guestStats.messagesRemaining,
        nextMessageIn: 0 // Will be set on cooldown
      });
    }
  }, [userInfo]);

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
        credentials: 'include',
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
    onSuccess: (data) => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/messages/global'] });
      
      // If guest, update stats and start cooldown
      if (data.guestStats) {
        setGuestStats(data.guestStats);
        setCooldownSeconds(data.guestStats.nextMessageIn);
        
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
    // Initialize session before first message send
    // This guarantees the session is initialized before any API calls
    await getSessionId();
    
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

  const handleStarMessage = async (messageId: string) => {
    if (!canStar()) {
      try {
        await verify();
        starMessageMutation.mutate(messageId);
      } catch (error) {
        console.log('Verification cancelled or failed');
      }
      return;
    }
    starMessageMutation.mutate(messageId);
  };

  const handleReportMessage = async (messageId: string) => {
    if (!canReport()) {
      try {
        await verify();
        setReportingMessage(messageId);
      } catch (error) {
        console.log('Verification cancelled or failed');
      }
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
  const canSend = message.trim().length > 0 && message.length <= maxChars;

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
                  // If in system or autoSun mode, switch to the opposite of current theme
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
                        <RadioGroupItem value="system" id="system" />
                        <Label htmlFor="system" className="flex-1">
                          <div className="font-medium">Match System</div>
                          <div className="text-xs text-muted-foreground">Match your device settings</div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="autoSun" id="autoSun" />
                        <Label htmlFor="autoSun" className="flex-1">
                          <div className="font-medium">Auto (Sunrise → Sunset)</div>
                          <div className="text-xs text-muted-foreground">
                            {sunTimes.sunrise && sunTimes.sunset ? (
                              <span>
                                Light from {sunTimes.sunrise.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to{' '}
                                {sunTimes.sunset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span>Light from 7:00 to 19:00, dark otherwise</span>
                            )}
                          </div>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                  {mode === 'autoSun' && (
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
            {import.meta.env.VITE_ENABLE_REFERRALS === 'true' && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setLocation('/referrals')}
                data-testid="button-referrals"
              >
                <Users className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFriendsDialogOpen(true)}
              className="relative"
              data-testid="button-friends"
            >
              <UserPlus className="h-4 w-4" />
              <span className="sr-only">Friends (coming soon)</span>
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-muted-foreground/30" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation('/room/work')}
              data-testid="button-toggle-work-mode"
            >
              <Briefcase className="h-4 w-4" />
            </Button>
            {showDevMenu() && (
              <Sheet open={devMenuOpen} onOpenChange={setDevMenuOpen}>
                <SheetTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    data-testid="button-dev-menu"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Developer Tools</SheetTitle>
                    <SheetDescription>
                      Debug and test your application
                    </SheetDescription>
                  </SheetHeader>
                  <div className="py-4 space-y-4">
                    <Button 
                      onClick={resetGuestSession}
                      variant="outline"
                      className="w-full justify-start"
                      data-testid="button-reset-guest-session"
                    >
                      Reset Guest Session
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      This will clear your guest session and reload the page, allowing you to test guest limits from scratch.
                    </p>
                  </div>
                </SheetContent>
              </Sheet>
            )}
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
              onProfileClick={() => setSelectedProfileHandle(msg.authorHandle)}
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

      {/* Compact Guest Mode Badge with Shield */}
      {isGuest() && role !== 'verified' && !isVerified && (
        <div className="bg-muted/50 border-t border-border px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Guest Mode
              </Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={verify} 
                    size="icon" 
                    variant="ghost"
                    className="h-6 w-6"
                    data-testid="button-verify-shield"
                  >
                    <Shield className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Verify to unlock full chat</p>
                </TooltipContent>
              </Tooltip>
              <span className="text-xs text-muted-foreground">
                60 chars • {guestStats?.messagesRemaining ?? 10} left today
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Composer Section - More Compact */}
      <div className="bg-background border-t border-border p-4">
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
              <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-amber-800 dark:text-amber-200" data-testid="text-cooldown-notice">
                    {isGuest() && role !== 'verified' ? `Wait ${cooldownSeconds}s before sending another message` : `Take a breath—back in ${cooldownSeconds}s`}
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="relative">
              <Textarea
                placeholder={isVerified || role === 'verified' ? "Say hello 👋..." : "Say hello 👋 (verify to unlock full chat)"}
                value={message}
                onChange={(e) => {
                  if (isGuest() && role !== 'verified' && e.target.value.length > maxChars) {
                    return; // Prevent typing beyond limit for guests
                  }
                  setMessage(e.target.value);
                }}
                className="resize-none"
                rows={2}
                maxLength={maxChars}
                disabled={cooldownSeconds > 0}
                data-testid="input-message-composer"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${characterCount > maxChars ? 'text-destructive' : 'text-muted-foreground'}`} data-testid="text-character-count">
                    {characterCount}/{maxChars}
                  </span>
                  {isGuest() && role !== 'verified' && !isVerified && (
                    <span className="text-xs text-muted-foreground" data-testid="text-messages-remaining">
                      {guestStats?.messagesRemaining ?? 10} messages left today
                    </span>
                  )}
                </div>
                <Button 
                  onClick={handleSendMessage}
                  disabled={!canSend || sendMessageMutation.isPending}
                  size="sm"
                  data-testid="button-send-message"
                >
                  {sendMessageMutation.isPending ? 'Sending...' : cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedProfileHandle && (
        <ProfileModal
          handle={selectedProfileHandle}
          onClose={() => setSelectedProfileHandle(null)}
        />
      )}

      {reportingMessage && (
        <ReportModal
          onConfirm={confirmReport}
          onCancel={() => setReportingMessage(null)}
          isLoading={reportMessageMutation.isPending}
        />
      )}

      {/* Friends Coming Soon Dialog */}
      <Dialog open={friendsDialogOpen} onOpenChange={setFriendsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Friends (Coming Soon)
            </DialogTitle>
            <DialogDescription className="pt-4 space-y-3">
              <p>
                World Chat DM integration planned—add friends and DM via World App.
              </p>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Soon you'll be able to:
                </p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>• Add friends from the World Mall community</li>
                  <li>• Send direct messages through World App</li>
                  <li>• Share Mall Coins with your friends</li>
                  <li>• Create private group chats</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground italic">
                This feature is part of our roadmap for enhanced social features.
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
