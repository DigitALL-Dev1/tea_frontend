import { Bot, Settings2, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuditLog, useMyApprovals, useUserNames } from "@/hooks/use-tea";
import { formatPngShort } from "@/lib/deadline";
import {
  GATE_LABEL,
  GATE_ROLE,
  GATE_STAGE,
  STAGE_GATES,
  isTerminal,
  latestApproval,
  stageIndex,
} from "@/lib/workflow";
import { cn } from "@/lib/utils";
import type { Tender } from "@/types";
import { ApprovalStateBadge, HashChip, Pill } from "../badges";
import { DecisionPanel } from "../decision-panel";
import { ROLE_LABEL } from "../role-context";

export function ApprovalsTab({ tender: t }: { tender: Tender }) {
  const name = useUserNames();
  const { data: mine } = useMyApprovals();
  const { data: audit, isLoading } = useAuditLog(t.id);
  const myHere = mine?.filter((p) => p.tenderId === t.id) ?? [];
  const reference = isTerminal(t.stage) ? (t.lastWorkflowStage ?? "DISCOVERED") : t.stage;
  const history = [...t.approvals].reverse();

  return (
    <div className="space-y-4">
      {myHere.map((p) => (
        <Card key={`${p.gate}-${p.subjectId ?? ""}`} className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your decision: {GATE_LABEL[p.gate]}</CardTitle>
          </CardHeader>
          <CardContent>
            <DecisionPanel tender={t} pending={p} showTender={false} />
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Gates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {STAGE_GATES.map((g) => {
            const a = latestApproval(t, g);
            const reached = stageIndex(reference) >= stageIndex(GATE_STAGE[g]);
            const state = a ? a.state : reached && !isTerminal(t.stage) ? "WAITING" : "NOT_REACHED";
            return (
              <div
                key={g}
                className={cn(
                  "rounded-md border p-3",
                  a?.state === "VOIDED" && "border-status-red/40 bg-status-red-soft/40",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-48 font-semibold">{GATE_LABEL[g]}</span>
                  <ApprovalStateBadge state={state} />
                  {a?.bidDecision && (
                    <Pill tone={a.bidDecision === "BID" ? "green" : "red"}>
                      {a.bidDecision === "BID" ? "Bid" : "No bid"}
                    </Pill>
                  )}
                  {a?.overrodeAi && <Pill tone="amber">Overrode AI</Pill>}
                  <span className="ml-auto text-xs text-muted-foreground">
                    Decided by {ROLE_LABEL[GATE_ROLE[g]]} · never the AI
                  </span>
                </div>
                {a && (
                  <div className="mt-2 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
                    <span className="text-muted-foreground">Approver</span>
                    <span>{name(a.approverId)}</span>
                    <span className="text-muted-foreground">Time</span>
                    <span className="tabular-nums">
                      {a.decidedAt ? formatPngShort(a.decidedAt) : "—"}
                    </span>
                    <span className="text-muted-foreground">Reason</span>
                    <span>“{a.reason}”</span>
                    <span className="text-muted-foreground">Version</span>
                    <span>
                      <HashChip hash={a.versionHash} />
                    </span>
                    {a.state === "VOIDED" && (
                      <>
                        <span className="text-status-red">Voided</span>
                        <span className="text-status-red">
                          {a.voidedAt ? formatPngShort(a.voidedAt) : ""} · {a.voidReason}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Decision history ({history.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No decisions yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {history.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="w-10 font-mono text-xs font-bold">{a.gate}</span>
                    <ApprovalStateBadge state={a.state} />
                    <span>{name(a.approverId)}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.decidedAt ? formatPngShort(a.decidedAt) : ""}
                    </span>
                    <HashChip hash={a.versionHash} className="ml-auto" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Audit log</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !audit ? (
              <Skeleton className="h-40" />
            ) : (
              <ol className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
                {audit.map((e) => {
                  const Icon =
                    e.actorId === "ai-agent" ? Bot : e.actorId === "system" ? Settings2 : User;
                  return (
                    <li key={e.id} className="flex gap-3 text-sm">
                      <span
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                          e.actorId === "ai-agent"
                            ? "bg-status-violet-soft text-status-violet"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-semibold">{e.action}</span>
                          <span className="text-xs text-muted-foreground">
                            {e.actorName} · {formatPngShort(e.at)}
                          </span>
                        </div>
                        <p className="break-words text-muted-foreground">{e.detail}</p>
                        {e.versionHash && <HashChip hash={e.versionHash} className="mt-1" />}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
