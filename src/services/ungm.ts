/**
 * Live UNGM tender search, served by the TEA backend (tea_backend/api/get_tender.py).
 * Unlike the rest of src/services this is NOT mock data: it calls GET /api/v1/tenders.
 * Set VITE_API_BASE_URL to point at the backend (default http://127.0.0.1:8001).
 */

export const API_BASE_URL = (
  (import.meta.env?.["VITE_API_BASE_URL"] as string | undefined) ?? "http://127.0.0.1:8001"
).replace(/\/+$/, "");

export interface UngmTender {
  notice_id: string;
  published: string;
  deadline: string;
  organization: string;
  type: string;
  reference: string;
  country: string;
  title: string;
  url: string;
}

export interface UngmSearchFilters {
  title?: string;
  description?: string;
  reference?: string;
  country?: string[];
  organization?: string[];
  noticeType?: string[];
  /** ISO dates (yyyy-mm-dd), converted to UNGM's "15-Nov-2026" format before sending. */
  publishedFrom?: string;
  publishedTo?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  includeClosed?: boolean;
  sort?: "deadline" | "published";
  limit?: number;
  fetchAll?: boolean;
}

export interface UngmSearchResult {
  count: number;
  filters: Record<string, unknown>;
  tenders: UngmTender[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-15" → "15-Nov-2026" (the format UNGM and the backend expect). */
export function toUngmDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1]}`;
}

export function buildUngmQuery(f: UngmSearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  const text = (k: string, v?: string) => v?.trim() && p.append(k, v.trim());
  const list = (k: string, v?: string[]) => v?.forEach((x) => x.trim() && p.append(k, x.trim()));
  const date = (k: string, v?: string) => v && toUngmDate(v) && p.append(k, toUngmDate(v));

  text("title", f.title);
  text("description", f.description);
  text("reference", f.reference);
  list("country", f.country);
  list("organization", f.organization);
  list("notice_type", f.noticeType);
  date("published_from", f.publishedFrom);
  date("published_to", f.publishedTo);
  date("deadline_from", f.deadlineFrom);
  date("deadline_to", f.deadlineTo);
  if (f.includeClosed) p.set("include_closed", "true");
  if (f.sort) p.set("sort", f.sort);
  if (f.limit) p.set("limit", String(f.limit));
  if (f.fetchAll) p.set("fetch_all", "true");
  return p;
}

export async function searchUngmTenders(
  filters: UngmSearchFilters,
  signal?: AbortSignal,
): Promise<UngmSearchResult> {
  const url = `${API_BASE_URL}/api/v1/tenders?${buildUngmQuery(filters).toString()}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: signal ?? null, credentials: "include" });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error(`Cannot reach the TEA backend at ${API_BASE_URL}. Is it running?`);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return (await res.json()) as UngmSearchResult;
}
