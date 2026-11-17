/**
 * Deadline utilities. Every deadline is shown three ways:
 *   1. the original notice text, e.g. "18-Nov-2026 16:00 (GMT 2.00)"
 *   2. UTC
 *   3. Papua New Guinea time (UTC+10, no daylight saving)
 *
 * UNGM writes the offset as "(GMT h.mm)", where the part after the dot is MINUTES
 * (e.g. "GMT 5.30" is UTC+05:30, "GMT -4.00" is UTC−04:00).
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const PNG_OFFSET_MINUTES = 10 * 60;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface ParsedDeadline {
  notice: string;
  /** The instant of the deadline. */
  utc: Date;
  /** Offset from UTC stated in the notice, in minutes. */
  offsetMinutes: number;
}

export interface DeadlineFormats {
  notice: string;
  utc: string;
  png: string;
  utcIso: string;
}

const NOTICE_RE =
  /^\s*(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2})\s*\(\s*(?:GMT|UTC)\s*(?:([+-]?)\s*(\d{1,2})(?:[.:](\d{2}))?)?\s*\)\s*$/i;

export function parseNoticeDeadline(notice: string): ParsedDeadline {
  const m = NOTICE_RE.exec(notice);
  if (!m) throw new Error(`Unsupported deadline format: "${notice}"`);
  const [, dd, mon, yyyy, hh, mi, sign, offH, offM] = m;
  const month = MONTHS.findIndex((x) => x.toLowerCase() === (mon ?? "").toLowerCase());
  if (month < 0) throw new Error(`Unknown month in deadline: "${notice}"`);
  const day = Number(dd);
  const hour = Number(hh);
  const minute = Number(mi);
  if (day < 1 || day > 31 || hour > 23 || minute > 59) {
    throw new Error(`Invalid date or time in deadline: "${notice}"`);
  }
  const offAbs = Number(offH ?? 0) * 60 + Number(offM ?? 0);
  if (Number(offM ?? 0) > 59 || offAbs > 14 * 60) {
    throw new Error(`Invalid GMT offset in deadline: "${notice}"`);
  }
  const offsetMinutes = sign === "-" ? -offAbs : offAbs;
  const localAsUtc = Date.UTC(Number(yyyy), month, day, hour, minute);
  const utc = new Date(localAsUtc - offsetMinutes * MINUTE);
  // Reject roll-over dates such as 31-Feb.
  if (new Date(localAsUtc).getUTCDate() !== day) {
    throw new Error(`Invalid calendar date in deadline: "${notice}"`);
  }
  return { notice: notice.trim(), utc, offsetMinutes };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "18-Nov-2026 14:00" for the given instant shifted by offsetMinutes. */
function formatShifted(date: Date, offsetMinutes: number): string {
  const d = new Date(date.getTime() + offsetMinutes * MINUTE);
  return `${pad(d.getUTCDate())}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()} ${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}`;
}

export function formatUtc(date: Date): string {
  return `${formatShifted(date, 0)} UTC`;
}

export function formatPng(date: Date): string {
  return `${formatShifted(date, PNG_OFFSET_MINUTES)} PNG (UTC+10)`;
}

export function deadlineFormats(notice: string): DeadlineFormats {
  const { utc } = parseNoticeDeadline(notice);
  return {
    notice: notice.trim(),
    utc: formatUtc(utc),
    png: formatPng(utc),
    utcIso: utc.toISOString(),
  };
}

export function deadlineUtc(notice: string): Date {
  return parseNoticeDeadline(notice).utc;
}

export interface TimeLeft {
  ms: number;
  /** Whole days left (floored); negative when past. */
  days: number;
  isPast: boolean;
  /** Under 7 days and not yet past. */
  isShort: boolean;
  label: string;
}

export function timeLeft(deadline: Date, now: Date = new Date()): TimeLeft {
  const ms = deadline.getTime() - now.getTime();
  const isPast = ms <= 0;
  const abs = Math.abs(ms);
  const d = Math.floor(abs / DAY);
  const h = Math.floor((abs % DAY) / HOUR);
  const m = Math.floor((abs % HOUR) / MINUTE);
  const body = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return {
    ms,
    days: isPast ? -Math.ceil(abs / DAY) : Math.floor(ms / DAY),
    isPast,
    isShort: !isPast && ms < 7 * DAY,
    label: isPast ? `Closed ${body} ago` : `${body} left`,
  };
}

/** Calendar date key in PNG time, e.g. "2026-11-16". Used for "new today". */
export function pngDateKey(date: Date): string {
  const d = new Date(date.getTime() + PNG_OFFSET_MINUTES * MINUTE);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Short PNG time for audit entries etc.: "16-Nov-2026 09:22 PNG". */
export function formatPngShort(iso: string): string {
  return `${formatShifted(new Date(iso), PNG_OFFSET_MINUTES)} PNG`;
}

export function formatPngDate(iso: string): string {
  return formatShifted(new Date(iso), PNG_OFFSET_MINUTES).slice(0, 11);
}
