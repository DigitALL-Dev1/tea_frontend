/**
 * React Query hooks over the service layer. Components use these hooks and never import
 * mocks or the store. All keys start with "tea" so one invalidation refreshes everything.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAuditLog,
  getMyApprovals,
  getSettings,
  getSuppliers,
  getTender,
  getTenders,
  getUsers,
  searchUngmTenders,
  type UngmSearchFilters,
} from "@/services";
import { useRole } from "@/components/tea/role-context";

export const teaKeys = {
  all: ["tea"] as const,
  tenders: ["tea", "tenders"] as const,
  tender: (id: string) => ["tea", "tender", id] as const,
  myApprovals: (userId: string) => ["tea", "my-approvals", userId] as const,
  audit: (tenderId?: string) => ["tea", "audit", tenderId ?? "all"] as const,
  settings: ["tea", "settings"] as const,
  users: ["tea", "users"] as const,
  suppliers: ["tea", "suppliers"] as const,
};

export function useTenders() {
  return useQuery({ queryKey: teaKeys.tenders, queryFn: getTenders });
}

export function useTender(id: string) {
  return useQuery({ queryKey: teaKeys.tender(id), queryFn: () => getTender(id) });
}

export function useMyApprovals() {
  const { user } = useRole();
  return useQuery({ queryKey: teaKeys.myApprovals(user.id), queryFn: getMyApprovals });
}

export function useAuditLog(tenderId?: string) {
  return useQuery({
    queryKey: teaKeys.audit(tenderId),
    queryFn: () => getAuditLog(tenderId ? { tenderId } : { limit: 50 }),
  });
}

export function useSettings() {
  return useQuery({ queryKey: teaKeys.settings, queryFn: getSettings });
}

export function useUsers() {
  return useQuery({ queryKey: teaKeys.users, queryFn: getUsers, staleTime: 60_000 });
}

export function useSuppliers() {
  return useQuery({ queryKey: teaKeys.suppliers, queryFn: getSuppliers, staleTime: 60_000 });
}

/**
 * Live UNGM search via the backend. Keyed outside "tea" on purpose: TEA action invalidations
 * must not re-trigger a slow scrape. Pass null to stay idle until the user searches.
 */
export function useUngmTenders(filters: UngmSearchFilters | null) {
  return useQuery({
    queryKey: ["ungm", "tenders", filters] as const,
    queryFn: ({ signal }) => searchUngmTenders(filters!, signal),
    enabled: filters !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** Map of user id → name, for display. */
export function useUserNames(): (id: string | undefined) => string {
  const { data } = useUsers();
  return (id) => {
    if (!id) return "Unassigned";
    if (id === "ai-agent") return "AI agent";
    if (id === "system") return "System";
    return data?.find((u) => u.id === id)?.name ?? "…";
  };
}

/**
 * Wrap a service call: shows a toast, refreshes all TEA queries, and never throws to the caller.
 * Returns the result, or undefined when the service refused the action.
 */
export function useTeaAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  success?: string | ((r: TResult) => string),
) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (args: TArgs) => fn(...args),
    onSuccess: (r) => {
      if (success) toast.success(typeof success === "function" ? success(r) : success);
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: teaKeys.all }),
  });
  return {
    run: (...args: TArgs): Promise<TResult | undefined> =>
      m.mutateAsync(args).catch(() => undefined),
    pending: m.isPending,
  };
}
