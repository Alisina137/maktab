import type { TeacherAcademicsPayload, TeacherTodayPayload } from "./api";
import { kabulTeacherClock } from "./teacher-today-model";

export type TeacherWeekday = TeacherAcademicsPayload["schedule"][number]["weekday"];
export type TeacherSchedulePeriod = TeacherAcademicsPayload["schedule"][number];
export type TeacherPeriodState = "CURRENT" | "FINISHED" | "UPCOMING";
export const TEACHER_SCHOOL_WEEKDAYS: readonly TeacherWeekday[] = [
  "SATURDAY", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"
];
export const TEACHER_ALL_WEEKDAYS: readonly TeacherWeekday[] = [
  ...TEACHER_SCHOOL_WEEKDAYS, "FRIDAY"
];
const JS_WEEKDAYS: readonly TeacherWeekday[] = [
  "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"
];

export function teacherKabulWeekday(now: Date): TeacherWeekday | null {
  const clock = kabulTeacherClock(now);
  if (!clock) return null;
  const parts = clock.date.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day) return null;
  return JS_WEEKDAYS[date.getUTCDay()] ?? null;
}

export function teacherShiftWeekday(current: TeacherWeekday, direction: -1 | 1): TeacherWeekday {
  const index = TEACHER_ALL_WEEKDAYS.indexOf(current);
  const length = TEACHER_ALL_WEEKDAYS.length;
  return TEACHER_ALL_WEEKDAYS[((index < 0 ? 0 : index) + direction + length) % length]!;
}

export function teacherPeriodsForDay(
  academics: TeacherAcademicsPayload | null,
  weekday: TeacherWeekday
): TeacherSchedulePeriod[] {
  return [...(academics?.schedule ?? [])]
    .filter(period => period.weekday === weekday)
    .sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt) ||
      a.endsAt.localeCompare(b.endsAt) ||
      a.className.localeCompare(b.className) ||
      a.id.localeCompare(b.id)
    );
}
function startEndMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]), m = Number(match[2]);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? h * 60 + m : null;
}

/** Highlight only server-confirmed today's lesson; never assume weekly periods
 * were not cancelled, moved or substituted. No exception data in this API yet. */
export function teacherSchedulePeriodState(
  period: TeacherSchedulePeriod,
  today: TeacherTodayPayload | null,
  now: Date
): TeacherPeriodState | null {
  if (!today) return null;
  const clock = kabulTeacherClock(now);
  if (!clock || today.date !== clock.date || today.weekday !== period.weekday ||
      teacherKabulWeekday(now) !== period.weekday) return null;
  const matchesToday = today.schedule.some(item =>
    item.classId === period.classId &&
    item.subjectId === period.subjectId &&
    item.startsAt === period.startsAt &&
    item.endsAt === period.endsAt
  );
  if (!matchesToday) return null;
  const start = startEndMinutes(period.startsAt);
  const end = startEndMinutes(period.endsAt);
  if (start === null || end === null || end <= start) return null;
  if (start <= clock.minutes && clock.minutes < end) return "CURRENT";
  return clock.minutes < start ? "UPCOMING" : "FINISHED";
}
