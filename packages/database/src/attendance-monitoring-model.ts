export type DayMonitorState =
  | "SUBMITTED" | "PENDING" | "CLOSED" | "NOT_SCHEDULED" | "FUTURE"
  | "OUTSIDE_YEAR" | "NO_STUDENTS" | "NO_NEGARAN" | "MULTIPLE_NEGARAN";

export type DayMonitorInput = {
  date: string; today: string; yearStart: string; yearEnd: string;
  closed: boolean; hasTimetable: boolean; activeStudents: number;
  negaranCount: number; submitted: boolean;
};

/** A submitted historical sheet remains visible even on a later-closed day.
 * Expected submissions require an actual lesson, students, and a sole Negaran.
 * Dates outside the academic year, future dates and declared closures are excluded.
 */
export function classifyAttendanceDay(input: DayMonitorInput): {
  state: DayMonitorState; expected: boolean;
} {
  const within = input.date >= input.yearStart && input.date <= input.yearEnd;
  const expected = within && input.date <= input.today && !input.closed &&
    input.hasTimetable && input.activeStudents > 0 && input.negaranCount === 1;
  if (input.submitted) return { state: "SUBMITTED", expected };
  if (!within) return { state: "OUTSIDE_YEAR", expected: false };
  if (input.date > input.today) return { state: "FUTURE", expected: false };
  if (input.closed) return { state: "CLOSED", expected: false };
  if (!input.hasTimetable) return { state: "NOT_SCHEDULED", expected: false };
  if (input.activeStudents === 0) return { state: "NO_STUDENTS", expected: false };
  if (input.negaranCount === 0) return { state: "NO_NEGARAN", expected: false };
  if (input.negaranCount > 1) return { state: "MULTIPLE_NEGARAN", expected: false };
  return { state: "PENDING", expected: true };
}

export type AttendanceMonitorClassRow = {
  classId: string; className: string; classCode: string; date: string;
  scheduled: boolean; activeStudents: number; negaranName: string | null;
  negaranCount: number; submittedAt: string | null;
  recordStatus: "SUBMITTED" | "CORRECTED" | null;
  state: DayMonitorState; expected: boolean;
  present: number; absent: number; late: number; excused: number;
};
export type AttendanceMonitoringResponse = {
  date: string; today: string; weekday: string;
  academicYearId: string; yearStatus: string;
  closure: { id: string; reason: string } | null;
  summary: {
    totalClasses: number; scheduledClasses: number; expectedClasses: number;
    submittedExpected: number; pendingClasses: number; configurationIssues: number;
    submittedTotal: number; present: number; absent: number;
    late: number; excused: number;
  };
  classes: AttendanceMonitorClassRow[];
};
export type AttendanceClosure = {
  id: string; academicYearId: string; date: string; reason: string;
};
