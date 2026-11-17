/**
 * Pure workflow rules shared by the mock services and the UI.
 * The backend should enforce the same rules; nothing here talks to a server.
 */
import { hashContent } from "./sha256";
import type {
  Approval,
  ApprovalGate,
  Costing,
  Tender,
  TenderStage,
  UserRole,
  WorkflowStage,
} from "@/types";
import { WORKFLOW_STAGES } from "@/types";

export const GATE_ROLE: Record<ApprovalGate, UserRole> = {
  SR: "SOLUTION_LEAD",
  G1: "CEO",
  G2: "SOLUTION_LEAD",
  G3: "CEO",
  G4: "SOLUTION_LEAD",
  G5: "CEO",
  GC: "CEO",
};

export const GATE_LABEL: Record<ApprovalGate, string> = {
  SR: "AI summary review",
  G1: "G1 · Bid / No bid",
  G2: "G2 · Technical approval",
  G3: "G3 · Price and margin",
  G4: "G4 · Final QA",
  G5: "G5 · Release package",
  GC: "GC · Outgoing email",
};

/** Gates in workflow order (GC is per email and not part of the stage sequence). */
export const STAGE_GATES = ["SR", "G1", "G2", "G3", "G4", "G5"] as const;
export type StageGate = (typeof STAGE_GATES)[number];

export const GATE_STAGE: Record<StageGate, WorkflowStage> = {
  SR: "SUMMARY_REVIEW",
  G1: "G1_BID_DECISION",
  G2: "G2_TECHNICAL",
  G3: "COSTING_G3",
  G4: "G4_FINAL_QA",
  G5: "G5_RELEASE",
};

export function gateForStage(stage: TenderStage): StageGate | undefined {
  return STAGE_GATES.find((g) => GATE_STAGE[g] === stage);
}

export const STAGE_LABEL: Record<TenderStage, string> = {
  DISCOVERED: "Discovered",
  AI_ANALYSIS: "AI analysis",
  SUMMARY_REVIEW: "Summary review",
  G1_BID_DECISION: "G1 Bid decision",
  AI_DRAFTING: "AI drafting",
  G2_TECHNICAL: "G2 Technical",
  COSTING_G3: "Costing / G3",
  G4_FINAL_QA: "G4 Final QA",
  G5_RELEASE: "G5 Release",
  SUBMISSION: "Submit",
  POST_SUBMISSION: "After submission",
  NO_BID: "No bid",
  MISSED: "Missed",
  WITHDRAWN: "Withdrawn",
  ARCHIVED: "Archived",
};

export const STAGE_DESCRIPTION: Record<WorkflowStage, string> = {
  DISCOVERED: "Found via the UNGM API or a UNGM alert email",
  AI_ANALYSIS: "AI scores the tender and recommends BID / NO BID / CLARIFY",
  SUMMARY_REVIEW: "Solution Engineering Lead reviews the AI summary",
  G1_BID_DECISION: "CEO decides Bid or No bid",
  AI_DRAFTING: "AI drafts legal, admin and technical sections",
  G2_TECHNICAL: "Solution Engineering Lead technical approval",
  COSTING_G3: "Cost sheet from supplier quotes; CEO sets price and margin",
  G4_FINAL_QA: "Final QA by a reviewer who did not prepare the package",
  G5_RELEASE: "CEO one-time release of this exact package",
  SUBMISSION: "A person submits and records the receipt",
  POST_SUBMISSION: "Awarded / Not awarded and lessons learned",
};

export function isTerminal(stage: TenderStage): boolean {
  return stage === "NO_BID" || stage === "MISSED" || stage === "WITHDRAWN" || stage === "ARCHIVED";
}

export function stageIndex(stage: TenderStage): number {
  return (WORKFLOW_STAGES as readonly string[]).indexOf(stage);
}

export function nextWorkflowStage(stage: WorkflowStage): WorkflowStage | undefined {
  return WORKFLOW_STAGES[stageIndex(stage) + 1];
}

/** Owner and a different backup owner are required before a tender moves past Discovered. */
export function ownersValid(t: Pick<Tender, "ownerId" | "backupOwnerId">): boolean {
  return Boolean(t.ownerId && t.backupOwnerId && t.ownerId !== t.backupOwnerId);
}

export function canRoleDecide(role: UserRole, gate: ApprovalGate): boolean {
  return GATE_ROLE[gate] === role;
}

