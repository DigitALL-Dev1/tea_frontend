import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileStack,
  FileText,
  Inbox,
  Send,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/tea/app-shell";
import { useNow } from "@/components/tea/deadline";
import { useRole } from "@/components/tea/role-context";
import {
  getDashboard,
  type DashboardData,
  type DashboardDeadline,
  type DashboardProposal,
  type DashboardRequest,
} from "@/services/dashboard";
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

// ---------- helpers ----------

/** SQLite timestamps are UTC without a zone: "2026-11-20 18:16:26". */
function parseDbTime(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function relativeTime(s: string | null, now: Date | null): string {
  const d = parseDbTime(s);
  if (!d || !now) return "";
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function timeLeft(utc: string | null, now: Date | null): { text: string; urgent: boolean } | null {
  if (!utc || !now) return null;
  const ms = new Date(utc).getTime() - now.getTime();
  if (ms <= 0) return { text: "Closed", urgent: false };
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const text = days > 0 ? `${days}d ${hours % 24}h left` : `${hours}h ${Math.floor((ms % 3_600_000) / 60000)}m left`;
  return { text, urgent: days < 7 };
}

const titleOf = (t: { title: string | null; tender_notice_id: string }) =>
  t.title || `UNGM Notice ${t.tender_notice_id}`;

// ---------- building blocks ----------

function Tile({
  label,
  value,
  icon: Icon,
  tone = "primary",
  to,
  hint,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "primary" | "yellow" | "green" | "red";
  to: string;
  hint?: string | undefined;
}) {
  const color = {
    primary: "text-primary bg-primary/10",
    yellow: "text-status-yellow bg-status-yellow/10",
    green: "text-status-green bg-status-green/10",
    red: "text-status-red bg-status-red/10",
  }[tone];
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", color)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="font-display text-2xl font-bold tabular-nums leading-none">{value}</div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{label}</div>
        {hint && <div className="truncate text-[11px] text-muted-foreground/80">{hint}</div>}
      </div>
    </Link>
  );
}

function Panel({
  title,
  to,
  children,
  className,
}: {
  title: string;
  to?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-lg border bg-card", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-display font-bold">{title}</h2>
        {to && (
          <Link to={to} className="text-primary" aria-label={`See all: ${title}`}>
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground">
      <p>{text}</p>
      {action}
    </div>
  );
}

function StatusPill({ status }: { status: DashboardRequest["bid_status"] }) {
  const map = {
    pending: { label: "Pending", icon: Clock, cls: "bg-status-yellow/10 text-status-yellow" },
    approved: { label: "Approved", icon: CheckCircle2, cls: "bg-status-green/10 text-status-green" },
    rejected: { label: "Rejected", icon: XCircle, cls: "bg-status-red/10 text-status-red" },
  }[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", map.cls)}>
      <map.icon className="size-3" /> {map.label}
    </span>
  );
}

function DeadlineBadge({ utc, now }: { utc: string | null; now: Date | null }) {
  const left = timeLeft(utc, now);
  if (!left) return null;
  return (
    <span
      className={cn(
        "shrink-0 text-xs font-medium tabular-nums",
        left.urgent ? "text-status-red" : "text-muted-foreground",
      )}
    >
      {left.text}
    </span>
  );
}

// ---------- lists ----------

function RequestList({ items, now, emptyText }: { items: DashboardRequest[]; now: Date | null; emptyText: string }) {
  if (items.length === 0) return <Empty text={emptyText} />;
  return (
    <ul className="divide-y">
      {items.map((r) => (
        <li key={r.id} className="flex items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{titleOf(r)}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {r.direction === "sent" ? `To ${r.other_user}` : `From ${r.other_user}`} ·{" "}
              {relativeTime(r.bid_status === "pending" ? r.requested_at : r.updated_at, now)}
            </span>
          </span>
          <StatusPill status={r.bid_status} />
        </li>
      ))}
    </ul>
  );
}

function DeadlineList({ items, now }: { items: DashboardDeadline[]; now: Date | null }) {
  if (items.length === 0) return <Empty text="No approved tenders with an upcoming deadline" />;
  return (
    <ul className="divide-y">
      {items.map((t) => (
        <li key={t.id}>
          <Link
            to="/approved-tenders"
            search={{ id: t.id }}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
          >
            <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{titleOf(t)}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[t.agency, t.deadline].filter(Boolean).join(" · ")}
              </span>
            </span>
            <DeadlineBadge utc={t.deadline_utc} now={now} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

const PROPOSAL_LABEL: Record<DashboardProposal["proposal_source"], string> = {
  template: "Outline",
  ai: "AI draft",
  user: "Edited",
};

function ProposalList({ items, now }: { items: DashboardProposal[]; now: Date | null }) {
  if (items.length === 0) {
    return (
      <Empty
        text="No proposals yet. Move an approved tender to AI to start one."
        action={
          <Button asChild size="sm" variant="outline">
            <Link to="/approved-tenders">Approved tenders</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ul className="divide-y">
      {items.map((p) => (
        <li key={p.id}>
          <Link
            to="/ai-tenders/$aiTenderId"
            params={{ aiTenderId: String(p.id) }}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
          >
            <FileText className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{titleOf(p)}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {PROPOSAL_LABEL[p.proposal_source]}
                {p.proposal_updated_at && ` · saved ${relativeTime(p.proposal_updated_at, now)}`}
              </span>
            </span>
            <DeadlineBadge utc={p.deadline_utc} now={now} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---------- role views ----------

function KowsalyaDashboard({ data, now }: { data: DashboardData; now: Date | null }) {
  const c = data.counts;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Awaiting Bernard" value={c.sent_pending} icon={Send} tone="yellow" to="/tenders" />
        <Tile
          label="Approved tenders"
          value={c.approved_tenders}
          icon={BadgeCheck}
          tone="green"
          to="/approved-tenders"
          hint={`${c.approved_open} still open`}
        />
        <Tile label="In AI processing" value={c.ai_total} icon={Sparkles} to="/ai-tenders" />
        <Tile
          label="Proposals edited"
          value={c.ai_proposals_edited}
          icon={FileText}
          to="/ai-tenders"
          hint={c.sent_rejected ? `${c.sent_rejected} request(s) rejected` : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Panel title="Upcoming deadlines" to="/approved-tenders">
          <DeadlineList items={data.upcoming_deadlines} now={now} />
        </Panel>
        <Panel title="Proposals" to="/ai-tenders">
          <ProposalList items={data.proposals} now={now} />
        </Panel>
        <Panel title="My bid requests" to="/tenders" className="lg:col-span-2">
          <RequestList
            items={data.recent_requests}
            now={now}
            emptyText="No bid requests yet. Find a tender and send it to Bernard."
          />
        </Panel>
      </div>
    </>
  );
}

function BernardDashboard({ data, now }: { data: DashboardData; now: Date | null }) {
  const c = data.counts;
  const pending = data.recent_requests.filter((r) => r.direction === "received" && r.bid_status === "pending");
  const decided = data.recent_requests.filter((r) => r.direction === "received" && r.bid_status !== "pending");
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="To review" value={c.to_review} icon={Inbox} tone={c.to_review ? "red" : "primary"} to="/approvals" />
        <Tile label="Approved by me" value={c.approved_by_me} icon={CheckCircle2} tone="green" to="/approvals" />
        <Tile label="Rejected by me" value={c.rejected_by_me} icon={XCircle} to="/approvals" />
        <Tile label="Open approved tenders" value={c.approved_open} icon={CalendarClock} to="/tenders" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Panel title="Waiting for your decision" to="/approvals">
          <RequestList items={pending} now={now} emptyText="All clear – nothing waiting for you" />
        </Panel>
        <Panel title="Upcoming deadlines">
          <DeadlineListPlain items={data.upcoming_deadlines} now={now} />
        </Panel>
        <Panel title="Recently decided" to="/approvals" className="lg:col-span-2">
          <RequestList items={decided} now={now} emptyText="No decisions yet" />
        </Panel>
      </div>
    </>
  );
}

/** Deadlines without links (the Approved Tenders module is Kowsalya's). */
function DeadlineListPlain({ items, now }: { items: DashboardDeadline[]; now: Date | null }) {
  if (items.length === 0) return <Empty text="No approved tenders with an upcoming deadline" />;
  return (
    <ul className="divide-y">
      {items.map((t) => (
        <li key={t.id} className="flex items-center gap-3 px-4 py-3">
          <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{titleOf(t)}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {[t.agency, t.deadline].filter(Boolean).join(" · ")}
            </span>
          </span>
          <DeadlineBadge utc={t.deadline_utc} now={now} />
        </li>
      ))}
    </ul>
  );
}

// ---------- page ----------

function Dashboard() {
  const { username } = useRole();
  const now = useNow();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        <PageHeader title="Home" />
        <div className="rounded-lg border border-status-red/30 bg-card p-8 text-center text-sm">
          Could not load the dashboard: {(error as Error | null)?.message ?? "no data"}
        </div>
      </div>
    );
  }

  const name = data.user.full_name || data.user.username;
  const isBernard = (username ?? data.user.username).toLowerCase() === "bernard";

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Hi, ${name.split(" ")[0]}`}
        description={
          isBernard
            ? data.counts.to_review
              ? `${data.counts.to_review} bid request(s) waiting for your decision.`
              : "Nothing waiting for your decision."
            : "Your tenders, approvals and proposals at a glance."
        }
        actions={
          !isBernard && (
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/tenders">
                <FileStack className="size-4" /> Find tenders
              </Link>
            </Button>
          )
        }
      />
      {isBernard ? <BernardDashboard data={data} now={now} /> : <KowsalyaDashboard data={data} now={now} />}
    </div>
  );
}
