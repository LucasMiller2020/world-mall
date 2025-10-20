import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import '@/lib/i18n'; // Initialize i18n

import Landing from "@/pages/landing";
import Join from "@/pages/join";
import GlobalSquare from "@/pages/global-square";
import WorkMode from "@/pages/work-mode";
import Capsule from "@/pages/capsule";
import Ledger from "@/pages/ledger";
import InvitePage from "@/pages/invite";
import ReferralDashboard from "@/pages/referral-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminTopics from "@/pages/admin-topics";
import AdminSchedules from "@/pages/admin-schedules";
import AdminModeration from "@/pages/admin-moderation";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* Homepage with "Enter the Global Square" button */}
      <Route path="/" component={Landing} />
      <Route path="/landing" component={Landing} />
      <Route path="/join" component={Join} />
      <Route path="/room/global" component={GlobalSquare} />
      <Route path="/room/work" component={WorkMode} />
      <Route path="/settings/:category" component={Settings} />
      <Route path="/settings" component={Settings} />
      <Route path="/capsule" component={Capsule} />
      <Route path="/ledger" component={Ledger} />
      <Route path="/invite/:code" component={InvitePage} />
      <Route path="/referrals" component={ReferralDashboard} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/topics" component={AdminTopics} />
      <Route path="/admin/schedules" component={AdminSchedules} />
      <Route path="/admin/moderation" component={AdminModeration} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Initialize theme on app load
  useEffect(() => {
    // Read stored theme preference
    const storedTheme = localStorage.getItem('wm_theme');
    let activeTheme: 'light' | 'dark' = 'light'; // Default to light
    
    if (storedTheme) {
      // Determine active theme based on stored mode
      if (storedTheme === 'dark') {
        activeTheme = 'dark';
      } else if (storedTheme === 'system') {
        activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else if (storedTheme === 'autoSun') {
        const hours = new Date().getHours();
        activeTheme = hours >= 7 && hours < 19 ? 'light' : 'dark';
      }
    }
    
    // Set data-theme attribute
    document.documentElement.dataset.theme = activeTheme;
    
    // Update meta theme-color
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    const themeColor = activeTheme === 'dark' ? '#000000' : '#ffffff';
    metaThemeColor.setAttribute('content', themeColor);
  }, []);

  // Ping /api/me on app load to establish session and debug role issues
  useEffect(() => {
    fetch('/api/me', {
      credentials: 'include',
      headers: {
        'X-Session': localStorage.getItem('guest_sid') || ''
      }
    })
    .then(res => res.json())
    .then(data => {
      console.log('[App Load] /api/me response:', data);
    })
    .catch(err => {
      console.error('[App Load] /api/me error:', err);
    });
  }, []);

  return (
    <MiniKitProvider
      props={{
        appId: import.meta.env.VITE_MINIKIT_APP_ID || "app_staging_12345"
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <div className="bg-background min-h-screen relative">
              <div className="h-6 bg-background"></div>
              <Toaster />
              <Router />
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </MiniKitProvider>
  );
}

export default App;
