import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, UserPlus, Shield, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Join() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [showWorldIdForm, setShowWorldIdForm] = useState(false);
  const [username, setUsername] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBack = () => {
    if (showGuestForm || showWorldIdForm) {
      setShowGuestForm(false);
      setShowWorldIdForm(false);
      setUsername("");
      setUsernameError("");
    } else {
      setLocation('/');
    }
  };

  const validateUsername = (value: string): string | null => {
    if (!value || value.trim().length === 0) {
      return "Username is required";
    }
    if (value.length < 2) {
      return "Username must be at least 2 characters";
    }
    if (value.length > 25) {
      return "Username cannot exceed 25 characters";
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      return "Username can only contain letters, numbers, underscores, and hyphens";
    }
    return null;
  };

  const checkUsernameAvailability = async (value: string) => {
    const error = validateUsername(value);
    if (error) {
      setUsernameError(error);
      return false;
    }

    setIsCheckingUsername(true);
    try {
      const res = await fetch(`/api/username/check?username=${encodeURIComponent(value)}`);
      const data = await res.json();
      
      if (!data.available) {
        setUsernameError(data.reason || "Username is already in use");
        return false;
      }
      
      setUsernameError("");
      return true;
    } catch (error) {
      console.error("Failed to check username:", error);
      setUsernameError("Failed to check username availability");
      return false;
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    const error = validateUsername(value);
    setUsernameError(error || "");
  };

  const handleGuestJoin = async () => {
    if (!await checkUsernameAvailability(username)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to join as guest');
      }

      toast({
        title: "Welcome!",
        description: `You've joined as ${username}`,
      });

      setLocation('/room/global');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Join failed",
        description: error.message || "Failed to join as guest",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWorldIdJoin = () => {
    // TODO: Implement World ID flow
    toast({
      title: "Coming soon!",
      description: "World ID verification will be available soon",
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Orange/Gold Color Bar at Top */}
      <div className="h-1 bg-gradient-to-r from-orange-400 via-amber-500 to-orange-400" style={{ height: '4px' }} />
      
      {/* Header with Back Button */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleBack}
            data-testid="button-go-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {!showGuestForm && !showWorldIdForm ? (
            // Initial choice screen
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-join-title">
                  Join Mall Space
                </h1>
                <p className="text-muted-foreground" data-testid="text-join-subtitle">
                  Choose how you'd like to join the conversation
                </p>
              </div>

              {/* Join as Guest - Primary Option */}
              <Card 
                className="cursor-pointer hover:border-primary transition-colors border-2"
                onClick={() => setShowGuestForm(true)}
                data-testid="card-join-guest"
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-primary/10">
                      <UserPlus className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Join as Guest</CardTitle>
                      <CardDescription>Quick and easy - just pick a username</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>No account required</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Start chatting immediately</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>Username available while you're online</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Login with World ID - Secondary Option */}
              <Card 
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setShowWorldIdForm(true)}
                data-testid="card-join-worldid"
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-muted">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Login with World ID</CardTitle>
                      <CardDescription className="text-sm">Reserve your username permanently</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <p className="text-center text-xs text-muted-foreground mt-6">
                By joining, you agree to our Community Guidelines
              </p>
            </div>
          ) : showGuestForm ? (
            // Guest username form
            <Card data-testid="card-guest-form">
              <CardHeader>
                <CardTitle>Choose Your Username</CardTitle>
                <CardDescription>
                  Pick a username to join the conversation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    onBlur={() => username && checkUsernameAvailability(username)}
                    maxLength={25}
                    disabled={isSubmitting}
                    data-testid="input-username"
                    className={usernameError ? "border-destructive" : ""}
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {username.length}/25 characters
                    </span>
                    {isCheckingUsername && (
                      <span className="text-muted-foreground">Checking...</span>
                    )}
                  </div>
                  {usernameError && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{usernameError}</AlertDescription>
                    </Alert>
                  )}
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    As a guest, your username is only reserved while you're online. 
                    When you leave, others can use it.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={isSubmitting}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleGuestJoin}
                    disabled={isSubmitting || !!usernameError || !username.trim() || isCheckingUsername}
                    className="flex-1"
                    data-testid="button-join-guest"
                  >
                    {isSubmitting ? "Joining..." : "Join Chat"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            // World ID form (placeholder for now)
            <Card data-testid="card-worldid-form">
              <CardHeader>
                <CardTitle>Verify with World ID</CardTitle>
                <CardDescription>
                  Reserve your username permanently
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    World ID verification will be available soon. This will let you reserve your username permanently.
                  </AlertDescription>
                </Alert>

                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="w-full"
                  data-testid="button-back-from-worldid"
                >
                  Back to Options
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Orange/Gold Color Bar at Bottom */}
      <div className="h-1 bg-gradient-to-r from-orange-400 via-amber-500 to-orange-400" style={{ height: '4px' }} />
    </div>
  );
}
