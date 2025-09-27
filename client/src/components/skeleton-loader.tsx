import { Card, CardContent } from "@/components/ui/card";

export function SkeletonLoader() {
  return (
    <Card className="animate-pulse">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-muted rounded-full flex-shrink-0" data-testid="skeleton-avatar" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-24" data-testid="skeleton-handle" />
            <div className="h-4 bg-muted rounded w-full" data-testid="skeleton-line-1" />
            <div className="h-4 bg-muted rounded w-3/4" data-testid="skeleton-line-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
