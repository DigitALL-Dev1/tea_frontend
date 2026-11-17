import { cn } from "@/lib/utils";
import { STAGE_LABEL, isTerminal, stageIndex } from "@/lib/workflow";
import { WORKFLOW_STAGES, type Tender } from "@/types";

/** Simple progress: "Step 4 of 11 · G2 review" and a segmented bar. Hover a segment for its name. */
export function WorkflowStepper({
  tender,
}: {
  tender: Pick<Tender, "stage" | "lastWorkflowStage" | "post">;
}) {
  const terminal = isTerminal(tender.stage);
  const reference = terminal ? (tender.lastWorkflowStage ?? "DISCOVERED") : tender.stage;
  const current = stageIndex(reference);
  const finished =
    tender.stage === "POST_SUBMISSION" && tender.post && tender.post.outcome !== "PENDING";
  const total = WORKFLOW_STAGES.length;

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
        <span className={cn("font-semibold", terminal && "text-status-red")}>
          {terminal ? STAGE_LABEL[tender.stage] : STAGE_LABEL[reference]}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          Step {current + 1} of {total}
        </span>
      </div>
      <ol className="flex gap-1" aria-label={`Step ${current + 1} of ${total}`}>
        {WORKFLOW_STAGES.map((s, i) => {
          const done = i < current || (i === current && Boolean(finished));
          const active = i === current && !finished;
          return (
            <li
              key={s}
              title={`${i + 1}. ${STAGE_LABEL[s]}`}
              aria-current={active ? "step" : undefined}
              className={cn(
                "h-2 flex-1 rounded-full",
                done && "bg-primary",
                active && (terminal ? "bg-status-red" : "bg-primary/45"),
                !done && !active && "bg-muted",
              )}
            >
              <span className="sr-only">{STAGE_LABEL[s]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
