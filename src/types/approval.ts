import type { UserRole } from "./user";

/**
 * SR  = Solution Engineering Lead review of the AI summary (before G1)
 * G1  = CEO bid / no-bid
 * G2  = Solution Engineering Lead technical approval
 * G3  = CEO price and margin
 * G4  = Solution Engineering Lead final QA
 * G5  = CEO one-time release of the exact package
 * GC  = CEO approval of an outgoing email
 */
export type ApprovalGate = "SR" | "G1" | "G2" | "G3" | "G4" | "G5" | "GC";

export type ApprovalState = "PENDING" | "APPROVED" | "RETURNED" | "REJECTED" | "VOIDED";

export type ApprovalDecision = "APPROVE" | "RETURN" | "REJECT";

export interface Approval {
  id: string;
  tenderId: string;
  gate: ApprovalGate;
  /** For GC approvals, the id of the email being approved. */
  subjectId?: string;
  requiredRole: UserRole;
  state: ApprovalState;
  /** User id of the person who decided. Never the AI agent. */
  approverId?: string;
  decidedAt?: string; // ISO 8601 UTC
  reason?: string;
  /** SHA-256 of the content in this gate's scope at the moment of the decision. */
  versionHash?: string;
  /** For G1: the decision taken and whether it went against the AI recommendation. */
  bidDecision?: "BID" | "NO_BID";
  overrodeAi?: boolean;
  voidedAt?: string;
  voidReason?: string;
}

/** A gate decision waiting on someone, shown in "My Approvals". */
export interface PendingApproval {
  tenderId: string;
  gate: ApprovalGate;
  subjectId?: string;
  requiredRole: UserRole;
  /** Hash of the content that would be approved right now. */
  currentHash: string;
  /** Set when the decision cannot be taken (e.g. the preparer cannot do G4). */
  blockedReason?: string;
}

export interface ApprovalInput {
  tenderId: string;
  gate: ApprovalGate;
  subjectId?: string;
  decision: ApprovalDecision;
  reason: string;
  /** The hash shown to the approver; the decision is refused if the content changed since. */
  expectedHash: string;
}
