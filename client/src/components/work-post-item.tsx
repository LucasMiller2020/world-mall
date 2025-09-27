import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Flag, Globe, MapPin, ExternalLink } from "lucide-react";
import type { MessageWithAuthor } from "@shared/schema";

interface WorkPostItemProps {
  post: MessageWithAuthor;
  onProfileClick: () => void;
  onStarClick: () => void;
  onReportClick: () => void;
}

export function WorkPostItem({
  post,
  onProfileClick,
  onStarClick,
  onReportClick,
}: WorkPostItemProps) {
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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'help':
        return 'bg-blue-100 text-blue-700';
      case 'advice':
        return 'bg-green-100 text-green-700';
      case 'collab':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'help':
        return 'Help Wanted';
      case 'advice':
        return 'Advice';
      case 'collab':
        return 'Collab';
      default:
        return category;
    }
  };

  return (
    <Card className="message-bubble hover:shadow-md transition-all duration-200">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getAvatarColor(post.authorHandle)}`}>
            <span className="text-xs font-medium" data-testid="text-post-initials">
              {generateInitials(post.authorHandle)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <button
                onClick={onProfileClick}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                data-testid="button-profile-handle"
              >
                {post.authorHandle}
              </button>
              {post.category && (
                <Badge 
                  variant="secondary" 
                  className={`text-xs px-2 py-1 ${getCategoryColor(post.category)}`}
                  data-testid="badge-post-category"
                >
                  {getCategoryLabel(post.category)}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground" data-testid="text-post-timestamp">
                {formatTimeAgo(post.createdAt)}
              </span>
            </div>
            <p className="text-sm text-foreground mb-2" data-testid="text-post-content">
              {post.text}
            </p>
            
            {/* Location and Link */}
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {post.geoScope === 'Global' ? (
                  <Globe className="h-3 w-3" />
                ) : (
                  <MapPin className="h-3 w-3" />
                )}
                <span data-testid="text-post-location">{post.geoScope || 'Global'}</span>
              </div>
              {post.link && (
                <a 
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  data-testid="link-post-external"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Details
                </a>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onStarClick}
                className={`h-auto p-1 ${post.isStarredByUser ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'}`}
                data-testid="button-star-post"
              >
                <Star className={`h-3 w-3 mr-1 ${post.isStarredByUser ? 'fill-current' : ''}`} />
                <span className="text-xs" data-testid="text-post-stars">
                  {post.starsCount}
                </span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onReportClick}
                className="h-auto p-1 text-muted-foreground hover:text-destructive"
                data-testid="button-report-post"
              >
                <Flag className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
