/**
 * Authentication and role context with real backend authentication.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentUser, switchDemoUser } from "@/services";
import { getStoredAuth, logout as apiLogout, getCurrentUserInfo } from "@/services/auth";
import type { DemoUser, UserRole } from "@/types";

const STORAGE_KEY = "tea.demoUserId";

interface RoleContextValue {
  user: DemoUser;
  setUserId: (id: string) => void;
  is: (role: UserRole) => boolean;
  isAuthenticated: boolean;
  username: string | null;
  logout: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<DemoUser>(() => getCurrentUser());
  const [authUsername, setAuthUsername] = useState<string | null>(null);

  useEffect(() => {
    // Check for real authentication first
    const auth = getStoredAuth();
    if (auth) {
      setAuthUsername(auth.username);
      // Verify token is still valid
      getCurrentUserInfo().then((userInfo) => {
        if (!userInfo) {
          // Token expired or invalid
          setAuthUsername(null);
          // Redirect to login will be handled by the router
        }
      }).catch(() => {
        setAuthUsername(null);
      });
      return;
    }

    // Fall back to demo mode if no auth
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored && stored !== user.id) {
      switchDemoUser(stored, { silent: true })
        .then((u) => {
          setUser(u);
          void qc.invalidateQueries({ queryKey: ["tea"] });
        })
        .catch(() => undefined);
    }
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setAuthUsername(null);
    void qc.invalidateQueries({ queryKey: ["tea"] });
    // Force page reload to clear all state
    window.location.href = "/login";
  }, [qc]);

  const setUserId = useCallback(
    (id: string) => {
      switchDemoUser(id)
        .then((u) => {
          setUser(u);
          try {
            window.localStorage.setItem(STORAGE_KEY, id);
          } catch {
            /* storage unavailable: role still switches for this session */
          }
          void qc.invalidateQueries({ queryKey: ["tea"] });
        })
        .catch(() => undefined);
    },
    [qc],
  );

  const value = useMemo<RoleContextValue>(
    () => ({ 
      user, 
      setUserId, 
      is: (role) => user.role === role,
      isAuthenticated: authUsername !== null,
      username: authUsername,
      logout,
    }),
    [user, setUserId, authUsername, logout],
  );
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  CEO: "CEO",
  SOLUTION_LEAD: "Solution Engineering Lead",
  ADMIN: "Admin",
};