// ---------- costing ----------

export function lineTotal(l: { quantity: number; unitCostUsd: number }): number {
  return l.quantity * l.unitCostUsd;
}

export function costTotal(c: Costing): number {
  return c.lines.reduce((s, l) => s + lineTotal(l), 0);
}

/** Margin as a percentage of price: (price − cost) / price. */
export function marginPct(c: Costing): number | undefined {
  if (!c.priceUsd || c.priceUsd <= 0) return undefined;
  return ((c.priceUsd - costTotal(c)) / c.priceUsd) * 100;
}

export function priceForMargin(cost: number, margin: number): number {
  if (margin >= 100) throw new Error("Margin must be below 100%.");
  return Math.round((cost / (1 - margin / 100)) * 100) / 100;
}

// ---------- version hashes ----------

function noticeScope(t: Tender) {
  return {
    title: t.title,
    agency: t.agency,
    reference: t.reference,
    deadlineNotice: t.deadlineNotice,
    ai: t.ai
      ? { score: t.ai.score, recommendation: t.ai.recommendation, summary: t.ai.summary }
      : null,
  };
}

function technicalScope(t: Tender) {
  return {
    requirements: t.requirements.map((r) => ({
      id: r.id,
      text: r.text,
      quote: r.exactQuote,
      verified: r.quoteVerified,
      response: r.response,
      evidence: r.evidence,
      status: r.status,
    })),
    proposal: t.proposal.map((p) => ({ id: p.id, title: p.title, body: p.body })),
    tenderDocuments: t.documents.filter((d) => d.scope === "TENDER").map((d) => d.sha256),
  };
}

function costingScope(t: Tender) {
  return {
    lines: t.costing.lines.map((l) => ({
      id: l.id,
      q: l.quantity,
      u: l.unitCostUsd,
      source: l.source,
    })),
    priceUsd: t.costing.priceUsd ?? null,
  };
}

/** Hash of the content a gate approves. Changing that content voids the approval. */
export function gateHash(t: Tender, gate: ApprovalGate, subjectId?: string): string {
  switch (gate) {
    case "SR":
    case "G1":
      return hashContent({ gate: "notice", ...noticeScope(t) });
    case "G2":
      return hashContent({ gate: "technical", ...technicalScope(t) });
    case "G3":
      return hashContent({ gate: "costing", ...costingScope(t) });
    case "G4":
    case "G5":
      return packageHash(t);
    case "GC": {
      const e = t.emails.find((x) => x.id === subjectId);
      return hashContent({ gate: "email", to: e?.to, subject: e?.subject, body: e?.body });
    }
  }
}

/** The full submission package: technical + costing + our package documents. */
export function packageHash(t: Tender): string {
  return hashContent({
    gate: "package",
    technical: technicalScope(t),
    costing: costingScope(t),
    packageDocuments: t.documents.filter((d) => d.scope === "PACKAGE").map((d) => d.sha256),
  });
}

// ---------- approval state ----------

/** Latest decision record for a gate (and email for GC). */
export function latestApproval(
  t: Pick<Tender, "approvals">,
  gate: ApprovalGate,
  subjectId?: string,
): Approval | undefined {
  for (let i = t.approvals.length - 1; i >= 0; i--) {
    const a = t.approvals[i]!;
    if (a.gate === gate && (gate !== "GC" || a.subjectId === subjectId)) return a;
  }
  return undefined;
}

/** True when the gate's latest record is APPROVED and still matches the current content. */
export function isGateValid(t: Tender, gate: ApprovalGate, subjectId?: string): boolean {
  const a = latestApproval(t, gate, subjectId);
  return a?.state === "APPROVED" && a.versionHash === gateHash(t, gate, subjectId);
}

/** Why the current role cannot take a decision right now (undefined = allowed). */
export function blockedReason(
  t: Tender,
  gate: ApprovalGate,
  actor: { id: string; role: UserRole },
): string | undefined {
  if (!canRoleDecide(actor.role, gate)) return "Your role cannot decide this gate.";
  if (gate !== "GC" && !ownersValid(t)) {
    return "Assign an owner and a different backup owner first.";
  }
  if (gate === "G4" && t.preparedById === actor.id) {
    return "You prepared this package, so you cannot approve its final QA.";
  }
  if (gate === "G3" && !t.costing.priceUsd) return "Set a price before approving G3.";
  return undefined;
}
