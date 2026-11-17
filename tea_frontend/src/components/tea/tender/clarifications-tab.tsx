import { useState } from "react";
import {
  AlertOctagon,
  FileWarning,
  HelpCircle,
  MessageSquareReply,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { draftClarificationEmail, recordAmendment } from "@/services";
import { useTeaAction } from "@/hooks/use-tea";
import { formatPngShort } from "@/lib/deadline";
import { cn } from "@/lib/utils";
import type { Tender, TimelineEvent } from "@/types";
import { Pill } from "../badges";
import { useRole } from "../role-context";
import { EmailCard } from "./email-card";
import { isLocked, voidedGates } from "./workflow-actions";
import { useNavigate } from "@tanstack/react-router";

const ICON: Record<TimelineEvent["kind"], typeof HelpCircle> = {
  CLARIFICATION_QUESTION: HelpCircle,
  CLARIFICATION_ANSWER: MessageSquareReply,
  AMENDMENT: FileWarning,
};

export function ClarificationsTab({ tender: t }: { tender: Tender }) {
  const { user } = useRole();
  const navigate = useNavigate();
  const canWork = user.role !== "ADMIN" && !isLocked(t);
  const [question, setQuestion] = useState("");
  const [amendOpen, setAmendOpen] = useState(false);
  const draft = useTeaAction(
    draftClarificationEmail,
    "AI drafted the email. It is pending GC approval.",
  );
  const events = [...t.timeline].sort((a, b) => b.at.localeCompare(a.at));
  const hasVoided = voidedGates(t).length > 0;
  const emails = t.emails.filter((e) => e.kind === "CLARIFICATION");

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <section className="lg:col-span-3" aria-label="Timeline">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display font-bold">Timeline</h2>
          {canWork && (
            <Button size="sm" variant="outline" onClick={() => setAmendOpen(true)}>
              <Plus /> Record amendment (demo)
            </Button>
          )}
        </div>
        {events.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            No clarifications or amendments yet.
          </p>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-border pl-6">
            {events.map((e) => {
              const Icon = ICON[e.kind];
              return (
                <li key={e.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[35px] flex size-7 items-center justify-center rounded-full border-2 bg-background",
                      e.material
                        ? "border-status-red text-status-red"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div
                    className={cn(
                      "rounded-lg border bg-card p-3",
                      e.material && "border-status-red/40",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{e.title}</span>
                      {e.kind === "AMENDMENT" &&
                        (e.material ? (
                          <Pill tone="red">Material</Pill>
                        ) : (
                          <Pill tone="slate">Non-material</Pill>
                        ))}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatPngShort(e.at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{e.detail}</p>
                    {e.material && hasVoided && (
                      <p className="mt-2 flex items-center gap-2 rounded-md bg-status-red-soft px-3 py-2 text-sm font-semibold text-status-red">
                        <AlertOctagon className="size-4" /> Approvals voided, re-approval needed
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="space-y-3 lg:col-span-2" aria-label="Clarification emails">
        <h2 className="font-display font-bold">Clarification emails</h2>
        {canWork && (
          <div className="space-y-2 rounded-lg border bg-card p-3">
            <Label htmlFor="q">Ask the agency a question</Label>
            <Textarea
              id="q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="What is unclear in the tender documents?"
            />
            <Button
              size="sm"
              disabled={!question.trim() || draft.pending}
              onClick={async () => {
                if (await draft.run(t.id, question)) setQuestion("");
              }}
            >
              <Sparkles /> AI: draft the email
            </Button>
          </div>
        )}
        {emails.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clarification emails.</p>
        ) : (
          emails.map((e) => (
            <EmailCard
              key={e.id}
              tender={t}
              email={e}
              onDecide={() =>
                void navigate({ to: "/approvals", search: { item: `${t.id}:GC:${e.id}` } })
              }
            />
          ))
        )}
      </section>
      {amendOpen && <AmendmentDialog tender={t} onClose={() => setAmendOpen(false)} />}
    </div>
  );
}

function AmendmentDialog({ tender: t, onClose }: { tender: Tender; onClose: () => void }) {
  const n = t.timeline.filter((e) => e.kind === "AMENDMENT").length + 1;
  const [title, setTitle] = useState(`Amendment No.${n}`);
  const [detail, setDetail] = useState("");
  const [material, setMaterial] = useState(true);
  const [deadline, setDeadline] = useState("");
  const action = useTeaAction(recordAmendment, (r) =>
    material ? `${title} recorded. Affected approvals were voided.` : `${title} recorded.`,
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record an amendment</DialogTitle>
          <DialogDescription>Demo only. Material amendments void approvals.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="am-title">Title</Label>
            <Input id="am-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="am-detail">What changed</Label>
            <Textarea
              id="am-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="am-deadline">New deadline (optional, notice format)</Label>
            <Input
              id="am-deadline"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              placeholder="e.g. 25-Nov-2026 16:00 (GMT 2.00)"
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>
              <span className="font-medium">Material amendment</span>
              <span className="block text-xs text-muted-foreground">
                Changes scope or documents; approvals tied to the old version are voided.
              </span>
            </span>
            <Switch checked={material} onCheckedChange={setMaterial} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || action.pending}
            onClick={async () => {
              const r = await action.run(t.id, {
                title,
                detail,
                material,
                ...(deadline.trim() ? { newDeadlineNotice: deadline.trim() } : {}),
              });
              if (r) onClose();
            }}
          >
            Record amendment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
