/**
 * In-memory mock store. INTERNAL to src/services — the UI never imports this file.
 * When the real backend exists, the service functions are rewritten as API calls
 * and this file is deleted.
 */
import { MOCK_SETTINGS } from "@/mocks/settings";
import { buildTenderSeeds, type SeedAmendment } from "@/mocks/tenders";
import { MOCK_DEMO_USERS, MOCK_SUPPLIERS, MOCK_USERS } from "@/mocks/users";
import { deadlineUtc } from "@/lib/deadline";
import {
  GATE_ROLE,
  GATE_STAGE,
  STAGE_GATES,
  gateHash,
  isGateValid,
  isTerminal,
  latestApproval,
  nextWorkflowStage,
  stageIndex,
  type StageGate,
} from "@/lib/workflow";
import type {
  Approval,
  ApprovalGate,
  AuditCategory,
  AuditEntry,
  DemoUser,
  Supplier,
  TeaSettings,
  Tender,
  User,
  WorkflowStage,
} from "@/types";
import { AI_ACTOR_ID, SYSTEM_ACTOR_ID } from "@/types";

interface State {
  tenders: Tender[];
  audit: AuditEntry[];
  settings: TeaSettings;
  users: User[];
  suppliers: Supplier[];
  currentUserId: string;
}

let seq = 0;
export function newId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

export const state: State = {
  tenders: [],
  audit: [],
  settings: structuredClone(MOCK_SETTINGS),
  users: structuredClone(MOCK_USERS),
  suppliers: structuredClone(MOCK_SUPPLIERS),
  currentUserId: "u-bernard",
};

// ---------- actors ----------

export function userName(id: string): string {
  if (id === AI_ACTOR_ID) return "AI agent";
  if (id === SYSTEM_ACTOR_ID) return "System";
  return state.users.find((u) => u.id === id)?.name ?? id;
}

export function currentActor(): DemoUser {
  const u = MOCK_DEMO_USERS.find((x) => x.id === state.currentUserId);
  if (!u) throw new Error("No demo user selected.");
  return u;
}

// ---------- audit ----------

export function audit(entry: {
  actorId: string;
  category: AuditCategory;
  action: string;
  detail: string;
  tenderId?: string | undefined;
  versionHash?: string | undefined;
  at?: string | undefined;
}): void {
  const row: AuditEntry = {
    id: newId("aud"),
    at: entry.at ?? new Date().toISOString(),
    actorId: entry.actorId,
    actorName: userName(entry.actorId),
    category: entry.category,
    action: entry.action,
    detail: entry.detail,
  };
  if (entry.tenderId) row.tenderId = entry.tenderId;
  if (entry.versionHash) row.versionHash = entry.versionHash;
  state.audit.unshift(row);
}

// ---------- tender helpers ----------

export function findTender(id: string): Tender {
  const t = state.tenders.find((x) => x.id === id);
  if (!t) throw new Error(`Tender ${id} not found.`);
  return t;
}

/** Move a tender to a new stage and log it. */
export function setStage(
  t: Tender,
  stage: Tender["stage"],
  actorId: string,
  why: string,
  at?: string,
): void {
  if (t.stage === stage) return;
  const from = t.stage;
  if (!isTerminal(from)) t.lastWorkflowStage = from as WorkflowStage;
  t.stage = stage;
  audit({
    actorId,
    category: "WORKFLOW",
    action: "Stage changed",
    detail: `${from} → ${stage}. ${why}`,
    tenderId: t.id,
    ...(at ? { at } : {}),
  });
}

/**
 * Move forward from a gate's stage, skipping later gates whose approval is still valid
 * (e.g. G3 stays valid when only the technical content changed).
 */
export function advanceFrom(
  t: Tender,
  stage: WorkflowStage,
  actorId: string,
  why: string,
  at?: string,
): void {
  let next = nextWorkflowStage(stage);
  while (next) {
    const gate = STAGE_GATES.find((g) => GATE_STAGE[g] === next);
    if (!gate || !isGateValid(t, gate)) break;
    next = nextWorkflowStage(next);
  }
  if (next) setStage(t, next, actorId, why, at);
}

/**
 * Compare every approval with the current content. Approvals whose content changed are
 * VOIDED, emails go back to "Pending approval", and the stage moves back to the earliest
 * voided gate. Call after every content change.
 */
export function reconcile(t: Tender, cause: string, actorId: string, at?: string): ApprovalGate[] {
  const when = at ?? new Date().toISOString();
  const voided: ApprovalGate[] = [];
  const check = (gate: ApprovalGate, subjectId?: string) => {
    const a = latestApproval(t, gate, subjectId);
    if (a?.state !== "APPROVED") return;
    if (a.versionHash === gateHash(t, gate, subjectId)) return;
    a.state = "VOIDED";
    a.voidedAt = when;
    a.voidReason = cause;
    voided.push(gate);
    audit({
      actorId: SYSTEM_ACTOR_ID,
      category: "APPROVAL",
      action: `${gate} voided`,
      detail: `Approved content changed: ${cause}. Re-approval needed.`,
      tenderId: t.id,
      versionHash: a.versionHash,
      at: when,
    });
    if (gate === "GC") {
      const e = t.emails.find((x) => x.id === subjectId);
      if (e && e.status === "APPROVED") e.status = "PENDING_APPROVAL";
    }
  };
  STAGE_GATES.forEach((g) => check(g));
  t.emails.forEach((e) => check("GC", e.id));

  if (!isTerminal(t.stage) && stageIndex(t.stage) < stageIndex("SUBMISSION")) {
    const earliest = (voided.filter((g) => g !== "GC") as StageGate[])
      .map((g) => GATE_STAGE[g])
      .sort((a, b) => stageIndex(a) - stageIndex(b))[0];
    if (earliest && stageIndex(earliest) < stageIndex(t.stage)) {
      setStage(t, earliest, SYSTEM_ACTOR_ID, `Approvals voided by: ${cause}.`, when);
    }
  }
  void actorId;
  return voided;
}

