import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, CheckSquare, Inbox, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/tea/app-shell";
import { StageBadge } from "@/components/tea/badges";
import { Countdown, useNow } from "@/components/tea/deadline";
import { useRole } from "@/components/tea/role-context";
import { useMyApprovals, useTenders } from "@/hooks/use-tea";
import { deadlineFormats, deadlineUtc, timeLeft } from "@/lib/deadline";
import { GATE_LABEL, isTerminal, stageIndex } from "@/lib/workflow";
import type { Tender } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Home | TEA – GREEN DigitALL" },
      { name: "description", content: "What needs you today." },
    ],
  }),
  component: Dashboard,
});

function isOpen(t: Tender) {
  return !isTerminal(t.stage) && stageIndex(t.stage) < stageIndex("POST_SUBMISSION");
}

function Tile({
  label,
  value,
  icon: Icon,
  red,
  to,
}: {
  label: string;
  value: number;
  icon: typeof Inbox;
  red?: boolean;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <Icon className={cn("size-5", red ? "text-status-red" : "text-primary")} aria-hidden />
      <div>
        <div
          className={cn("font-display text-2xl font-bold tabular-nums", red && "text-status-red")}
        >
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </Link>
  );
}

function Panel({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-display font-bold">{title}</h2>
        <Link to={to} className="text-primary" aria-label={`See all: ${title}`}>
          <ArrowRight className="size-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

function Dashboard() {
  const { user } = useRole();
  const { data: tenders, isLoading } = useTenders();
  const { data: mine } = useMyApprovals();
  const now = useNow();

  if (isLoading || !tenders || !now) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const open = tenders
    .filter(isOpen)
    .sort(
      (a, b) => deadlineUtc(a.deadlineNotice).getTime() - deadlineUtc(b.deadlineNotice).getTime(),
    );
  const soon = open.filter((t) => {
    const l = timeLeft(deadlineUtc(t.deadlineNotice), now);
    return !l.isPast && l.isShort;
  });
  const todo = mine?.filter((p) => !p.blockedReason) ?? [];
  const byId = new Map(tenders.map((t) => [t.id, t]));
  const due = (id: string) => {
    const t = byId.get(id);
    return t ? deadlineUtc(t.deadlineNotice).getTime() : 0;
  };
  const decisions = [...(mine ?? [])].sort((a, b) => due(a.tenderId) - due(b.tenderId));

  return (
    <div className="space-y-5">
      <PageHeader title={`Hi, ${user.name.split(" ")[0]}`} />

      <div className="grid grid-cols-3 gap-3">
        <Tile label="Need me" value={todo.length} icon={CheckSquare} to="/approvals" />
        <Tile
          label="Closing ≤ 7d"
          value={soon.length}
          icon={CalendarClock}
          red={soon.length > 0}
          to="/tenders"
        />
        <Tile label="Open" value={open.length} icon={Inbox} to="/tenders" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        {user.role !== "ADMIN" && (
          <Panel title="Needs your decision" to="/approvals">
            {decisions.length === 0 ? (
              <Empty text="All clear" />
            ) : (
              <ul className="divide-y">
                {decisions.map((p) => {
                  const t = byId.get(p.tenderId);
                  if (!t) return null;
                  const email = p.subjectId
                    ? t.emails.find((e) => e.id === p.subjectId)
                    : undefined;
                  return (
                    <li key={`${p.tenderId}-${p.gate}-${p.subjectId ?? ""}`}>
                      <Link
                        to="/approvals"
                        search={{ item: `${p.tenderId}:${p.gate}:${p.subjectId ?? ""}` }}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {email ? email.subject : t.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {GATE_LABEL[p.gate]}
                          </span>
                        </span>
                        {p.blockedReason ? (
                          <Lock className="size-4 text-muted-foreground" aria-label="Blocked" />
                        ) : (
                          <Countdown notice={t.deadlineNotice} compact />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        )}

        <Panel title="Next deadlines" to="/tenders">
          {open.length === 0 ? (
            <Empty text="No open tenders" />
          ) : (
            <ul className="divide-y">
              {open.slice(0, 5).map((t) => {
                const f = deadlineFormats(t.deadlineNotice);
                return (
                  <li key={t.id}>
                    <Link
                      to="/tenders/$tenderId"
                      params={{ tenderId: t.id }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
                      title={`Notice: ${f.notice}\n${f.utc}\n${f.png}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{t.title}</span>
                        <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <StageBadge stage={t.stage} />
                          <span className="truncate">{f.png}</span>
                        </span>
                      </span>
                      <Countdown notice={t.deadlineNotice} compact />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
