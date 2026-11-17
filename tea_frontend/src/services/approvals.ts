/**
 * Approval gates. The AI is never an approver: every decision needs a person in the right role,
 * a reason, and the version hash that person saw.
 */
import {
  GATE_ROLE,
  GATE_STAGE,
  blockedReason,
  gateForStage,
  gateHash,
  isGateValid,
  isTerminal,
  latestApproval,
} from "@/lib/workflow";
import type { Approval, ApprovalInput, PendingApproval, Tender } from "@/types";
import {
  advanceFrom,
  audit,
  clone,
  currentActor,
  delay,
  findTender,
  recordApproval,
  setStage,
  state,
  sweepDeadlines,
} from "./store";

/** Minimum reason length when the CEO's G1 decision differs from the AI recommendation. */
export const OVERRIDE_REASON_MIN = 20;

/** Every decision currently waiting on someone (all roles). */
export function pendingFor(t: Tender): PendingApproval[] {
  const out: PendingApproval[] = [];
  if (!isTerminal(t.stage)) {
    const gate = gateForStage(t.stage);
    if (gate && !isGateValid(t, gate)) {
      out.push({
        tenderId: t.id,
        gate,
        requiredRole: GATE_ROLE[gate],
        currentHash: gateHash(t, gate),
      });
    }
  }
  for (const e of t.emails) {
    if (e.status === "PENDING_APPROVAL") {
      out.push({
        tenderId: t.id,
        gate: "GC",
        subjectId: e.id,
        requiredRole: "CEO",
        currentHash: gateHash(t, "GC", e.id),
      });
    }
  }
  return out;
}

/** Pending items for the current demo user, with the reason if they cannot decide yet. */
export async function getMyApprovals(): Promise<PendingApproval[]> {
  await delay();
  sweepDeadlines();
  const actor = currentActor();
  const rows: PendingApproval[] = [];
  for (const t of state.tenders) {
    for (const p of pendingFor(t)) {
      if (p.requiredRole !== actor.role) continue;
      const blocked = blockedReason(t, p.gate, actor);
      rows.push(blocked ? { ...p, blockedReason: blocked } : p);
    }
  }
  return clone(rows);
}

export async function getAllPendingApprovals(): Promise<PendingApproval[]> {
  await delay();
  return clone(state.tenders.flatMap(pendingFor));
}

export async function decideGate(input: ApprovalInput): Promise<Approval> {
  await delay(200);
  const actor = currentActor();
  const t = findTender(input.tenderId);
  const reason = input.reason.trim();

  const blocked = blockedReason(t, input.gate, actor);
  if (blocked) throw new Error(blocked);
  if (!reason) throw new Error("A reason is required.");

  const current = gateHash(t, input.gate, input.subjectId);
  if (current !== input.expectedHash) {
    throw new Error(
      "The content changed after you opened it. Review the new version before deciding.",
    );
  }

  if (input.gate === "GC") {
    const e = t.emails.find((x) => x.id === input.subjectId);
    if (!e) throw new Error("Email not found.");
    if (e.status !== "PENDING_APPROVAL") throw new Error("This email is not waiting for approval.");
  } else {
    const expectedStage = GATE_STAGE[input.gate];
    if (t.stage !== expectedStage) throw new Error(`This tender is not at ${input.gate}.`);
    if (isGateValid(t, input.gate))
      throw new Error(`${input.gate} is already approved for this version.`);
  }
  if (input.gate === "SR" && input.decision === "REJECT") {
    throw new Error("The summary review can be approved or returned to the AI, not rejected.");
  }

  // G1: approve = BID, reject = NO BID. Disagreeing with the AI needs a fuller reason.
  let bidDecision: Approval["bidDecision"];
  let overrodeAi: boolean | undefined;
  if (input.gate === "G1" && input.decision !== "RETURN") {
    bidDecision = input.decision === "APPROVE" ? "BID" : "NO_BID";
    overrodeAi = Boolean(t.ai && t.ai.recommendation !== bidDecision);
    if (overrodeAi && reason.length < OVERRIDE_REASON_MIN) {
      throw new Error(
        `You are deciding ${bidDecision === "BID" ? "BID" : "NO BID"} against the AI recommendation (${t.ai?.recommendation}). Explain why in at least ${OVERRIDE_REASON_MIN} characters.`,
      );
    }
  }

  const now = new Date().toISOString();
  const stateByDecision = { APPROVE: "APPROVED", RETURN: "RETURNED", REJECT: "REJECTED" } as const;
  const a = recordApproval(t, {
    gate: input.gate,
    state: stateByDecision[input.decision],
    approverId: actor.id,
    decidedAt: now,
    reason,
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    ...(bidDecision ? { bidDecision } : {}),
    ...(overrodeAi !== undefined ? { overrodeAi } : {}),
  });
  audit({
    actorId: actor.id,
    category: "APPROVAL",
    action: `${input.gate} ${a.state.toLowerCase()}${bidDecision ? ` (${bidDecision === "BID" ? "Bid" : "No bid"})` : ""}`,
    detail: `${reason}${overrodeAi ? " [Overrode AI recommendation]" : ""}`,
    tenderId: t.id,
    ...(a.versionHash ? { versionHash: a.versionHash } : {}),
  });

  applyOutcome(t, a, actor.id);
  return clone(a);
}

function applyOutcome(t: Tender, a: Approval, actorId: string): void {
  const why = `${a.gate} ${a.state.toLowerCase()}`;
  if (a.gate === "GC") {
    const e = t.emails.find((x) => x.id === a.subjectId);
    if (e)
      e.status =
        a.state === "APPROVED" ? "APPROVED" : a.state === "RETURNED" ? "RETURNED" : "REJECTED";
    return;
  }
  if (a.state === "APPROVED") {
    advanceFrom(t, GATE_STAGE[a.gate], actorId, why);
    return;
  }
  if (a.state === "REJECTED") {
    setStage(t, a.gate === "G1" ? "NO_BID" : "WITHDRAWN", actorId, `${why}: ${a.reason}`);
    return;
  }
  // RETURNED
  const back = {
    SR: "AI_ANALYSIS",
    G1: "SUMMARY_REVIEW",
    G2: "AI_DRAFTING",
    G3: "COSTING_G3",
    G4: "AI_DRAFTING",
    G5: "G4_FINAL_QA",
  } as const;
  setStage(t, back[a.gate], actorId, `${why}: ${a.reason}`);
  // Returning to an approved gate re-opens it, so its earlier approval is voided.
  const reopened = gateForStage(back[a.gate]);
  const prev = reopened ? latestApproval(t, reopened) : undefined;
  if (reopened && prev?.state === "APPROVED") {
    prev.state = "VOIDED";
    prev.voidedAt = a.decidedAt ?? new Date().toISOString();
    prev.voidReason = `Returned at ${a.gate}`;
    audit({
      actorId,
      category: "APPROVAL",
      action: `${reopened} voided`,
      detail: `Re-opened because ${a.gate} was returned.`,
      tenderId: t.id,
      ...(prev.versionHash ? { versionHash: prev.versionHash } : {}),
    });
  }
}
