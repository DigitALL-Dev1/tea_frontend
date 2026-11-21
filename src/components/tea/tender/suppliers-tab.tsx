import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSuppliers } from "@/hooks/use-tea";
import { deadlineUtc, formatPngDate, formatPngShort } from "@/lib/deadline";
import { money, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Quote, RfqStatus, Tender } from "@/types";
import { Pill } from "../badges";
import { useNow } from "../deadline";
import { EmailCard } from "./email-card";

const RFQ_TONE: Record<RfqStatus, ["slate" | "amber" | "green" | "red", string]> = {
  DRAFT: ["amber", "Draft · pending GC"],
  SENT: ["slate", "Sent"],
  RESPONDED: ["green", "Quote received"],
  DECLINED: ["red", "Declined"],
};

export function quoteTotalUsd(q: Quote): number {
  return q.lines.reduce((s, l) => s + l.quantity * l.unitPrice * q.fxToUsd, 0);
}

/** expired | expires before the tender deadline or within 7 days | ok */
function expiry(q: Quote, deadline: Date, now: Date): "expired" | "soon" | "ok" {
  const until = new Date(q.validUntil).getTime();
  if (until <= now.getTime()) return "expired";
  if (until < deadline.getTime() || until - now.getTime() < 7 * 86_400_000) return "soon";
  return "ok";
}

export function SuppliersTab({ tender: t }: { tender: Tender }) {
  const { data: suppliers } = useSuppliers();
  const now = useNow();
  const navigate = useNavigate();
  const supplierName = (id: string) => suppliers?.find((s) => s.id === id)?.name ?? "…";
  const deadline = deadlineUtc(t.deadlineNotice);
  const rfqEmails = t.emails.filter((e) => e.kind === "RFQ");

  const items = [
    ...new Map(t.quotes.flatMap((q) => q.lines.map((l) => [l.itemKey, l] as const))).values(),
  ];
  const usedQuoteIds = new Set(t.costing.lines.map((l) => l.quoteId).filter(Boolean));

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-display font-bold">Requests for quotation</h2>
        {t.rfqs.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            No RFQs sent yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Reply due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.rfqs.map((r) => {
                  const [tone, label] = RFQ_TONE[r.status];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{supplierName(r.supplierId)}</TableCell>
                      <TableCell>
                        <Pill tone={tone}>{label}</Pill>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.sentAt ? formatPngShort(r.sentAt) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{formatPngDate(r.dueAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {rfqEmails.length > 0 && (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {rfqEmails.map((e) => (
              <EmailCard
                key={e.id}
                tender={t}
                email={e}
                onDecide={() =>
                  void navigate({ to: "/approvals" })
                }
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-display font-bold">Quotes received</h2>
        {t.quotes.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            No quotes yet.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {t.quotes.map((q) => {
              const state = now ? expiry(q, deadline, now) : "ok";
              return (
                <article
                  key={q.id}
                  className={cn(
                    "rounded-lg border bg-card p-3",
                    state === "expired" && "border-status-red/50",
                    state === "soon" && "border-status-amber/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{supplierName(q.supplierId)}</div>
                      <div className="font-mono text-xs text-muted-foreground">{q.reference}</div>
                    </div>
                    {usedQuoteIds.has(q.id) && (
                      <Pill tone="green">
                        <CheckCircle2 className="size-3" /> In cost sheet
                      </Pill>
                    )}
                  </div>
                  <div className="mt-2 font-display text-xl font-bold tabular-nums">
                    {usd(quoteTotalUsd(q))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {q.currency !== "USD"
                      ? `${money(
                          q.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
                          q.currency,
                        )} @ ${q.fxToUsd} · `
                      : ""}
                    Lead time {q.leadTimeDays} days
                  </div>
                  <div
                    className={cn(
                      "mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
                      state === "expired" && "bg-status-red text-white",
                      state === "soon" && "bg-status-amber-soft text-status-amber",
                      state === "ok" && "bg-muted text-muted-foreground",
                    )}
                  >
                    {state !== "ok" && <AlertTriangle className="size-3.5" />}
                    {state === "expired"
                      ? `Expired ${formatPngDate(q.validUntil)} — ask for a renewed quote`
                      : state === "soon"
                        ? `Valid until ${formatPngDate(q.validUntil)} — expires before the deadline or within 7 days`
                        : `Valid until ${formatPngDate(q.validUntil)}`}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {t.quotes.length > 1 && (
        <section>
          <h2 className="mb-2 font-display font-bold">Side-by-side comparison (USD)</h2>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  {t.quotes.map((q) => (
                    <TableHead key={q.id} className="text-right">
                      {supplierName(q.supplierId)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const prices = t.quotes.map((q) => {
                    const l = q.lines.find((x) => x.itemKey === item.itemKey);
                    return l ? l.quantity * l.unitPrice * q.fxToUsd : undefined;
                  });
                  const best = Math.min(...prices.filter((p): p is number => p !== undefined));
                  return (
                    <TableRow key={item.itemKey}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                      {prices.map((p, i) => (
                        <TableCell
                          key={t.quotes[i]!.id}
                          className={cn(
                            "text-right tabular-nums",
                            p === best && "font-bold text-status-green",
                          )}
                        >
                          {p === undefined ? "—" : usd(p)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell />
                  {t.quotes.map((q) => (
                    <TableCell key={q.id} className="text-right tabular-nums">
                      {usd(quoteTotalUsd(q))}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Lead time / valid until</TableCell>
                  <TableCell />
                  {t.quotes.map((q) => (
                    <TableCell key={q.id} className="text-right text-xs text-muted-foreground">
                      {q.leadTimeDays} d · {formatPngDate(q.validUntil)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Lowest in green · USD</p>
        </section>
      )}
    </div>
  );
}
