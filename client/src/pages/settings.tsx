import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, UserX, Volume2, Shield, Info, Trash2, Settings as SettingsIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWorldId } from "@/hooks/use-world-id";
import { useAuthRole } from "@/hooks/use-auth-role";
import { apiRequest } from "@/lib/queryClient";
import { getSessionIdSync } from "@/lib/session";
import type { Human } from "@shared/schema";

export default function Settings() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { humanId, isVerified } = useWorldId();
  const { role, isGuest } = useAuthRole();
  const [sessionId] = useState<string | null>(getSessionIdSync());
  const [activeTab, setActiveTab] = useState("general");
  const [usernameColor, setUsernameColor] = useState<string>(
    localStorage.getItem('username_color') || ''
  );

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
      
      // Note: This endpoint might not exist yet, so we'll fallback to using just the IDs
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
        // Fallback - create dummy human data from IDs
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
    onSuccess: (_, blockedHumanId) => {
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
    onSuccess: (_, mutedHumanId) => {
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="flex gap-6">
          {/* Vertical Sidebar Tabs */}
          <TabsList className="flex flex-col h-fit w-full sm:w-[200px] bg-muted/30 p-1">
            <TabsTrigger 
              value="general" 
              data-testid="tab-general" 
              className="w-full justify-start gap-3 px-3 py-2.5 text-left data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground hover:text-foreground transition-colors"
            >
              <SettingsIcon className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">General</span>
            </TabsTrigger>
            <TabsTrigger 
              value="blocked" 
              data-testid="tab-blocked" 
              className="w-full justify-start gap-3 px-3 py-2.5 text-left data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground hover:text-foreground transition-colors"
            >
              <UserX className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">Blocked</span>
            </TabsTrigger>
            <TabsTrigger 
              value="muted" 
              data-testid="tab-muted" 
              className="w-full justify-start gap-3 px-3 py-2.5 text-left data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground hover:text-foreground transition-colors"
            >
              <Volume2 className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">Muted</span>
            </TabsTrigger>
            <TabsTrigger 
              value="account" 
              data-testid="tab-account" 
              className="w-full justify-start gap-3 px-3 py-2.5 text-left data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">Account</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Tab Content Area */}
          <div className="flex-1">
            {/* General Tab */}
            <TabsContent value="general" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>
                    Manage your general preferences and settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Username Color */}
                  <div>
                    <h3 className="text-sm font-medium mb-4">Username Color</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Choose a color to personalize how your username appears in chat
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {colorOptions.map(option => (
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

                  {/* More settings can be added here in the future */}
                  <div className="border-t pt-6">
                    <h3 className="text-sm font-medium mb-2">More Settings Coming Soon</h3>
                    <p className="text-xs text-muted-foreground">
                      Additional preferences and customization options will be available here in future updates.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Blocked Users Tab */}
            <TabsContent value="blocked" className="space-y-4">
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
                      {blockedUsers.map(userId => {
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
          </TabsContent>

          {/* Muted Users Tab */}
          <TabsContent value="muted" className="space-y-4">
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
                      {mutedUsers.map(userId => {
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
          </TabsContent>

            {/* Account Tab */}
          <TabsContent value="account" className="space-y-4">
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

                {/* Debug Information */}
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

                {/* Clear Data Button */}
                <div className="border-t pt-4">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm('Are you sure you want to clear all local data and start fresh?')) {
                        localStorage.clear();
                        sessionStorage.clear();
                        document.cookie.split(";").forEach(c => {
                          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
                        });
                        window.location.href = '/';
                      }
                    }}
                    className="w-full"
                    data-testid="button-clear-data"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Data & Start Fresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}