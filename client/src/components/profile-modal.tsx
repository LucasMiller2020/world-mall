import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { X, Edit2, Save, User, Calendar, MessageCircle, Star } from "lucide-react";
import { useWorldId } from "@/hooks/use-world-id";
import { useAuthRole } from "@/hooks/use-auth-role";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface ProfileModalProps {
  handle: string;
  onClose: () => void;
}

const profileUpdateSchema = z.object({
  avatarUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  mbti: z.string().optional(),
  zodiac: z.string().optional(),
  age: z.number().min(18).max(100).optional().or(z.nan()),
});

type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;

const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP'
];

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer',
  'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

export function ProfileModal({ handle, onClose }: ProfileModalProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const { humanId, isVerified } = useWorldId();
  const { role } = useAuthRole();
  const { toast } = useToast();

  // Fetch current user data to check if this is their profile
  const { data: currentUser } = useQuery({
    queryKey: ['/api/me'],
    staleTime: 5 * 60 * 1000,
  });

  // Fetch profile data by handle
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['/api/profile', handle],
    queryFn: async () => {
      const res = await fetch(`/api/profile/${handle}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Profile not found');
        }
        throw new Error('Failed to fetch profile');
      }
      return res.json();
    },
    retry: false,
  });

  const isOwnProfile = currentUser?.humanId && profile?.handle === currentUser?.handle;

  // Form for editing profile
  const form = useForm<ProfileUpdateData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      avatarUrl: profile?.avatarUrl || "",
      mbti: profile?.mbti || undefined,
      zodiac: profile?.zodiac || undefined,
      age: profile?.age || undefined,
    },
  });

  // Update form when profile data loads
  useEffect(() => {
    if (profile && isEditMode) {
      form.reset({
        avatarUrl: profile.avatarUrl || "",
        mbti: profile.mbti || undefined,
        zodiac: profile.zodiac || undefined,
        age: profile.age || undefined,
      });
    }
  }, [profile, isEditMode, form]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileUpdateData) => {
      const res = await fetch('/api/me/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          avatarUrl: data.avatarUrl || null,
          mbti: data.mbti || null,
          zodiac: data.zodiac || null,
          age: data.age && !isNaN(data.age) ? data.age : null,
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to update profile');
      }
      
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile', handle] });
      setIsEditMode(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = (data: ProfileUpdateData) => {
    updateProfileMutation.mutate(data);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (isLoading) {
    return (
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50"
        onClick={handleBackdropClick}
        data-testid="profile-modal-backdrop"
      >
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="animate-pulse">
              <div className="w-20 h-20 bg-muted rounded-full mx-auto mb-4"></div>
              <div className="h-6 bg-muted rounded mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50"
        onClick={handleBackdropClick}
        data-testid="profile-modal-backdrop"
      >
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                {error?.message || 'Profile not found'}
              </p>
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50"
      onClick={handleBackdropClick}
      data-testid="profile-modal-backdrop"
    >
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardContent className="pt-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-xl font-semibold">User Profile</h2>
            <div className="flex gap-2">
              {isOwnProfile && role === 'verified' && !isEditMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditMode(true)}
                  data-testid="button-edit-profile"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                data-testid="button-close-profile"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isEditMode ? (
            // Edit Mode
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                {/* Avatar Preview */}
                <div className="flex justify-center mb-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={form.watch("avatarUrl")} alt={profile.handle} />
                    <AvatarFallback>
                      <User className="h-10 w-10 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Avatar URL */}
                <FormField
                  control={form.control}
                  name="avatarUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Avatar URL</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="https://example.com/avatar.jpg"
                          data-testid="input-avatar-url"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* MBTI */}
                <FormField
                  control={form.control}
                  name="mbti"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MBTI Type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-mbti">
                            <SelectValue placeholder="Select MBTI type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MBTI_TYPES.map(type => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Zodiac */}
                <FormField
                  control={form.control}
                  name="zodiac"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zodiac Sign</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-zodiac">
                            <SelectValue placeholder="Select zodiac sign" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ZODIAC_SIGNS.map(sign => (
                            <SelectItem key={sign} value={sign}>
                              {sign}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Age */}
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Age</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={18}
                          max={100}
                          placeholder="Enter your age"
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          data-testid="input-age"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="flex-1"
                    data-testid="button-save-profile"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditMode(false)}
                    className="flex-1"
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            // View Mode
            <div className="space-y-4">
              {/* Avatar and Handle */}
              <div className="text-center">
                <Avatar className="w-20 h-20 mx-auto mb-3">
                  <AvatarImage src={profile.avatarUrl} alt={profile.handle} />
                  <AvatarFallback>
                    <User className="h-10 w-10 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-lg font-semibold" data-testid="text-profile-handle">
                  @{profile.handle}
                </h3>
                {profile.role === 'verified' && (
                  <Badge variant="secondary" className="mt-1">
                    Verified
                  </Badge>
                )}
              </div>

              {/* Profile Info */}
              <div className="space-y-3 border-t pt-4">
                {profile.mbti && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">MBTI</span>
                    <span className="text-sm font-medium" data-testid="text-profile-mbti">
                      {profile.mbti}
                    </span>
                  </div>
                )}
                
                {profile.zodiac && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Zodiac</span>
                    <span className="text-sm font-medium" data-testid="text-profile-zodiac">
                      {profile.zodiac}
                    </span>
                  </div>
                )}
                
                {profile.age && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Age</span>
                    <span className="text-sm font-medium" data-testid="text-profile-age">
                      {profile.age}
                    </span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Joined
                  </span>
                  <span className="text-sm" data-testid="text-profile-joined">
                    {profile.joinedAt ? format(new Date(profile.joinedAt), 'MMM d, yyyy') : 'Unknown'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    Messages
                  </span>
                  <span className="text-sm font-medium" data-testid="text-profile-messages">
                    {profile.messageCount || 0}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    Stars Received
                  </span>
                  <span className="text-sm font-medium text-yellow-600" data-testid="text-profile-stars">
                    {profile.starCount || 0}
                  </span>
                </div>
              </div>

              {/* Close Button */}
              <Button
                variant="secondary"
                onClick={onClose}
                className="w-full"
                data-testid="button-close"
              >
                Close
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}