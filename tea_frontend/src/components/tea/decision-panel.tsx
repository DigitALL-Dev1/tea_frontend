import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  CornerUpLeft,
  X,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { decideGate, OVERRIDE_REASON_MIN } from "@/services";
import { useSettings, useTeaAction, useUserNames } from "@/hooks/use-tea";
import { GATE_LABEL, costTotal, marginPct } from "@/lib/workflow";
import { usd, pct } from "@/lib/format";
import { deadlineUtc, timeLeft } from "@/lib/deadline";
import type { ApprovalDecision, PendingApproval, Tender } from "@/types";
import { AiBadge, HashChip, RecommendationBadge, ScoreBadge } from "./badges";
import { Countdown, DeadlineTriple } from "./deadline";

const BUTTONS: Record<string, { approve: string; ret: string; reject: string | null }> = {
  SR: { approve: "Confirm summary", ret: "Return to AI", reject: null },
  G1: { approve: "Bid", ret: "Return", reject: "No bid" },
  GC: { approve: "Approve email", ret: "Return", reject: "Reject" },
  default: { approve: "Approve", ret: "Return", reject: "Reject" },
};

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "red" | "green" | "amber" | undefined;
}) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-0.5 font-display text-lg font-bold tabular-nums",
          tone === "red" && "text-status-red",
          tone === "green" && "text-status-green",
          tone === "amber" && "text-status-amber",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** What exactly is being approved, per gate. */
