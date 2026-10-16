import type { TeacherAcademicsPayload, TeacherTodayPayload } from "./api";

export type TodayPeriod = TeacherTodayPayload["schedule"][number];
export type TeacherDayStage = "UNAVAILABLE" | "EMPTY" | "BEFORE" | "CURRENT" | "BETWEEN" | "DONE";
export interface TeacherDayTimeline {
  stage: TeacherDayStage;
  current: TodayPeriod | null;
  next: TodayPeriod | null;
  completed: number;
  remaining: number;
  total: number;
}

function minutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  return hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? hour * 60 + minute : null;
}

/** Always use the school's Kabul-local day, never the phone's timezone. */
export function kabulTeacherClock(now: Date): { date: string; minutes: number } | null {
  if (Number.isNaN(now.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kabul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(now);
  const part = (key: string) => parts.find((entry) => entry.type === key)?.value ?? "";
  const hour = Number(part("hour")), minute = Number(part("minute"));
  if (!part("year") || !part("month") || !part("day") ||
      hour > 23 || minute > 59) return null;
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minutes: hour * 60 + minute
  };
}

/**
 * This is a presentation-only projection of the server-owned timetable.
 * It cannot grant class or Negaran permissions, or invent attendance records.
 */
export function teacherDayTimeline(today: TeacherTodayPayload | null, now = new Date()): TeacherDayTimeline {
  const empty: TeacherDayTimeline = {
    stage: "UNAVAILABLE", current: null, next: null, completed: 0, remaining: 0, total: 0
  };
  if (!today) return empty;
  const periods = [...today.schedule].map((period) => ({
    period, start: minutes(period.startsAt), end: minutes(period.endsAt)
  })).filter((item): item is {period: TodayPeriod; start: number; end: number} =>
    item.start !== null && item.end !== null && item.end > item.start
  ).sort((a, b) => a.start - b.start || a.period.id.localeCompare(b.period.id));
  const total = periods.length;
  const clock = kabulTeacherClock(now);
  if (!clock || clock.date !== today.date)
    return {...empty, total};
  if (!total) return {...empty, stage: "EMPTY"};
  const completed = periods.filter((item) => item.end <= clock.minutes).length;
  const remaining = total - completed;
  const current = periods.find((item) => item.start <= clock.minutes && clock.minutes < item.end)?.period ?? null;
  const next = periods.find((item) => item.start > clock.minutes)?.period ?? null;
  const stage: TeacherDayStage = current ? "CURRENT" : next
    ? (completed ? "BETWEEN" : "BEFORE") : "DONE";
  return { stage, current, next, completed, remaining, total };
}

/** Resolve by both class AND subject to prevent opening another teacher's subject. */
export function teacherAssignmentForPeriod(
  period: TodayPeriod, academics: TeacherAcademicsPayload | null
): TeacherAcademicsPayload["assignmentDetails"][number] | null {
  return academics?.assignmentDetails.find((item) =>
    item.classId === period.classId && item.subjectId === period.subjectId
  ) ?? null;
}
