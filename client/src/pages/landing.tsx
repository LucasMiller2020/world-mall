import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageItem } from "@/components/message-item";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Shield, Settings, Sun, Moon } from "lucide-react";
import { useMiniKitStatus, useWorldId } from "@/hooks/use-world-id";
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
import type { MessageWithAuthor } from "@shared/schema";

export default function Landing() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { isInstalled } = useMiniKitStatus();
  const { verify, isVerifying, isVerified } = useWorldId();
  const { toast } = useToast();
  const { mode, setMode, activeTheme, sunTimes } = useThemeContext();
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);

  // Fetch latest messages for preview (no auth required)
  const { data: messages, isLoading } = useQuery<MessageWithAuthor[]>({
    queryKey: ['/api/messages/global'],
    queryFn: async () => {
      const res = await fetch('/api/messages/global?limit=10');
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
  });

  const handleEnterGlobalSquare = () => {
    if (!isInstalled) {
      // Show instructions to open in World App
      alert(t('landing.worldAppNotice'));
      return;
    }
    setLocation('/room/global');
  };

  const handleAdminAccess = () => {
    if (adminKey.trim()) {
      localStorage.setItem('admin_key', adminKey.trim());
      setLocation('/admin');
      setAdminDialogOpen(false);
      toast({
        title: t('auth.adminAccessGranted'),
        description: t('auth.adminWelcome')
      });
    } else {
      toast({
        title: t('common.error'), 
        description: t('auth.pleaseEnterAdminKey'),
        variant: "destructive"
      });
    }
  };

  const handleVerifyWithWorldId = async () => {
    if (!isInstalled) {
      toast({
        title: t('common.error'),
        description: 'Please open this app in World App to verify',
        variant: 'destructive'
      });
      return;
    }

    if (isVerified) {
      setLocation('/room/global');
      return;
    }

    try {
      await verify();
      // On successful verification, redirect to global square
      toast({
        title: 'Verification Successful',
        description: 'Welcome! You now have full access to World Mall.',
      });
      setLocation('/room/global');
    } catch (error) {
      console.error('Verification failed:', error);
      toast({
        title: t('common.error'),
        description: 'Verification failed. Please try again.',
        variant: 'destructive'
      });
    }
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
      
      {/* Hero Section */}
      <div className="px-6 pt-12 pb-8 text-center">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-3" data-testid="hero-title">
            {t('app.name')}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed" data-testid="hero-subtitle">
            {t('app.tagline')}
          </p>
          <p className="text-base text-muted-foreground" data-testid="hero-description">
            {t('app.description')}
          </p>
        </div>
        
        {/* CTA Buttons */}
        <div className="space-y-3 mb-8">
          <Button 
            onClick={handleEnterGlobalSquare}
            className="w-full py-4 text-lg"
            size="lg"
            data-testid="button-enter-global-square"
          >
            {t('landing.enterGlobalSquare')}
          </Button>
          
          <Button 
            variant="outline"
            className="w-full"
            size="sm"
            onClick={handleVerifyWithWorldId}
            disabled={isVerifying}
            data-testid="button-verify-world-id"
          >
            <Shield className="h-4 w-4 mr-2" />
            {isVerifying ? 'Verifying...' : isVerified ? 'Verified ✓' : t('auth.verifyWorldId')}
          </Button>
          
          <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="ghost"
                size="sm"
                className="text-muted-foreground text-xs"
                data-testid="button-admin-access"
              >
                Admin Access
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('auth.adminAccess')}</DialogTitle>
                <DialogDescription>
                  {t('auth.adminAccessDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="admin-key">{t('auth.adminKey')}</Label>
                  <Input
                    id="admin-key"
                    type="password"
                    placeholder={t('auth.adminKeyPlaceholder')}
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAdminAccess();
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('auth.adminKeyDemo')}
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAdminDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleAdminAccess} data-testid="button-admin-login">
                  {t('auth.accessAdmin')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Guest Access Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground" data-testid="text-guest-access-title">
                  {t('landing.guestAccessTitle')}
                </h3>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground mb-2" data-testid="text-verification-notice">
                  {t('landing.verificationNotice')}
                </p>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground" data-testid="text-guest-benefits">
                    {t('landing.guestBenefits')}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid="text-verified-benefits">
                    {t('landing.verifiedBenefits')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {!isInstalled && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="pt-4">
              <p className="text-sm text-amber-800" data-testid="text-world-app-notice">
                {t('landing.worldAppNotice')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Read-only Preview Section */}
      <div className="flex-1 px-6 pb-6">
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
            messages.slice(0, 10).map((message) => (
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
  );
}
