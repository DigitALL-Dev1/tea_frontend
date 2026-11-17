import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowDownUp, Search, X } from "lucide-react";
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
import { AiBadge, ScoreBadge, StageBadge } from "@/components/tea/badges";
import { Countdown, DaysLeft, useNow } from "@/components/tea/deadline";
import { useTenders, useUserNames } from "@/hooks/use-tea";
import { deadlineFormats, deadlineUtc, timeLeft } from "@/lib/deadline";
import { STAGE_LABEL } from "@/lib/workflow";
import { WORKFLOW_STAGES, type TenderStage } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tenders/")({
  head: () => ({
    meta: [
      { title: "Tenders | TEA – GREEN DigitALL" },
      {
        name: "description",
        content: "All UN tenders tracked by TEA, with AI score, deadline and stage.",
      },
    ],
  }),
  component: TendersPage,
});

const ALL = "all";
type SortKey = "deadline" | "score" | "title";

function TendersPage() {
  const { data, isLoading } = useTenders();
  const name = useUserNames();
  const now = useNow();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>(ALL);
  const [agency, setAgency] = useState<string>(ALL);
  const [country, setCountry] = useState<string>(ALL);
  const [minScore, setMinScore] = useState<string>(ALL);
  const [within, setWithin] = useState<string>(ALL);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "deadline", dir: 1 });

  const agencies = useMemo(() => [...new Set(data?.map((t) => t.agency))].sort(), [data]);
  const countries = useMemo(() => [...new Set(data?.map((t) => t.country))].sort(), [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    const filtered = data.filter((t) => {
      if (stage !== ALL && t.stage !== stage) return false;
      if (agency !== ALL && t.agency !== agency) return false;
      if (country !== ALL && t.country !== country) return false;
      if (minScore !== ALL && (t.ai?.score ?? -1) < Number(minScore)) return false;
      if (within !== ALL && now) {
        const l = timeLeft(deadlineUtc(t.deadlineNotice), now);
        if (l.isPast || l.ms > Number(within) * 86_400_000) return false;
      }
      if (
        needle &&
        !`${t.title} ${t.reference} ${t.agency} ${t.country} ${t.category}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });
    return filtered.sort((a, b) => {
      const v =
        sort.key === "deadline"
          ? deadlineUtc(a.deadlineNotice).getTime() - deadlineUtc(b.deadlineNotice).getTime()
          : sort.key === "score"
            ? (a.ai?.score ?? -1) - (b.ai?.score ?? -1)
            : a.title.localeCompare(b.title);
      return v * sort.dir;
    });
  }, [data, q, stage, agency, country, minScore, within, sort, now]);

  const anyFilter = q || [stage, agency, country, minScore, within].some((v) => v !== ALL);
  const clear = () => {
    setQ("");
    setStage(ALL);
    setAgency(ALL);
    setCountry(ALL);
    setMinScore(ALL);
    setWithin(ALL);
  };
  const toggleSort = (key: SortKey) =>
    setSort((s) => ({
      key,
      dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "score" ? -1 : 1,
    }));

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
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {children}
        <ArrowDownUp className={cn("size-3", sort.key === k ? "text-primary" : "opacity-40")} />
      </button>
    </TableHead>
  );

  return (
    <div>
      <PageHeader
        title="Tenders"
        description="Every tender TEA is tracking, from discovery to outcome."
      />

      <div className="mb-4 grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(5,1fr)_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, reference…"
            className="pl-8"
            aria-label="Search tenders"
          />
        </div>
        <FilterSelect
          label="Stage"
          value={stage}
          onChange={setStage}
          options={[...WORKFLOW_STAGES, "NO_BID", "MISSED", "WITHDRAWN", "ARCHIVED"].map((s) => [
            s,
            STAGE_LABEL[s as TenderStage],
          ])}
        />
        <FilterSelect
          label="Agency"
          value={agency}
          onChange={setAgency}
          options={agencies.map((a) => [a, a])}
        />
        <FilterSelect
          label="Country"
          value={country}
          onChange={setCountry}
          options={countries.map((c) => [c, c])}
        />
        <FilterSelect
          label="AI score"
          value={minScore}
          onChange={setMinScore}
          options={[
            ["80", "80 and above"],
            ["70", "70 and above"],
            ["50", "50 and above"],
          ]}
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
        {rows.length} of {data?.length ?? 0} tenders · deadlines shown as notice text and PNG time
        (UTC+10) · <AiBadge className="align-middle" /> score is AI-generated
      </p>

      {isLoading || !data ? (
        <Skeleton className="h-96" />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
          No tenders match these filters.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead k="score" className="w-20">
                    AI score
                  </SortHead>
                  <SortHead k="title">Title</SortHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Country</TableHead>
                  <SortHead k="deadline">Deadline</SortHead>
                  <TableHead className="text-right">Days left</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Owner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => {
                  const f = deadlineFormats(t.deadlineNotice);
                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer"
                      onClick={() =>
                        void navigate({ to: "/tenders/$tenderId", params: { tenderId: t.id } })
                      }
                    >
                      <TableCell>
                        <ScoreBadge score={t.ai?.score} />
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <Link
                          to="/tenders/$tenderId"
                          params={{ tenderId: t.id }}
                          className="line-clamp-2 font-medium hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t.title}
                        </Link>
                      </TableCell>
                      <TableCell className="font-semibold">{t.agency}</TableCell>
                      <TableCell className="text-xs">
                        <div>{t.procurementType}</div>
                        <div className="text-muted-foreground">{t.category}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                      <TableCell className="text-sm">{t.country}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        <div className="tabular-nums">{f.notice}</div>
                        <div className="tabular-nums text-muted-foreground">{f.utc}</div>
                        <div className="font-semibold tabular-nums">{f.png}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DaysLeft notice={t.deadlineNotice} />
                      </TableCell>
                      <TableCell>
                        <StageBadge stage={t.stage} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {t.ownerId ? (
                          name(t.ownerId)
                        ) : (
                          <span className="text-status-amber">Unassigned</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map((t) => (
              <li key={t.id}>
                <Link
                  to="/tenders/$tenderId"
                  params={{ tenderId: t.id }}
                  className="block rounded-lg border bg-card p-3 active:bg-muted"
                >
                  <div className="flex items-start gap-3">
                    <ScoreBadge score={t.ai?.score} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium leading-snug">{t.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {t.agency} · {t.country} · <span className="font-mono">{t.reference}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StageBadge stage={t.stage} />
                    <Countdown notice={t.deadlineNotice} />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {t.deadlineNotice} ·{" "}
                    <span className="font-semibold text-foreground">
                      {deadlineFormats(t.deadlineNotice).png}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Owner: {t.ownerId ? name(t.ownerId) : "Unassigned"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
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
