import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, UserX, Volume2, Shield, Info, Settings as SettingsIcon, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorldId } from "@/hooks/use-world-id";
import { useAuthRole } from "@/hooks/use-auth-role";
import { apiRequest } from "@/lib/queryClient";
import { getSessionIdSync } from "@/lib/session";
import type { Human } from "@shared/schema";

export default function Settings() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/settings/:category?");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { humanId, isVerified } = useWorldId();
  const { role, isGuest } = useAuthRole();
  const [sessionId] = useState<string | null>(getSessionIdSync());
  const [usernameColor, setUsernameColor] = useState<string>(
    localStorage.getItem('username_color') || ''
  );
  const [showVoting, setShowVoting] = useState<boolean>(() => {
    const saved = localStorage.getItem('showVoting');
    return saved !== null ? saved === 'true' : true;
  });

  // Determine viewport size for responsive behavior
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Determine current category from URL or default
  const currentCategory = params?.category || 'general';

  // Platform debug info
  const platformInfo = {
    hasWorldApp: typeof window !== 'undefined' && !!(window as any).WorldApp,
    hasMinikit: typeof window !== 'undefined' && !!(window as any).minikit,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
    sessionId,
    humanId,
    role,
    isVerified,
    timestamp: new Date().toISOString()
  };

  // Fetch blocked users
  const { data: blockedUsers = [], isLoading: loadingBlocked } = useQuery<string[]>({
    queryKey: ['/api/blocks'],
    queryFn: async () => {
      const res = await fetch('/api/blocks', {
        credentials: 'include',
        headers: {
          'X-World-ID-Proof': humanId || '',
        },
      });
      if (!res.ok) throw new Error('Failed to fetch blocked users');
      return res.json();
    },
  });

  // Fetch muted users  
  const { data: mutedUsers = [], isLoading: loadingMuted } = useQuery<string[]>({
    queryKey: ['/api/mutes'],
    queryFn: async () => {
      const res = await fetch('/api/mutes', {
        credentials: 'include',
        headers: {
          'X-World-ID-Proof': humanId || '',
        },
      });
      if (!res.ok) throw new Error('Failed to fetch muted users');
      return res.json();
    },
  });

  // Fetch human info for blocked/muted users
  const { data: humansData = {} } = useQuery<Record<string, Human>>({
    queryKey: ['/api/humans/batch', [...blockedUsers, ...mutedUsers]],
    queryFn: async () => {
      const allIds = [...new Set([...blockedUsers, ...mutedUsers])];
      if (allIds.length === 0) return {};
      
      try {
        const res = await fetch('/api/humans/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-World-ID-Proof': humanId || '',
          },
          credentials: 'include',
          body: JSON.stringify({ humanIds: allIds }),
        });
        if (!res.ok) throw new Error('Failed to fetch human data');
        return res.json();
      } catch {
        const dummyData: Record<string, Human> = {};
        allIds.forEach(id => {
          dummyData[id] = {
            humanId: id,
            handle: id.startsWith('guest_') ? id.substring(0, 15) + '...' : id,
            role: 'guest' as const,
            isVerified: false,
            isPremium: false,
            trustLevel: 0,
            joinedAt: new Date(),
          };
        });
        return dummyData;
      }
    },
    enabled: blockedUsers.length > 0 || mutedUsers.length > 0,
  });

  // Unblock mutation
  const unblockMutation = useMutation({
    mutationFn: async (blockedHumanId: string) => {
      return apiRequest("DELETE", `/api/blocks/${blockedHumanId}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "User unblocked",
        description: "You can now see each other's messages again.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/blocks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/global'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unblock user",
        variant: "destructive",
      });
    },
  });

  // Unmute mutation
  const unmuteMutation = useMutation({
    mutationFn: async (mutedHumanId: string) => {
      return apiRequest("DELETE", `/api/mutes/${mutedHumanId}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "User unmuted",
        description: "You'll see their messages again.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/mutes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/messages/global'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unmute user",
        variant: "destructive",
      });
    },
  });

  const handleColorSelect = (color: string) => {
    setUsernameColor(color);
    localStorage.setItem('username_color', color);
    toast({
      title: "Color saved",
      description: "Your username color has been updated.",
      duration: 2000,
    });
  };

  const handleVotingToggle = (checked: boolean) => {
    setShowVoting(checked);
    localStorage.setItem('showVoting', String(checked));
    toast({
      title: checked ? "Voting enabled" : "Voting disabled",
      description: checked 
        ? "You can now see voting arrows and scores on messages." 
        : "Voting UI has been hidden from your view.",
      duration: 2000,
    });
  };

  const colorOptions = [
    { value: '', label: 'Default', preview: 'text-foreground' },
    { value: '#FF6B6B', label: 'Coral', preview: 'text-red-400' },
    { value: '#4ECDC4', label: 'Teal', preview: 'text-teal-400' },
    { value: '#FFE66D', label: 'Gold', preview: 'text-yellow-400' },
    { value: '#95E77E', label: 'Mint', preview: 'text-green-400' },
    { value: '#A8E6CF', label: 'Sage', preview: 'text-emerald-300' },
    { value: '#FFD3B6', label: 'Peach', preview: 'text-orange-300' },
    { value: '#C7CEEA', label: 'Lavender', preview: 'text-purple-300' },
    { value: '#FF8CC8', label: 'Pink', preview: 'text-pink-400' },
    { value: '#87CEEB', label: 'Sky', preview: 'text-sky-400' },
  ];

  const categories = [
    { id: 'general', label: 'General', icon: SettingsIcon, description: 'Preferences and customization' },
    { id: 'blocked', label: 'Blocked Users', icon: UserX, description: 'Manage blocked users', count: blockedUsers.length },
    { id: 'muted', label: 'Muted Users', icon: Volume2, description: 'Manage muted users', count: mutedUsers.length },
    { id: 'account', label: 'Account', icon: Info, description: 'Account details and debug info' },
  ];

  // Mobile: Show category list or detail page
  if (isMobile && currentCategory === 'general' && !params?.category) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/room/global')}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>

          <div className="space-y-2">
            {categories.map(category => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setLocation(`/settings/${category.id}`)}
                  className="w-full flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-accent transition-colors"
                  data-testid={`category-${category.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{category.label}</div>
                      <div className="text-sm text-muted-foreground">{category.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {category.count !== undefined && category.count > 0 && (
                      <Badge variant="secondary">{category.count}</Badge>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Mobile detail page or Desktop tab view
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(isMobile ? '/settings' : '/room/global')}
            data-testid={isMobile ? "button-back-to-settings" : "button-back"}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">
            {isMobile && params?.category ? categories.find(c => c.id === currentCategory)?.label || 'Settings' : 'Settings'}
          </h1>
        </div>

        {/* Desktop: Tabs */}
        {!isMobile && (
          <Tabs value={currentCategory} onValueChange={(value) => setLocation(`/settings/${value}`)} orientation="vertical" className="flex gap-6">
            <TabsList className="flex flex-col h-fit w-[200px] bg-muted/30 p-1">
              {categories.map(category => {
                const Icon = category.icon;
                return (
                  <TabsTrigger 
                    key={category.id}
                    value={category.id}
                    data-testid={`tab-${category.id}`}
                    className="w-full justify-start gap-3 px-3 py-2.5 text-left data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm font-medium">{category.label}</span>
                    {category.count !== undefined && category.count > 0 && (
                      <Badge variant="secondary" className="ml-auto">{category.count}</Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            
            <div className="flex-1">
              <TabsContent value="general" className="space-y-4">
                <GeneralSettings 
                  usernameColor={usernameColor}
                  showVoting={showVoting}
                  colorOptions={colorOptions}
                  handleColorSelect={handleColorSelect}
                  handleVotingToggle={handleVotingToggle}
                />
              </TabsContent>

              <TabsContent value="blocked" className="space-y-4">
                <BlockedUsers 
                  blockedUsers={blockedUsers}
                  loadingBlocked={loadingBlocked}
                  humansData={humansData}
                  unblockMutation={unblockMutation}
                />
              </TabsContent>

              <TabsContent value="muted" className="space-y-4">
                <MutedUsers 
                  mutedUsers={mutedUsers}
                  loadingMuted={loadingMuted}
                  humansData={humansData}
                  unmuteMutation={unmuteMutation}
                />
              </TabsContent>

              <TabsContent value="account" className="space-y-4">
                <AccountInfo 
                  role={role}
                  isVerified={isVerified}
                  sessionId={sessionId}
                  humanId={humanId}
                  platformInfo={platformInfo}
                />
              </TabsContent>
            </div>
          </Tabs>
        )}

        {/* Mobile: Category content */}
        {isMobile && params?.category && (
          <>
            {currentCategory === 'general' && (
              <GeneralSettings 
                usernameColor={usernameColor}
                showVoting={showVoting}
                colorOptions={colorOptions}
                handleColorSelect={handleColorSelect}
                handleVotingToggle={handleVotingToggle}
              />
            )}
            {currentCategory === 'blocked' && (
              <BlockedUsers 
                blockedUsers={blockedUsers}
                loadingBlocked={loadingBlocked}
                humansData={humansData}
                unblockMutation={unblockMutation}
              />
            )}
            {currentCategory === 'muted' && (
              <MutedUsers 
                mutedUsers={mutedUsers}
                loadingMuted={loadingMuted}
                humansData={humansData}
                unmuteMutation={unmuteMutation}
              />
            )}
            {currentCategory === 'account' && (
              <AccountInfo 
                role={role}
                isVerified={isVerified}
                sessionId={sessionId}
                humanId={humanId}
                platformInfo={platformInfo}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// General Settings Component
function GeneralSettings({ usernameColor, showVoting, colorOptions, handleColorSelect, handleVotingToggle }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <CardDescription>
          Manage your general preferences and settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-4">Username Color</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Choose a color to personalize how your username appears in chat
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {colorOptions.map((option: any) => (
              <button
                key={option.value}
                onClick={() => handleColorSelect(option.value)}
                className={`relative p-3 rounded-lg border transition-all ${
                  usernameColor === option.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
                data-testid={`color-option-${option.label.toLowerCase()}`}
              >
                <div
                  className="font-semibold text-sm"
                  style={{ color: option.value || undefined }}
                >
                  {option.label}
                </div>
                {usernameColor === option.value && (
                  <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Show voting on messages</h3>
              <p className="text-xs text-muted-foreground">
                Display voting arrows and scores on messages in the chat
              </p>
            </div>
            <Switch
              checked={showVoting}
              onCheckedChange={handleVotingToggle}
              data-testid="switch-show-voting"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Blocked Users Component
function BlockedUsers({ blockedUsers, loadingBlocked, humansData, unblockMutation }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Blocked Users</CardTitle>
        <CardDescription>
          You and these users cannot see each other's messages. Unblock them to restore communication.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingBlocked ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : blockedUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No blocked users
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {blockedUsers.map((userId: string) => {
                const human = humansData[userId];
                const displayName = human?.handle || userId.substring(0, 15) + '...';
                return (
                  <div
                    key={userId}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    data-testid={`blocked-user-${userId}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {displayName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{displayName}</div>
                        <div className="text-xs text-muted-foreground">
                          {human?.isVerified && (
                            <Badge variant="secondary" className="mr-2">
                              <Shield className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                          {userId.startsWith('guest_') && 'Guest User'}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unblockMutation.mutate(userId)}
                      disabled={unblockMutation.isPending}
                      data-testid={`button-unblock-${userId}`}
                    >
                      Unblock
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// Muted Users Component
function MutedUsers({ mutedUsers, loadingMuted, humansData, unmuteMutation }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Muted Users</CardTitle>
        <CardDescription>
          Messages from these users are hidden. Unmute them to see their messages again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingMuted ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : mutedUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No muted users
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {mutedUsers.map((userId: string) => {
                const human = humansData[userId];
                const displayName = human?.handle || userId.substring(0, 15) + '...';
                return (
                  <div
                    key={userId}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    data-testid={`muted-user-${userId}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {displayName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{displayName}</div>
                        <div className="text-xs text-muted-foreground">
                          {human?.isVerified && (
                            <Badge variant="secondary" className="mr-2">
                              <Shield className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                          {userId.startsWith('guest_') && 'Guest User'}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unmuteMutation.mutate(userId)}
                      disabled={unmuteMutation.isPending}
                      data-testid={`button-unmute-${userId}`}
                    >
                      Unmute
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// Account Info Component
function AccountInfo({ role, isVerified, sessionId, humanId, platformInfo }: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Information</CardTitle>
        <CardDescription>
          Your account details and session information
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">Role</span>
            <span className="text-sm font-medium">{role}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">Verification</span>
            <span className="text-sm font-medium">
              {isVerified ? (
                <Badge variant="secondary">
                  <Shield className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              ) : (
                'Not verified'
              )}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-sm text-muted-foreground">Session ID</span>
            <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
              {sessionId ? sessionId.substring(0, 12) + '...' : 'N/A'}
            </span>
          </div>
          {humanId && (
            <div className="flex justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Human ID</span>
              <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                {humanId.substring(0, 12) + '...'}
              </span>
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-3">Debug Information</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Platform</span>
              <span className="font-mono">
                {platformInfo.hasWorldApp ? 'World App' : 
                 platformInfo.hasMinikit ? 'MiniKit' : 'Web'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">User Agent</span>
              <span className="font-mono truncate max-w-xs">
                {platformInfo.userAgent.substring(0, 30) + '...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Timestamp</span>
              <span className="font-mono">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
