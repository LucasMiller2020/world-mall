import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Heart, 
  Ban, 
  Target, 
  ShieldAlert, 
  Flag,
  AlertTriangle,
  XCircle,
  Clock
} from "lucide-react";

interface CommunityGuidelinesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept?: () => void;
}

const guidelines = [
  {
    id: 1,
    title: "Be Respectful",
    description: "No harassment, hate speech, or personal attacks",
    icon: Heart,
    color: "text-blue-500",
  },
  {
    id: 2,
    title: "No Spam",
    description: "Avoid repetitive messages or promotional content",
    icon: Ban,
    color: "text-blue-500",
  },
  {
    id: 3,
    title: "Stay On Topic",
    description: "Keep conversations relevant to the room",
    icon: Target,
    color: "text-blue-500",
  },
  {
    id: 4,
    title: "No Harmful Content",
    description: "No illegal content, graphic violence, or explicit material",
    icon: ShieldAlert,
    color: "text-blue-500",
  },
  {
    id: 5,
    title: "Report Issues",
    description: "Use the report feature for violations instead of engaging",
    icon: Flag,
    color: "text-blue-500",
  },
];

export function CommunityGuidelinesModal({
  open,
  onOpenChange,
  onAccept,
}: CommunityGuidelinesModalProps) {
  const handleAccept = () => {
    onAccept?.();
    onOpenChange(false);
  };

  const handleDismiss = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl rounded-xl bg-card border-border"
        data-testid="dialog-community-guidelines"
      >
        <DialogHeader className="sticky top-0 bg-card pb-4 border-b border-border z-10">
          <DialogTitle className="text-lg font-semibold text-foreground">
            <span className="flex items-center gap-2">
              <span className="text-[hsl(215,80%,55%)]">Mall Space</span>
              <span>Community Guidelines</span>
            </span>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Please read and follow these rules to maintain a safe and welcoming community
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Community Rules */}
            <div className="space-y-4">
              {guidelines.map((guideline) => {
                const Icon = guideline.icon;
                return (
                  <div
                    key={guideline.id}
                    className="flex gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                    data-testid={`text-guideline-${guideline.id}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-8 h-8 rounded-full bg-[hsl(215,80%,55%)]/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-[hsl(215,80%,55%)]" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-foreground text-sm">
                          {guideline.id}.
                        </span>
                        <h3 className="font-semibold text-foreground text-sm">
                          {guideline.title}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {guideline.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 3-Strike Warning System */}
            <div className="pt-6 border-t border-border">
              <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-[hsl(38,95%,55%)]" />
                3-Strike Warning System
              </h3>
              <div className="space-y-3">
                <div className="flex gap-3 items-start p-3 rounded-lg bg-blue-500/5 border-l-2 border-[hsl(215,80%,55%)]">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[hsl(215,80%,55%)]/20 flex items-center justify-center text-xs font-bold text-[hsl(215,80%,55%)]">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">Strike 1:</span> Warning message
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 rounded-lg bg-amber-500/5 border-l-2 border-[hsl(38,95%,55%)]">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[hsl(38,95%,55%)]/20 flex items-center justify-center text-xs font-bold text-[hsl(38,95%,55%)]">
                    2
                  </div>
                  <div className="flex-1 flex items-start gap-2">
                    <Clock className="h-4 w-4 text-[hsl(38,95%,55%)] mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">Strike 2:</span> Temporary timeout (1 hour)
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 rounded-lg bg-red-500/5 border-l-2 border-[hsl(0,85%,60%)]">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[hsl(0,85%,60%)]/20 flex items-center justify-center text-xs font-bold text-[hsl(0,85%,60%)]">
                    3
                  </div>
                  <div className="flex-1 flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-[hsl(0,85%,60%)] mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-foreground">
                      <span className="font-semibold text-[hsl(0,85%,60%)]">Strike 3:</span>{" "}
                      <span className="text-[hsl(0,85%,60%)]">Permanent ban</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4 border-t border-border">
          <button
            onClick={handleDismiss}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            data-testid="button-dismiss-guidelines"
          >
            Dismiss
          </button>
          <Button
            onClick={handleAccept}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            data-testid="button-accept-guidelines"
          >
            I Understand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
