import type { TeacherTodayPayload, TeacherLearningPayload } from "./api";

export function teacherTime12(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  if (hour > 23) return value;
  return `${String(hour % 12 || 12).padStart(2, "0")}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}

export function teacherTaskCounts(
  today: TeacherTodayPayload | null,
  learning: TeacherLearningPayload | null
) {
  return {
    pendingAttendance: today?.supervisedClasses.filter((item) => item.attendanceStatus === "PENDING").length ?? 0,
    homeworkDrafts: learning?.homeworks.filter((item) => item.status === "DRAFT").length ?? 0,
    openGradeSheets: learning?.examSubjects.filter((item) => item.exam.status === "IN_PROGRESS").length ?? 0
  };
}

export function nextTeacherPeriod(
  today: TeacherTodayPayload | null,
  now: Date = new Date()
): TeacherTodayPayload["schedule"][number] | null {
  if (!today || Number.isNaN(now.getTime())) return null;
  // Only label a period upcoming when the server school date agrees with the
  // Afghanistan school-local clock; otherwise avoid misleading stale data.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kabul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(now);
  const part = (key: string) => parts.find((entry) => entry.type === key)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  if (date !== today.date) return null;
  const nowMinutes = Number(part("hour")) * 60 + Number(part("minute"));
  return [...today.schedule]
    .filter((item) => {
      const match = /^(\d{1,2}):(\d{2})$/.exec(item.startsAt);
      return match && (Number(match[1]) * 60 + Number(match[2])) > nowMinutes;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.className.localeCompare(b.className))[0] ?? null;
}
