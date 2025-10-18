import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Flag, VolumeX, Ban, Pencil, Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { MessageWithAuthor } from "@shared/schema";

interface MessageItemProps {
  message: MessageWithAuthor;
  isPreview?: boolean;
  currentUserHumanId?: string | null;
  onProfileClick: () => void;
  onStarClick: () => void;
  onReportClick: () => void;
  onMuteClick: () => void;
  onEditMessage?: (messageId: string, newText: string) => Promise<void>;
}

export function MessageItem({
  message,
  isPreview = false,
  currentUserHumanId,
  onProfileClick,
  onStarClick,
  onReportClick,
  onMuteClick,
  onEditMessage,
}: MessageItemProps) {
  const [upvoted, setUpvoted] = useState(false);
  const [downvoted, setDownvoted] = useState(false);
  const [starred, setStarred] = useState(message.isStarredByUser || false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(message.text);
  const [isSaving, setIsSaving] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const { toast } = useToast();

  // Calculate time remaining for edit window
  useEffect(() => {
    if (isPreview) return;

    const updateTimeRemaining = () => {
      const now = new Date();
      const messageTime = new Date(message.createdAt);
      const elapsed = now.getTime() - messageTime.getTime();
      const thirtySeconds = 30 * 1000;
      const remaining = thirtySeconds - elapsed;

      if (remaining > 0) {
        setTimeRemaining(remaining);
      } else {
        setTimeRemaining(null);
      }
    };

    // Initial calculation
    updateTimeRemaining();

    // Update every second
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [message.createdAt, isPreview]);

  // Check if current user can edit this message
  const canEdit = !isPreview && 
                  currentUserHumanId && 
                  message.authorHumanId === currentUserHumanId &&
                  timeRemaining !== null &&
                  timeRemaining > 0;

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

  const handleEditClick = () => {
    setEditedText(message.text);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedText(message.text);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!onEditMessage || !editedText.trim()) return;

    setIsSaving(true);
    try {
      await onEditMessage(message.id, editedText);
      setIsEditing(false);
      toast({
        title: "Message updated",
        description: "Your message has been successfully updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update message",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
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
            {isEditing ? (
              <div className="mb-2">
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="text-sm min-h-[80px] mb-2"
                  maxLength={240}
                  placeholder="Edit your message..."
                  disabled={isSaving}
                  data-testid="textarea-edit-message"
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editedText.trim()}
                    className="h-8"
                    data-testid="button-save-edit"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="h-8"
                    data-testid="button-cancel-edit"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {editedText.length}/240
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground mb-2" data-testid="text-message-content">
                {message.text}
                {message.editedAt && (
                  <span className="text-xs text-muted-foreground ml-2">(edited)</span>
                )}
              </p>
            )}
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
                    {canEdit && !isEditing && (
                      <>
                        <DropdownMenuItem onClick={handleEditClick} data-testid="menuitem-edit">
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit ({Math.ceil((timeRemaining || 0) / 1000)}s)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
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
