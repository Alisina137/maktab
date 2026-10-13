import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNull,
  lte,
  or
} from "drizzle-orm";
import type {
  AttendanceStatus,
  CorrectAttendanceInput,
  SubmitDailyAttendanceInput
} from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import {
  academicYears,
  auditLogs,
  classSections,
  dailyAttendances,
  negaranAssignments,
  notifications,
  schoolSettings,
  studentAttendances,
  students,
  subjects,
  teacherProfiles,
  timetablePeriods,
  type ClassSection,
  type DailyAttendance,
  type Notification,
  type Student,
  type StudentAttendance
} from "./schema.js";

export interface AttendanceStudentRow {
  student: Student;
  status: AttendanceStatus | null;
  note: string | null;
}

export interface AttendanceSheet {
  date: string;
  classSection: ClassSection;
  attendance: DailyAttendance | null;
  students: AttendanceStudentRow[];
  canEdit: boolean;
  locked: boolean;
}

export interface TeacherTodayPeriod {
  id: string;
  startsAt: string;
  endsAt: string;
  classId: string;
  className: string;
  classCode: string;
  subjectId: string;
  subjectName: string;
}

export interface TeacherSupervisedClass {
  assignmentId: string;
  classId: string;
  className: string;
  classCode: string;
  attendanceStatus: "PENDING" | "SUBMITTED";
  attendanceId: string | null;
}

export interface TeacherToday {
  date: string;
  weekday: string;
  teacher: {
    userId: string;
    fullName: string;
    employeeCode: string;
  };
  schedule: TeacherTodayPeriod[];
  supervisedClasses: TeacherSupervisedClass[];
}

export interface ParentAttendanceDay {
  attendanceId: string;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  classId: string;
  className: string;
}

export interface NegaranHistoryDay {
  attendanceId: string;
  date: string;
  recordStatus: "SUBMITTED" | "CORRECTED";
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  submittedAt: Date;
}

export interface NegaranAttendanceHistory {
  classId: string;
  from: string;
  to: string;
  today: string;
  days: NegaranHistoryDay[];
  summary: {
    submittedDays: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    totalMarks: number;
    // Includes late as attended; excused is not counted as attended.
    attendancePercent: number | null;
  };
}

export interface AttendanceReportRow {
  attendanceId: string;
  date: string;
  classId: string;
  className: string;
  classCode: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  status: AttendanceStatus;
  note: string | null;
  submittedAt: Date;
  updatedAt: Date;
}

export interface AttendanceReport {
  from: string;
  to: string;
  summary: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    totalMarks: number;
    submittedClasses: number;
    pendingClasses: number;
  };
  rows: AttendanceReportRow[];
}

export interface AttendanceCorrection {
  attendance: DailyAttendance;
  entry: StudentAttendance;
  previousStatus: AttendanceStatus;
}

export interface AttendanceStore {
  getSchoolToday(schoolId: string): Promise<string>;
  getTeacherToday(schoolId: string, teacherUserId: string): Promise<TeacherToday>;
  getTeacherAttendanceSheet(
    schoolId: string,
    teacherUserId: string,
    classId: string,
    date: string
  ): Promise<AttendanceSheet>;
  getTeacherAttendanceHistory(
    schoolId: string,
    teacherUserId: string,
    classId: string,
    from: string,
    to: string
  ): Promise<NegaranAttendanceHistory>;
  submitDailyAttendance(
    schoolId: string,
    teacherUserId: string,
    input: SubmitDailyAttendanceInput
  ): Promise<{ sheet: AttendanceSheet; created: boolean; changed: boolean; notificationCount: number }>;
  getParentAttendance(
    schoolId: string,
    parentUserId: string,
    studentId: string,
    from?: string,
    to?: string
  ): Promise<ParentAttendanceDay[]>;
  getParentNotifications(schoolId: string, parentUserId: string): Promise<Notification[]>;
  markNotificationRead(schoolId: string, parentUserId: string, notificationId: string): Promise<Notification | null>;
  getAdminReport(
    schoolId: string,
    from: string,
    to: string,
    classId?: string,
    academicYearId?: string
  ): Promise<AttendanceReport>;
  correctAttendance(
    schoolId: string,
    actorUserId: string,
    attendanceId: string,
    studentId: string,
    input: CorrectAttendanceInput
  ): Promise<AttendanceCorrection>;
}

