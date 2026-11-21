/**
 * Dashboard API client: counts and recent activity for the logged-in user.
 */

import { getStoredAuth } from "./auth";
import { API_BASE_URL } from "./api-config";

export interface DashboardRequest {
  id: number;
  tender_notice_id: string;
  title: string | null;
  bid_status: "pending" | "approved" | "rejected";
  notes: string | null;
  requested_at: string;
  updated_at: string;
  direction: "sent" | "received";
  other_user: string;
  approved_tender_id: number | null;
}

export interface DashboardDeadline {
  id: number;
  tender_notice_id: string;
  title: string | null;
  agency: string | null;
  deadline: string | null;
  deadline_utc: string | null;
  notice_status: string | null;
  approved_at: string | null;
  ai_tender_id: number | null;
}

export interface DashboardProposal {
  id: number;
  tender_notice_id: string;
  title: string | null;
  agency: string | null;
  deadline: string | null;
  deadline_utc: string | null;
  status: "queued" | "processing" | "done" | "error";
  proposal_source: "template" | "ai" | "user";
  proposal_updated_at: string | null;
  moved_at: string | null;
}

export interface DashboardData {
  user: { id: number; username: string; full_name: string | null };
  counts: {
    sent_pending: number;
    sent_approved: number;
    sent_rejected: number;
    to_review: number;
    approved_by_me: number;
    rejected_by_me: number;
    ai_total: number;
    ai_queued: number;
    ai_processing: number;
    ai_done: number;
    ai_proposals_edited: number;
    approved_tenders: number;
    approved_open: number;
  };
  recent_requests: DashboardRequest[];
  upcoming_deadlines: DashboardDeadline[];
  proposals: DashboardProposal[];
}

export async function getDashboard(): Promise<DashboardData> {
  const auth = getStoredAuth();
  if (!auth) throw new Error("Not authenticated");
  const response = await fetch(`${API_BASE_URL}/api/v1/dashboard`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to load dashboard" }));
    throw new Error(error.detail || "Failed to load dashboard");
  }
  return (await response.json()) as DashboardData;
}
