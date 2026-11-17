import { useState, type ReactNode } from "react";
import {
  AlertOctagon,
  Bot,
  Loader2,
  Send,
  UserCog,
  Users,
  ArrowRight,
  Trophy,
  Archive,
  Ban,
  Upload,
  Hourglass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  assignOwners,
  closeTender,
  completeAiAnalysis,
  completeAiDrafting,
  recordOutcome,
  recordSubmission,
  startAiAnalysis,
} from "@/services";
import { useTeaAction, useUserNames, useUsers } from "@/hooks/use-tea";
import { useRole } from "../role-context";
import { AiBadge, HashChip } from "../badges";
import {
  GATE_LABEL,
  GATE_ROLE,
  STAGE_GATES,
  blockedReason,
  gateForStage,
  isGateValid,
  isTerminal,
  latestApproval,
  ownersValid,
  stageIndex,
} from "@/lib/workflow";
import { formatPngShort } from "@/lib/deadline";
import type { Tender, UserRole } from "@/types";

const PERSON: Record<UserRole, string> = {
  CEO: "Bernard George",
  SOLUTION_LEAD: "Kowsalya",
  ADMIN: "Zain",
};

export function isLocked(t: Tender): boolean {
  return isTerminal(t.stage) || stageIndex(t.stage) >= stageIndex("SUBMISSION");
}

/** Gates whose latest decision was voided and not yet re-approved. */
export function voidedGates(t: Tender) {
  return STAGE_GATES.map((g) => latestApproval(t, g)).filter((a) => a?.state === "VOIDED");
}

export function VoidedBanner({ tender: t, onReview }: { tender: Tender; onReview?: () => void }) {
  const voided = voidedGates(t);
  if (voided.length === 0 || isTerminal(t.stage)) return null;
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-lg border border-status-red/40 bg-status-red-soft px-4 py-3"
      title={voided[0]?.voidReason}
    >
      <AlertOctagon className="size-5 shrink-0 text-status-red" />
      <p className="flex-1 text-sm font-semibold text-status-red">
        Approvals voided: {voided.map((a) => a!.gate).join(", ")} need re-approval
      </p>
      {onReview && (
        <Button size="sm" variant="outline" className="bg-background" onClick={onReview}>
          View
        </Button>
      )}
    </div>
  );
}

