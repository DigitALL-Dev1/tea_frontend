import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/tea/app-shell";
import { PendingBidRequests } from "@/components/tea/pending-bid-requests";
import { useRole } from "@/components/tea/role-context";

export const Route = createFileRoute("/approvals")({
  head: () => ({
    meta: [
      { title: "My approvals | TEA – GREEN DigitALL" },
      {
        name: "description",
        content: "Decisions waiting for you: approve, return or reject with a reason.",
      },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { username } = useRole();

  return (
    <div>
      <PageHeader title="Approvals" />
      {username === "bernard" ? (
        <PendingBidRequests />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-10 text-center">
          <CheckCircle2 className="size-10 text-status-green" />
          <p className="font-semibold">All clear</p>
        </div>
      )}
    </div>
  );
}
