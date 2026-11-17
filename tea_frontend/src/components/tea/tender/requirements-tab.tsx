import { useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateRequirement, verifyRequirementQuote } from "@/services";
import { useTeaAction } from "@/hooks/use-tea";
import { cn } from "@/lib/utils";
import type { Requirement, RequirementStatus, Tender } from "@/types";
import { AiBadge, Pill, RequirementBadge } from "../badges";
import { useRole } from "../role-context";
import { isLocked } from "./workflow-actions";

export function RequirementsTab({ tender: t }: { tender: Tender }) {
  const { user } = useRole();
  const canEdit = user.role !== "ADMIN" && !isLocked(t);
  const setStatus = useTeaAction(updateRequirement, "Requirement updated");
  const verify = useTeaAction(verifyRequirementQuote, "Quote marked as verified");
  const [editing, setEditing] = useState<Requirement | null>(null);
  const docName = (id: string) => t.documents.find((d) => d.id === id)?.fileName ?? "—";

  const count = (s: RequirementStatus) => t.requirements.filter((r) => r.status === s).length;
  const unverified = t.requirements.filter((r) => !r.quoteVerified).length;

  if (t.requirements.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No requirements yet. The AI extracts them during analysis.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Pill tone="green">{count("MET")} Met</Pill>
        <Pill tone="red">{count("GAP")} Gap</Pill>
        <Pill tone="slate">{count("UNKNOWN")} Unknown</Pill>
        {unverified > 0 && (
          <Pill tone="amber">
            <AlertTriangle className="size-3" /> {unverified} unverified quote
            {unverified > 1 ? "s" : ""}
          </Pill>
        )}
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <AiBadge /> Quotes are extracted by AI. A person must verify each against the source page
          before it can be set to Met.
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[18%]">Requirement</TableHead>
              <TableHead>Source document</TableHead>
              <TableHead className="w-12">Page</TableHead>
              <TableHead className="w-[24%]">Exact quote</TableHead>
              <TableHead>Mandatory</TableHead>
              <TableHead className="w-[14%]">Our response</TableHead>
              <TableHead>Evidence</TableHead>
              <TableHead className="w-36">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {t.requirements.map((r) => (
              <TableRow key={r.id} className={cn(!r.quoteVerified && "bg-status-amber-soft/40")}>
                <TableCell className="align-top text-sm font-medium">
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {r.id.split("-").at(-1)}
                  </div>
                  {r.text}
                </TableCell>
                <TableCell className="align-top text-xs">{docName(r.sourceDocumentId)}</TableCell>
                <TableCell className="align-top text-sm tabular-nums">{r.page}</TableCell>
                <TableCell className="align-top">
                  <blockquote
                    className={cn(
                      "border-l-2 pl-2 text-xs italic leading-relaxed",
                      r.quoteVerified
                        ? "border-status-green"
                        : "border-status-amber bg-status-amber-soft py-1 pr-1",
                    )}
                  >
                    “{r.exactQuote}”
                  </blockquote>
                  {r.quoteVerified ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-status-green">
                      <CheckCircle2 className="size-3" /> Verified by a person
                    </span>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-status-amber">
                        <AlertTriangle className="size-3" /> Unverified AI quote
                      </span>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={verify.pending}
                          onClick={() => void verify.run(t.id, r.id)}
                        >
                          <ShieldCheck className="!size-3.5" /> I checked page {r.page}
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  {r.mandatory ? (
                    <Pill tone="blue">Mandatory</Pill>
                  ) : (
                    <span className="text-xs text-muted-foreground">Optional</span>
                  )}
                </TableCell>
                <TableCell className="align-top text-sm">
                  {r.response || <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="align-top text-xs">
                  {r.evidence || <span className="text-muted-foreground">—</span>}
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 h-7 px-2 text-xs"
                      onClick={() => setEditing(r)}
                    >
                      <Pencil className="!size-3" /> Edit
                    </Button>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  {canEdit ? (
                    <Select
                      value={r.status}
                      onValueChange={(v) =>
                        void setStatus.run(t.id, r.id, { status: v as RequirementStatus })
                      }
                    >
                      <SelectTrigger className="h-8" aria-label={`Status of ${r.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MET" disabled={!r.quoteVerified}>
                          Met{!r.quoteVerified ? " (verify quote first)" : ""}
                        </SelectItem>
                        <SelectItem value="GAP">Gap</SelectItem>
                        <SelectItem value="UNKNOWN">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <RequirementBadge status={r.status} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {editing && <EditDialog tender={t} req={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditDialog({
  tender: t,
  req,
  onClose,
}: {
  tender: Tender;
  req: Requirement;
  onClose: () => void;
}) {
  const [response, setResponse] = useState(req.response);
  const [evidence, setEvidence] = useState(req.evidence);
  const action = useTeaAction(updateRequirement, "Requirement updated");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Our response</DialogTitle>
          <DialogDescription>{req.text}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="resp">Response</Label>
            <Textarea
              id="resp"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="evid">Evidence</Label>
            <Textarea
              id="evid"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={action.pending}
            onClick={async () => {
              if (await action.run(t.id, req.id, { response, evidence })) onClose();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
