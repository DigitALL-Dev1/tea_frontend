import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, ChevronRight, Lock, Mail } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/tea/app-shell";
import { DecisionPanel } from "@/components/tea/decision-panel";
import { Countdown } from "@/components/tea/deadline";
import { useRole } from "@/components/tea/role-context";
import { useMyApprovals, useTenders } from "@/hooks/use-tea";
import { GATE_LABEL } from "@/lib/workflow";
import { deadlineUtc } from "@/lib/deadline";
import { cn } from "@/lib/utils";
import type { PendingApproval } from "@/types";

export const Route = createFileRoute("/approvals")({
  validateSearch: (s: Record<string, unknown>): { item?: string } =>
    typeof s["item"] === "string" ? { item: s["item"] } : {},
  head: () => ({
    meta: [
      { title: "My approvals | TEA – GREEN DigitALL" },
      {
        name: "description",
        content: "Decisions waiting for you: approve, return or reject with a reason.",
      },
    ],
  }),
  component: ApprovalsPage,
});

const keyOf = (p: PendingApproval) => `${p.tenderId}:${p.gate}:${p.subjectId ?? ""}`;

function ApprovalsPage() {
  const { user } = useRole();
  const { item } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: pending, isLoading } = useMyApprovals();
  const { data: tenders } = useTenders();

  const select = (k: string | undefined) =>
    void navigate({ search: k ? { item: k } : {}, replace: false });

  if (user.role === "ADMIN") {
    return (
      <div>
        <PageHeader title="Approvals" />
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Admin has no approvals.
        </div>
      </div>
    );
  }

  if (isLoading || !pending || !tenders) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  const byId = new Map(tenders.map((t) => [t.id, t]));
  const sorted = [...pending].sort((a, b) => {
    if (Boolean(a.blockedReason) !== Boolean(b.blockedReason)) return a.blockedReason ? 1 : -1;
    const ta = byId.get(a.tenderId);
    const tb = byId.get(b.tenderId);
    return (
      (ta ? deadlineUtc(ta.deadlineNotice).getTime() : 0) -
      (tb ? deadlineUtc(tb.deadlineNotice).getTime() : 0)
    );
  });
  const selected = sorted.find((p) => keyOf(p) === item);
  const selectedTender = selected ? byId.get(selected.tenderId) : undefined;

  return (
    <div>
      <div className={cn(selected && "hidden lg:block")}>
        <PageHeader
          title="Approvals"
          description={`${sorted.filter((p) => !p.blockedReason).length} waiting`}
        />
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-10 text-center">
          <CheckCircle2 className="size-10 text-status-green" />
          <p className="font-semibold">All clear</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_1fr]">
          <ul
            className={cn("space-y-2", selected && "hidden lg:block")}
            aria-label="Pending approvals"
          >
            {sorted.map((p) => {
              const t = byId.get(p.tenderId);
              if (!t) return null;
              const email = p.subjectId ? t.emails.find((e) => e.id === p.subjectId) : undefined;
              const active = selected && keyOf(selected) === keyOf(p);
              return (
                <li key={keyOf(p)}>
                  <button
                    type="button"
                    onClick={() => select(keyOf(p))}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40",
                      active && "border-primary ring-2 ring-primary/20",
                      p.blockedReason && "opacity-75",
                    )}
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-secondary font-display text-sm font-extrabold text-secondary-foreground">
                      {p.gate === "GC" ? <Mail className="size-5" /> : p.gate}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {GATE_LABEL[p.gate]}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block font-medium leading-snug">
                        {email ? email.subject : t.title}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {t.agency}
                        {p.blockedReason ? (
                          <span className="inline-flex items-center gap-1 text-status-red">
                            <Lock className="size-3" /> Blocked
                          </span>
                        ) : (
                          <Countdown notice={t.deadlineNotice} />
                        )}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>

          <section className={cn(!selected && "hidden lg:block")} aria-label="Decision">
            {selected && selectedTender ? (
              <div className="rounded-lg border bg-card p-4 sm:p-5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 mb-2 lg:hidden"
                  onClick={() => select(undefined)}
                >
                  <ArrowLeft /> All approvals
                </Button>
                <DecisionPanel
                  key={keyOf(selected)}
                  tender={selectedTender}
                  pending={selected}
                  onDone={() => select(undefined)}
                />
              </div>
            ) : (
              <div className="flex h-full min-h-60 items-center justify-center rounded-lg border border-dashed bg-card/50 p-8 text-sm text-muted-foreground">
                {item ? "Already decided" : "Pick an item"}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
