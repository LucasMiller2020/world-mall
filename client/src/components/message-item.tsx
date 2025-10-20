import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MoreHorizontal, Flag, VolumeX, Ban, Pencil, Check, X, Trash2, EyeOff, ArrowUp, ArrowDown, Smile } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MessageWithAuthor } from "@shared/schema";

interface MessageItemProps {
  message: MessageWithAuthor;
  index?: number;
  isPreview?: boolean;
  currentUserHumanId?: string | null;
  showVoting?: boolean;
  onProfileClick: () => void;
  onStarClick: () => void;
  onReportClick: () => void;
  onMuteClick: () => void;
  onEditMessage?: (messageId: string, newText: string) => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onVote?: (messageId: string, voteType: number) => Promise<void>;
  onReact?: (messageId: string, reactionType: string, action: 'add' | 'remove') => Promise<void>;
}

export function MessageItem({
  message,
  index,
  isPreview = false,
  currentUserHumanId,
  showVoting = true,
  onProfileClick,
  onStarClick,
  onReportClick,
  onMuteClick,
  onEditMessage,
  onDeleteMessage,
  onVote,
  onReact,
}: MessageItemProps) {
  // Initialize vote state from message userVote property
  const [userVoteType, setUserVoteType] = useState<number | null>(message.userVote || null);
  const [netScore, setNetScore] = useState((message.upvotes || 0) - (message.downvotes || 0));
  const [starred, setStarred] = useState(message.isStarredByUser || false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [emojiPopoverOpen, setEmojiPopoverOpen] = useState(false);
  
  // Track user reactions for this message
  const [messageReactions, setMessageReactions] = useState(message.reactions || {});
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(message.text);
  const [isSaving, setIsSaving] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [timeRemainingDelete, setTimeRemainingDelete] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

  // Calculate time remaining for delete window (60 seconds)
  useEffect(() => {
    if (isPreview) return;

    const updateTimeRemainingDelete = () => {
      const now = new Date();
      const messageTime = new Date(message.createdAt);
      const elapsed = now.getTime() - messageTime.getTime();
      const sixtySeconds = 60 * 1000;
      const remaining = sixtySeconds - elapsed;

      if (remaining > 0) {
        setTimeRemainingDelete(remaining);
      } else {
        setTimeRemainingDelete(null);
      }
    };

    // Initial calculation
    updateTimeRemainingDelete();

    // Update every second
    const interval = setInterval(updateTimeRemainingDelete, 1000);

    return () => clearInterval(interval);
  }, [message.createdAt, isPreview]);

  // Check if current user can edit this message
  const canEdit = !isPreview && 
                  currentUserHumanId && 
                  message.authorHumanId === currentUserHumanId &&
                  timeRemaining !== null &&
                  timeRemaining > 0;

  // Check if current user can delete this message (60 second window)
  const canDelete = !isPreview && 
                    currentUserHumanId && 
                    message.authorHumanId === currentUserHumanId &&
                    timeRemainingDelete !== null &&
                    timeRemainingDelete > 0;

  const handleUpvote = async () => {
    if (!onVote) return;
    
    // Optimistic update
    const newVoteType = userVoteType === 1 ? null : 1;
    const prevVoteType = userVoteType;
    
    // Update local state optimistically
    setUserVoteType(newVoteType);
    
    // Update net score optimistically
    let scoreDelta = 0;
    if (prevVoteType === 1) {
      // Removing upvote
      scoreDelta = -1;
    } else if (prevVoteType === -1) {
      // Changing from downvote to upvote
      scoreDelta = 2;
    } else {
      // Adding upvote
      scoreDelta = 1;
    }
    setNetScore(prev => prev + scoreDelta);
    
    try {
      await onVote(message.id, newVoteType === null ? 0 : newVoteType);
    } catch (error) {
      // Revert on error
      setUserVoteType(prevVoteType);
      setNetScore(prev => prev - scoreDelta);
      toast({
        title: "Error",
        description: "Failed to update vote",
        variant: "destructive",
      });
    }
  };

  const handleDownvote = async () => {
    if (!onVote) return;
    
    // Optimistic update
    const newVoteType = userVoteType === -1 ? null : -1;
    const prevVoteType = userVoteType;
    
    // Update local state optimistically
    setUserVoteType(newVoteType);
    
    // Update net score optimistically
    let scoreDelta = 0;
    if (prevVoteType === -1) {
      // Removing downvote
      scoreDelta = 1;
    } else if (prevVoteType === 1) {
      // Changing from upvote to downvote
      scoreDelta = -2;
    } else {
      // Adding downvote
      scoreDelta = -1;
    }
    setNetScore(prev => prev + scoreDelta);
    
    try {
      await onVote(message.id, newVoteType === null ? 0 : newVoteType);
    } catch (error) {
      // Revert on error
      setUserVoteType(prevVoteType);
      setNetScore(prev => prev - scoreDelta);
      toast({
        title: "Error",
        description: "Failed to update vote",
        variant: "destructive",
      });
    }
  };

  const handleReactionClick = async (reactionType: string) => {
    if (!onReact) return;
    
    // Check if user has already reacted with this emoji
    const hasReacted = messageReactions[reactionType]?.hasReacted || false;
    const action = hasReacted ? 'remove' : 'add';
    
    // Optimistic update
    const newReactions = { ...messageReactions };
    if (!newReactions[reactionType]) {
      newReactions[reactionType] = { count: 0, hasReacted: false };
    }
    
    if (action === 'add') {
      newReactions[reactionType].count++;
      newReactions[reactionType].hasReacted = true;
    } else {
      newReactions[reactionType].count = Math.max(0, newReactions[reactionType].count - 1);
      newReactions[reactionType].hasReacted = false;
    }
    
    setMessageReactions(newReactions);
    
    try {
      await onReact(message.id, reactionType, action);
    } catch (error) {
      // Revert optimistic update on error
      setMessageReactions(messageReactions);
      toast({
        title: "Error",
        description: "Failed to update reaction",
        variant: "destructive",
      });
    }
    
    // Keep popover open for multiple reactions
    // setEmojiPopoverOpen(false);
  };

  const handleCustomEmoji = () => {
    toast({
      title: "Coming soon",
      description: "Custom emoji reactions will be available soon!",
    });
  };

  const muteMutation = useMutation({
    mutationFn: async (mutedHumanId: string) => {
      return apiRequest("POST", "/api/mutes", { mutedHumanId });
    },
    onSuccess: () => {
      toast({
        title: "User muted successfully",
        description: "You won't see messages from this user anymore.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/global"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/work"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mute user",
        variant: "destructive",
      });
    },
  });

  const blockMutation = useMutation({
    mutationFn: async (blockedHumanId: string) => {
      return apiRequest("POST", "/api/blocks", { blockedHumanId });
    },
    onSuccess: () => {
      toast({
        title: "User blocked successfully",
        description: "You and this user won't see each other's messages.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/global"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/work"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to block user",
        variant: "destructive",
      });
    },
  });

  const handleBlock = () => {
    if (message.authorHumanId) {
      blockMutation.mutate(message.authorHumanId);
    }
  };

  const handleMute = () => {
    if (message.authorHumanId) {
      muteMutation.mutate(message.authorHumanId);
    }
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

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!onDeleteMessage) return;

    setIsDeleting(true);
    try {
      await onDeleteMessage(message.id);
      setShowDeleteConfirm(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete message",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
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

  const getUsernameColor = (handle: string) => {
    // Check localStorage first for custom color
    const savedColor = localStorage.getItem('username_color');
    if (savedColor) {
      const colorMap: { [key: string]: string } = {
        'blue': 'text-blue-600',
        'green': 'text-green-600',
        'purple': 'text-purple-600',
        'orange': 'text-orange-600',
        'pink': 'text-pink-600',
        'indigo': 'text-indigo-600',
      };
      // Only apply custom color if this is the current user's message
      if (currentUserHumanId && message.authorHumanId === currentUserHumanId && colorMap[savedColor]) {
        return colorMap[savedColor];
      }
    }
    
    // Fallback to hash-based color for other users
    const colors = [
      'text-blue-600',
      'text-green-600',
      'text-purple-600',
      'text-orange-600',
      'text-pink-600',
      'text-indigo-600',
    ];
    const hash = handle.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Check if this is a hidden message that belongs to the current user
  const isOwnHiddenMessage = message.isHidden && 
                              currentUserHumanId && 
                              message.authorHumanId === currentUserHumanId;

  // Check if this message belongs to the current user
  const isOwnMessage = currentUserHumanId && message.authorHumanId === currentUserHumanId;

  // Determine background color based on index (alternating rows)
  const getBackgroundClass = () => {
    if (isOwnHiddenMessage) {
      return 'opacity-70 bg-muted/30';
    }
    // Apply alternating backgrounds only if index is provided
    if (index !== undefined) {
      // Use solid colors for better visibility in dark mode
      return index % 2 === 0 
        ? 'bg-gray-50 dark:bg-gray-800' 
        : 'bg-white dark:bg-gray-900';
    }
    return '';
  };

  return (
    <>
      <div 
        className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/5 ${isPreview ? 'border-b border-gray-200/50 dark:border-gray-600/30 last:border-0' : 'border-2 border-gray-200 dark:border-gray-700/30'} ${getBackgroundClass()}`}
        data-testid={isOwnHiddenMessage ? 'card-message-hidden' : 'card-message'}
      >
        {/* Avatar - 40px */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getAvatarColor(message.authorHandle)}`}>
          <span className="text-sm font-medium" data-testid="text-message-initials">
            {generateInitials(message.authorHandle)}
          </span>
        </div>

        {/* Content area - flex-1 */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Username + badges */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <button
              onClick={onProfileClick}
              className={`text-sm font-semibold ${getUsernameColor(message.authorHandle)} hover:opacity-80 transition-opacity cursor-pointer`}
              disabled={isPreview}
              data-testid="button-profile-handle"
            >
              {message.authorHandle}
            </button>
            {isOwnHiddenMessage && (
              <Badge variant="destructive" className="text-xs h-5 gap-1" data-testid="badge-message-hidden">
                <EyeOff className="h-3 w-3" />
                Hidden (Reported)
              </Badge>
            )}
          </div>
          
          {/* Row 2: Message text */}
          {isEditing ? (
            <div className="mb-2">
              <Textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                onKeyDown={handleEditKeyDown}
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

          {/* Row 3: Actions on left, timestamp + menu on right */}
          <div className="flex items-start">
            {/* Left side: Upvote, downvote, emoji buttons - aligned under username */}
            <div className="flex items-center -ml-1">
              {!isPreview && (
                <>
                  {/* Voting UI - conditionally rendered based on showVoting prop */}
                  {showVoting && (
                    <>
                      {/* Upvote */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUpvote}
                        className={`h-auto p-1 ${userVoteType === 1 ? 'text-blue-600' : 'text-muted-foreground hover:text-blue-600'}`}
                        data-testid="button-upvote"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>

                      {/* Net Score Display */}
                      <span className={`px-1 text-sm font-medium ${
                        netScore > 0 ? 'text-blue-600' : 
                        netScore < 0 ? 'text-orange-600' : 
                        'text-muted-foreground'
                      }`}>
                        {netScore}
                      </span>

                      {/* Downvote */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDownvote}
                        className={`h-auto p-1 ${userVoteType === -1 ? 'text-orange-600' : 'text-muted-foreground hover:text-orange-600'}`}
                        data-testid="button-downvote"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </>
                  )}

                  {/* Emoji Reaction */}
                  <Popover open={emojiPopoverOpen} onOpenChange={setEmojiPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-1 text-muted-foreground hover:text-foreground"
                        data-testid="button-emoji-reaction"
                      >
                        <Smile className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="start">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReactionClick('like')}
                          className={`h-auto p-1 ${messageReactions.like?.hasReacted ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
                          data-testid="button-emoji-like"
                        >
                          <span className="text-base">👍</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReactionClick('laugh')}
                          className={`h-auto p-1 ${messageReactions.laugh?.hasReacted ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
                          data-testid="button-emoji-laugh"
                        >
                          <span className="text-base">😂</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReactionClick('emphasize')}
                          className={`h-auto p-1 ${messageReactions.emphasize?.hasReacted ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
                          data-testid="button-emoji-emphasize"
                        >
                          <span className="text-base">❗</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReactionClick('heart')}
                          className={`h-auto p-1 ${messageReactions.heart?.hasReacted ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
                          data-testid="button-emoji-heart"
                        >
                          <span className="text-base">❤️</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReactionClick('fire')}
                          className={`h-auto p-1 ${messageReactions.fire?.hasReacted ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
                          data-testid="button-emoji-fire"
                        >
                          <span className="text-base">🔥</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReactionClick('eyes')}
                          className={`h-auto p-1 ${messageReactions.eyes?.hasReacted ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
                          data-testid="button-emoji-eyes"
                        >
                          <span className="text-base">👀</span>
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </div>

            {/* Right side: Timestamp + overflow menu */}
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-xs text-muted-foreground" data-testid="text-message-timestamp">
                {formatTimeAgo(message.createdAt)}
              </span>
              
              {!isPreview && (
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
                    {canDelete && !isEditing && (
                      <>
                        <DropdownMenuItem onClick={handleDeleteClick} data-testid="menuitem-delete">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete ({Math.ceil((timeRemainingDelete || 0) / 1000)}s)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={onReportClick} data-testid="menuitem-report">
                      <Flag className="h-4 w-4 mr-2" />
                      Report
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleMute} 
                      disabled={muteMutation.isPending}
                      data-testid="menuitem-mute"
                    >
                      <VolumeX className="h-4 w-4 mr-2" />
                      {muteMutation.isPending ? "Muting..." : "Mute"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleBlock}
                      disabled={blockMutation.isPending}
                      data-testid="menuitem-block"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      {blockMutation.isPending ? "Blocking..." : "Block user"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          
          {/* Row 4: Display reactions */}
          {!isPreview && (
            <div className="flex items-center gap-1 -ml-1 mt-1">
              {Object.entries(messageReactions || {}).map(([reactionType, reactionData]) => {
                if (!reactionData || reactionData.count === 0) return null;
                
                const emoji = reactionType === 'like' ? '👍' :
                              reactionType === 'laugh' ? '😂' :
                              reactionType === 'emphasize' ? '❗' :
                              reactionType === 'heart' ? '❤️' :
                              reactionType === 'fire' ? '🔥' :
                              reactionType === 'eyes' ? '👀' : '';
                
                return (
                  <Button
                    key={reactionType}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReactionClick(reactionType)}
                    className={`h-auto px-1.5 py-0.5 text-xs ${
                      reactionData.hasReacted 
                        ? 'bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700' 
                        : 'bg-muted border border-border'
                    }`}
                    data-testid={`reaction-${reactionType}`}
                  >
                    <span className="mr-0.5">{emoji}</span>
                    <span>{reactionData.count}</span>
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* AlertDialog for delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete} disabled={isDeleting} data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
