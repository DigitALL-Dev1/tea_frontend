import { useEffect, useState } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setPrice } from "@/services";
import { useSettings, useTeaAction } from "@/hooks/use-tea";
import { costTotal, lineTotal, marginPct, priceForMargin } from "@/lib/workflow";
import { pct, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Tender } from "@/types";
import { useRole } from "../role-context";
import { isLocked } from "./workflow-actions";

export function CostingTab({ tender: t }: { tender: Tender }) {
  const { user } = useRole();
  const { data: settings } = useSettings();
  const warnAt = settings?.marginWarningPct ?? 25;
  const cost = costTotal(t.costing);
  const margin = marginPct(t.costing);
  const isCeo = user.role === "CEO";
  const canEdit = isCeo && !isLocked(t) && t.costing.lines.length > 0;

  const [price, setPriceInput] = useState(t.costing.priceUsd?.toString() ?? "");
  const [marginInput, setMarginInput] = useState(margin?.toFixed(1) ?? "");
  useEffect(() => {
    setPriceInput(t.costing.priceUsd?.toString() ?? "");
    setMarginInput(marginPct(t.costing)?.toFixed(1) ?? "");
  }, [t.costing]);
  const action = useTeaAction(setPrice, "Price saved");

  const draftPrice = Number(price);
  const draftMargin = draftPrice > 0 ? ((draftPrice - cost) / draftPrice) * 100 : undefined;
  const shownMargin = canEdit ? draftMargin : margin;
  const low = shownMargin !== undefined && shownMargin < warnAt;

  if (t.costing.lines.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No cost sheet yet. Costing is built from supplier quotes after the G2 technical approval.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="overflow-x-auto rounded-lg border bg-card lg:col-span-2">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead>Cost line</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit (USD)</TableHead>
              <TableHead className="text-right">Total (USD)</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {t.costing.lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.description}</TableCell>
                <TableCell className="text-right tabular-nums">{l.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {l.unitCostUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {lineTotal(l).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {l.quoteId ? <span className="font-medium text-foreground">Quote </span> : null}
                  {l.source}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="font-semibold">
                Total cost
              </TableCell>
              <TableCell className="text-right font-bold tabular-nums">
                {cost.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <section
        className="h-fit space-y-4 rounded-lg border bg-card p-4"
        aria-label="Price and margin"
      >
        <h2 className="font-display font-bold">Price and margin</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Total cost</dt>
            <dd className="font-display text-lg font-bold tabular-nums">{usd(cost)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Bid price</dt>
            <dd className="font-display text-lg font-bold tabular-nums">
              {usd(t.costing.priceUsd)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Margin</dt>
            <dd
              className={cn(
                "font-display text-3xl font-bold tabular-nums",
                low ? "text-status-red" : "text-status-green",
              )}
            >
              {pct(shownMargin)}
            </dd>
          </div>
        </dl>

        {low && (
          <p
            className="flex items-start gap-2 rounded-md bg-status-amber-soft px-3 py-2 text-sm text-status-amber"
            role="status"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Margin below {warnAt}%
          </p>
        )}

        {canEdit ? (
          <form
            className="space-y-3 border-t pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(t.id, draftPrice);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="price">Price (USD)</Label>
                <Input
                  id="price"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => {
                    setPriceInput(e.target.value);
                    const p = Number(e.target.value);
                    setMarginInput(p > 0 ? (((p - cost) / p) * 100).toFixed(1) : "");
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="margin">Margin (%)</Label>
                <Input
                  id="margin"
                  inputMode="decimal"
                  value={marginInput}
                  onChange={(e) => {
                    setMarginInput(e.target.value);
                    const m = Number(e.target.value);
                    if (Number.isFinite(m) && m < 100 && e.target.value !== "")
                      setPriceInput(priceForMargin(cost, m).toFixed(0));
                  }}
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!(draftPrice > 0) || draftPrice === t.costing.priceUsd || action.pending}
            >
              Save price
            </Button>
          </form>
        ) : (
          <p className="flex items-start gap-2 border-t pt-4 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            {isCeo ? "Price locked" : "CEO sets the price"}
          </p>
        )}
      </section>
    </div>
  );
}
