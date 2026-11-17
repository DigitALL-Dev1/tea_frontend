/**
 * Demo role switcher state. No real login: the chosen demo user is remembered in
 * localStorage and passed to the mock services. The backend will replace this with auth.
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
import type { DemoUser, UserRole } from "@/types";

const STORAGE_KEY = "tea.demoUserId";

interface RoleContextValue {
  user: DemoUser;
  setUserId: (id: string) => void;
  is: (role: UserRole) => boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<DemoUser>(() => getCurrentUser());

  useEffect(() => {
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
    () => ({ user, setUserId, is: (role) => user.role === role }),
    [user, setUserId],
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
