import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/tea/app-shell";
import { useRole } from "@/components/tea/role-context";
import {
  getApprovedTenders,
  refreshApprovedTender,
  type ApprovedTender,
} from "@/services/approved-tenders";
import { moveToAi } from "@/services/ai-tenders";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/approved-tenders")({
  validateSearch: (s: Record<string, unknown>): { id?: number | undefined } => ({
    id: typeof s["id"] === "number" ? s["id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Approved tenders | TEA – GREEN DigitALL" },
      { name: "description", content: "Tenders approved for bidding, with full UNGM notice details." },
    ],
  }),
  component: ApprovedTendersPage,
});

const QUERY_KEY = ["approved-tenders"];
const AI_QUERY_KEY = ["ai-tenders"];

function ApprovedTendersPage() {
  const { username } = useRole();
  const { id } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getApprovedTenders,
    enabled: username === "kowsalya",
  });

  const select = (next: number | undefined) => void navigate({ search: { id: next } });

  if (username !== "kowsalya") {
    return (
      <div>
        <PageHeader title="Approved Tenders" />
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          This module is available to Kowsalya.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Approved Tenders" />
        <div className="rounded-lg border border-status-red/30 bg-card p-8 text-center text-sm">
          Could not load approved tenders: {(error as Error).message}
        </div>
      </div>
    );
  }

  const tenders = data ?? [];
  const selected = tenders.find((t) => t.id === id);

  return (
    <div>
      <PageHeader title="Approved Tenders" />
      {tenders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-10 text-center">
          <BadgeCheck className="size-10 text-muted-foreground" />
          <p className="font-semibold">No approved tenders yet</p>
          <p className="text-sm text-muted-foreground">
            Tenders appear here once Bernard approves your bid request.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(300px,400px)_1fr]">
          <ul className={cn("space-y-2", selected && "hidden lg:block")} aria-label="Approved tenders">
            {tenders.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => select(t.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40",
                    selected?.id === t.id && "border-primary ring-2 ring-primary/20",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t.agency || "UNGM"} · {t.notice_type || "Notice"}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block font-medium leading-snug">
                      {t.title || `UNGM Notice ${t.tender_notice_id}`}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {t.countries && <span>{t.countries}</span>}
                      {t.deadline && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="size-3" /> {t.deadline}
                        </span>
                      )}
                      <StatusTag tender={t} />
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>

          <section className={cn(!selected && "hidden lg:block")} aria-label="Tender details">
            {selected ? (
              <TenderDetail tender={selected} onBack={() => select(undefined)} />
            ) : (
              <div className="flex h-full min-h-60 items-center justify-center rounded-lg border border-dashed bg-card/50 p-8 text-sm text-muted-foreground">
                Pick a tender to see the full notice
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function StatusTag({ tender }: { tender: ApprovedTender }) {
  if (tender.fetch_status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-status-red">
        <AlertTriangle className="size-3" /> Details not loaded
      </span>
    );
  }
  if (!tender.notice_status) return null;
  const expired = tender.notice_status.toLowerCase() === "expired";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-medium",
        expired ? "bg-muted text-muted-foreground" : "bg-status-green/10 text-status-green",
      )}
    >
      {tender.notice_status}
    </span>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-sm font-medium", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

function TenderDetail({ tender: t, onBack }: { tender: ApprovedTender; onBack: () => void }) {
  const qc = useQueryClient();
  const refresh = useMutation({
    mutationFn: () => refreshApprovedTender(t.id),
    onSuccess: (updated) => {
      if (updated.fetch_status === "ok") toast.success("Tender details updated from UNGM");
      else toast.error("Could not fetch from UNGM", { description: updated.fetch_error ?? undefined });
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error("Refresh failed", { description: e.message }),
  });
  const moveAi = useMutation({
    mutationFn: () => moveToAi(t.id),
    onSuccess: () => {
      toast.success("Moved to AI for processing");
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
      void qc.invalidateQueries({ queryKey: AI_QUERY_KEY });
    },
    onError: (e: Error) => toast.error("Could not move to AI", { description: e.message }),
  });

  return (
    <article className="space-y-5 rounded-lg border bg-card p-4 sm:p-5">
      <Button variant="ghost" size="sm" className="-ml-2 lg:hidden" onClick={onBack}>
        <ArrowLeft /> All approved tenders
      </Button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-secondary px-2 py-0.5 font-semibold text-secondary-foreground">
            {t.agency || "UNGM"}
          </span>
          {t.notice_type && <span className="text-muted-foreground">{t.notice_type}</span>}
          <StatusTag tender={t} />
        </div>
        <h2 className="font-display text-xl font-bold leading-snug">
          {t.title || `UNGM Notice ${t.tender_notice_id}`}
        </h2>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <BadgeCheck className="size-4 text-status-green" />
          Approved by {t.approved_by_full_name || t.approved_by_username}
          {t.approved_at && <> on {new Date(t.approved_at.replace(" ", "T")).toLocaleDateString()}</>}
        </p>
      </header>

      {t.fetch_status === "error" && (
        <div className="rounded-md border border-status-red/30 bg-status-red/5 p-3 text-sm">
          Could not load details from UNGM: {t.fetch_error}
        </div>
      )}

      <dl className="grid gap-4 sm:grid-cols-2">
        <Field label="Reference" value={t.reference} mono />
        <Field label="UNGM notice ID" value={t.tender_notice_id} mono />
        <Field label="Beneficiary countries" value={t.countries} />
        <Field label="Registration level" value={t.registration_level} />
        <Field label="Published" value={t.published} />
        <Field label="Deadline" value={t.deadline} />
      </dl>

      {t.notes && (
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="text-xs font-medium text-muted-foreground">Your note to Bernard</div>
          <div className="mt-1 text-sm">{t.notes}</div>
        </div>
      )}

      {t.description && (
        <section>
          <h3 className="mb-2 font-display font-bold">Description</h3>
          <div className="max-h-[480px] overflow-y-auto whitespace-pre-line rounded-md bg-muted/30 p-4 text-sm leading-relaxed">
            {t.description}
          </div>
        </section>
      )}

      {t.contacts.length > 0 && (
        <section>
          <h3 className="mb-2 font-display font-bold">Contacts</h3>
          <ul className="space-y-2">
            {t.contacts.map((c, i) => (
              <li key={i} className="rounded-md border p-3 text-sm">
                {Object.entries(c).map(([k, v]) => (
                  <div key={k} className="flex flex-wrap gap-1">
                    <span className="text-muted-foreground">{k}:</span>
                    {k.toLowerCase().includes("email") ? (
                      <a href={`mailto:${v}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Mail className="size-3.5" /> {v}
                      </a>
                    ) : (
                      <span className="font-medium">{v}</span>
                    )}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      {t.links.length > 0 && (
        <section>
          <h3 className="mb-2 font-display font-bold">Links</h3>
          <ul className="space-y-1.5">
            {t.links.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-start gap-1.5 text-sm text-primary hover:underline"
                >
                  <Link2 className="mt-0.5 size-3.5 shrink-0" />
                  <span className="break-all">{l.description || l.url}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {t.unspsc_codes.length > 0 && (
        <section>
          <h3 className="mb-2 font-display font-bold">UNSPSC codes</h3>
          <ul className="list-inside list-disc text-sm">
            {t.unspsc_codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex flex-wrap gap-2 border-t pt-4">
        {t.ai_tender_id ? (
          <Button variant="secondary" asChild className="gap-1.5">
            <Link to="/ai-tenders">
              <Sparkles className="size-4" /> In AI processing ({t.ai_status})
            </Link>
          </Button>
        ) : (
          <Button
            className="gap-1.5"
            onClick={() => moveAi.mutate()}
            disabled={moveAi.isPending || t.fetch_status !== "ok"}
            title={t.fetch_status !== "ok" ? "Load tender details from UNGM first" : undefined}
          >
            {moveAi.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Move to AI for processing
          </Button>
        )}
        <Button variant="outline" asChild className="gap-1.5">
          <a href={t.url} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" /> View on UNGM
          </a>
        </Button>
        <Button
          variant="ghost"
          className="gap-1.5"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
        >
          {refresh.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh from UNGM
        </Button>
        {t.fetched_at && (
          <span className="ml-auto self-center text-xs text-muted-foreground">
            Fetched {new Date(t.fetched_at.replace(" ", "T") + "Z").toLocaleString()}
          </span>
        )}
      </footer>
    </article>
  );
}
