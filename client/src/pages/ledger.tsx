import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SkeletonLoader } from "@/components/skeleton-loader";
import { ArrowLeft, Info } from "lucide-react";
import type { LedgerEntry } from "@shared/schema";

export default function Ledger() {
  const [, setLocation] = useLocation();

  // Fetch ledger entries
  const { data: entries = [], isLoading } = useQuery<LedgerEntry[]>({
    queryKey: ['/api/ledger'],
    queryFn: async () => {
      const res = await fetch('/api/ledger');
      if (!res.ok) throw new Error('Failed to fetch ledger entries');
      return res.json();
    },
  });

  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center gap-3 mb-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLocation('/room/global')}
            data-testid="button-go-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground" data-testid="text-page-title">
            Room Rain Ledger
          </h1>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">
          Transparent points distribution history
        </p>
      </div>

      {/* Ledger Entries */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" data-testid="list-ledger-entries">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLoader key={i} />
          ))
        ) : entries.length > 0 ? (
          entries.map((entry) => (
            <Card key={entry.id} data-testid={`ledger-entry-${entry.id}`}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-foreground" data-testid="text-entry-title">
                    {entry.title}
                  </h3>
                  <span className="text-xs text-muted-foreground" data-testid="text-entry-timestamp">
                    {formatTimeAgo(entry.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3" data-testid="text-entry-description">
                  {entry.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-600 font-medium" data-testid="text-entry-points">
                    {entry.totalPoints.toLocaleString()} points
                  </span>
                  <span className="text-xs text-muted-foreground" data-testid="text-entry-participants">
                    {entry.participantCount} recipients
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground" data-testid="text-empty-state">
                No room rain distributions yet
              </p>
            </CardContent>
          </Card>
        )}

        {/* Info Note */}
        <Card className="mt-6 bg-secondary/50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground" data-testid="text-info-note">
                Real ERC-20 transfers will use Permit2 and sponsored gas in future versions. 
                Current system uses points for demonstration.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
