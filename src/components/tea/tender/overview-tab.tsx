import { ListChecks, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiBadge, RecommendationBadge, ScoreBadge } from "../badges";
import { formatPngShort } from "@/lib/deadline";
import { usd } from "@/lib/format";
import type { Tender } from "@/types";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}

export function OverviewTab({ tender: t }: { tender: Tender }) {
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">{t.description}</p>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Country">{t.country}</Field>
              <Field label="Value">{usd(t.estimatedValueUsd)}</Field>
              <Field label="Type">{t.procurementType}</Field>
              <Field label="Category">{t.category}</Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="size-4" /> Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              {t.submissionRules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit border-status-violet/25 lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            AI view <AiBadge />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!t.ai ? (
            <p className="text-sm text-muted-foreground">Not analysed yet</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <ScoreBadge score={t.ai.score} size="lg" />
                <div>
                  <RecommendationBadge rec={t.ai.recommendation} />
                </div>
              </div>
              <p className="rounded-md bg-status-violet-soft/50 p-3 text-sm leading-relaxed">
                {t.ai.summary}
              </p>
              <div>
                <h3 className="mb-1.5 text-sm font-semibold">Reasons</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {t.ai.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              {t.ai.risks.length > 0 && (
                <div>
                  <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-status-amber">
                    <AlertTriangle className="size-4" /> Risks
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {t.ai.risks.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="border-t pt-2 text-xs text-muted-foreground">
                {t.ai.model} · {formatPngShort(t.ai.generatedAt)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