export function OwnerLine({ tender: t }: { tender: Tender }) {
  const { user } = useRole();
  const name = useUserNames();
  const [open, setOpen] = useState(false);
  const canEdit = user.role !== "ADMIN" && !isTerminal(t.stage);
  const missing = !ownersValid(t);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <Users className="size-4 text-muted-foreground" aria-hidden />
      <span className={cn("font-medium", !t.ownerId && "text-status-amber")}>
        {name(t.ownerId)}
      </span>
      <span className="text-muted-foreground">
        Backup:{" "}
        <span
          className={cn("font-medium text-foreground", !t.backupOwnerId && "text-status-amber")}
        >
          {name(t.backupOwnerId)}
        </span>
      </span>
      {canEdit && (
        <Button
          variant={missing ? "default" : "ghost"}
          size="sm"
          className={cn(!missing && "h-7 px-2 text-muted-foreground")}
          onClick={() => setOpen(true)}
        >
          <UserCog /> {missing ? "Assign owners" : "Edit"}
        </Button>
      )}
      <OwnersDialog tender={t} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function OwnersDialog({
  tender: t,
  open,
  onOpenChange,
}: {
  tender: Tender;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: users } = useUsers();
  const [owner, setOwner] = useState(t.ownerId ?? "");
  const [backup, setBackup] = useState(t.backupOwnerId ?? "");
  const action = useTeaAction(assignOwners, "Owners saved");
  const same = owner && owner === backup;
  const people = users?.filter((u) => u.active && u.role !== "ADMIN") ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tender owners</DialogTitle>
          <DialogDescription>Backup must be a different person.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["Owner", owner, setOwner],
              ["Backup owner", backup, setBackup],
            ] as const
          ).map(([label, value, set]) => (
            <div key={label} className="space-y-1.5">
              <Label>{label}</Label>
              <Select value={value} onValueChange={set}>
                <SelectTrigger aria-label={label}>
                  <SelectValue placeholder="Choose a person" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} · {u.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        {same && (
          <p className="text-sm text-status-red">The backup owner must be a different person.</p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!owner || !backup || Boolean(same) || action.pending}
            onClick={async () => {
              if (await action.run(t.id, owner, backup)) onOpenChange(false);
            }}
          >
            Save owners
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActionCard({
  icon,
  title,
  children,
  tone = "default",
}: {
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  tone?: "default" | "ai" | "you";
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center",
        tone === "ai" && "border-status-violet/30 bg-status-violet-soft/50",
        tone === "you" && "border-primary/40 bg-secondary",
        tone === "default" && "bg-card",
      )}
      aria-label="Next step"
    >
      <div className="flex flex-1 items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="text-sm font-semibold">{title}</div>
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </section>
  );
}

/** The next step for this tender, adapted to the current role. */
export function WorkflowActions({
  tender: t,
  onGoToTab,
}: {
  tender: Tender;
  onGoToTab: (tab: string) => void;
}) {
  const { user } = useRole();
  const name = useUserNames();
  const isAdmin = user.role === "ADMIN";
  const start = useTeaAction(startAiAnalysis, "Sent to AI analysis");
  const aiDone = useTeaAction(completeAiAnalysis, "AI analysis finished");
  const drafted = useTeaAction(completeAiDrafting, "Drafts sent to technical review");
  const [closeOpen, setCloseOpen] = useState<null | "WITHDRAWN" | "ARCHIVED">(null);

  const gate = gateForStage(t.stage);
  const footer = !isAdmin && (
    <div className="flex flex-wrap justify-end gap-2">
      {user.role === "CEO" && !isTerminal(t.stage) && t.stage !== "POST_SUBMISSION" && (
        <Button
          variant="ghost"
          size="sm"
          className="text-status-red hover:text-status-red"
          onClick={() => setCloseOpen("WITHDRAWN")}
        >
          <Ban /> Withdraw tender
        </Button>
      )}
      {(isTerminal(t.stage) || (t.stage === "POST_SUBMISSION" && t.post?.outcome !== "PENDING")) &&
        t.stage !== "ARCHIVED" && (
          <Button variant="outline" size="sm" onClick={() => setCloseOpen("ARCHIVED")}>
            <Archive /> Archive
          </Button>
        )}
      {closeOpen && <CloseDialog tender={t} to={closeOpen} onClose={() => setCloseOpen(null)} />}
    </div>
  );

  let card: ReactNode = null;
  if (isAdmin) {
    card = (
      <ActionCard
        icon={<UserCog className="size-5 text-muted-foreground" />}
        title="Read-only (Admin)"
      />
    );
  } else if (t.stage === "DISCOVERED") {
    const ok = ownersValid(t);
    card = (
      <ActionCard
        icon={<Users className="size-5 text-primary" />}
        tone="you"
        title={ok ? "Next: send to AI analysis" : "Next: assign owners"}
      >
        <Button disabled={!ok || start.pending} onClick={() => void start.run(t.id)}>
          <Bot /> Send to AI analysis
        </Button>
      </ActionCard>
    );
  } else if (t.stage === "AI_ANALYSIS") {
    card = (
      <ActionCard
        icon={<Loader2 className="size-5 animate-spin text-status-violet" />}
        tone="ai"
        title={
          <>
            <AiBadge className="mr-1.5 align-middle" /> AI is analysing…
          </>
        }
      >
        <Button variant="outline" disabled={aiDone.pending} onClick={() => void aiDone.run(t.id)}>
          Finish (demo)
        </Button>
      </ActionCard>
    );
  } else if (t.stage === "AI_DRAFTING") {
    card = (
      <ActionCard
        icon={<Bot className="size-5 text-status-violet" />}
        tone="ai"
        title={
          <>
            <AiBadge className="mr-1.5 align-middle" /> AI drafts ready to review
          </>
        }
      >
        <Button
          disabled={drafted.pending}
          onClick={() => void drafted.run(t.id)}
          title={`${user.name} becomes the preparer and cannot do G4`}
        >
          Send to G2 <ArrowRight />
        </Button>
      </ActionCard>
    );
  } else if (gate) {
    const role = GATE_ROLE[gate];
    const mine = role === user.role;
    const blocked = mine ? blockedReason(t, gate, user) : undefined;
    const noPrice = gate === "G3" && !t.costing.priceUsd;
    card = (
      <ActionCard
        icon={
          <Hourglass className={cn("size-5", mine ? "text-primary" : "text-muted-foreground")} />
        }
        tone={mine && !blocked ? "you" : "default"}
        title={
          <>
            {mine && !blocked ? `Your turn: ${GATE_LABEL[gate]}` : `Waiting: ${GATE_LABEL[gate]}`}
            <span className="block font-normal text-muted-foreground">
              {blocked ?? (mine ? (noPrice ? "Set the price first" : null) : PERSON[role])}
            </span>
          </>
        }
      >
        {mine && noPrice && (
          <Button variant="outline" onClick={() => onGoToTab("costing")}>
            Set price
          </Button>
        )}
        {mine && !blocked && (
          <Button onClick={() => onGoToTab("approvals")}>
            Decide <ArrowRight />
          </Button>
        )}
      </ActionCard>
    );
  } else if (t.stage === "SUBMISSION") {
    card = <SubmissionCard tender={t} />;
  } else if (t.stage === "POST_SUBMISSION") {
    card = <OutcomeCard tender={t} />;
  } else if (isTerminal(t.stage)) {
    const last = [...t.approvals].reverse().find((a) => a.state === "REJECTED");
    card = (
      <ActionCard
        icon={<Ban className="size-5 text-muted-foreground" />}
        title={
          <>
            Closed: {t.stage.replace("_", " ").toLowerCase()}
            {last?.reason && (
              <span className="block font-normal text-muted-foreground">
                {name(last.approverId)}: “{last.reason}”
              </span>
            )}
          </>
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {card}
      {footer}
    </div>
  );
}

function SubmissionCard({ tender: t }: { tender: Tender }) {
  const [receipt, setReceipt] = useState("");
  const [file, setFile] = useState("");
  const action = useTeaAction(recordSubmission, "Submission recorded");
  const g5 = latestApproval(t, "G5");
  const valid = isGateValid(t, "G5");
  return (
    <section
      className="rounded-lg border border-status-teal/40 bg-status-teal-soft/50 p-4"
      aria-label="Record submission"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Send className="size-5 text-status-teal" />
        <h2 className="font-display font-bold">Submit on UNGM, then record it</h2>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        G5 {g5?.decidedAt ? formatPngShort(g5.decidedAt) : ""} <HashChip hash={g5?.versionHash} />
        {!valid && <span className="text-status-red">package changed</span>}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="receipt">UNGM receipt number</Label>
          <Input
            id="receipt"
            value={receipt}
            onChange={(e) => setReceipt(e.target.value)}
            placeholder="e.g. UNGM-RCPT-0045821"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shot">Submission screenshot</Label>
          <Input
            id="shot"
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")}
          />
        </div>
        <Button
          disabled={!receipt.trim() || !file || action.pending}
          onClick={() =>
            void action.run(t.id, { receiptNumber: receipt, screenshotFileName: file })
          }
        >
          <Upload /> Record submission
        </Button>
      </div>
    </section>
  );
}

function OutcomeCard({ tender: t }: { tender: Tender }) {
  const name = useUserNames();
  const [lessons, setLessons] = useState("");
  const action = useTeaAction(recordOutcome, "Outcome recorded");
  const s = t.submission;
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4" aria-label="After submission">
      {s && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold text-status-teal">Submitted</span>
          <span>{formatPngShort(s.submittedAt)}</span>
          <span>by {name(s.submittedById)}</span>
          <span>
            Receipt <span className="font-mono">{s.receiptNumber}</span>
          </span>
          <span>Screenshot: {s.screenshotFileName}</span>
          <HashChip hash={s.packageHash} label="package" />
        </div>
      )}
      {t.post?.outcome === "PENDING" ? (
        <div className="space-y-2">
          <Label htmlFor="lessons">Outcome and lessons learned</Label>
          <Textarea
            id="lessons"
            value={lessons}
            onChange={(e) => setLessons(e.target.value)}
            rows={2}
            placeholder="What worked, what to do differently next time…"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={action.pending}
              onClick={() => void action.run(t.id, "AWARDED", lessons)}
            >
              <Trophy /> Awarded
            </Button>
            <Button
              variant="outline"
              disabled={action.pending}
              onClick={() => void action.run(t.id, "NOT_AWARDED", lessons)}
            >
              Not awarded
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-sm">
          <p
            className={cn(
              "font-display text-lg font-bold",
              t.post?.outcome === "AWARDED" ? "text-status-green" : "text-muted-foreground",
            )}
          >
            {t.post?.outcome === "AWARDED" ? "Awarded" : "Not awarded"}
          </p>
          <p className="text-muted-foreground">
            {t.post?.lessonsLearned || "No lessons recorded."}
          </p>
        </div>
      )}
    </section>
  );
}

function CloseDialog({
  tender: t,
  to,
  onClose,
}: {
  tender: Tender;
  to: "WITHDRAWN" | "ARCHIVED";
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const action = useTeaAction(
    closeTender,
    to === "WITHDRAWN" ? "Tender withdrawn" : "Tender archived",
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {to === "WITHDRAWN" ? "Withdraw this tender?" : "Archive this tender?"}
          </DialogTitle>
          <DialogDescription>{t.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="close-reason">
            Reason <span className="text-status-red">*</span>
          </Label>
          <Textarea
            id="close-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={to === "WITHDRAWN" ? "destructive" : "default"}
            disabled={!reason.trim() || action.pending}
            onClick={async () => {
              if (await action.run(t.id, to, reason)) onClose();
            }}
          >
            {to === "WITHDRAWN" ? "Withdraw" : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
