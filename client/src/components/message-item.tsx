import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Flag, VolumeX, Ban } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
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
  const [upvoted, setUpvoted] = useState(false);
  const [downvoted, setDownvoted] = useState(false);
  const [starred, setStarred] = useState(message.isStarredByUser || false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);
  const { toast } = useToast();

  const handleUpvote = () => {
    setUpvoted(!upvoted);
    if (downvoted) setDownvoted(false);
  };

  const handleDownvote = () => {
    setDownvoted(!downvoted);
    if (upvoted) setUpvoted(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    setEmojiPopoverOpen(false);
  };

  const handleCustomEmoji = () => {
    toast({
      title: "Coming soon",
      description: "Custom emoji reactions will be available soon!",
    });
  };

  const handleBlock = () => {
    toast({
      title: "Coming soon", 
      description: "User blocking will be available soon!",
    });
  };

  const handleMute = () => {
    toast({
      title: "Coming soon",
      description: "User muting will be available soon!",
    });
  };
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
              <div className="flex items-center justify-between mt-2">
                {/* New compact controls row */}
                <div className="flex items-center gap-1">
                  {/* Upvote */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUpvote}
                    className={`h-auto p-1 ${upvoted ? 'text-green-600' : 'text-muted-foreground hover:text-green-600'}`}
                    data-testid="button-upvote"
                  >
                    <span className="text-base">⬆️</span>
                  </Button>

                  {/* Downvote */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownvote}
                    className={`h-auto p-1 ${downvoted ? 'text-red-600' : 'text-muted-foreground hover:text-red-600'}`}
                    data-testid="button-downvote"
                  >
                    <span className="text-base">⬇️</span>
                  </Button>

                  {/* Star */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStarred(!starred);
                      onStarClick();
                    }}
                    className={`h-auto p-1 ${starred ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'}`}
                    data-testid="button-star"
                  >
                    <span className="text-base">⭐</span>
                  </Button>

                  {/* Emoji Launcher */}
                  <Popover open={emojiPopoverOpen} onOpenChange={setEmojiPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-1 text-muted-foreground hover:text-foreground"
                        data-testid="button-emoji-launcher"
                      >
                        {selectedEmoji || '🙂'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="start">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEmojiSelect('👍')}
                          className="h-auto p-1"
                          data-testid="button-emoji-thumbs-up"
                        >
                          <span className="text-base">👍</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEmojiSelect('❤️')}
                          className="h-auto p-1"
                          data-testid="button-emoji-heart"
                        >
                          <span className="text-base">❤️</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEmojiSelect('😂')}
                          className="h-auto p-1"
                          data-testid="button-emoji-laugh"
                        >
                          <span className="text-base">😂</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEmojiSelect('🔥')}
                          className="h-auto p-1"
                          data-testid="button-emoji-fire"
                        >
                          <span className="text-base">🔥</span>
                        </Button>
                        <div className="border-l pl-1 ml-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCustomEmoji}
                                disabled
                                className="h-auto p-1 text-xs"
                                data-testid="button-custom-emoji"
                              >
                                + custom
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Coming soon</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Overflow Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1 text-muted-foreground hover:text-foreground"
                      data-testid="button-overflow-menu"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onReportClick}>
                      <Flag className="h-4 w-4 mr-2" />
                      Report
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleMute}>
                      <VolumeX className="h-4 w-4 mr-2" />
                      Mute
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleBlock}>
                      <Ban className="h-4 w-4 mr-2" />
                      Block user
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            {isPreview && (
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="text-base">⭐</span>
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
