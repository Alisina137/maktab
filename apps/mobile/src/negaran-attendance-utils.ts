import type { AttendanceStatus } from "./api";

export const ATTENDANCE_TYPES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

export function countAttendance(
  studentIds: string[],
  draft: Record<string, AttendanceStatus>
) {
  const totals = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  let marked = 0;
  for (const id of studentIds) {
    const status = draft[id];
    if (status && status in totals) {
      totals[status]++;
      marked++;
    }
  }
  return { totals, marked, unmarked: studentIds.length - marked, total: studentIds.length };
}

// Never silently overwrite a Negaran's intentional Absent/Late/Excused marks.
export function fillUnmarkedPresent(
  studentIds: string[],
  draft: Record<string, AttendanceStatus>
): Record<string, AttendanceStatus> {
  const next = { ...draft };
  for (const id of studentIds) {
    if (!ATTENDANCE_TYPES.includes(next[id])) next[id] = "PRESENT";
  }
  return next;
}

export function monthRange(month: string, today: string): { from: string; to: string } | null {
  if (!/^\\d{4}-\\d{2}$/.test(month) || !/^\\d{4}-\\d{2}-\\d{2}$/.test(today)) return null;
  const year = Number(month.slice(0, 4)), mon = Number(month.slice(5, 7));
  if (mon < 1 || mon > 12 || year < 2000 || year > 2100) return null;
  const from = month + "-01";
  if (from > today) return null;
  const day = String(new Date(Date.UTC(year, mon, 0)).getUTCDate()).padStart(2, "0");
  const end = month + "-" + day;
  return { from, to: end > today ? today : end };
}

export function shiftMonth(month: string, delta: number): string {
  const year = Number(month.slice(0, 4));
  const num = Number(month.slice(5, 7));
  const next = new Date(Date.UTC(year, num - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function calendarCells(month: string): Array<string | null> {
  const year = Number(month.slice(0, 4)), mon = Number(month.slice(5, 7));
  const first = new Date(Date.UTC(year, mon - 1, 1));
  // Sat first: JS 0=Sun, 6=Sat
  const leading = (first.getUTCDay() + 1) % 7;
  const length = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const size = Math.ceil((leading + length) / 7) * 7;
  return Array.from({ length: size }, (_, i) => {
    const d = i - leading + 1;
    return d >= 1 && d <= length ? `${month}-${String(d).padStart(2, "0")}` : null;
  });
}
