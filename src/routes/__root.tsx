import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { RoleProvider } from "@/components/tea/role-context";
import { AppShell } from "@/components/tea/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCurrentUserInfo, isAuthenticated } from "@/services/auth";
import { Loader2 } from "lucide-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Replace these placeholders with the app's name and description when first building the app.
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TEA | GREEN DigitALL" },
      { name: "description", content: "Tender execution workspace for GREEN DigitALL." },
      { name: "author", content: "GREEN DigitALL" },
      { name: "theme-color", content: "#1f5a3a" },
      { property: "og:title", content: "TEA | GREEN DigitALL" },
      { property: "og:description", content: "Tender execution workspace for GREEN DigitALL." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Manrope:wght@600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      // No favicon. "data:," stops the browser from requesting /favicon.ico on its own.
      { rel: "icon", href: "data:," },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <RoleProvider>
        <TooltipProvider delayDuration={200}>
          <AuthenticatedShell />
          <Toaster position="top-center" richColors closeButton />
        </TooltipProvider>
      </RoleProvider>
    </QueryClientProvider>
  );
}

/**
 * Login gate: every page except /login needs a valid session.
 * The token is confirmed with the backend before any module is shown.
 */
function AuthenticatedShell() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  const [status, setStatus] = useState<"checking" | "in" | "out">("checking");

  // Verify the stored token once per page load
  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated()) {
      setStatus("out");
      return;
    }
    getCurrentUserInfo()
      .then((user) => !cancelled && setStatus(user ? "in" : "out"))
      .catch(() => !cancelled && setStatus("out"));
    return () => {
      cancelled = true;
    };
  }, []);

  // Send logged-out users to /login, and logged-in users away from it
  useEffect(() => {
    if (status === "checking") return;
    const onLogin = pathname === "/login";
    if (status === "out" && !onLogin) void navigate({ to: "/login", replace: true });
    if (status === "in" && onLogin) void navigate({ to: "/", replace: true });
  }, [status, pathname, navigate]);

  const onLogin = pathname === "/login";
  if (status === "out") return onLogin ? <Outlet /> : <FullPageLoader />;
  if (status === "in" && !onLogin) {
    return (
      <AppShell>
        <Outlet />
      </AppShell>
    );
  }
  return <FullPageLoader />;
}

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background" role="status">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
