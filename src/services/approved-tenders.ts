/**
 * Approved tenders API client.
 * Tenders Bernard approved; the backend stores the full UNGM notice for each one.
 */

import { getStoredAuth } from "./auth";
import { API_BASE_URL } from "./api-config";

const API_BASE = `${API_BASE_URL}/api/v1/approved-tenders`;

export interface ApprovedTender {
  id: number;
  bid_request_id: number;
  tender_notice_id: string;
  url: string;
  title: string | null;
  agency: string | null;
  notice_type: string | null;
  reference: string | null;
  countries: string | null;
  registration_level: string | null;
  published: string | null;
  deadline: string | null;
  notice_status: string | null;
  description: string | null;
  contacts: Record<string, string>[];
  links: { url: string; description: string }[];
  unspsc_codes: string[];
  ai_context: string | null;
  notes: string | null;
  requested_by_username: string;
  approved_by_username: string;
  approved_by_full_name: string | null;
  approved_at: string | null;
  fetch_status: "pending" | "ok" | "error";
  fetch_error: string | null;
  fetched_at: string | null;
  ai_tender_id: number | null;
  ai_status: "queued" | "processing" | "done" | "error" | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = getStoredAuth();
  if (!auth) throw new Error("Not authenticated");

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${auth.token}` },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || "Request failed");
  }
  return (await response.json()) as T;
}

/** Approved tenders the current user requested or approved, newest first. */
export function getApprovedTenders(): Promise<ApprovedTender[]> {
  return request<ApprovedTender[]>("");
}

/** Re-fetch one tender's details from UNGM. */
export function refreshApprovedTender(id: number): Promise<ApprovedTender> {
  return request<ApprovedTender>(`/${id}/refresh`, { method: "POST" });
}
