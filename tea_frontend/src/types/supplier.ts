export interface Supplier {
  id: string;
  name: string;
  country: string;
  contactEmail: string;
}

export type RfqStatus = "DRAFT" | "SENT" | "RESPONDED" | "DECLINED";

export interface Rfq {
  id: string;
  tenderId: string;
  supplierId: string;
  status: RfqStatus;
  sentAt?: string;
  dueAt: string;
  emailId?: string;
}

export interface QuoteLine {
  /** Matches CostLine.itemKey and the rows of the side-by-side comparison. */
  itemKey: string;
  description: string;
  quantity: number;
  unitPrice: number; // in the quote currency
}

export interface Quote {
  id: string;
  tenderId: string;
  supplierId: string;
  reference: string;
  currency: "USD" | "PGK" | "FJD" | "SBD" | "AUD";
  /** Rate used to convert to USD for comparison. */
  fxToUsd: number;
  receivedAt: string;
  validUntil: string; // ISO 8601
  leadTimeDays: number;
  lines: QuoteLine[];
}
