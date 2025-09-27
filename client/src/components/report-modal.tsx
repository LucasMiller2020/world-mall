import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Flag } from "lucide-react";

interface ReportModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ReportModal({ onConfirm, onCancel, isLoading = false }: ReportModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50"
      onClick={handleBackdropClick}
      data-testid="report-modal-backdrop"
    >
      <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Flag className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2" data-testid="text-report-title">
              Report Message
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="text-report-description">
              Help us keep this space safe and healthy
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={onConfirm}
              disabled={isLoading}
              variant="destructive"
              className="w-full"
              data-testid="button-confirm-report"
            >
              {isLoading ? 'Submitting...' : 'Submit Report'}
            </Button>
            <Button 
              onClick={onCancel}
              variant="secondary"
              className="w-full"
              data-testid="button-cancel-report"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
