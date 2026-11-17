export type AuditCategory =
  | "DISCOVERY"
  | "AI"
  | "WORKFLOW"
  | "APPROVAL"
  | "CONTENT"
  | "COSTING"
  | "EMAIL"
  | "SUBMISSION"
  | "SETTINGS"
  | "SESSION";

export interface AuditEntry {
  id: string;
  at: string; // ISO 8601 UTC
  /** User id, "ai-agent" or "system". */
  actorId: string;
  actorName: string;
  tenderId?: string;
  category: AuditCategory;
  action: string;
  detail: string;
  versionHash?: string;
}
