import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Flag, VolumeX } from "lucide-react";
import type { MessageWithAuthor } from "@shared/schema";

interface MessageItemProps {
  message: MessageWithAuthor;
  isPreview?: boolean;
  onProfileClick: () => void;
  onStarClick: () => void;
  onReportClick: () => void;
  onMuteClick: () => void;
}

export function MessageItem({
  message,
  isPreview = false,
  onProfileClick,
  onStarClick,
  onReportClick,
  onMuteClick,
}: MessageItemProps) {
  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  const generateInitials = (handle: string) => {
    const parts = handle.split('_');
    return parts.map(part => part[0].toUpperCase()).join('');
  };

  const getAvatarColor = (handle: string) => {
    const colors = [
      'bg-blue-100 text-blue-600',
      'bg-green-100 text-green-600',
      'bg-purple-100 text-purple-600',
      'bg-orange-100 text-orange-600',
      'bg-pink-100 text-pink-600',
      'bg-indigo-100 text-indigo-600',
    ];
    const hash = handle.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <Card className="message-bubble hover:shadow-md transition-all duration-200">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getAvatarColor(message.authorHandle)}`}>
            <span className="text-xs font-medium" data-testid="text-message-initials">
              {generateInitials(message.authorHandle)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={onProfileClick}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                disabled={isPreview}
                data-testid="button-profile-handle"
              >
                {message.authorHandle}
              </button>
              <span className="text-xs text-muted-foreground" data-testid="text-message-timestamp">
                {formatTimeAgo(message.createdAt)}
              </span>
            </div>
            <p className="text-sm text-foreground mb-2" data-testid="text-message-content">
              {message.text}
            </p>
            {!isPreview && (
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onStarClick}
                  className={`h-auto p-1 ${message.isStarredByUser ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'}`}
                  data-testid="button-star-message"
                >
                  <Star className={`h-3 w-3 mr-1 ${message.isStarredByUser ? 'fill-current' : ''}`} />
                  <span className="text-xs" data-testid="text-message-stars">
                    {message.starsCount}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReportClick}
                  className="h-auto p-1 text-muted-foreground hover:text-destructive"
                  data-testid="button-report-message"
                >
                  <Flag className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onMuteClick}
                  className="h-auto p-1 text-muted-foreground hover:text-foreground"
                  data-testid="button-mute-user"
                >
                  <VolumeX className="h-3 w-3" />
                </Button>
              </div>
            )}
            {isPreview && (
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3" />
                  <span data-testid="text-preview-stars">{message.starsCount}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
