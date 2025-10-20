import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient as importedQueryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageItem } from "@/components/message-item";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { ProfileModal } from "@/components/profile-modal";
import { ReportModal } from "@/components/report-modal";
import { OnlineUsersSidebar } from "@/components/online-users-sidebar";
import { ArrowLeft, Briefcase, Shield, Users, Sun, Moon, Settings, MoreVertical, UserPlus, Crown, Check, ChevronRight, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWebSocket } from "@/hooks/use-websocket";
import { useWorldId } from "@/hooks/use-world-id";
import { useAuthRole } from "@/hooks/use-auth-role";
import { useToast } from "@/hooks/use-toast";
import { useThemeContext } from "@/theme/ThemeProvider";
import { usePayment, usePremiumStatus } from "@/hooks/use-payment";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { filterContent } from "@/lib/content-filter";
import { getSessionId, getSessionIdSync } from "@/lib/session";
import { containsFilteredKeyword, getFilteredContentMessage } from "@shared/keyword-filter";
import type { MessageWithAuthor, OnlinePresence, Theme, Topic } from "@shared/schema";

export default function GlobalSquare() {
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [selectedProfileHandle, setSelectedProfileHandle] = useState<string | null>(null);
  const [reportingMessage, setReportingMessage] = useState<string | null>(null);
  const [mutePromptHumanId, setMutePromptHumanId] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  const [friendsDialogOpen, setFriendsDialogOpen] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [usernameColor, setUsernameColor] = useState<string>(
    localStorage.getItem('username_color') || ''
  );
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [showVoting, setShowVoting] = useState<boolean>(() => {
    const saved = localStorage.getItem('showVoting');
    return saved !== null ? saved === 'true' : true; // Default to true
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mode, setMode, activeTheme, sunTimes } = useThemeContext();
  const { payForPremium, isPaying } = usePayment();
  const { isPremium } = usePremiumStatus();
  
  const handleColorSelect = (color: string) => {
    setUsernameColor(color);
    localStorage.setItem('username_color', color);
  };
  
  // Check if developer menu should be shown
  const showDevMenu = () => {
    if (typeof window === 'undefined') return false;
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
  const { isConnected, usePollingFallback } = useWebSocket(humanId, 'global');
  const { role, limits, isGuest, canStar, canReport, policy } = useAuthRole();
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null);
  const [pollStatus, setPollStatus] = useState<'active' | 'paused'>('active');
  const [secondsSinceLastPoll, setSecondsSinceLastPoll] = useState(0);
  const [refreshCount, setRefreshCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastMessageCountRef = useRef(0);
  const pageLoadTimeRef = useRef(Date.now());
  const autoReloadTimeoutRef = useRef<NodeJS.Timeout>();
  const fetchCountRef = useRef(0);
  
  // Version to force cache refresh
  const appVersion = 'v2.2.1-worldapp-detection';
  
  // Platform debug info (shown in settings)
  const platformInfo = {
    hasWorldApp: typeof window !== 'undefined' && !!(window as any).WorldApp,
    hasMinikit: typeof window !== 'undefined' && !!(window as any).minikit,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
    isConnected,
    usePollingFallback,
    timestamp: new Date().toISOString()
  };
  const [guestStats, setGuestStats] = useState<{ messagesRemaining: number; nextMessageIn: number } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(getSessionIdSync());

  // Initialize session on mount for guests
  useEffect(() => {
    const initSession = async () => {
      if (isGuest()) {
        const sid = await getSessionId();
        setSessionId(sid);
      }
    };
    initSession();
  }, [isGuest]);

  // Listen for voting preference changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'showVoting') {
        setShowVoting(e.newValue !== null ? e.newValue === 'true' : true);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // FIX 8: Manual refresh function
  const manualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshCount(prev => prev + 1);
    console.log(`[MANUAL REFRESH #${refreshCount + 1}] User triggered refresh`);
    
    // Clear all caches
    queryClient.clear();
    
    // Force refetch everything with cache busting
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['/api/messages', 'global'] }),
      queryClient.refetchQueries({ queryKey: ['/api/presence'] }),
      queryClient.refetchQueries({ queryKey: ['/api/me'] }),
      queryClient.refetchQueries({ queryKey: ['/api/theme'] })
    ]);
    
    toast({
      title: "Refreshed",
      description: `Force refreshed all data (attempt #${refreshCount + 1})`,
      duration: 2000
    });
    
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [queryClient, refreshCount, toast]);
  
  // Fetch messages
  const { data: messages = [], isLoading } = useQuery<MessageWithAuthor[]>({
    queryKey: ['/api/messages', 'global'],
    queryFn: async () => {
      fetchCountRef.current++;
      console.log(`[FETCH #${fetchCountRef.current}] Fetching messages...`);
      const res = await fetch('/api/messages/global');
      if (!res.ok) throw new Error('Failed to fetch messages');
      setLastPollTime(new Date()); // Update last poll time
      console.log(`[FETCH #${fetchCountRef.current}] Success - got messages at ${new Date().toISOString()}`);
      const data = await res.json();
      lastMessageCountRef.current = data?.length || 0;
      return data;
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

  // Update seconds since last poll display
  useEffect(() => {
    if (!lastPollTime) return;
    
    const interval = setInterval(() => {
      setSecondsSinceLastPoll(Math.floor((Date.now() - lastPollTime.getTime()) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [lastPollTime]);
  
  // FIX 5: Aggressive event-based polling
  useEffect(() => {
    let lastInteraction = Date.now();
    let throttleTimeout: NodeJS.Timeout;
    
    const triggerPoll = (event: string) => {
      const now = Date.now();
      // Throttle to max once per second
      if (now - lastInteraction > 1000) {
        lastInteraction = now;
        console.log(`[EVENT POLL] Triggered by ${event}`);
        queryClient.invalidateQueries({ queryKey: ['/api/messages', 'global'] });
      }
    };
    
    const handleTouch = () => triggerPoll('touch');
    const handleClick = () => triggerPoll('click'); 
    const handleFocus = () => triggerPoll('focus');
    const handleScroll = () => {
      clearTimeout(throttleTimeout);
      throttleTimeout = setTimeout(() => triggerPoll('scroll'), 500);
    };
    
    // Add event listeners
    document.addEventListener('touchstart', handleTouch);
    document.addEventListener('touchend', handleTouch); 
    document.addEventListener('click', handleClick);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      document.removeEventListener('touchstart', handleTouch);
      document.removeEventListener('touchend', handleTouch);
      document.removeEventListener('click', handleClick);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('scroll', handleScroll);
      clearTimeout(throttleTimeout);
    };
  }, [queryClient]);
  
  // FIX 10: Periodic page reload (nuclear option) - only for mobile WebView
  useEffect(() => {
    const isMobileWebView = /World App|worldapp|minikit/i.test(navigator.userAgent);
    if (!isMobileWebView) return;
    
    const checkForStaleData = () => {
      const now = Date.now();
      const timeSinceLoad = now - pageLoadTimeRef.current;
      
      // After 30 seconds, if no new messages, reload
      if (timeSinceLoad > 30000 && lastMessageCountRef.current === 0) {
        console.warn('[NUCLEAR RELOAD] No messages after 30s, reloading page...');
        localStorage.setItem('wm_reload_reason', 'no_messages_timeout');
        window.location.reload();
      }
    };
    
    // Check every 30 seconds
    autoReloadTimeoutRef.current = setInterval(checkForStaleData, 30000);
    
    return () => {
      if (autoReloadTimeoutRef.current) {
        clearInterval(autoReloadTimeoutRef.current);
      }
    };
  }, []);

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
      queryClient.invalidateQueries({ queryKey: ['/api/messages', 'global'] });
      
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
      queryClient.invalidateQueries({ queryKey: ['/api/messages', 'global'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mute user mutation
  const muteMutation = useMutation({
    mutationFn: async (mutedHumanId: string) => {
      const res = await fetch('/api/mutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-World-ID-Proof': humanId || '',
        },
        body: JSON.stringify({ mutedHumanId }),
        credentials: 'include',
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to mute user');
      }
      
      return res.json();
    },
    onSuccess: () => {
      setMutePromptHumanId(null);
      toast({
        title: "User muted successfully",
        description: "You won't see messages from this user anymore.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/messages', 'global'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mute user",
        variant: "destructive",
      });
    },
  });

  // Unblock user mutation - EMERGENCY for unblocking zoe_builder
  const unblockMutation = useMutation({
    mutationFn: async (blockedHumanId: string) => {
      const res = await fetch(`/api/blocks/${blockedHumanId}`, {
        method: 'DELETE',
        headers: {
          'X-World-ID-Proof': humanId || '',
        },
        credentials: 'include',
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to unblock user');
      }
      
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "User unblocked successfully",
        description: "You can now see each other's messages again.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/messages', 'global'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unblock user",
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
      
      // Find the reported message to get author's humanId
      if (reportingMessage) {
        const reportedMsg = messages.find(m => m.id === reportingMessage);
        if (reportedMsg && reportedMsg.authorHumanId !== currentUserHumanId) {
          // Show mute prompt for the reported user
          setMutePromptHumanId(reportedMsg.authorHumanId);
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, text }: { messageId: string; text: string }) => {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-World-ID-Proof': humanId || '',
        },
        body: JSON.stringify({ text }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to edit message');
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages', 'global'] });
    },
    onError: (error: any) => {
      // Error is handled in MessageItem component
      throw error;
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'X-World-ID-Proof': humanId || '',
        },
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to delete message');
      }
      
      return res.json();
    },
    onMutate: async (messageId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/messages', 'global'] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<MessageWithAuthor[]>(['/api/messages', 'global']);

      // Optimistically update to remove the message
      queryClient.setQueryData<MessageWithAuthor[]>(
        ['/api/messages', 'global'],
        (old) => old?.filter((msg) => msg.id !== messageId) || []
      );

      // Return context with the previous data
      return { previousMessages };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages', 'global'] });
      toast({
        title: "Message deleted",
        description: "Your message has been successfully deleted.",
      });
    },
    onError: (error: any, messageId, context) => {
      // Restore the previous messages on error
      if (context?.previousMessages) {
        queryClient.setQueryData(['/api/messages', 'global'], context.previousMessages);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete message",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = async () => {
    // Initialize session before first message send
    // This guarantees the session is initialized before any API calls
    await getSessionId();
    
    // Check message length (500 chars for premium, 240 for regular users)
    const maxChars = isPremium ? 500 : 240;
    if (message.length > maxChars) {
      toast({
        title: "Message too long",
        description: `Message exceeds ${maxChars} character limit`,
        variant: "destructive",
      });
      return;
    }

    // No verification required - guests can post immediately

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

    // Keyword filtering - check for harmful content
    const keywordCheck = containsFilteredKeyword(trimmedMessage);
    if (keywordCheck.blocked) {
      toast({
        title: "Message Contains Prohibited Content",
        description: getFilteredContentMessage(keywordCheck),
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
    // Guests can star messages too
    if (!canStar()) {
      toast({
        title: "Feature unavailable",
        description: "Star feature is not available",
        variant: "destructive",
      });
      return;
    }
    starMessageMutation.mutate(messageId);
  };

  const handleReportMessage = async (messageId: string) => {
    // Guests can report messages too
    if (!canReport()) {
      toast({
        title: "Feature unavailable",
        description: "Report feature is not available",
        variant: "destructive",
      });
      return;
    }
    setReportingMessage(messageId);
  };

  const handleConfirmReport = () => {
    if (reportingMessage) {
      reportMessageMutation.mutate(reportingMessage);
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    await editMessageMutation.mutateAsync({ messageId, text: newText });
  };

  const handleDeleteMessage = async (messageId: string) => {
    await deleteMessageMutation.mutateAsync(messageId);
  };

  const handleVoteMessage = async (messageId: string, voteType: number) => {
    try {
      const response = await apiRequest("POST", `/api/messages/${messageId}/vote`, { voteType });
      const data = await response.json();
      
      // Update the message in the cache with new vote counts
      queryClient.setQueryData(["/api/messages", "global"], (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return oldData;
        
        return oldData.map((msg: any) => 
          msg.id === messageId 
            ? { 
                ...msg, 
                upvotes: data.upvotes,
                downvotes: data.downvotes,
                userVote: data.userVote
              }
            : msg
        );
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update vote",
        variant: "destructive",
      });
      throw error;
    }
  };
  
  const handleReactMessage = async (messageId: string, reactionType: string, action: 'add' | 'remove') => {
    try {
      const response = await apiRequest("POST", `/api/messages/${messageId}/react`, { reactionType, action });
      const data = await response.json();
      
      // Update the message in the cache with new reaction data
      queryClient.setQueryData(["/api/messages", "global"], (oldData: any) => {
        if (!oldData || !Array.isArray(oldData)) return oldData;
        
        return oldData.map((msg: any) => 
          msg.id === messageId 
            ? { 
                ...msg, 
                reactions: data.reactions
              }
            : msg
        );
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update reaction",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Calculate current user's humanId (for both guests and verified users)
  // Use useMemo to recalculate when sessionId or humanId changes
  const currentUserHumanId = useMemo(() => {
    if (isGuest()) {
      // Use the session ID from state (initialized on mount)
      const guestId = sessionId ? `guest_${sessionId}` : null;
      return guestId;
    }
    return humanId;
  }, [sessionId, humanId, isGuest]);

  const handlePremiumUpgrade = async () => {
    if (!isVerified) {
      try {
        await verify();
      } catch (error) {
        console.log('Verification cancelled or failed');
      }
      return;
    }
    setPremiumModalOpen(true);
  };

  const characterCount = message.length;
  const maxChars = isPremium ? 500 : 240; // 500 chars for premium, 240 for regular users
  const canSend = message.trim().length > 0 && message.length <= maxChars;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend && !sendMessageMutation.isPending && cooldownSeconds === 0) {
        handleSendMessage();
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Orange/Gold Color Bar at Top */}
      <div className="h-1 bg-gradient-to-r from-orange-400 via-amber-500 to-orange-400" style={{ height: '4px' }} />
      
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="relative flex items-center justify-between mb-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLocation('/')}
            data-testid="button-go-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <button 
            onClick={() => setLocation('/')}
            className="absolute left-1/2 transform -translate-x-1/2 hover:opacity-80 transition-opacity"
            data-testid="button-title-home"
          >
            <h1 className="text-lg font-semibold text-foreground" data-testid="text-page-title">
              Global Square
            </h1>
          </button>
          <div className="flex items-center space-x-1">
            {/* FIX 8: Manual refresh button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={manualRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh"
              className={`relative ${isRefreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="h-4 w-4" />
              {refreshCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                  {refreshCount}
                </span>
              )}
            </Button>

            {/* Debug Panel Toggle Button (dev mode only) */}
            {showDevMenu() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDebugPanelOpen(!debugPanelOpen)}
                data-testid="button-debug-toggle"
                className={debugPanelOpen ? 'bg-accent' : ''}
              >
                <Shield className="h-4 w-4" />
              </Button>
            )}

            {/* Mobile: Dropdown menu with Settings, Theme, Work Mode, and Friends */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="md:hidden">
                <Button variant="ghost" size="sm" data-testid="button-mobile-menu">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setLocation('/settings')}
                  data-testid="dropdown-settings"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    // Quick theme toggle
                    if (mode === 'light') {
                      setMode('dark');
                    } else if (mode === 'dark') {
                      setMode('light');
                    } else {
                      setMode(activeTheme === 'light' ? 'dark' : 'light');
                    }
                  }}
                  data-testid="dropdown-theme-toggle"
                >
                  {activeTheme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                  Theme
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation('/room/work')}
                  data-testid="dropdown-work-mode"
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  Work Mode
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFriendsDialogOpen(true)}
                  data-testid="dropdown-friends"
                  className="relative"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Friends
                  <span className="ml-auto text-xs text-muted-foreground">Soon</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Desktop: Dropdown menu with Settings, Theme, Work Mode, and Friends */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="hidden md:flex">
                <Button variant="ghost" size="sm" data-testid="button-desktop-menu">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setLocation('/settings')}
                  data-testid="dropdown-desktop-settings"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    // Quick theme toggle
                    if (mode === 'light') {
                      setMode('dark');
                    } else if (mode === 'dark') {
                      setMode('light');
                    } else {
                      setMode(activeTheme === 'light' ? 'dark' : 'light');
                    }
                  }}
                  data-testid="dropdown-desktop-theme-toggle"
                >
                  {activeTheme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
                  Theme
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation('/room/work')}
                  data-testid="dropdown-desktop-work-mode"
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  Work Mode
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFriendsDialogOpen(true)}
                  data-testid="dropdown-desktop-friends"
                  className="relative"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Friends
                  <span className="ml-auto text-xs text-muted-foreground">Soon</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Theme sheet (now hidden, keeping for backwards compatibility) */}
            <Sheet open={false} onOpenChange={setThemeSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="button-theme-settings" className="hidden">
                  <span></span>
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
                  
                  {/* Username Color Picker */}
                  <div className="mt-6 pt-6 border-t border-border">
                    <Label className="text-sm font-medium mb-3 block">Username Color</Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Choose a color for your username display
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { name: 'Blue', class: 'bg-blue-600', value: 'blue' },
                        { name: 'Green', class: 'bg-green-600', value: 'green' },
                        { name: 'Purple', class: 'bg-purple-600', value: 'purple' },
                        { name: 'Orange', class: 'bg-orange-600', value: 'orange' },
                        { name: 'Pink', class: 'bg-pink-600', value: 'pink' },
                        { name: 'Indigo', class: 'bg-indigo-600', value: 'indigo' },
                      ].map((color) => (
                        <button
                          key={color.value}
                          onClick={() => handleColorSelect(color.value)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all ${
                            usernameColor === color.value
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          data-testid={`button-username-color-${color.value}`}
                        >
                          <div className={`w-8 h-8 rounded-full ${color.class}`} />
                          <span className="text-xs">{color.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Platform Debug Info */}
                  <div className="mt-6 pt-6 border-t border-border">
                    <Label className="text-sm font-medium mb-3 block">🔍 Debug Info</Label>
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 rounded-lg text-xs font-mono space-y-1">
                      <div className="text-yellow-900 dark:text-yellow-100">
                        <strong>window.WorldApp:</strong> {platformInfo.hasWorldApp ? 'YES ✓' : 'NO ✗'}
                      </div>
                      <div className="text-yellow-900 dark:text-yellow-100">
                        <strong>window.minikit:</strong> {platformInfo.hasMinikit ? 'YES ✓' : 'NO ✗'}
                      </div>
                      <div className="text-yellow-900 dark:text-yellow-100">
                        <strong>isConnected:</strong> {platformInfo.isConnected ? 'YES' : 'NO'}
                      </div>
                      <div className="text-yellow-900 dark:text-yellow-100">
                        <strong>usePollingFallback:</strong> {platformInfo.usePollingFallback ? 'YES' : 'NO'}
                      </div>
                      <div className="text-yellow-900 dark:text-yellow-100">
                        <strong>Badge should show:</strong> {platformInfo.usePollingFallback ? 'Polling (yellow)' : 'Live (green)'}
                      </div>
                      <div className="text-yellow-800 dark:text-yellow-200 truncate">
                        <strong>User Agent:</strong> {platformInfo.userAgent.substring(0, 50)}...
                      </div>
                    </div>
                  </div>
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
            
            {/* Premium Upgrade Button */}
            {!isPremium && isVerified && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPremiumModalOpen(true)}
                disabled={isPaying}
                data-testid="button-upgrade-premium"
                className="animate-pulse"
              >
                <Crown className="h-4 w-4 text-amber-500" />
              </Button>
            )}
            
            {/* Premium Badge */}
            {isPremium && (
              <Badge variant="secondary" className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0">
                <Crown className="h-3 w-3 mr-1" />
                Premium
              </Badge>
            )}
            
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
                    {/* Emergency unblock button */}
                    <div className="space-y-2">
                      <Button 
                        onClick={() => {
                          // Find zoe_builder's humanId from messages 
                          const zoeMsgs = messages.filter(m => m.authorHandle === 'zoe_builder');
                          if (zoeMsgs.length > 0 && zoeMsgs[0].authorHumanId) {
                            unblockMutation.mutate(zoeMsgs[0].authorHumanId);
                          } else {
                            // Try the hardcoded IDs we saw in the DB
                            const possibleIds = [
                              'guest_d3ba19f1-dd63-432c-bc90-8c4354c54d54', // zoe_builder from mobile
                              'guest_52d24386-7e90-472e-b5bd-78698969c3c4'  // Another ID from DB
                            ];
                            // Try both IDs
                            possibleIds.forEach(id => unblockMutation.mutate(id));
                            toast({
                              title: "Attempting to unblock",
                              description: "Trying to unblock zoe_builder with known IDs",
                            });
                          }
                        }}
                        variant="destructive"
                        className="w-full justify-start"
                        data-testid="button-emergency-unblock"
                      >
                        🚨 EMERGENCY: Unblock zoe_builder
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Click this to immediately unblock zoe_builder. This is a temporary fix while we build the Settings page.
                      </p>
                    </div>

                    <div className="border-t pt-4">
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
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
        {/* Sync indicator - now below title */}
        <div className="flex justify-center mb-2">
          <Tooltip>
            <TooltipTrigger>
              <span 
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isConnected && !usePollingFallback 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                    : secondsSinceLastPoll > 10 
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                }`}
                data-testid="badge-connection-status"
              >
                <span className={`h-2 w-2 rounded-full ${
                  isConnected && !usePollingFallback 
                    ? 'bg-green-500 animate-pulse' 
                    : secondsSinceLastPoll > 10
                    ? 'bg-red-500'
                    : 'bg-blue-500 animate-pulse'
                }`} />
                {isConnected && !usePollingFallback ? 'Live' : 
                  secondsSinceLastPoll > 10 ? 'Syncing...' :
                  lastPollTime ? `Synced ${secondsSinceLastPoll}s ago` : 'Syncing'
                }
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {usePollingFallback && (
                <div className="text-xs space-y-1">
                  <p className="font-medium">📡 Universal Polling Mode</p>
                  <p>Checking for new messages every 2.5s</p>
                  {lastPollTime && (
                    <p className="text-muted-foreground">
                      Last sync: {lastPollTime.toLocaleTimeString()}
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    Messages sync across all your devices
                  </p>
                </div>
              )}
              {!usePollingFallback && isConnected && (
                <div className="text-xs">
                  <p className="font-medium">⚡ Real-time Connection</p>
                  <p className="text-muted-foreground">Messages appear instantly</p>
                </div>
              )}
            </TooltipContent>
          </Tooltip>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="h-auto p-1 ml-1"
                data-testid="button-toggle-sidebar"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>View online users</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Connection Status Banner - Shows when sync is delayed */}
      {secondsSinceLastPoll > 10 && usePollingFallback && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-y border-amber-200 dark:border-amber-800 px-6 py-2 banner-slide-in" data-testid="banner-sync-delayed">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-sm">
            <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-spin" />
            <span className="text-amber-800 dark:text-amber-200">
              Syncing messages... Last update {secondsSinceLastPoll}s ago
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={manualRefresh}
              className="text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 h-auto py-1 px-2"
              data-testid="button-banner-refresh"
            >
              Refresh now
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Area: Single column centered layout on mobile, full-width on desktop */}
      <div className="flex-1 flex flex-col overflow-hidden max-w-md mx-auto px-6 md:mx-0 md:px-8 w-full md:max-w-none">
        {/* Chat Area (Composer + Messages) */}
        <div className="flex-1 flex flex-col min-w-0">
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
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {cooldownSeconds > 0 && (
              <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-amber-800 dark:text-amber-200" data-testid="text-cooldown-notice">
                    Take a breath—back in {cooldownSeconds}s
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="relative">
              <Textarea
                placeholder="Say hello 👋..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                className="resize-none border-2 border-gray-200 dark:border-gray-700/50 dark:bg-gray-800"
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

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto py-3 md:py-4 space-y-3 md:space-y-2" data-testid="list-messages">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLoader key={i} />
          ))
        ) : messages.length > 0 ? (
          messages.slice().reverse().map((msg, idx) => (
            <div key={msg.id} className="message-enter">
              <MessageItem
                message={msg}
                index={idx}
                currentUserHumanId={currentUserHumanId}
                showVoting={showVoting}
                onProfileClick={() => setSelectedProfileHandle(msg.authorHandle)}
                onStarClick={() => handleStarMessage(msg.id)}
                onReportClick={() => handleReportMessage(msg.id)}
                onMuteClick={() => {}}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onVote={handleVoteMessage}
                onReact={handleReactMessage}
                data-testid={`message-item-${msg.id}`}
              />
            </div>
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
        </div>
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
          onConfirm={handleConfirmReport}
          onCancel={() => setReportingMessage(null)}
          isLoading={reportMessageMutation.isPending}
        />
      )}

      {/* Mute Prompt Dialog */}
      <AlertDialog open={!!mutePromptHumanId} onOpenChange={(open) => !open && setMutePromptHumanId(null)}>
        <AlertDialogContent className="sm:max-w-md" data-testid="dialog-mute-prompt">
          <AlertDialogHeader>
            <AlertDialogTitle>Mute this user?</AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              Muting will hide all messages from this user. You can unmute them later from settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setMutePromptHumanId(null)}
              disabled={muteMutation.isPending}
              data-testid="button-dismiss-mute-prompt"
            >
              No Thanks
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => mutePromptHumanId && muteMutation.mutate(mutePromptHumanId)}
              disabled={muteMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-confirm-mute"
            >
              {muteMutation.isPending ? "Muting..." : "Mute User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Premium Benefits Modal */}
      <Dialog open={premiumModalOpen} onOpenChange={setPremiumModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Upgrade to Mall Space Premium
            </DialogTitle>
            <DialogDescription className="pt-4 space-y-4">
              <div className="text-center">
                <p className="text-lg font-semibold text-foreground">
                  One-time payment of 1 WLD
                </p>
                <p className="text-sm text-muted-foreground">
                  Lifetime access to premium features
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 p-4 rounded-lg space-y-3">
                <h4 className="font-semibold text-sm">Premium Benefits:</h4>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span><strong>500 character messages</strong> (vs 240 for standard users)</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span><strong>Unlimited daily messages</strong> (no cooldowns or limits)</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span><strong>Premium badge</strong> next to your name</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span><strong>Priority in Work Mode</strong> for collaboration</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <span><strong>Special themes</strong> (coming soon)</span>
                  </li>
                </ul>
              </div>
              
              <div className="pt-2">
                <Button 
                  onClick={async () => {
                    try {
                      setPremiumModalOpen(false);
                      await payForPremium();
                    } catch (error) {
                      console.error('Payment failed:', error);
                    }
                  }}
                  disabled={isPaying}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white"
                  data-testid="button-pay-premium"
                >
                  {isPaying ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Crown className="h-4 w-4 mr-2" />
                      Pay 1 WLD for Premium
                    </>
                  )}
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Payment processed securely through World ID
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

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

      {/* Online Users Sidebar Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="right" className="w-[300px] sm:w-[350px] p-0">
          <OnlineUsersSidebar presence={presence} />
        </SheetContent>
      </Sheet>

      {/* Debug Panel (Dev Mode Only) - SYNC DIAGNOSTICS */}
      {debugPanelOpen && (
        <div className="fixed bottom-5 right-5 bg-card border border-border rounded-lg shadow-xl p-4 max-w-md z-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Sync Diagnostics
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDebugPanelOpen(false)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
          
          <div className="space-y-2 text-xs font-mono">
            <div className="grid grid-cols-2 gap-1">
              <span className="text-muted-foreground">Session ID:</span>
              <span className="text-primary truncate" title={sessionId || 'N/A'}>
                {sessionId ? `${sessionId.substring(0, 12)}...` : 'N/A'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-1">
              <span className="text-muted-foreground">Last Poll:</span>
              <span className={`${secondsSinceLastPoll > 5 ? 'text-red-500' : 'text-green-500'}`}>
                {lastPollTime ? `${secondsSinceLastPoll}s ago` : 'Never'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-1">
              <span className="text-muted-foreground">Messages (State):</span>
              <span className="text-foreground">{messages.length}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-1">
              <span className="text-muted-foreground">Polling Status:</span>
              <span className={`${usePollingFallback ? 'text-blue-500' : isConnected ? 'text-green-500' : 'text-red-500'}`}>
                {usePollingFallback ? 'Polling' : isConnected ? 'WebSocket' : 'Disconnected'}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-1">
              <span className="text-muted-foreground">Refresh Count:</span>
              <span className="text-foreground">{refreshCount}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-1">
              <span className="text-muted-foreground">User ID:</span>
              <span className="text-primary truncate" title={currentUserHumanId || 'N/A'}>
                {currentUserHumanId ? `${currentUserHumanId.substring(0, 15)}...` : 'N/A'}
              </span>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
            <p className="mb-1">Check browser console for detailed poll logs</p>
            <p className="text-[10px] opacity-70">
              Look for [POLL #X] and [GET /api/messages/global] logs
            </p>
          </div>
        </div>
      )}
      
      {/* Orange/Gold Color Bar at Bottom */}
      <div className="h-1 bg-gradient-to-r from-orange-400 via-amber-500 to-orange-400" style={{ height: '4px' }} />
    </div>
  );
}
