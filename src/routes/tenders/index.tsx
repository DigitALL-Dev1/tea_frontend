import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ArrowDownUp, ExternalLink, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/tea/app-shell";
import { Countdown, DaysLeft } from "@/components/tea/deadline";
import { SendBidRequestDialog } from "@/components/tea/send-bid-request-dialog";
import { useRole } from "@/components/tea/role-context";
import { useUngmTenders } from "@/hooks/use-tea";
import { deadlineFormats, parseNoticeDeadline } from "@/lib/deadline";
import type { UngmSearchFilters } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tenders/")({
  head: () => ({
    meta: [
      { title: "Tenders | TEA – GREEN DigitALL" },
      {
        name: "description",
        content: "Live UN tenders from UNGM, filtered by keyword, agency, country and deadline.",
      },
    ],
  }),
  component: TendersPage,
});

const ALL = "all";
type SortKey = "deadline" | "published";

/** Delay text filters so we don't hit the backend on every keystroke. */
function useDebounced<T>(value: T, ms = 600): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** UNGM deadlines are usually "18-Nov-2026 16:00 (GMT 2.00)"; anything else is shown as text. */
function isNotice(s: string) {
  try {
    parseNoticeDeadline(s);
    return true;
  } catch {
    return false;
  }
}

function TendersPage() {
  const [q, setQ] = useState("");
  const [agency, setAgency] = useState("");
  const [country, setCountry] = useState("");
  const [within, setWithin] = useState<string>(ALL);
  const [limit, setLimit] = useState("25");
  const [sort, setSort] = useState<SortKey>("deadline");
  const { username } = useRole();

  const dq = useDebounced(q);
  const dAgency = useDebounced(agency);
  const dCountry = useDebounced(country);

  const filters = useMemo<UngmSearchFilters>(() => {
    const f: UngmSearchFilters = {
      title: dq,
      organization: dAgency ? [dAgency] : [],
      country: dCountry ? [dCountry] : [],
      sort,
      limit: Number(limit),
    };
    if (within !== ALL) {
      const today = new Date();
      f.deadlineFrom = isoDay(today);
      f.deadlineTo = isoDay(new Date(today.getTime() + Number(within) * 86_400_000));
    }
    return f;
  }, [dq, dAgency, dCountry, within, limit, sort]);

  const { data, error, isFetching } = useUngmTenders(filters);
  const rows = data?.tenders ?? [];

  const anyFilter = q || agency || country || within !== ALL;
  const clear = () => {
    setQ("");
    setAgency("");
    setCountry("");
    setWithin(ALL);
  };

  const SortHead = ({
    k,
    children,
    className,
  }: {
    k: SortKey;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => setSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {children}
        <ArrowDownUp className={cn("size-3", sort === k ? "text-primary" : "opacity-40")} />
      </button>
    </TableHead>
  );

  return (
    <div>
      <PageHeader title="Tenders" description="Live UN tenders from UNGM, via the TEA backend." />

      <div className="mb-4 grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(4,1fr)_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title…"
            className="pl-8"
            aria-label="Search tenders"
          />
        </div>
        <Input
          value={agency}
          onChange={(e) => setAgency(e.target.value)}
          placeholder="Agency, e.g. UNDP"
          aria-label="Agency"
          className={cn(agency && "border-primary/50 bg-secondary")}
        />
        <Input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="Country"
          aria-label="Country"
          className={cn(country && "border-primary/50 bg-secondary")}
        />
        <FilterSelect
          label="Deadline"
          value={within}
          onChange={setWithin}
          options={[
            ["7", "Next 7 days"],
            ["14", "Next 14 days"],
            ["30", "Next 30 days"],
          ]}
        />
        <Select value={limit} onValueChange={setLimit}>
          <SelectTrigger aria-label="Results">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["10", "25", "50", "100"].map((n) => (
              <SelectItem key={n} value={n}>
                {n} results
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          onClick={clear}
          disabled={!anyFilter}
          className="justify-self-start"
        >
          <X /> Clear
        </Button>
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        {isFetching ? "Loading from UNGM…" : `${rows.length} tenders`} · deadlines shown as notice
        text and PNG time (UTC+10)
        {(agency || country) && " · agency/country searches can take longer"}
      </p>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-red" />
          <div>
            <p className="font-semibold">Could not load tenders</p>
            <p className="text-muted-foreground">{(error as Error).message}</p>
          </div>
        </div>
      ) : !data ? (
        <Skeleton className="h-96" />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
          No tenders match these filters.
        </div>
      ) : (
        <div className={cn(isFetching && "opacity-60 transition-opacity")}>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Country</TableHead>
                  <SortHead k="published">Published</SortHead>
                  <SortHead k="deadline">Deadline</SortHead>
                  <TableHead className="text-right">Days left</TableHead>
                  {username === "kowsalya" && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => {
                  const ok = isNotice(t.deadline);
                  const f = ok ? deadlineFormats(t.deadline) : null;
                  return (
                    <TableRow key={t.notice_id} className="cursor-pointer">
                      <TableCell
                        className="max-w-[300px]"
                        onClick={() => window.open(t.url, "_blank", "noopener,noreferrer")}
                      >
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group inline-flex items-start gap-1 font-medium hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="line-clamp-2">{t.title}</span>
                          <ExternalLink className="mt-0.5 size-3.5 shrink-0 opacity-40 group-hover:opacity-100" />
                        </a>
                      </TableCell>
                      <TableCell
                        className="font-semibold"
                        onClick={() => window.open(t.url, "_blank", "noopener,noreferrer")}
                      >
                        {t.organization}
                      </TableCell>
                      <TableCell
                        className="text-xs"
                        onClick={() => window.open(t.url, "_blank", "noopener,noreferrer")}
                      >
                        {t.type}
                      </TableCell>
                      <TableCell
                        className="font-mono text-xs"
                        onClick={() => window.open(t.url, "_blank", "noopener,noreferrer")}
                      >
                        {t.reference}
                      </TableCell>
                      <TableCell
                        className="text-sm"
                        onClick={() => window.open(t.url, "_blank", "noopener,noreferrer")}
                      >
                        {t.country}
                      </TableCell>
                      <TableCell
                        className="whitespace-nowrap text-xs tabular-nums"
                        onClick={() => window.open(t.url, "_blank", "noopener,noreferrer")}
                      >
                        {t.published}
                      </TableCell>
                      <TableCell
                        className="whitespace-nowrap text-xs"
                        onClick={() => window.open(t.url, "_blank", "noopener,noreferrer")}
                      >
                        {f ? (
                          <>
                            <div className="tabular-nums">{f.notice}</div>
                            <div className="tabular-nums text-muted-foreground">{f.utc}</div>
                            <div className="font-semibold tabular-nums">{f.png}</div>
                          </>
                        ) : (
                          <div className="tabular-nums">{t.deadline}</div>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={() => window.open(t.url, "_blank", "noopener,noreferrer")}
                      >
                        {ok ? <DaysLeft notice={t.deadline} /> : "—"}
                      </TableCell>
                      {username === "kowsalya" && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <SendBidRequestDialog
                            tenderNoticeId={t.notice_id}
                            tenderTitle={t.title}
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map((t) => {
              const ok = isNotice(t.deadline);
              return (
                <li key={t.notice_id}>
                  <div className="rounded-lg border bg-card p-3">
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block active:bg-muted"
                    >
                      <div className="font-medium leading-snug">{t.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {t.organization} · {t.country} ·{" "}
                        <span className="font-mono">{t.reference}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        {ok && <Countdown notice={t.deadline} />}
                        <span className="text-muted-foreground">{t.type}</span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {t.deadline}
                        {ok && (
                          <>
                            {" · "}
                            <span className="font-semibold text-foreground">
                              {deadlineFormats(t.deadline).png}
                            </span>
                          </>
                        )}
                      </div>
                    </a>
                    {username === "kowsalya" && (
                      <div className="mt-3 border-t pt-3">
                        <SendBidRequestDialog
                          tenderNoticeId={t.notice_id}
                          tenderTitle={t.title}
                        />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={label}
        className={cn(value !== ALL && "border-primary/50 bg-secondary")}
      >
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All · {label}</SelectItem>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
