export type EmailKind = "CLARIFICATION" | "RFQ" | "OTHER";

/** PENDING_APPROVAL until GC is approved by the CEO. Sending is done by a person. */
export type EmailStatus = "PENDING_APPROVAL" | "APPROVED" | "RETURNED" | "REJECTED" | "SENT";

export interface DraftEmail {
  id: string;
  tenderId: string;
  kind: EmailKind;
  to: string;
  subject: string;
  body: string;
  aiDrafted: boolean;
  status: EmailStatus;
  createdAt: string;
  sentAt?: string;
  /** Supplier id for RFQ emails. */
  supplierId?: string;
}
