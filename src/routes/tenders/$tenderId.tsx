import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Countdown, DeadlineTriple } from "@/components/tea/deadline";
import { WorkflowStepper } from "@/components/tea/stepper";
import { VoidedBanner, WorkflowActions, OwnerLine } from "@/components/tea/tender/workflow-actions";
import { OverviewTab } from "@/components/tea/tender/overview-tab";
import { RequirementsTab } from "@/components/tea/tender/requirements-tab";
import { DocumentsTab } from "@/components/tea/tender/documents-tab";
import { ClarificationsTab } from "@/components/tea/tender/clarifications-tab";
import { ProposalTab } from "@/components/tea/tender/proposal-tab";
import { SuppliersTab } from "@/components/tea/tender/suppliers-tab";
import { CostingTab } from "@/components/tea/tender/costing-tab";
import { ApprovalsTab } from "@/components/tea/tender/approvals-tab";
import { useTender } from "@/hooks/use-tea";

const TABS = [
  ["overview", "Overview"],
  ["requirements", "Requirements"],
  ["documents", "Docs"],
  ["clarifications", "Q&A"],
  ["proposal", "Proposal"],
  ["suppliers", "Suppliers"],
  ["costing", "Costing"],
  ["approvals", "Approvals"],
] as const;
export type TenderTab = (typeof TABS)[number][0];

export const Route = createFileRoute("/tenders/$tenderId")({
  validateSearch: (search: Record<string, unknown>): { tab?: TenderTab } => {
    const tab = search["tab"];
    return TABS.some(([k]) => k === tab) ? { tab: tab as TenderTab } : {};
  },
  head: () => ({
    meta: [
      { title: "Tender | TEA – GREEN DigitALL" },
      {
        name: "description",
        content: "Tender workspace: requirements, documents, proposal, costing and approvals.",
      },
    ],
  }),
  component: TenderPage,
});

function TenderPage() {
  const { tenderId } = Route.useParams();
  const { tab = "overview" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: t, isLoading } = useTender(tenderId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (!t) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center">
        <p className="font-semibold">Tender not found.</p>
        <Link to="/tenders" className="mt-2 inline-block text-sm text-primary hover:underline">
          Back to tenders
        </Link>
      </div>
    );
  }

  const setTab = (v: string) => void navigate({ search: { tab: v as TenderTab }, replace: true });

  return (
    <div className="space-y-4">
      <Link
        to="/tenders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All tenders
      </Link>

      <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold leading-snug sm:text-2xl">{t.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.agency} · <span className="font-mono">{t.reference}</span>
              <a
                href={t.ungmUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-2 inline-flex items-center text-primary"
                aria-label="View on UNGM"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </p>
          </div>
          <div className="shrink-0 sm:text-right">
            <Countdown notice={t.deadlineNotice} />
            <DeadlineTriple notice={t.deadlineNotice} layout="compact" className="mt-1" />
          </div>
        </div>
        <WorkflowStepper tender={t} />
        <OwnerLine tender={t} />
      </section>

      <VoidedBanner tender={t} onReview={() => setTab("approvals")} />
      <WorkflowActions tender={t} onGoToTab={setTab} />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-auto w-max justify-start">
            {TABS.map(([k, label]) => (
              <TabsTrigger key={k} value={k} className="px-3 py-1.5">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview">
          <OverviewTab tender={t} />
        </TabsContent>
        <TabsContent value="requirements">
          <RequirementsTab tender={t} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab tender={t} />
        </TabsContent>
        <TabsContent value="clarifications">
          <ClarificationsTab tender={t} />
        </TabsContent>
        <TabsContent value="proposal">
          <ProposalTab tender={t} />
        </TabsContent>
        <TabsContent value="suppliers">
          <SuppliersTab tender={t} />
        </TabsContent>
        <TabsContent value="costing">
          <CostingTab tender={t} />
        </TabsContent>
        <TabsContent value="approvals">
          <ApprovalsTab tender={t} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
