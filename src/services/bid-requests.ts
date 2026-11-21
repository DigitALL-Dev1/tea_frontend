/**
 * Bid Request API client - for tender approval workflow
 */

import { getStoredAuth } from "./auth";

const API_BASE = "http://127.0.0.1:8001/api/v1/bid-requests";

export interface BidRequest {
  id: number;
  tender_notice_id: string;
  from_user_id: number;
  from_username: string;
  from_full_name: string | null;
  to_user_id: number;
  to_username: string;
  to_full_name: string | null;
  bid_status: "pending" | "approved" | "rejected";
  notes: string | null;
  requested_at: string;
  updated_at: string;
}

export interface PendingBidRequestWithTender {
  bid_request: BidRequest;
  tender: {
    notice_id: string;
    published: string;
    deadline: string;
    organization: string;
    type: string;
    reference: string;
    country: string;
    title: string;
    url: string;
  } | null;
  tender_error: string | null;
}

export interface CreateBidRequestParams {
  tender_notice_id: string;
  to_username: string;
  notes?: string | undefined;
  tender_title?: string | undefined;
}

/**
 * Create a new bid request
 */
export async function createBidRequest(params: CreateBidRequestParams): Promise<BidRequest> {
  const auth = getStoredAuth();
  if (!auth) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE}/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${auth.token}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to create bid request" }));
    throw new Error(error.detail || "Failed to create bid request");
  }

  return await response.json();
}

/**
 * Update bid request status (approve/reject)
 */
export async function updateBidRequestStatus(
  bidRequestId: number,
  status: "approved" | "rejected"
): Promise<BidRequest> {
  const auth = getStoredAuth();
  if (!auth) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE}/${bidRequestId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${auth.token}`,
    },
    body: JSON.stringify({ bid_status: status }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to update bid status" }));
    throw new Error(error.detail || "Failed to update bid status");
  }

  return await response.json();
}

/**
 * Get pending bid requests with full tender data
 * Only returns requests where current user is the recipient
 */
export async function getPendingBidRequestsWithTenders(): Promise<PendingBidRequestWithTender[]> {
  const auth = getStoredAuth();
  if (!auth) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE}/pending`, {
    headers: {
      "Authorization": `Bearer ${auth.token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch pending bid requests" }));
    throw new Error(error.detail || "Failed to fetch pending bid requests");
  }

  return await response.json();
}

/**
 * Get my bid requests (sent/received/all)
 */
export async function getMyBidRequests(
  requestType: "sent" | "received" | "all" = "all"
): Promise<BidRequest[]> {
  const auth = getStoredAuth();
  if (!auth) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE}/my-requests?request_type=${requestType}`, {
    headers: {
      "Authorization": `Bearer ${auth.token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch bid requests" }));
    throw new Error(error.detail || "Failed to fetch bid requests");
  }

  return await response.json();
}

/**
 * Get bid requests for a specific tender
 */
export async function getBidRequestsByTender(tenderNoticeId: string): Promise<BidRequest[]> {
  const auth = getStoredAuth();
  if (!auth) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE}/tender/${encodeURIComponent(tenderNoticeId)}`, {
    headers: {
      "Authorization": `Bearer ${auth.token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch bid requests" }));
    throw new Error(error.detail || "Failed to fetch bid requests");
  }

  return await response.json();
}

/**
 * Get a specific bid request by ID
 */
export async function getBidRequestById(bidRequestId: number): Promise<BidRequest> {
  const auth = getStoredAuth();
  if (!auth) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE}/${bidRequestId}`, {
    headers: {
      "Authorization": `Bearer ${auth.token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch bid request" }));
    throw new Error(error.detail || "Failed to fetch bid request");
  }

  return await response.json();
}
