import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import type { AttendanceStatus } from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import { academicYears, auditLogs, classSections, dailyAttendances, students, users } from "./schema.js";
import { AttendanceHistoryNotFoundError } from "./attendance-history-store.js";
import { AttendanceCalendarValidationError, validCalendarDay } from "./attendance-monitoring-store.js";

export type AdminAttendanceAuditOptions = {
  academicYearId: string;
  from?: string;
  to?: string;
  classId?: string;
  search?: string;
  limit: number;
  offset: number;
};
export type AttendanceAuditEvent = {
  id: string;
  at: string;
  attendanceId: string;
  date: string;
  classId: string;
  className: string;
  actorName: string;
  studentId: string | null;
  studentName: string | null;
  studentCode: string | null;
  previousStatus: AttendanceStatus | null;
  status: AttendanceStatus | null;
  originalNote: string | null;
  reason: string | null;
};
export type AdminAttendanceAuditResult = {
  academicYearId: string;
  total: number;
  limit: number;
  offset: number;
  rows: AttendanceAuditEvent[];
};
export interface AttendanceAuditStore {
  getAdminAttendanceAudit(schoolId: string, options: AdminAttendanceAuditOptions): Promise<AdminAttendanceAuditResult>;
}

const statuses: ReadonlyArray<string> = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
function auditedStatus(value: unknown): AttendanceStatus | null {
  return typeof value === "string" && statuses.includes(value) ? value as AttendanceStatus : null;
}
function auditedText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

// Audit metadata stores studentId as an ordinary JSON string. Compare text,
// not a UUID cast: legacy or malformed metadata must never crash this read.
export function createAttendanceAuditStore(db: FoundationDatabase): AttendanceAuditStore {
  return {
    async getAdminAttendanceAudit(schoolId, options) {
      const { academicYearId, from, to, classId, limit, offset } = options;
      const [year] = await db.select({ id: academicYears.id }).from(academicYears)
        .where(and(eq(academicYears.id, academicYearId), eq(academicYears.schoolId, schoolId))).limit(1);
      if (!year) throw new AttendanceHistoryNotFoundError("Academic year not found.");
      if ((from && !validCalendarDay(from)) || (to && !validCalendarDay(to)) ||
          (from && to && from > to)) {
        throw new AttendanceCalendarValidationError("Choose a valid attendance date range.");
      }
      if (from && to && (Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / 86400000 > 365) {
        throw new AttendanceCalendarValidationError("Audit date range cannot exceed 366 days.");
      }
      if (!Number.isInteger(limit) || limit < 1 || limit > 50 ||
          !Number.isInteger(offset) || offset < 0 || offset > 100000) {
        throw new AttendanceCalendarValidationError("Invalid audit pagination.");
      }
      const search = (options.search ?? "").trim();
      if (search.length > 100) throw new AttendanceCalendarValidationError("Search is too long.");
      const escaped = search.replace(/[\\%_]/g, match => "\\" + match);
      const filters = [
        eq(auditLogs.schoolId, schoolId),
        eq(auditLogs.action, "attendance.corrected_by_admin"),
        eq(dailyAttendances.schoolId, schoolId),
        eq(dailyAttendances.academicYearId, academicYearId),
        ...(from ? [gte(dailyAttendances.date, from)] : []),
        ...(to ? [lte(dailyAttendances.date, to)] : []),
        ...(classId ? [eq(dailyAttendances.classId, classId)] : []),
        ...(search ? [or(ilike(students.fullName, `%${escaped}%`), ilike(students.studentCode, `%${escaped}%`))!] : [])
      ];
      // The school-scoped attendance join is authoritative: never trust
      // school/year/class claims embedded in free-form audit metadata.
      const query = () => db.select({
        id: auditLogs.id, at: auditLogs.createdAt,
        attendanceId: dailyAttendances.id, date: dailyAttendances.date,
        classId: classSections.id, className: classSections.name,
        actorName: users.username,
        studentId: students.id, studentName: students.fullName, studentCode: students.studentCode,
        metadata: auditLogs.metadata
      }).from(auditLogs)
        .innerJoin(dailyAttendances, and(
          eq(auditLogs.entityType, "daily_attendance"),
          eq(auditLogs.entityId, dailyAttendances.id),
          eq(auditLogs.schoolId, dailyAttendances.schoolId)
        ))
        .innerJoin(classSections, and(
          eq(classSections.id, dailyAttendances.classId),
          eq(classSections.schoolId, schoolId)
        ))
        .leftJoin(students, and(
          eq(students.schoolId, schoolId),
          sql`${students.id}::text = (${auditLogs.metadata}->>'studentId')`
        ))
        .leftJoin(users, and(eq(users.schoolId, schoolId), eq(users.id, auditLogs.actorUserId)));
      const [totalRows, entries] = await Promise.all([
        db.select({ total: count() }).from(auditLogs)
          .innerJoin(dailyAttendances, and(
            eq(auditLogs.entityType, "daily_attendance"),
            eq(auditLogs.entityId, dailyAttendances.id),
            eq(auditLogs.schoolId, dailyAttendances.schoolId)
          ))
          .innerJoin(classSections, and(
            eq(classSections.id, dailyAttendances.classId),
            eq(classSections.schoolId, schoolId)
          ))
          .leftJoin(students, and(
            eq(students.schoolId, schoolId),
            sql`${students.id}::text = (${auditLogs.metadata}->>'studentId')`
          ))
          .where(and(...filters)),
        query().where(and(...filters))
          .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(limit).offset(offset)
      ]);
      return {
        academicYearId, total: Number(totalRows[0]?.total ?? 0), limit, offset,
        rows: entries.map(row => ({
          id: row.id, at: row.at.toISOString(), attendanceId: row.attendanceId,
          date: row.date, classId: row.classId, className: row.className,
          actorName: row.actorName ?? "Former administrator",
          studentId: row.studentId, studentName: row.studentName, studentCode: row.studentCode,
          previousStatus: auditedStatus(row.metadata.previousStatus),
          status: auditedStatus(row.metadata.status),
          originalNote: auditedText(row.metadata.originalNote),
          reason: auditedText(row.metadata.reason)
        }))
      };
    }
  };
}
