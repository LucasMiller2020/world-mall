import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider";

import Landing from "@/pages/landing";
import GlobalSquare from "@/pages/global-square";
import WorkMode from "@/pages/work-mode";
import Capsule from "@/pages/capsule";
import Ledger from "@/pages/ledger";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/room/global" component={GlobalSquare} />
      <Route path="/room/work" component={WorkMode} />
      <Route path="/capsule" component={Capsule} />
      <Route path="/ledger" component={Ledger} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <MiniKitProvider
      props={{
        appId: import.meta.env.VITE_MINIKIT_APP_ID || "app_staging_12345"
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="max-w-md mx-auto bg-background shadow-lg min-h-screen relative">
            <div className="h-6 bg-background"></div>
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </MiniKitProvider>
  );
}

export default App;
