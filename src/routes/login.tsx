import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, isAuthenticated } from "@/services/auth";
import { toast } from "sonner";
import { LogIn } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login | TEA – GREEN DigitALL" },
      { name: "description", content: "Login to Tender Execution Agent" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      void navigate({ to: "/" });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error("Please enter username and password");
      return;
    }

    setIsLoading(true);
    try {
      const user = await login(username, password);
      toast.success(`Welcome back, ${user.full_name || user.username}!`);
      
      // Force a page reload to update all context
      window.location.href = "/";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <div className="font-display text-2xl font-extrabold tracking-tight">TEA</div>
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
            Tender Execution Agent
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to continue to your workspace
          </p>
        </div>

        <div className="rounded-lg border bg-card p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>Signing in...</>
              ) : (
                <>
                  <LogIn className="size-4" />
                  Sign in
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 rounded-md bg-muted/50 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Demo credentials:</p>
            <ul className="mt-2 space-y-1">
              <li>• <strong>kowsalya</strong> / kowsalya123</li>
              <li>• <strong>bernard</strong> / bernard123</li>
            </ul>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          GREEN DigitALL · Papua New Guinea
        </p>
      </div>
    </div>
  );
}