export function recordApproval(
  t: Tender,
  input: Omit<Approval, "id" | "tenderId" | "requiredRole" | "versionHash">,
): Approval {
  const a: Approval = {
    id: newId("apr"),
    tenderId: t.id,
    requiredRole: GATE_ROLE[input.gate],
    versionHash: gateHash(t, input.gate, input.subjectId),
    ...input,
  };
  t.approvals.push(a);
  return a;
}

/** Content edits are locked once the package is released for submission or the tender is closed. */
export function assertEditable(t: Tender): void {
  if (isTerminal(t.stage) || stageIndex(t.stage) >= stageIndex("SUBMISSION")) {
    throw new Error("This tender is locked: the package was released or the tender is closed.");
  }
}

/** Tenders past their deadline that were never submitted become MISSED. */
export function sweepDeadlines(now = new Date()): void {
  for (const t of state.tenders) {
    if (isTerminal(t.stage) || stageIndex(t.stage) >= stageIndex("POST_SUBMISSION")) continue;
    if (deadlineUtc(t.deadlineNotice).getTime() <= now.getTime()) {
      setStage(t, "MISSED", SYSTEM_ACTOR_ID, "Deadline passed without a recorded submission.");
    }
  }
}

// ---------- amendments (shared by seed and service) ----------

export function applyAmendmentToTender(t: Tender, a: SeedAmendment, actorId: string): void {
  t.documents.push(a.document);
  for (const c of a.requirementChanges) {
    const r = t.requirements.find((x) => x.id === c.id);
    if (r) {
      r.text = c.text;
      r.exactQuote = c.exactQuote;
      r.quoteVerified = false;
      r.status = "UNKNOWN";
    }
  }
  t.timeline.push({
    id: newId("tl"),
    kind: "AMENDMENT",
    at: a.at,
    title: a.title,
    detail: a.detail,
    material: a.material,
    documentId: a.document.id,
  });
  audit({
    actorId,
    category: "DISCOVERY",
    action: `${a.title} received`,
    detail: `${a.material ? "Material" : "Non-material"} amendment. ${a.detail}`,
    tenderId: t.id,
    at: a.at,
  });
  if (a.material) reconcile(t, a.title, actorId, a.at);
}

// ---------- seed ----------

function seed(): void {
  state.tenders = [];
  state.audit = [];
  for (const s of buildTenderSeeds()) {
    const t = s.tender;
    state.tenders.push(t);
    audit({
      actorId: SYSTEM_ACTOR_ID,
      category: "DISCOVERY",
      action: "Tender discovered",
      detail: `Imported from ${t.source === "UNGM_API" ? "the UNGM API" : "a UNGM alert email"}.`,
      tenderId: t.id,
      at: t.discoveredAt,
    });
    if (t.ai) {
      audit({
        actorId: AI_ACTOR_ID,
        category: "AI",
        action: "AI analysis completed",
        detail: `Score ${t.ai.score}, recommendation ${t.ai.recommendation}.`,
        tenderId: t.id,
        at: t.ai.generatedAt,
      });
    }
    for (const d of s.decisions) {
      const a = recordApproval(t, {
        gate: d.gate,
        state: "APPROVED",
        approverId: d.approverId,
        decidedAt: d.at,
        reason: d.reason,
        ...(d.subjectId ? { subjectId: d.subjectId } : {}),
        ...(d.bidDecision
          ? {
              bidDecision: d.bidDecision,
              overrodeAi: t.ai ? t.ai.recommendation !== d.bidDecision : false,
            }
          : {}),
      });
      if (d.gate === "GC") {
        const e = t.emails.find((x) => x.id === d.subjectId);
        if (e && e.status === "PENDING_APPROVAL") e.status = "APPROVED";
      }
      audit({
        actorId: d.approverId,
        category: "APPROVAL",
        action: `${d.gate} approved`,
        detail: d.reason,
        tenderId: t.id,
        versionHash: a.versionHash,
        at: d.at,
      });
    }
    for (const am of s.amendments ?? []) applyAmendmentToTender(t, am, SYSTEM_ACTOR_ID);
  }
  state.audit.sort((a, b) => b.at.localeCompare(a.at));
}

seed();

export function resetStore(): void {
  state.settings = structuredClone(MOCK_SETTINGS);
  state.users = structuredClone(MOCK_USERS);
  state.currentUserId = "u-bernard";
  seed();
}

/** Simulated network latency so loading states are visible. */
export function delay(ms = 120): Promise<void> {
  if (import.meta.env?.MODE === "test") return Promise.resolve();
  return new Promise((r) => setTimeout(r, ms));
}

export function clone<T>(v: T): T {
  return structuredClone(v);
}
