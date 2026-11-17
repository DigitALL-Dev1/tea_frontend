import { useState } from "react";
import { MessageSquare, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addProposalComment, updateProposalSection } from "@/services";
import { useTeaAction } from "@/hooks/use-tea";
import { formatPngShort } from "@/lib/deadline";
import type { ProposalSection, Tender } from "@/types";
import { AiBadge, Pill } from "../badges";
import { useRole } from "../role-context";
import { isLocked } from "./workflow-actions";

const KIND: Record<ProposalSection["kind"], string> = {
  LEGAL: "Legal",
  ADMIN: "Admin",
  TECHNICAL: "Technical",
};

export function ProposalTab({ tender: t }: { tender: Tender }) {
  if (t.proposal.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No drafts yet. AI drafting of legal, admin and technical sections starts after the G1 Bid
        decision.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {t.proposal.map((s) => (
        <SectionCard key={s.id} tender={t} section={s} />
      ))}
    </div>
  );
}

function SectionCard({ tender: t, section: s }: { tender: Tender; section: ProposalSection }) {
  const { user } = useRole();
  const canEdit = user.role !== "ADMIN" && !isLocked(t);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(s.body);
  const [comment, setComment] = useState("");
  const save = useTeaAction(updateProposalSection, "Section saved");
  const add = useTeaAction(addProposalComment, "Comment added");

  return (
    <article className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Pill tone="slate">{KIND[s.kind]}</Pill>
        <h3 className="font-display font-bold">{s.title}</h3>
        {s.aiAssisted && <AiBadge label="AI-assisted draft" />}
        <span className="ml-auto text-xs text-muted-foreground">
          Updated {formatPngShort(s.updatedAt)}
        </span>
      </header>
      <div className="px-4 py-3">
        {editing ? (
          <div className="space-y-2">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} />
            <p className="text-xs text-status-amber">Saving voids G2, G4 and G5.</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={save.pending}
                onClick={async () => {
                  if (await save.run(t.id, s.id, body)) setEditing(false);
                }}
              >
                Save section
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setBody(s.body);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed">{s.body}</p>
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0"
                onClick={() => setEditing(true)}
              >
                <Pencil /> Edit
              </Button>
            )}
          </div>
        )}
      </div>
      <footer className="space-y-2 border-t bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <MessageSquare className="size-3.5" /> {s.comments.length} comment
          {s.comments.length === 1 ? "" : "s"}
        </div>
        {s.comments.map((c) => (
          <div key={c.id} className="rounded-md bg-background px-3 py-2 text-sm">
            <span className="font-semibold">{c.authorName}</span>{" "}
            <span className="text-xs text-muted-foreground">{formatPngShort(c.at)}</span>
            <p>{c.text}</p>
          </div>
        ))}
        {user.role !== "ADMIN" && (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await add.run(t.id, s.id, comment)) setComment("");
            }}
          >
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment…"
              aria-label={`Comment on ${s.title}`}
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={!comment.trim() || add.pending}
            >
              Post
            </Button>
          </form>
        )}
      </footer>
    </article>
  );
}