export function GateSummary({
  tender: t,
  pending: p,
}: {
  tender: Tender;
  pending: PendingApproval;
}) {
  const { data: settings } = useSettings();
  const name = useUserNames();
  const marginWarn = settings?.marginWarningPct ?? 25;
  const met = t.requirements.filter((r) => r.status === "MET").length;
  const gaps = t.requirements.filter((r) => r.status === "GAP");
  const unknown = t.requirements.filter((r) => r.status === "UNKNOWN").length;
  const unverified = t.requirements.filter((r) => !r.quoteVerified).length;
  const mandatoryGaps = gaps.filter((r) => r.mandatory).length;
  const cost = costTotal(t.costing);
  const margin = marginPct(t.costing);
  const email = p.subjectId ? t.emails.find((e) => e.id === p.subjectId) : undefined;
  const pkgDocs = t.documents.filter((d) => d.scope === "PACKAGE");

  return (
    <div className="space-y-4">
      {(p.gate === "SR" || p.gate === "G1") && t.ai && (
        <div className="rounded-lg border border-status-violet/25 bg-status-violet-soft/40 p-3">
          <div className="flex items-center gap-3">
            <ScoreBadge score={t.ai.score} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <AiBadge label="AI recommendation" />
                <RecommendationBadge rec={t.ai.recommendation} />
              </div>
              <p className="mt-1 text-sm">{t.ai.summary}</p>
            </div>
          </div>
          <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm">
            {t.ai.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {t.ai.risks.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-semibold text-status-amber">Risks:</span>{" "}
              {t.ai.risks.join(" · ")}
            </p>
          )}
        </div>
      )}

      {p.gate === "SR" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Requirements found" value={t.requirements.length} />
          <Stat label="Quotes to verify" value={unverified} tone={unverified ? "amber" : "green"} />
          <Stat label="Documents" value={t.documents.length} />
        </div>
      )}

      {p.gate === "G1" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Estimated value" value={usd(t.estimatedValueUsd)} />
          <Stat
            label="Days to prepare"
            value={Math.max(0, timeLeft(deadlineUtc(t.deadlineNotice)).days)}
            tone={
              timeLeft(deadlineUtc(t.deadlineNotice)).days < (settings?.minPreparationDays ?? 7)
                ? "red"
                : "green"
            }
          />
          <Stat
            label="Mandatory requirements"
            value={t.requirements.filter((r) => r.mandatory).length}
          />
        </div>
      )}

      {(p.gate === "G2" || p.gate === "G4") && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Met" value={met} tone="green" />
          <Stat label="Gaps" value={gaps.length} tone={gaps.length ? "red" : undefined} />
          <Stat label="Unknown" value={unknown} tone={unknown ? "amber" : undefined} />
          <Stat
            label="Unverified quotes"
            value={unverified}
            tone={unverified ? "amber" : "green"}
          />
        </div>
      )}
      {(p.gate === "G2" || p.gate === "G4") && mandatoryGaps > 0 && (
        <p className="flex items-start gap-2 rounded-md bg-status-red-soft px-3 py-2 text-sm text-status-red">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {mandatoryGaps} mandatory gap{mandatoryGaps > 1 ? "s" : ""}
        </p>
      )}

      {(p.gate === "G3" || p.gate === "G4" || p.gate === "G5") && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Total cost" value={usd(cost)} />
          <Stat label="Price" value={usd(t.costing.priceUsd)} />
          <Stat
            label="Margin"
            value={pct(margin)}
            tone={margin !== undefined && margin < marginWarn ? "red" : "green"}
          />
        </div>
      )}
      {(p.gate === "G3" || p.gate === "G5") && margin !== undefined && margin < marginWarn && (
        <p className="flex items-center gap-2 rounded-md bg-status-amber-soft px-3 py-2 text-sm text-status-amber">
          <AlertTriangle className="size-4 shrink-0" /> Margin below {marginWarn}%
        </p>
      )}

      {(p.gate === "G4" || p.gate === "G5") && (
        <div className="rounded-md border bg-background p-3 text-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">Package contents</span>
            <span className="text-xs text-muted-foreground">
              Prepared by {name(t.preparedById)}
            </span>
          </div>
          <ul className="space-y-1">
            {pkgDocs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="truncate">{d.fileName}</span>
                <HashChip hash={d.sha256} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.gate === "GC" && email && (
        <div className="rounded-md border bg-background text-sm">
          <div className="space-y-0.5 border-b px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              {email.aiDrafted && <AiBadge label="AI drafted" />}
              <span className="text-xs text-muted-foreground">
                {email.kind === "RFQ" ? "Supplier RFQ" : "Clarification"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">To: </span>
              {email.to}
            </div>
            <div className="font-semibold">{email.subject}</div>
          </div>
          <pre className="whitespace-pre-wrap px-3 py-2 font-sans text-sm">{email.body}</pre>
        </div>
      )}
    </div>
  );
}

interface DecisionPanelProps {
  tender: Tender;
  pending: PendingApproval;
  /** Show the tender header (title, deadline). Off when already on the tender page. */
  showTender?: boolean;
  onDone?: () => void;
}

/** Summary card + required reason + big Approve / Return / Reject buttons. */
export function DecisionPanel({
  tender: t,
  pending: p,
  showTender = true,
  onDone,
}: DecisionPanelProps) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const action = useTeaAction(decideGate, (a) => `${a.gate} ${a.state.toLowerCase()}`);
  const labels = BUTTONS[p.gate] ?? BUTTONS["default"]!;
  const reasonMissing = reason.trim().length === 0;
  const isG1 = p.gate === "G1";
  const aiRec = t.ai?.recommendation;

  async function decide(decision: ApprovalDecision) {
    setTouched(true);
    if (reasonMissing) return;
    if (decision === "REJECT" && !confirmReject) {
      setConfirmReject(true);
      return;
    }
    const r = await action.run({
      tenderId: t.id,
      gate: p.gate,
      ...(p.subjectId ? { subjectId: p.subjectId } : {}),
      decision,
      reason,
      expectedHash: p.currentHash,
    });
    if (r) {
      setReason("");
      setTouched(false);
      setConfirmReject(false);
      onDone?.();
    }
  }

  return (
    <div className="space-y-4">
      {showTender && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              {GATE_LABEL[p.gate]}
            </span>
            <Countdown notice={t.deadlineNotice} />
          </div>
          <Link
            to="/tenders/$tenderId"
            params={{ tenderId: t.id }}
            className="block font-display text-lg font-bold leading-snug hover:text-primary"
          >
            {t.title}
          </Link>
          <DeadlineTriple notice={t.deadlineNotice} layout="inline" />
        </div>
      )}

      <div className="rounded-lg border bg-muted/40 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold">Summary</span>
          <HashChip hash={p.currentHash} label="version" />
        </div>
        <GateSummary tender={t} pending={p} />
      </div>

      {p.blockedReason ? (
        <div className="flex items-start gap-2 rounded-lg border border-status-red/30 bg-status-red-soft p-4 text-sm text-status-red">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <div>
            <p>{p.blockedReason}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label
              htmlFor={`reason-${p.gate}-${p.subjectId ?? t.id}`}
              className="text-sm font-semibold"
            >
              Reason <span className="text-status-red">*</span>
            </Label>
            <Textarea
              id={`reason-${p.gate}-${p.subjectId ?? t.id}`}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setConfirmReject(false);
              }}
              rows={3}
              placeholder="Why?"
              className={cn(
                "text-base",
                touched && reasonMissing && "border-status-red focus-visible:ring-status-red",
              )}
              aria-invalid={touched && reasonMissing}
            />
            {touched && reasonMissing && <p className="text-sm text-status-red">Add a reason</p>}
            {isG1 && aiRec && (
              <p className="text-xs text-muted-foreground">
                AI says <strong>{aiRec === "NO_BID" ? "NO BID" : aiRec}</strong>. Overriding needs{" "}
                {OVERRIDE_REASON_MIN}+ characters ({reason.trim().length})
              </p>
            )}
          </div>

          <div
            className={cn(
              "grid gap-2",
              labels.reject ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2",
            )}
          >
            <Button
              size="lg"
              className="h-14 text-base font-semibold"
              onClick={() => void decide("APPROVE")}
              disabled={action.pending}
            >
              <Check className="!size-5" /> {labels.approve}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 border-2 text-base font-semibold"
              onClick={() => void decide("RETURN")}
              disabled={action.pending}
            >
              <CornerUpLeft className="!size-5" /> {labels.ret}
            </Button>
            {labels.reject && (
              <Button
                size="lg"
                variant="outline"
                className={cn(
                  "h-14 border-2 border-status-red/40 text-base font-semibold text-status-red hover:bg-status-red-soft hover:text-status-red",
                  confirmReject &&
                    "bg-status-red text-white hover:bg-status-red/90 hover:text-white",
                )}
                onClick={() => void decide("REJECT")}
                disabled={action.pending}
              >
                <X className="!size-5" />{" "}
                {confirmReject ? `Tap again: ${labels.reject}` : labels.reject}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
