import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  FileDown,
  Loader2,
  Printer,
  Save,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/components/tea/role-context";
import {
  PROPOSAL_DOC_CSS,
  ProposalEditor,
  copyRichText,
  downloadAsWord,
} from "@/components/tea/proposal-editor";
import { getAiTender, saveProposal, type AiTenderDetail } from "@/services/ai-tenders";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ai-tenders/$aiTenderId")({
  head: () => ({
    meta: [{ title: "Proposal editor | TEA – GREEN DigitALL" }],
  }),
  component: ProposalPage,
});

const SOURCE_LABEL: Record<AiTenderDetail["proposal_source"], string> = {
  template: "Starter outline – the AI draft will replace it",
  ai: "AI draft",
  user: "Edited",
};

function fileNameFor(t: AiTenderDetail) {
  const base = (t.reference || t.title || `notice-${t.tender_notice_id}`)
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .slice(0, 80);
  return `Proposal - ${base || t.tender_notice_id}`;
}

function ProposalPage() {
  const { aiTenderId } = Route.useParams();
  const id = Number(aiTenderId);
  const { username } = useRole();
  const qc = useQueryClient();
  const editorRef = useRef<Editor | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ai-tenders", id],
    queryFn: () => getAiTender(id),
    enabled: username === "kowsalya" && Number.isFinite(id),
    refetchOnWindowFocus: false,
  });

  const save = useMutation({
    mutationFn: (content: string) => saveProposal(id, content),
    onSuccess: (updated) => {
      qc.setQueryData(["ai-tenders", id], updated);
      setDirty(false);
      toast.success("Proposal saved");
    },
    onError: (e: Error) => toast.error("Could not save", { description: e.message }),
  });

  const doSave = useCallback(() => {
    const content = editorRef.current?.getHTML() ?? html;
    if (content && !save.isPending) save.mutate(content);
  }, [html, save]);

  // Ctrl/Cmd+S saves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doSave]);

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const onChange = useCallback((next: string) => {
    setHtml(next);
    setDirty(true);
  }, []);
  const onReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  if (username !== "kowsalya") {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        This module is available to Kowsalya.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-12" />
        <Skeleton className="h-[60vh]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="rounded-lg border border-status-red/30 bg-card p-8 text-center text-sm">
          Could not load this tender: {(error as Error | null)?.message ?? "not found"}
        </div>
      </div>
    );
  }

  const t = data;
  const currentHtml = () => editorRef.current?.getHTML() ?? html ?? t.proposal_html;

  const exportWord = () => {
    downloadAsWord(currentHtml(), fileNameFor(t));
    toast.success("Word document downloaded");
  };

  const copy = async () => {
    if (!editorRef.current) return;
    try {
      await copyRichText(editorRef.current);
      toast.success("Copied – paste into Word to keep the formatting");
    } catch {
      toast.error("Copy failed – your browser blocked clipboard access");
    }
  };

  const print = () => {
    const w = window.open("", "_blank", "noopener=no");
    if (!w) {
      toast.error("Allow pop-ups to print");
      return;
    }
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${fileNameFor(t)}</title>` +
        `<style>@page{margin:2cm} ${PROPOSAL_DOC_CSS}</style></head><body>${currentHtml()}</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <BackLink />
          <h1 className="line-clamp-2 font-display text-xl font-bold leading-snug sm:text-2xl">
            {t.title || `UNGM Notice ${t.tender_notice_id}`}
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {t.agency && <span className="font-semibold text-foreground">{t.agency}</span>}
            {t.reference && <span className="font-mono">{t.reference}</span>}
            {t.deadline && <span>Deadline {t.deadline}</span>}
            {t.url && (
              <a
                href={t.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                UNGM notice <ExternalLink className="size-3" />
              </a>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
              dirty
                ? "bg-status-yellow/10 text-status-yellow"
                : t.proposal_source === "template"
                  ? "bg-muted text-muted-foreground"
                  : "bg-status-green/10 text-status-green",
            )}
          >
            {dirty ? (
              "Unsaved changes"
            ) : t.proposal_source === "template" ? (
              <>
                <Sparkles className="size-3" /> {SOURCE_LABEL.template}
              </>
            ) : (
              <>
                <Check className="size-3" /> {SOURCE_LABEL[t.proposal_source]}
                {t.proposal_updated_at &&
                  ` · ${new Date(t.proposal_updated_at.replace(" ", "T") + "Z").toLocaleString()}`}
              </>
            )}
          </span>
          <Button onClick={doSave} disabled={save.isPending || !dirty} className="gap-1.5" title="Save (Ctrl+S)">
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </Button>
          <Button variant="outline" onClick={exportWord} className="gap-1.5">
            <FileDown className="size-4" /> Download Word
          </Button>
          <Button variant="outline" onClick={() => void copy()} className="gap-1.5">
            <Copy className="size-4" /> Copy
          </Button>
          <Button variant="ghost" size="icon" onClick={print} title="Print or save as PDF" aria-label="Print or save as PDF">
            <Printer className="size-4" />
          </Button>
        </div>
      </div>

      <ProposalEditor key={t.id} content={t.proposal_html} onChange={onChange} onReady={onReady} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/ai-tenders"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> AI Processing
    </Link>
  );
}