export class AttendanceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceConflictError";
  }
}

export class AttendanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceValidationError";
  }
}

export class AttendanceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceNotFoundError";
  }
}

const weekdayByUtcDay = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY"
] as const;

function weekdayForDate(date: string) {
  return weekdayByUtcDay[new Date(`${date}T12:00:00Z`).getUTCDay()] ?? "SATURDAY";
}

function dateInTimezone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Could not resolve school-local date.");
  return `${year}-${month}-${day}`;
}

function isValidAttendanceDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function defaultFrom(to: string): string {
  const date = new Date(`${to}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 29);
  return date.toISOString().slice(0, 10);
}

export function createAttendanceStore(db: FoundationDatabase): AttendanceStore {
  async function schoolToday(schoolId: string): Promise<string> {
    const [settings] = await db
      .select({ timezone: schoolSettings.timezone })
      .from(schoolSettings)
      .where(eq(schoolSettings.schoolId, schoolId))
      .limit(1);
    return dateInTimezone(settings?.timezone ?? "Asia/Kabul");
  }

  async function getClass(schoolId: string, classId: string) {
    const [row] = await db
      .select()
      .from(classSections)
      .where(and(eq(classSections.schoolId, schoolId), eq(classSections.id, classId)))
      .limit(1);
    if (!row) throw new AttendanceNotFoundError("Class not found.");
    return row;
  }

  async function requireTeacher(schoolId: string, teacherUserId: string) {
    const [teacher] = await db
      .select()
      .from(teacherProfiles)
      .where(and(eq(teacherProfiles.schoolId, schoolId), eq(teacherProfiles.userId, teacherUserId)))
      .limit(1);
    if (!teacher) throw new AttendanceNotFoundError("Teacher profile not found.");
    return teacher;
  }

  async function getNegaran(
    schoolId: string,
    teacherUserId: string,
    classId: string,
    date: string
  ) {
    const [row] = await db
      .select({ assignment: negaranAssignments })
      .from(negaranAssignments)
      .innerJoin(
        academicYears,
        and(
          eq(academicYears.id, negaranAssignments.academicYearId),
          eq(academicYears.schoolId, negaranAssignments.schoolId),
          eq(academicYears.status, "ACTIVE")
        )
      )
      .where(
        and(
          eq(negaranAssignments.schoolId, schoolId),
          eq(negaranAssignments.teacherUserId, teacherUserId),
          eq(negaranAssignments.classId, classId),
          lte(negaranAssignments.startDate, date),
          or(isNull(negaranAssignments.endDate), gte(negaranAssignments.endDate, date))
        )
      )
      .limit(1);
    const assignment = row?.assignment;
    if (!assignment) {
      throw new AttendanceValidationError("You are not the active Negaran for this class on the selected date.");
    }
    return assignment;
  }

  async function getAttendance(schoolId: string, classId: string, date: string) {
    const [attendance] = await db
      .select()
      .from(dailyAttendances)
      .where(
        and(
          eq(dailyAttendances.schoolId, schoolId),
          eq(dailyAttendances.classId, classId),
          eq(dailyAttendances.date, date)
        )
      )
      .limit(1);
    return attendance ?? null;
  }

  async function activeStudents(schoolId: string, classId: string, academicYearId: string) {
    return db
      .select()
      .from(students)
      .where(
        and(
          eq(students.schoolId, schoolId),
          eq(students.classId, classId),
          eq(students.academicYearId, academicYearId),
          eq(students.status, "ACTIVE")
        )
      )
      .orderBy(asc(students.fullName));
  }

  async function buildSheet(
    schoolId: string,
    classId: string,
    date: string,
    canEdit: boolean
  ): Promise<AttendanceSheet> {
    const classSection = await getClass(schoolId, classId);
    const attendance = await getAttendance(schoolId, classId, date);
    // Historical read-only sheets must use the students who were actually
    // marked on that date. A student withdrawn/transferred later must not
    // disappear from archived attendance; today's editable sheet continues
    // to use the active current roster.
    const classStudents = attendance && !canEdit
      ? (await db.select({ student: students })
          .from(studentAttendances)
          .innerJoin(students, and(
            eq(students.id, studentAttendances.studentId),
            eq(students.schoolId, schoolId),
            eq(students.academicYearId, classSection.academicYearId)
          ))
          .where(and(
            eq(studentAttendances.schoolId, schoolId),
            eq(studentAttendances.attendanceId, attendance.id)
          ))
          .orderBy(asc(students.fullName))).map((row) => row.student)
      : await activeStudents(schoolId, classId, classSection.academicYearId);
    const marks = attendance
      ? await db
          .select()
          .from(studentAttendances)
          .where(
            and(
              eq(studentAttendances.schoolId, schoolId),
              eq(studentAttendances.attendanceId, attendance.id)
            )
          )
      : [];
    const markByStudent = new Map(marks.map((mark) => [mark.studentId, mark]));
    return {
      date,
      classSection,
      attendance,
      students: classStudents.map((student) => ({
        student,
        status: markByStudent.get(student.id)?.status ?? null,
        note: markByStudent.get(student.id)?.note ?? null
      })),
      canEdit,
      locked: !canEdit
    };
  }

  // Keep the notification and its triggering attendance mark in one transaction.
  // A failed notification write must roll back the mark, not leave a silent
  // absence that retries consider already complete.
  type AttendanceTx = Parameters<Parameters<FoundationDatabase["transaction"]>[0]>[0];

  async function syncAttendanceAlert(
    tx: AttendanceTx,
    schoolId: string,
    attendance: DailyAttendance,
    student: Student,
    status: AttendanceStatus
  ): Promise<boolean> {
    const dedupKey = `attendance:${attendance.id}:${student.id}`;
    const [existing] = await tx
      .select()
      .from(notifications)
      .where(and(eq(notifications.schoolId, schoolId), eq(notifications.dedupKey, dedupKey)))
      .limit(1);

    if (status !== "ABSENT" && status !== "LATE") {
      // A correction to Present/Excused supersedes an old alert even when
      // the parent has already read it. Do not leave a misleading absence.
      if (existing && existing.deliveryStatus !== "CANCELLED") {
        await tx
          .update(notifications)
          .set({ deliveryStatus: "CANCELLED", updatedAt: new Date() })
          .where(and(eq(notifications.schoolId, schoolId), eq(notifications.id, existing.id)));
      }
      return false;
    }

    const type = status === "ABSENT" ? "ATTENDANCE_ABSENT" : "ATTENDANCE_LATE";
    // A same-status update to another mark must not generate another alert.
    if (existing && existing.type === type && existing.deliveryStatus !== "CANCELLED") return false;

    const title = status === "ABSENT" ? "Student absent" : "Student late";
    const message =
      status === "ABSENT"
        ? `${student.fullName} was marked absent on ${attendance.date}.`
        : `${student.fullName} was marked late on ${attendance.date}.`;
    const values = {
      type,
      title,
      message,
      deepLink: `/parent/children/${student.id}/attendance`,
      metadata: { studentId: student.id, date: attendance.date, status },
      deliveryStatus: "PENDING" as const,
      readAt: null,
      updatedAt: new Date()
    };

    if (existing) {
      await tx
        .update(notifications)
        .set(values)
        .where(and(eq(notifications.schoolId, schoolId), eq(notifications.id, existing.id)));
      return false;
    }

    await tx.insert(notifications).values({
      id: randomUUID(),
      schoolId,
      userId: student.parentUserId,
      dedupKey,
      ...values
    });
    return true;
  }

  async function sheetForTeacher(
    schoolId: string,
    teacherUserId: string,
    classId: string,
    date: string
  ) {
    if (!isValidAttendanceDate(date)) {
      throw new AttendanceValidationError("Choose a valid calendar date.");
    }
    await requireTeacher(schoolId, teacherUserId);
    await getNegaran(schoolId, teacherUserId, classId, date);
    const today = await schoolToday(schoolId);
    if (date > today) throw new AttendanceValidationError("Future attendance cannot be recorded.");
    return buildSheet(schoolId, classId, date, date === today);
  }

  return {
    getSchoolToday: schoolToday,

    async getTeacherToday(schoolId, teacherUserId) {
      const teacher = await requireTeacher(schoolId, teacherUserId);
      const date = await schoolToday(schoolId);
      const weekday = weekdayForDate(date);

      const [scheduleRows, negaranRows] = await Promise.all([
        db
          .select({
            id: timetablePeriods.id,
            startsAt: timetablePeriods.startsAt,
            endsAt: timetablePeriods.endsAt,
            classId: classSections.id,
            className: classSections.name,
            classCode: classSections.code,
            subjectId: subjects.id,
            subjectName: subjects.name
          })
          .from(timetablePeriods)
          .innerJoin(
            academicYears,
            and(
              eq(academicYears.id, timetablePeriods.academicYearId),
              eq(academicYears.schoolId, timetablePeriods.schoolId),
              eq(academicYears.status, "ACTIVE")
            )
          )
          .innerJoin(
            classSections,
            and(eq(classSections.id, timetablePeriods.classId), eq(classSections.schoolId, timetablePeriods.schoolId))
          )
          .innerJoin(
            subjects,
            and(eq(subjects.id, timetablePeriods.subjectId), eq(subjects.schoolId, timetablePeriods.schoolId))
          )
          .where(
            and(
              eq(timetablePeriods.schoolId, schoolId),
              eq(timetablePeriods.teacherUserId, teacherUserId),
              eq(timetablePeriods.weekday, weekday)
            )
          )
          .orderBy(asc(timetablePeriods.startsAt)),
        db
          .select({
            assignmentId: negaranAssignments.id,
            classId: classSections.id,
            className: classSections.name,
            classCode: classSections.code
          })
          .from(negaranAssignments)
          .innerJoin(
            academicYears,
            and(
              eq(academicYears.id, negaranAssignments.academicYearId),
              eq(academicYears.schoolId, negaranAssignments.schoolId),
              eq(academicYears.status, "ACTIVE")
            )
          )
          .innerJoin(
            classSections,
            and(eq(classSections.id, negaranAssignments.classId), eq(classSections.schoolId, negaranAssignments.schoolId))
          )
          .where(
            and(
              eq(negaranAssignments.schoolId, schoolId),
              eq(negaranAssignments.teacherUserId, teacherUserId),
              lte(negaranAssignments.startDate, date),
              or(isNull(negaranAssignments.endDate), gte(negaranAssignments.endDate, date))
            )
          )
      ]);

      const supervisedClasses: TeacherSupervisedClass[] = [];
      for (const row of negaranRows) {
        const attendance = await getAttendance(schoolId, row.classId, date);
        supervisedClasses.push({
          ...row,
          attendanceStatus: attendance ? "SUBMITTED" : "PENDING",
          attendanceId: attendance?.id ?? null
        });
      }

      return {
        date,
        weekday,
        teacher: {
          userId: teacher.userId,
          fullName: teacher.fullName,
          employeeCode: teacher.employeeCode
        },
        schedule: scheduleRows,
        supervisedClasses
      };
    },

    async getTeacherAttendanceHistory(schoolId, teacherUserId, classId, from, to) {
      await requireTeacher(schoolId, teacherUserId);
      const today = await schoolToday(schoolId);
      if (!isValidAttendanceDate(from) || !isValidAttendanceDate(to) || from > to || to > today) {
        throw new AttendanceValidationError("Choose valid past or current dates in chronological order.");
      }
      const numberOfDays = Math.round(
        (new Date(to + "T12:00:00Z").getTime() -
          new Date(from + "T12:00:00Z").getTime()) / 86_400_000
      ) + 1;
      if (numberOfDays > 42) {
        throw new AttendanceValidationError("Attendance history is limited to 42 days per request.");
      }

      // A teacher must be the active Negaran TODAY to open history, and
      // may only see days during the active assignment's own date window.
      // Ordinary subject teachers must never gain roster or attendance access.
      const negaran = await getNegaran(schoolId, teacherUserId, classId, today);
      const section = await getClass(schoolId, classId);
      if (section.academicYearId !== negaran.academicYearId) {
        throw new AttendanceValidationError("Negaran responsibility is not for this class academic year.");
      }
      const [year] = await db.select({ id: academicYears.id })
        .from(academicYears)
        .where(and(
          eq(academicYears.id, negaran.academicYearId),
          eq(academicYears.schoolId, schoolId),
          eq(academicYears.status, "ACTIVE")
        )).limit(1);
      if (!year) {
        throw new AttendanceValidationError("Negaran history requires an active academic year.");
      }

      const allowedFrom = from > negaran.startDate ? from : negaran.startDate;
      const allowedTo = negaran.endDate && negaran.endDate < to ? negaran.endDate : to;
      const counts = { present: 0, absent: 0, late: 0, excused: 0, totalMarks: 0 };
      if (allowedFrom > allowedTo) {
        return {
          classId, from, to, today, days: [],
          summary: { submittedDays: 0, ...counts, attendancePercent: null }
        };
      }

      const rows = await db.select({
        attendanceId: dailyAttendances.id,
        date: dailyAttendances.date,
        recordStatus: dailyAttendances.status,
        submittedAt: dailyAttendances.submittedAt,
        status: studentAttendances.status
      }).from(dailyAttendances)
        .leftJoin(studentAttendances, and(
          eq(studentAttendances.attendanceId, dailyAttendances.id),
          eq(studentAttendances.schoolId, schoolId)
        ))
        .where(and(
          eq(dailyAttendances.schoolId, schoolId),
          eq(dailyAttendances.classId, classId),
          eq(dailyAttendances.academicYearId, negaran.academicYearId),
          gte(dailyAttendances.date, allowedFrom),
          lte(dailyAttendances.date, allowedTo)
        ))
        .orderBy(desc(dailyAttendances.date));

      const byDate = new Map<string, NegaranHistoryDay>();
      for (const row of rows) {
        let day = byDate.get(row.date);
        if (!day) {
          day = {
            attendanceId: row.attendanceId,
            date: row.date,
            recordStatus: row.recordStatus,
            submittedAt: row.submittedAt,
            present: 0, absent: 0, late: 0, excused: 0, total: 0
          };
          byDate.set(row.date, day);
        }
        if (!row.status) continue;
        if (row.status === "PRESENT") day.present++;
        else if (row.status === "ABSENT") day.absent++;
        else if (row.status === "LATE") day.late++;
        else if (row.status === "EXCUSED") day.excused++;
        day.total++;
      }
      const days = Array.from(byDate.values());
      for (const day of days) {
        counts.present += day.present;
        counts.absent += day.absent;
        counts.late += day.late;
        counts.excused += day.excused;
        counts.totalMarks += day.total;
      }

      return {
        classId, from, to, today, days,
        summary: {
          submittedDays: days.length,
          ...counts,
          attendancePercent: counts.totalMarks
            ? Math.round((counts.present + counts.late) * 1000 / counts.totalMarks) / 10
            : null
        }
      };
    },

    getTeacherAttendanceSheet: sheetForTeacher,

    async submitDailyAttendance(schoolId, teacherUserId, input) {
      if (!isValidAttendanceDate(input.date)) {
        throw new AttendanceValidationError("Choose a valid calendar date.");
      }
      const today = await schoolToday(schoolId);
      if (input.date !== today) {
        throw new AttendanceConflictError("Negaran attendance is locked after the school-local day ends.");
      }
      await requireTeacher(schoolId, teacherUserId);
      const negaran = await getNegaran(schoolId, teacherUserId, input.classId, input.date);
      const classSection = await getClass(schoolId, input.classId);
      if (classSection.academicYearId !== negaran.academicYearId) {
        throw new AttendanceValidationError("Negaran assignment and class academic year do not match.");
      }
      const classStudents = await activeStudents(schoolId, input.classId, negaran.academicYearId);
      if (!classStudents.length) {
        throw new AttendanceConflictError("This class has no active students to mark.");
      }

      const studentById = new Map(classStudents.map((student) => [student.id, student]));
      const submittedIds = new Set(input.entries.map((entry) => entry.studentId));
      if (submittedIds.size !== input.entries.length) {
        throw new AttendanceValidationError("Each student may be marked only once.");
      }
      if (
        input.entries.length !== classStudents.length ||
        input.entries.some((entry) => !studentById.has(entry.studentId))
      ) {
        throw new AttendanceValidationError("Every active student in the supervised class must have exactly one attendance state.");
      }

      // Serialize same-class/day edits. Handle competing first submissions via
      // ON CONFLICT, and accept exact network retries without duplicate writes.
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(dailyAttendances)
          .where(and(
            eq(dailyAttendances.schoolId, schoolId),
            eq(dailyAttendances.classId, input.classId),
            eq(dailyAttendances.date, input.date)
          ))
          .limit(1)
          .for("update");

        let attendanceRow = existing;
        let created = false;
        if (!attendanceRow) {
          const [inserted] = await tx.insert(dailyAttendances).values({
            id: randomUUID(),
            schoolId,
            academicYearId: negaran.academicYearId,
            classId: input.classId,
            date: input.date,
            status: "SUBMITTED",
            submittedBy: teacherUserId,
            updatedBy: teacherUserId
          }).onConflictDoNothing().returning();
          if (!inserted) {
            throw new AttendanceConflictError("Attendance was submitted by another request. Reload the sheet.");
          }
          attendanceRow = inserted;
          created = true;
        }

        const existingMarks = created ? [] : await tx
          .select()
          .from(studentAttendances)
          .where(and(
            eq(studentAttendances.schoolId, schoolId),
            eq(studentAttendances.attendanceId, attendanceRow.id)
          ));
        const markByStudent = new Map(existingMarks.map((entry) => [entry.studentId, entry]));
        // Omitted notes mean "leave the current note unchanged", never clear
        // an administrator's correction note during a status-only resubmit.
        const nextNote = (entry: (typeof input.entries)[number]) =>
          entry.note === undefined ? markByStudent.get(entry.studentId)?.note ?? null : entry.note || null;
        const changed = created || input.entries.some((entry) => {
          const previous = markByStudent.get(entry.studentId);
          return !previous || previous.status !== entry.status || previous.note !== nextNote(entry);
        });
        if (!changed) return { created: false, changed: false, notificationCount: 0 };

        // Precondition applies only to actual changes. Thus a lost-response
        // retry with exactly the same marks remains idempotent.
        if (
          input.expectedUpdatedAt !== undefined &&
          (existing?.updatedAt.toISOString() ?? null) !== input.expectedUpdatedAt
        ) {
          throw new AttendanceConflictError("Attendance changed since you opened it. Reload the sheet.");
        }

        if (!created) {
          const [updated] = await tx.update(dailyAttendances).set({
            status: "CORRECTED",
            updatedBy: teacherUserId,
            updatedAt: new Date(Math.max(Date.now(), attendanceRow.updatedAt.getTime() + 1))
          }).where(and(
            eq(dailyAttendances.schoolId, schoolId),
            eq(dailyAttendances.id, attendanceRow.id)
          )).returning();
          if (!updated) throw new AttendanceNotFoundError("Attendance record not found.");
          attendanceRow = updated;
        }

        let notificationCount = 0;
        for (const entry of input.entries) {
          const old = markByStudent.get(entry.studentId);
          if (old) {
            if (old.status !== entry.status || old.note !== nextNote(entry)) {
              await tx.update(studentAttendances).set({
                status: entry.status,
                note: nextNote(entry),
                updatedAt: new Date()
              }).where(and(eq(studentAttendances.schoolId, schoolId), eq(studentAttendances.id, old.id)));
            }
          } else {
            await tx.insert(studentAttendances).values({
              id: randomUUID(),
              schoolId,
              attendanceId: attendanceRow.id,
              studentId: entry.studentId,
              status: entry.status,
              note: nextNote(entry)
            });
          }
          // No notification replay for an unchanged mark on the same sheet.
          if (!old || old.status !== entry.status) {
            const student = studentById.get(entry.studentId);
            if (student && await syncAttendanceAlert(tx, schoolId, attendanceRow, student, entry.status)) {
              notificationCount++;
            }
          }
        }
        // The audit event must commit with the marks and alerts, so a failed
        // audit write cannot produce an untracked attendance change.
        await tx.insert(auditLogs).values({
          id: randomUUID(),
          schoolId,
          actorUserId: teacherUserId,
          action: created ? "attendance.submitted" : "attendance.corrected_by_negaran",
          entityType: "daily_attendance",
          entityId: attendanceRow.id,
          metadata: { classId: input.classId, date: input.date, notificationCount }
        });
        return { created, changed, notificationCount };
      });

      return {
        sheet: await buildSheet(schoolId, input.classId, input.date, true),
        ...result
      };
    },

    async getParentAttendance(schoolId, parentUserId, studentId, from, to) {
      if ((from && !isValidAttendanceDate(from)) || (to && !isValidAttendanceDate(to)) ||
        (from && to && from > to)) {
        throw new AttendanceValidationError("Choose valid attendance dates in chronological order.");
      }
      const today = await schoolToday(schoolId);
      const effectiveTo = to ?? today;
      const effectiveFrom = from ?? defaultFrom(effectiveTo);

      const [student] = await db
        .select()
        .from(students)
        .where(
          and(
            eq(students.schoolId, schoolId),
            eq(students.id, studentId),
            eq(students.parentUserId, parentUserId),
            eq(students.status, "ACTIVE")
          )
        )
        .limit(1);
      if (!student) throw new AttendanceNotFoundError("Student not found for this parent account.");

      return db
        .select({
          attendanceId: dailyAttendances.id,
          date: dailyAttendances.date,
          status: studentAttendances.status,
          note: studentAttendances.note,
          classId: classSections.id,
          className: classSections.name
        })
        .from(studentAttendances)
        .innerJoin(
          dailyAttendances,
          and(
            eq(dailyAttendances.id, studentAttendances.attendanceId),
            eq(dailyAttendances.schoolId, studentAttendances.schoolId)
          )
        )
        .innerJoin(
          classSections,
          and(eq(classSections.id, dailyAttendances.classId), eq(classSections.schoolId, dailyAttendances.schoolId))
        )
        .where(
          and(
            eq(studentAttendances.schoolId, schoolId),
            eq(studentAttendances.studentId, studentId),
            gte(dailyAttendances.date, effectiveFrom),
            lte(dailyAttendances.date, effectiveTo)
          )
        )
        .orderBy(desc(dailyAttendances.date));
    },

    async getParentNotifications(schoolId, parentUserId) {
      return db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.schoolId, schoolId),
            eq(notifications.userId, parentUserId),
            or(eq(notifications.deliveryStatus, "PENDING"), eq(notifications.deliveryStatus, "SENT"))
          )
        )
        .orderBy(desc(notifications.createdAt));
    },

    async markNotificationRead(schoolId, parentUserId, notificationId) {
      const [updated] = await db
        .update(notifications)
        .set({ readAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(notifications.schoolId, schoolId),
            eq(notifications.userId, parentUserId),
            eq(notifications.id, notificationId),
            or(eq(notifications.deliveryStatus, "PENDING"), eq(notifications.deliveryStatus, "SENT"))
          )
        )
        .returning();
      return updated ?? null;
    },

    async getAdminReport(schoolId, from, to, classId, academicYearId) {
      if (!isValidAttendanceDate(from) || !isValidAttendanceDate(to) || from > to) {
        throw new AttendanceValidationError("Choose valid attendance dates in chronological order.");
      }
      const predicates = [
        eq(dailyAttendances.schoolId, schoolId),
        gte(dailyAttendances.date, from),
        lte(dailyAttendances.date, to)
      ];
      if (classId) predicates.push(eq(dailyAttendances.classId, classId));
      if (academicYearId) predicates.push(eq(dailyAttendances.academicYearId, academicYearId));

      const rows = await db
        .select({
          attendanceId: dailyAttendances.id,
          date: dailyAttendances.date,
          classId: classSections.id,
          className: classSections.name,
          classCode: classSections.code,
          studentId: students.id,
          studentCode: students.studentCode,
          studentName: students.fullName,
          status: studentAttendances.status,
          note: studentAttendances.note,
          submittedAt: dailyAttendances.submittedAt,
          updatedAt: studentAttendances.updatedAt
        })
        .from(dailyAttendances)
        .innerJoin(
          studentAttendances,
          and(
            eq(studentAttendances.attendanceId, dailyAttendances.id),
            eq(studentAttendances.schoolId, dailyAttendances.schoolId)
          )
        )
        .innerJoin(
          students,
          and(eq(students.id, studentAttendances.studentId), eq(students.schoolId, studentAttendances.schoolId))
        )
        .innerJoin(
          classSections,
          and(eq(classSections.id, dailyAttendances.classId), eq(classSections.schoolId, dailyAttendances.schoolId))
        )
        .where(and(...predicates))
        .orderBy(desc(dailyAttendances.date), asc(classSections.name), asc(students.fullName));

      const attendanceIds = new Set(rows.map((row) => row.attendanceId));
      let pendingClasses = 0;
      if (from === to) {
        const activeClasses = await db
          .select({ id: classSections.id })
          .from(classSections)
          .innerJoin(
            academicYears,
            and(
              eq(academicYears.id, classSections.academicYearId),
              eq(academicYears.schoolId, classSections.schoolId),
              academicYearId
                ? eq(academicYears.id, academicYearId)
                : eq(academicYears.status, "ACTIVE")
            )
          )
          .where(
            classId
              ? and(eq(classSections.schoolId, schoolId), eq(classSections.id, classId))
              : eq(classSections.schoolId, schoolId)
          );
        const submittedClassIds = new Set(rows.map((row) => row.classId));
        pendingClasses = activeClasses.filter((item) => !submittedClassIds.has(item.id)).length;
      }

      return {
        from,
        to,
        summary: {
          present: rows.filter((row) => row.status === "PRESENT").length,
          absent: rows.filter((row) => row.status === "ABSENT").length,
          late: rows.filter((row) => row.status === "LATE").length,
          excused: rows.filter((row) => row.status === "EXCUSED").length,
          totalMarks: rows.length,
          submittedClasses: attendanceIds.size,
          pendingClasses
        },
        rows
      };
    },

    async correctAttendance(schoolId, actorUserId, attendanceId, studentId, input) {
      const [current] = await db
        .select({ attendance: dailyAttendances, entry: studentAttendances, student: students })
        .from(studentAttendances)
        .innerJoin(
          dailyAttendances,
          and(
            eq(dailyAttendances.id, studentAttendances.attendanceId),
            eq(dailyAttendances.schoolId, studentAttendances.schoolId)
          )
        )
        .innerJoin(
          students,
          and(eq(students.id, studentAttendances.studentId), eq(students.schoolId, studentAttendances.schoolId))
        )
        .where(
          and(
            eq(studentAttendances.schoolId, schoolId),
            eq(studentAttendances.attendanceId, attendanceId),
            eq(studentAttendances.studentId, studentId)
          )
        )
        .limit(1);
      if (!current) throw new AttendanceNotFoundError("Attendance entry not found.");

      const [year] = await db
        .select({ status: academicYears.status })
        .from(academicYears)
        .where(
          and(
            eq(academicYears.schoolId, schoolId),
            eq(academicYears.id, current.attendance.academicYearId)
          )
        )
        .limit(1);
      if (!year) throw new AttendanceNotFoundError("Academic year not found.");
      if (year.status !== "ACTIVE") {
        throw new AttendanceConflictError("Historical attendance is read-only unless its academic year is active.");
      }

      const { attendance, entry } = await db.transaction(async (tx) => {
        const [entry] = await tx
          .update(studentAttendances)
          .set({ status: input.status, note: input.note || null, updatedAt: new Date() })
          .where(and(eq(studentAttendances.schoolId, schoolId), eq(studentAttendances.id, current.entry.id)))
          .returning();
        if (!entry) throw new AttendanceNotFoundError("Attendance entry not found.");

        const [attendance] = await tx
          .update(dailyAttendances)
          .set({
            status: "CORRECTED",
            updatedBy: actorUserId,
            updatedAt: new Date(Math.max(Date.now(), current.attendance.updatedAt.getTime() + 1))
          })
          .where(and(eq(dailyAttendances.schoolId, schoolId), eq(dailyAttendances.id, attendanceId)))
          .returning();
        if (!attendance) throw new AttendanceNotFoundError("Attendance record not found.");
        if (current.entry.status !== entry.status) {
          await syncAttendanceAlert(tx, schoolId, attendance, current.student, entry.status);
        }
        await tx.insert(auditLogs).values({
          id: randomUUID(),
          schoolId,
          actorUserId,
          action: "attendance.corrected_by_admin",
          entityType: "daily_attendance",
          entityId: attendance.id,
          metadata: {
            studentId,
            previousStatus: current.entry.status,
            status: entry.status,
            note: entry.note
          }
        });
        return { attendance, entry };
      });
      return { attendance, entry, previousStatus: current.entry.status };
    }
  };
}
