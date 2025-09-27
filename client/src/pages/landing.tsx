import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageItem } from "@/components/message-item";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { Shield } from "lucide-react";
import { useMiniKitStatus } from "@/hooks/use-world-id";
import type { MessageWithAuthor } from "@shared/schema";

export default function Landing() {
  const [, setLocation] = useLocation();
  const { isInstalled } = useMiniKitStatus();

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
      alert('Please open this app in World App to access all features');
      return;
    }
    setLocation('/room/global');
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <div className="px-6 pt-12 pb-8 text-center">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-3" data-testid="hero-title">
            Humans Square
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed" data-testid="hero-subtitle">
            A global square for verified humans.
          </p>
          <p className="text-base text-muted-foreground" data-testid="hero-description">
            Talk. Learn. Build. One human, one voice.
          </p>
        </div>
        
        {/* CTA Button */}
        <Button 
          onClick={handleEnterGlobalSquare}
          className="w-full py-4 text-lg mb-8"
          size="lg"
          data-testid="button-enter-global-square"
        >
          Enter Global Square
        </Button>
        
        {/* Verification Gate Notice */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium text-foreground" data-testid="text-verification-notice">
                  Posting is human-only
                </p>
                <p className="text-xs text-muted-foreground" data-testid="text-verification-subtitle">
                  Verify once with World ID
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {!isInstalled && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="pt-4">
              <p className="text-sm text-amber-800" data-testid="text-world-app-notice">
                For full functionality, please open this app in World App
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Read-only Preview Section */}
      <div className="flex-1 px-6 pb-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground mb-2" data-testid="text-preview-header">
            Live from Global Square
          </h2>
          <p className="text-sm text-muted-foreground" data-testid="text-preview-subtitle">
            Latest conversations (read-only preview)
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
                  Be the first to say hi today 👋
                </p>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* Show More Indicator */}
        {messages && messages.length > 0 && (
          <div className="text-center mt-6">
            <p className="text-sm text-muted-foreground" data-testid="text-join-conversation">
              Join the conversation to see more
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
