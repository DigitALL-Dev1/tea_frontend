import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Clock, ExternalLink, User, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPendingBidRequestsWithTenders, updateBidRequestStatus } from "@/services/bid-requests";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { deadlineFormats } from "@/lib/deadline";
import { Countdown } from "./deadline";

export function PendingBidRequests() {
  const queryClient = useQueryClient();
  
  const { data: pendingRequests, isLoading } = useQuery({
    queryKey: ["bid-requests", "pending"],
    queryFn: getPendingBidRequestsWithTenders,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const approveMutation = useMutation({
    mutationFn: (bidRequestId: number) => updateBidRequestStatus(bidRequestId, "approved"),
    onSuccess: (_, bidRequestId) => {
      toast.success("Bid request approved!");
      void queryClient.invalidateQueries({ queryKey: ["bid-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to approve", { description: error.message });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (bidRequestId: number) => updateBidRequestStatus(bidRequestId, "rejected"),
    onSuccess: () => {
      toast.success("Bid request rejected");
      void queryClient.invalidateQueries({ queryKey: ["bid-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to reject", { description: error.message });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!pendingRequests || pendingRequests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-10 text-center">
        <CheckCircle2 className="size-10 text-status-green" />
        <p className="font-semibold">No pending requests</p>
        <p className="text-sm text-muted-foreground">
          All bid requests have been reviewed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingRequests.map((item) => {
        const { bid_request, tender, tender_error } = item;
        const isProcessing = approveMutation.isPending || rejectMutation.isPending;

        return (
          <div
            key={bid_request.id}
            className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="size-4" />
                  <span>
                    From <strong className="text-foreground">{bid_request.from_username}</strong>
                  </span>
                  <span className="text-xs">•</span>
                  <Calendar className="size-3.5" />
                  <span className="text-xs">
                    {new Date(bid_request.requested_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 rounded-full bg-status-yellow/10 px-2.5 py-1 text-xs font-medium text-status-yellow">
                <Clock className="size-3" />
                Pending
              </div>
            </div>

            {/* Tender Information */}
            {tender ? (
              <div className="mt-4 space-y-3">
                <div>
                  <a
                    href={tender.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex items-start gap-1.5 text-lg font-semibold leading-tight hover:text-primary"
                  >
                    <span>{tender.title}</span>
                    <ExternalLink className="mt-0.5 size-4 shrink-0 opacity-40 group-hover:opacity-100" />
                  </a>
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  {tender.organization && (
                    <div>
                      <span className="text-muted-foreground">Agency: </span>
                      <span className="font-medium">{tender.organization}</span>
                    </div>
                  )}
                  {tender.country && (
                    <div>
                      <span className="text-muted-foreground">Country: </span>
                      <span className="font-medium">{tender.country}</span>
                    </div>
                  )}
                  {tender.type && (
                    <div>
                      <span className="text-muted-foreground">Type: </span>
                      <span className="font-medium">{tender.type}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Reference: </span>
                    <span className="font-mono text-xs font-medium">{tender.reference}</span>
                  </div>
                </div>

                {/* Deadline */}
                {tender.deadline && (
                  <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted/50 p-3">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Deadline: </span>
                      <span className="font-semibold">{tender.deadline}</span>
                    </div>
                    <Countdown notice={tender.deadline} />
                  </div>
                )}
              </div>
            ) : tender_error ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-md border border-status-yellow/20 bg-status-yellow/5 p-4">
                  <div className="flex items-start gap-2">
                    <ExternalLink className="mt-0.5 size-4 shrink-0 text-status-yellow" />
                    <div className="flex-1 space-y-2">
                      <div>
                        <strong className="text-sm">Tender Notice ID:</strong>{" "}
                        <span className="font-mono text-sm">{bid_request.tender_notice_id}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Could not automatically fetch tender details. Click below to view on UNGM.
                      </div>
                      <a
                        href={`https://www.ungm.org/Public/Notice/${bid_request.tender_notice_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      >
                        <ExternalLink className="size-3.5" />
                        Open Tender on UNGM Website
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-md bg-muted p-3 text-sm">
                <strong>Tender Notice ID:</strong>{" "}
                <a
                  href={`https://www.ungm.org/Public/Notice/${bid_request.tender_notice_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-primary hover:underline"
                >
                  {bid_request.tender_notice_id}
                </a>
              </div>
            )}

            {/* Notes */}
            {bid_request.notes && (
              <div className="mt-3 rounded-md border bg-muted/30 p-3">
                <div className="text-xs font-medium text-muted-foreground">Notes from {bid_request.from_username}:</div>
                <div className="mt-1 text-sm">{bid_request.notes}</div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              <Button
                onClick={() => approveMutation.mutate(bid_request.id)}
                disabled={isProcessing}
                className="gap-1.5"
              >
                {approveMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    Approve Bid
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                onClick={() => rejectMutation.mutate(bid_request.id)}
                disabled={isProcessing}
                className="gap-1.5"
              >
                {rejectMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="size-4" />
                    Reject Bid
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                asChild
                className="ml-auto gap-1.5"
              >
                <a
                  href={tender?.url || `https://www.ungm.org/Public/Notice/${bid_request.tender_notice_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="size-4" />
                  View on UNGM
                </a>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
