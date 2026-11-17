import type { Approval } from "./approval";
import type { DraftEmail } from "./email";
import type { Quote, Rfq } from "./supplier";

/** The 11 steps of the workflow stepper, in order. */
export const WORKFLOW_STAGES = [
  "DISCOVERED",
  "AI_ANALYSIS",
  "SUMMARY_REVIEW",
  "G1_BID_DECISION",
  "AI_DRAFTING",
  "G2_TECHNICAL",
  "COSTING_G3",
  "G4_FINAL_QA",
  "G5_RELEASE",
  "SUBMISSION",
  "POST_SUBMISSION",
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];
export type TerminalStage = "NO_BID" | "MISSED" | "WITHDRAWN" | "ARCHIVED";
export type TenderStage = WorkflowStage | TerminalStage;

export type Recommendation = "BID" | "NO_BID" | "CLARIFY";
export type DiscoverySource = "UNGM_API" | "UNGM_ALERT_EMAIL";
export type Outcome = "PENDING" | "AWARDED" | "NOT_AWARDED";

export interface AiAnalysis {
  score: number; // 0–100
  recommendation: Recommendation;
  reasons: string[];
  risks: string[];
  summary: string;
  generatedAt: string;
  model: string;
}

export type RequirementStatus = "MET" | "GAP" | "UNKNOWN";

export interface Requirement {
  id: string;
  text: string;
  sourceDocumentId: string;
  page: number;
  /** Exact quote from the source document, extracted by AI. */
  exactQuote: string;
  /** True once a person has checked the quote against the source page. */
  quoteVerified: boolean;
  mandatory: boolean;
  response: string;
  evidence: string;
  status: RequirementStatus;
}

export interface TenderDocument {
  id: string;
  fileName: string;
  sha256: string;
  source: "UNGM_NOTICE" | "UNGM_ALERT" | "AMENDMENT" | "CLARIFICATION" | "INTERNAL" | "SUPPLIER";
  /** TENDER documents come from the agency; PACKAGE documents are part of our submission. */
  scope: "TENDER" | "PACKAGE";
  addedAt: string;
  sizeKb: number;
}

export type TimelineKind = "CLARIFICATION_QUESTION" | "CLARIFICATION_ANSWER" | "AMENDMENT";

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  at: string;
  title: string;
  detail: string;
  /** A material amendment voids approvals whose content it changes. */
  material: boolean;
  documentId?: string;
}

export interface ProposalComment {
  id: string;
  authorId: string;
  authorName: string;
  at: string;
  text: string;
}

export interface ProposalSection {
  id: string;
  kind: "LEGAL" | "ADMIN" | "TECHNICAL";
  title: string;
  body: string;
  aiAssisted: boolean;
  updatedAt: string;
  comments: ProposalComment[];
}

export interface CostLine {
  id: string;
  itemKey: string;
  description: string;
  quantity: number;
  unitCostUsd: number;
  /** Where the cost comes from: a quote reference, an estimate, etc. */
  source: string;
  quoteId?: string;
}

export interface Costing {
  lines: CostLine[];
  /** Set by the CEO only. Margin is derived from price and total cost. */
  priceUsd?: number;
}

export interface Submission {
  submittedAt: string;
  submittedById: string;
  receiptNumber: string;
  screenshotFileName: string;
  /** SHA-256 of the released package that was submitted. */
  packageHash: string;
}

export interface PostSubmission {
  outcome: Outcome;
  decidedAt?: string;
  lessonsLearned: string;
}

export interface Tender {
  id: string;
  title: string;
  agency: string;
  procurementType: string; // e.g. "Request for quotation"
  category: string; // e.g. "Solar", "ICT equipment"
  reference: string;
  country: string;
  location: string;
  /** Deadline exactly as written in the notice, e.g. "18-Nov-2026 16:00 (GMT 2.00)". */
  deadlineNotice: string;
  ungmUrl: string;
  source: DiscoverySource;
  discoveredAt: string;
  submissionRules: string[];
  description: string;
  estimatedValueUsd?: number;

  stage: TenderStage;
  /** Last workflow stage before a terminal state, so the stepper can show where it stopped. */
  lastWorkflowStage?: WorkflowStage;
  ownerId?: string;
  backupOwnerId?: string;
  /** Person who prepared the package. They cannot do G4 final QA. */
  preparedById?: string;

  ai?: AiAnalysis;
  requirements: Requirement[];
  documents: TenderDocument[];
  timeline: TimelineEvent[];
  proposal: ProposalSection[];
  rfqs: Rfq[];
  quotes: Quote[];
  costing: Costing;
  emails: DraftEmail[];
  approvals: Approval[];
  submission?: Submission;
  post?: PostSubmission;
}
