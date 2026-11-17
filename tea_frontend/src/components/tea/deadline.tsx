import { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { deadlineFormats, deadlineUtc, timeLeft } from "@/lib/deadline";

/** Re-render every minute so countdowns stay current. Null until mounted (avoids SSR mismatch). */
export function useNow(intervalMs = 60_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Red under 7 days, grey when closed. */
export function Countdown({
  notice,
  className,
  compact,
}: {
  notice: string;
  className?: string | undefined;
  compact?: boolean;
}) {
  const now = useNow();
  if (!now) return <span className={cn("text-xs text-muted-foreground", className)}>…</span>;
  const t = timeLeft(deadlineUtc(notice), now);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums whitespace-nowrap",
        t.isPast
          ? "bg-muted text-muted-foreground"
          : t.isShort
            ? "bg-status-red text-white"
            : "bg-status-green-soft text-status-green",
        className,
      )}
      aria-label={t.label}
    >
      {t.isShort ? (
        <AlertTriangle className="size-3" aria-hidden />
      ) : (
        <Clock className="size-3" aria-hidden />
      )}
      {compact ? (t.isPast ? "Closed" : `${t.days}d`) : t.label}
    </span>
  );
}

export function DaysLeft({ notice }: { notice: string }) {
  const now = useNow();
  if (!now) return <span className="text-muted-foreground">…</span>;
  const t = timeLeft(deadlineUtc(notice), now);
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        t.isPast ? "text-muted-foreground" : t.isShort ? "text-status-red" : "",
      )}
    >
      {t.isPast ? "Closed" : t.days}
    </span>
  );
}

/** Every deadline three ways: notice text, UTC, PNG time. */
export function DeadlineTriple({
  notice,
  layout = "stack",
  className,
}: {
  notice: string;
  layout?: "stack" | "inline" | "compact";
  className?: string | undefined;
}) {
  const f = deadlineFormats(notice);
  if (layout === "compact") {
    return (
      <div className={cn("text-xs leading-snug tabular-nums", className)}>
        <div className="text-sm font-semibold">{f.png}</div>
        <div className="text-muted-foreground">{f.utc}</div>
        <div className="text-muted-foreground">Notice: {f.notice}</div>
      </div>
    );
  }
  const rows: [string, string][] = [
    ["Notice", f.notice],
    ["UTC", f.utc],
    ["PNG", f.png],
  ];
  if (layout === "inline") {
    return (
      <div className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs", className)}>
        {rows.map(([k, v]) => (
          <span key={k}>
            <span className="text-muted-foreground">{k}: </span>
            <span className="font-medium tabular-nums">{v}</span>
          </span>
        ))}
      </div>
    );
  }
  return (
    <dl className={cn("grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm", className)}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className={cn("tabular-nums", k === "PNG" && "font-semibold")}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
