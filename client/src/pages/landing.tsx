import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MessageItem } from "@/components/message-item";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Settings, Sun, Moon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useThemeContext } from "@/theme/ThemeProvider";
import { isMiniApp, getMiniAppPollInterval } from "@/lib/platform";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { MessageWithAuthor } from "@shared/schema";

export default function Landing() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { mode, setMode, activeTheme, sunTimes } = useThemeContext();
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const isInMiniApp = isMiniApp();
  const lastMessageIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout>();

  // Fetch latest messages for preview (no auth required)
  const { data: messages, isLoading, refetch } = useQuery<MessageWithAuthor[]>({
    queryKey: ['/api/messages', 'global'],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '10' });
      if (isInMiniApp && lastMessageIdRef.current) {
        params.append('since', lastMessageIdRef.current);
      }
      const res = await fetch(`/api/messages/global?${params}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      const newMessages = await res.json();
      
      // Update last message ID for next poll (Mini App only)
      if (isInMiniApp && Array.isArray(newMessages) && newMessages.length > 0) {
        const latestMessage = newMessages[newMessages.length - 1];
        if (latestMessage?.id) {
          lastMessageIdRef.current = latestMessage.id;
        }
      }
      
      return newMessages;
    },
    // Reduce refetch interval for Mini App to ensure timely updates
    refetchInterval: isInMiniApp ? getMiniAppPollInterval() : false,
  });

  // Set up polling for Mini App
  useEffect(() => {
    if (isInMiniApp) {
      const pollInterval = getMiniAppPollInterval();
      console.log(`[Landing] Mini App detected - using polling with ${pollInterval}ms interval`);
      
      // Set up recurring refetch
      pollIntervalRef.current = setInterval(() => {
        refetch();
      }, pollInterval);
      
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [isInMiniApp, refetch]);

  const handleEnterGlobalSquare = () => {
    // Allow immediate entry without verification
    setLocation('/room/global');
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header with Theme and Language Switchers */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
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
        </div>
        <LanguageSwitcher />
      </div>
      
      {/* Hero Section - Improved spacing and centering */}
      <div className="max-w-md mx-auto px-6 md:max-w-2xl pt-16 md:pt-24 pb-12 text-center">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4" data-testid="hero-title">
            {t('app.name')}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-2" data-testid="hero-subtitle">
            {t('app.tagline')}
          </p>
          <p className="text-base text-muted-foreground" data-testid="hero-description">
            {t('app.description')}
          </p>
        </div>
        
        {/* CTA Button */}
        <div className="mb-12">
          <Button 
            onClick={handleEnterGlobalSquare}
            className="w-full md:w-auto md:px-12 py-6 text-lg font-semibold"
            size="lg"
            data-testid="button-enter-global-square"
          >
            {t('landing.enterGlobalSquare')}
          </Button>
        </div>
      </div>
      
      {/* Read-only Preview Section */}
      <div className="flex-1 pb-6">
        <div className="max-w-md mx-auto px-6 md:max-w-none md:mx-0 md:px-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground mb-2" data-testid="text-preview-header">
              {t('landing.previewHeader')}
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="text-preview-subtitle">
              {t('landing.previewSubtitle')}
            </p>
          </div>
          
          {/* Message Preview List */}
          <div className="space-y-3" data-testid="list-preview-messages">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <SkeletonLoader key={i} />
            ))
          ) : messages && messages.length > 0 ? (
            messages.slice().reverse().map((message) => (
              <MessageItem 
                key={message.id} 
                message={message} 
                isPreview={true}
                onProfileClick={() => {}}
                onStarClick={() => {}}
                onReportClick={() => {}}
                onMuteClick={() => {}}
              />
            ))
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground" data-testid="text-empty-preview">
                  {t('landing.emptyPreview')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
        
          {/* Show More Indicator */}
          {messages && messages.length > 0 && (
            <div className="text-center mt-6">
              <p className="text-sm text-muted-foreground" data-testid="text-join-conversation">
                {t('landing.joinConversation')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
