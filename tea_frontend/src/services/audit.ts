import type { AuditEntry } from "@/types";
import { clone, delay, state } from "./store";

export async function getAuditLog(
  filter: { tenderId?: string; limit?: number } = {},
): Promise<AuditEntry[]> {
  await delay();
  let rows = state.audit;
  if (filter.tenderId) rows = rows.filter((r) => r.tenderId === filter.tenderId);
  if (filter.limit) rows = rows.slice(0, filter.limit);
  return clone(rows);
}
