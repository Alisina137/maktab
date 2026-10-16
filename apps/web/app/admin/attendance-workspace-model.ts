export type AttendanceTab =
  "OVERVIEW" | "REGISTERS" | "STUDENTS" | "FOLLOWUPS" | "REPORTS" | "AUDIT" | "STAFF_REQUESTS";

export const ATTENDANCE_TABS: ReadonlyArray<{ id: AttendanceTab; label: string }> = [
  { id: "OVERVIEW", label: "Overview" },
  { id: "REGISTERS", label: "Daily registers" },
  { id: "STUDENTS", label: "Students" },
  { id: "FOLLOWUPS", label: "Follow-ups" },
  { id: "REPORTS", label: "Reports" },
  { id: "AUDIT", label: "Audit trail" },
  { id: "STAFF_REQUESTS", label: "Staff requests" }
];

export type AttendancePeriodRow = {
  studentId: string; studentName: string; studentCode: string; className: string;
  date: string; status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
};

export function attendanceRate(summary: { present: number; late: number; absent: number }): number | null {
  const eligible = summary.present + summary.late + summary.absent;
  return eligible ? Math.round((summary.present + summary.late) * 1000 / eligible) / 10 : null;
}

export type StudentAttendancePreview = {
  studentId: string; studentName: string; studentCode: string; className: string;
  recorded: number; absent: number; late: number; present: number; excused: number;
};

export function studentAttendancePreviews(rows: ReadonlyArray<AttendancePeriodRow>): StudentAttendancePreview[] {
  const byId = new Map<string, StudentAttendancePreview>();
  // Attendance records are unique by class/day/student. This preview is only
  // for returned marks in the selected period, not an enrollment directory.
  for (const row of rows) {
    let preview = byId.get(row.studentId);
    if (!preview) {
      preview = {
        studentId: row.studentId, studentName: row.studentName,
        studentCode: row.studentCode, className: row.className,
        recorded: 0, absent: 0, late: 0, present: 0, excused: 0
      };
      byId.set(row.studentId, preview);
    }
    preview.recorded++;
    if (row.status === "ABSENT") preview.absent++;
    if (row.status === "LATE") preview.late++;
    if (row.status === "PRESENT") preview.present++;
    if (row.status === "EXCUSED") preview.excused++;
  }
  return [...byId.values()].sort((a,b) =>
    a.studentName.localeCompare(b.studentName) || a.studentId.localeCompare(b.studentId));
}
