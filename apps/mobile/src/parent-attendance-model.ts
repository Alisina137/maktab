import type { SupportedLocale } from "@maktablink/localization";
import type { ParentAttendanceDay, AttendanceStatus } from "./api";

const DAY_MS = 86_400_000;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function validIsoDay(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function shiftIsoDay(value: string, days: number): string {
  if (!validIsoDay(value) || !Number.isInteger(days)) throw new Error("Invalid calendar date");
  return new Date(Date.parse(value + "T12:00:00Z") + days * DAY_MS)
    .toISOString().slice(0, 10);
}

function monthParts(value: string, locale: SupportedLocale) {
  const calendar = locale === "en" ? "gregory" : "persian";
  const parts = new Intl.DateTimeFormat("en-US", {
    calendar, numberingSystem: "latn", timeZone: "UTC",
    year: "numeric", month: "numeric", day: "numeric"
  }).formatToParts(new Date(value + "T12:00:00Z"));
  const number = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value ?? NaN);
  return { year: number("year"), month: number("month"), day: number("day") };
}

/** Afghanistan's week begins on Saturday. A missing record is never an absence. */
export function attendanceMonth(anchor: string, locale: SupportedLocale) {
  if (!validIsoDay(anchor)) throw new Error("Invalid calendar month");
  const selected = monthParts(anchor, locale);
  const isSameMonth = (iso: string) => {
    const p = monthParts(iso, locale);
    return p.year === selected.year && p.month === selected.month;
  };
  let from = anchor;
  let to = anchor;
  // Gregorian months have 28–31 days; Solar Hijri months have 29–31.
  for (let i = 0; i < 31; i++) {
    const previous = shiftIsoDay(from, -1);
    if (!isSameMonth(previous)) break;
    from = previous;
  }
  for (let i = 0; i < 31; i++) {
    const next = shiftIsoDay(to, 1);
    if (!isSameMonth(next)) break;
    to = next;
  }
  const title = new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale, {
    calendar: locale === "en" ? "gregory" : "persian",
    numberingSystem: locale === "en" ? "latn" : "arabext",
    timeZone: "UTC", month: "long", year: "numeric"
  }).format(new Date(anchor + "T12:00:00Z"));
  const offset = (new Date(from + "T12:00:00Z").getUTCDay() + 1) % 7;
  const dates: Array<{ iso: string; day: number }> = [];
  for (let iso = from; iso <= to; iso = shiftIsoDay(iso, 1)) {
    dates.push({ iso, day: monthParts(iso, locale).day });
  }
  return { from, to, title, offset, dates };
}

export function adjacentAttendanceMonth(anchor: string, locale: SupportedLocale, direction: -1 | 1) {
  const month = attendanceMonth(anchor, locale);
  return shiftIsoDay(direction < 0 ? month.from : month.to, direction);
}

/**
 * Rate = (PRESENT + LATE) / (PRESENT + LATE + ABSENT).
 * EXCUSED days are shown but excluded from the rate; unrecorded/future
 * days are not counted. One mark per calendar day (latest row wins).
 */
export function summarizeAttendance(
  days: ParentAttendanceDay[], from: string, to: string
): { counts: Record<AttendanceStatus, number>; recorded: number; eligible: number; rate: number | null } {
  const counts: Record<AttendanceStatus, number> = {
    PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0
  };
  const latestByDay = new Map<string, ParentAttendanceDay>();
  for (const row of days) {
    if (!validIsoDay(row.date) || row.date < from || row.date > to) continue;
    // Normally a date has one row; de-duplicate conservatively for corrections.
    if (!latestByDay.has(row.date)) latestByDay.set(row.date, row);
  }
  for (const row of latestByDay.values()) {
    if (Object.prototype.hasOwnProperty.call(counts, row.status)) counts[row.status]++;
  }
  const recorded = counts.PRESENT + counts.ABSENT + counts.LATE + counts.EXCUSED;
  const eligible = recorded - counts.EXCUSED;
  return { counts, recorded, eligible,
    rate: eligible > 0 ? Math.round(100 * (counts.PRESENT + counts.LATE) / eligible) : null };
}
