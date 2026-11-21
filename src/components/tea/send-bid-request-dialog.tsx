import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createBidRequest } from "@/services/bid-requests";
import { toast } from "sonner";
import { useRole } from "./role-context";

interface SendBidRequestDialogProps {
  tenderNoticeId: string;
  tenderTitle: string;
  children?: React.ReactNode;
}

export function SendBidRequestDialog({
  tenderNoticeId,
  tenderTitle,
  children,
}: SendBidRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const { username } = useRole();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      createBidRequest({
        tender_notice_id: tenderNoticeId,
        to_username: "bernard", // Always send to Bernard
        notes: notes || undefined,
        tender_title: tenderTitle,
      }),
    onSuccess: () => {
      toast.success("Bid request sent to Bernard!", {
        description: `Tender: ${tenderTitle}`,
      });
      setOpen(false);
      setNotes("");
      // Invalidate queries to refresh the list
      void queryClient.invalidateQueries({ queryKey: ["bid-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to send bid request", {
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  // Only show for kowsalya
  if (username !== "kowsalya") {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" variant="outline" className="gap-1">
            <Send className="size-3.5" />
            Send to Bernard
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send Bid Request to Bernard</DialogTitle>
            <DialogDescription>
              Ask Bernard if we should bid on this tender.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tender</Label>
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="font-medium">{tenderTitle}</div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {tenderNoticeId}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">
                Notes <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Should we bid on this project? Add any relevant context..."
                rows={4}
                disabled={mutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Bernard will review and approve or reject this bid request.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Send Request
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
