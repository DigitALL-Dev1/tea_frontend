import { useState } from "react";
import { Mail, Pencil, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { markEmailSent, updateEmailBody } from "@/services";
import { useTeaAction, useUserNames } from "@/hooks/use-tea";
import { formatPngShort } from "@/lib/deadline";
import { latestApproval } from "@/lib/workflow";
import type { DraftEmail, Tender } from "@/types";
import { AiBadge, EmailStatusBadge, HashChip } from "../badges";
import { useRole } from "../role-context";

/** Drafted email. Shows "Pending approval" until the CEO approves GC; a person sends it. */
export function EmailCard({
  tender: t,
  email: e,
  onDecide,
}: {
  tender: Tender;
  email: DraftEmail;
  onDecide?: () => void;
}) {
  const { user } = useRole();
  const name = useUserNames();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(e.body);
  const save = useTeaAction(updateEmailBody, "Email updated");
  const send = useTeaAction(markEmailSent, "Email marked as sent");
  const gc = latestApproval(t, "GC", e.id);
  const canWork = user.role !== "ADMIN";

  return (
    <article className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Mail className="size-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {e.kind === "RFQ" ? "Supplier RFQ" : "Clarification"}
        </span>
        {e.aiDrafted && <AiBadge label="AI drafted" />}
        <span className="ml-auto">
          <EmailStatusBadge status={e.status} />
        </span>
      </header>
      <div className="space-y-1 px-3 py-2 text-sm">
        <div>
          <span className="text-muted-foreground">To: </span>
          {e.to}
        </div>
        <div className="font-semibold">{e.subject}</div>
        {editing ? (
          <div className="space-y-2 pt-1">
            <Textarea value={body} onChange={(ev) => setBody(ev.target.value)} rows={7} />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={save.pending}
                onClick={async () => {
                  if (await save.run(t.id, e.id, body)) setEditing(false);
                }}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
            {e.status === "APPROVED" && (
              <p className="text-xs text-status-amber">Saving changes voids the GC approval.</p>
            )}
          </div>
        ) : (
          <pre className="whitespace-pre-wrap pt-1 font-sans text-sm text-foreground/90">
            {e.body}
          </pre>
        )}
      </div>
      <footer className="flex flex-wrap items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
        <span>Drafted {formatPngShort(e.createdAt)}</span>
        {gc && gc.state !== "PENDING" && (
          <span>
            · GC {gc.state.toLowerCase()} by {name(gc.approverId)}{" "}
            {gc.decidedAt ? formatPngShort(gc.decidedAt) : ""}
          </span>
        )}
        {gc?.versionHash && <HashChip hash={gc.versionHash} />}
        {e.sentAt && <span>· Sent {formatPngShort(e.sentAt)}</span>}
        <span className="ml-auto flex gap-2">
          {canWork && e.status !== "SENT" && !editing && (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
          )}
          {canWork && e.status === "APPROVED" && (
            <Button size="sm" disabled={send.pending} onClick={() => void send.run(t.id, e.id)}>
              <Send /> I sent it
            </Button>
          )}
          {user.role === "CEO" && e.status === "PENDING_APPROVAL" && onDecide && (
            <Button size="sm" onClick={onDecide}>
              Review GC
            </Button>
          )}
        </span>
      </footer>
    </article>
  );
}
