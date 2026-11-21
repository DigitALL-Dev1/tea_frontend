import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ExternalLink, FileText, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/tea/app-shell";
import { useRole } from "@/components/tea/role-context";
import { getAiTenders, type AiStatus } from "@/services/ai-tenders";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai-tenders/")({
  head: () => ({
    meta: [
      { title: "AI processing | TEA – GREEN DigitALL" },
      { name: "description", content: "Approved tenders moved to AI for processing." },
    ],
  }),
  component: AiTendersPage,
});

const STATUS_STYLE: Record<AiStatus, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-status-yellow/10 text-status-yellow" },
  processing: { label: "Processing", className: "bg-primary/10 text-primary" },
  done: { label: "Processed", className: "bg-status-green/10 text-status-green" },
  error: { label: "Failed", className: "bg-status-red/10 text-status-red" },
};

function AiTendersPage() {
  const { username } = useRole();
  const { data, isLoading, error } = useQuery({
    queryKey: ["ai-tenders"],
    queryFn: getAiTenders,
    enabled: username === "kowsalya",
    refetchInterval: 30000,
  });

  if (username !== "kowsalya") {
    return (
      <div>
        <PageHeader title="AI Processing" />
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          This module is available to Kowsalya.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="AI Processing" />
        <div className="rounded-lg border border-status-red/30 bg-card p-8 text-center text-sm">
          Could not load AI tenders: {(error as Error).message}
        </div>
      </div>
    );
  }

  const tenders = data ?? [];

  return (
    <div>
      <PageHeader title="AI Processing" />
      {tenders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-10 text-center">
          <Sparkles className="size-10 text-muted-foreground" />
          <p className="font-semibold">No tenders in AI processing</p>
          <p className="text-sm text-muted-foreground">
            Open an{" "}
            <Link to="/approved-tenders" className="text-primary hover:underline">
              approved tender
            </Link>{" "}
            and click "Move to AI for processing".
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card" aria-label="AI processing tenders">
          {tenders.map((t) => {
            const status = STATUS_STYLE[t.status];
            return (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                <Link
                  to="/ai-tenders/$aiTenderId"
                  params={{ aiTenderId: String(t.id) }}
                  className="flex min-w-0 flex-1 items-center gap-3"
                  title="Open proposal editor"
                >
                <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {t.title || `UNGM Notice ${t.tender_notice_id}`}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {t.agency && <span>{t.agency}</span>}
                    {t.reference && <span className="font-mono">{t.reference}</span>}
                    {t.deadline && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-3" /> {t.deadline}
                      </span>
                    )}
                    {t.moved_at && (
                      <span>
                        Moved {new Date(t.moved_at.replace(" ", "T") + "Z").toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                    status.className,
                  )}
                >
                  {status.label}
                </span>
                </Link>
                {t.url && (
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-primary"
                    aria-label="View on UNGM"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
