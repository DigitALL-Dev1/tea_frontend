import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileStack, CheckSquare, BadgeCheck, Sparkles, Settings, UserCircle2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { getMyBidRequests } from "@/services/bid-requests";
import { ROLE_LABEL, useRole } from "./role-context";
import { getCurrentUser } from "@/services";
import { useQuery } from "@tanstack/react-query";
import { getDemoUsers } from "@/services";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true, hideFor: [] as string[], showFor: null },
  { to: "/tenders", label: "Tenders", icon: FileStack, exact: false, hideFor: [] as string[], showFor: null },
  { to: "/approved-tenders", label: "Approved Tenders", icon: BadgeCheck, exact: false, hideFor: [] as string[], showFor: ["kowsalya"] as string[] },
  { to: "/ai-tenders", label: "AI Processing", icon: Sparkles, exact: false, hideFor: [] as string[], showFor: ["kowsalya"] as string[] },
  { to: "/approvals", label: "Approvals", icon: CheckSquare, exact: false, hideFor: ["kowsalya"] as string[], showFor: null },
  { to: "/settings", label: "Settings", icon: Settings, exact: false, hideFor: [] as string[], showFor: null },
] as const;

function useActive() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (to: string, exact: boolean) =>
    exact ? path === to : path === to || path.startsWith(`${to}/`);
}

/** Number of bid requests waiting for the logged-in user's decision (from the backend). */
function ApprovalCount({ className }: { className?: string }) {
  const { isAuthenticated } = useRole();
  const { data } = useQuery({
    // Shares the "bid-requests" prefix, so approving/rejecting refreshes the badge
    queryKey: ["bid-requests", "received"],
    queryFn: () => getMyBidRequests("received"),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });
  const n = data?.filter((r) => r.bid_status === "pending").length ?? 0;
  if (!n) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-status-red px-1.5 text-[11px] font-bold text-white",
        className,
      )}
      aria-label={`${n} waiting`}
    >
      {n}
    </span>
  );
}

function Logo({ dark }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "flex size-9 items-center justify-center rounded-lg font-display text-sm font-extrabold tracking-tight",
          dark
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "bg-primary text-primary-foreground",
        )}
        aria-hidden
      >
        TEA
      </div>
      <div className={cn("leading-tight", !dark && "hidden sm:block")}>
        <div
          className={cn(
            "font-display text-sm font-bold",
            dark ? "text-sidebar-foreground" : "text-foreground",
          )}
        >
          Tender Execution Agent
        </div>
        <div className={cn("text-[11px]", dark ? "text-sidebar-muted" : "text-muted-foreground")}>
          GREEN DigitALL · PNG
        </div>
      </div>
    </div>
  );
}

function RoleSwitcher() {
  const { user, setUserId, isAuthenticated, username, logout: handleLogout } = useRole();
  const { data: users } = useQuery({
    queryKey: ["tea", "demo-users"],
    queryFn: getDemoUsers,
    staleTime: Infinity,
  });
  const list = users ?? [getCurrentUser()];

  // If authenticated with real backend, show username and logout
  if (isAuthenticated && username) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {username.substring(0, 2).toUpperCase()}
          </span>
          <span className="hidden font-medium sm:inline">{username}</span>
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleLogout()}
          className="h-9"
          title="Logout"
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    );
  }

  // Demo mode - show role switcher
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground sm:inline">Acting as</span>
      <Select value={user.id} onValueChange={setUserId}>
        <SelectTrigger
          className="h-10 w-[min(62vw,260px)] bg-background"
          aria-label="Switch demo role"
        >
          <SelectValue>
            <span className="flex items-center gap-2 truncate">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {user.initials}
              </span>
              <span className="truncate text-left">
                <span className="font-medium">{user.name}</span>
                <span className="hidden text-muted-foreground sm:inline">
                  {" "}
                  · {ROLE_LABEL[user.role]}
                </span>
              </span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {list.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              <span className="flex flex-col">
                <span className="font-medium">{u.name}</span>
                <span className="text-xs text-muted-foreground">{ROLE_LABEL[u.role]}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const isActive = useActive();
  const { user, isAuthenticated, username } = useRole();

  // Filter navigation items based on authenticated username
  const visibleNav = NAV.filter(n => {
    const who = isAuthenticated && username ? username.toLowerCase() : null;
    if (n.showFor && (!who || !n.showFor.includes(who))) return false;
    if (who && n.hideFor.includes(who)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <Logo dark />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main">
          {visibleNav.map((n) => {
            const active = isActive(n.to, n.exact);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-foreground"
                    : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <n.icon className="size-4" aria-hidden />
                <span className="flex-1">{n.label}</span>
                {n.to === "/approvals" && <ApprovalCount />}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border px-5 py-4 text-[11px] leading-relaxed text-sidebar-muted">
          <p className="flex items-center gap-1.5 font-medium text-sidebar-foreground">
            <UserCircle2 className="size-3.5" />
            {isAuthenticated && username ? username : user.name}
          </p>
          <p>{isAuthenticated && username ? "Authenticated User" : user.title}</p>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="hidden lg:block" />
          <RoleSwitcher />
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
        style={{ gridTemplateColumns: `repeat(${visibleNav.length}, minmax(0, 1fr))` }}
        aria-label="Main"
      >
        {visibleNav.map((n) => {
          const active = isActive(n.to, n.exact);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <n.icon className="size-5" aria-hidden />
              {n.label}
              {n.to === "/approvals" && <ApprovalCount className="absolute right-[22%] top-1" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
