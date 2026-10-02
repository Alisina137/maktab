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
    const [assignment] = await db
      .select()
      .from(negaranAssignments)
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
    const classStudents = await activeStudents(schoolId, classId, classSection.academicYearId);
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

  async function syncAttendanceAlert(
    schoolId: string,
    attendance: DailyAttendance,
    student: Student,
    status: AttendanceStatus
  ): Promise<boolean> {
    const dedupKey = `attendance:${attendance.id}:${student.id}`;
    const [existing] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.schoolId, schoolId), eq(notifications.dedupKey, dedupKey)))
      .limit(1);

    if (status !== "ABSENT" && status !== "LATE") {
      if (existing && !existing.readAt) {
        await db
          .update(notifications)
          .set({ deliveryStatus: "CANCELLED", updatedAt: new Date() })
          .where(eq(notifications.id, existing.id));
      }
      return false;
    }

    const type = status === "ABSENT" ? "ATTENDANCE_ABSENT" : "ATTENDANCE_LATE";
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
      updatedAt: new Date()
    };

    if (existing) {
      await db
        .update(notifications)
        .set(values)
        .where(and(eq(notifications.schoolId, schoolId), eq(notifications.id, existing.id)));
      return false;
    }

    await db.insert(notifications).values({
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

    getTeacherAttendanceSheet: sheetForTeacher,

    async submitDailyAttendance(schoolId, teacherUserId, input) {
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
      if (classStudents.length === 0) {
        throw new AttendanceConflictError("This class has no active students to mark.");
      }

      const studentIds = new Set(classStudents.map((student) => student.id));
      const submittedIds = new Set(input.entries.map((entry) => entry.studentId));
      if (submittedIds.size !== input.entries.length) {
        throw new AttendanceValidationError("Each student may be marked only once.");
      }
      if (
        input.entries.length !== classStudents.length ||
        input.entries.some((entry) => !studentIds.has(entry.studentId))
      ) {
        throw new AttendanceValidationError("Every active student in the supervised class must have exactly one attendance state.");
      }

      const existing = await getAttendance(schoolId, input.classId, input.date);
      let changed = !existing;
      if (existing) {
        const current = await db
          .select()
          .from(studentAttendances)
          .where(
            and(
              eq(studentAttendances.schoolId, schoolId),
              eq(studentAttendances.attendanceId, existing.id)
            )
          );
        const byStudent = new Map(current.map((entry) => [entry.studentId, entry]));
        changed = input.entries.some((entry) => {
          const old = byStudent.get(entry.studentId);
          return !old || old.status !== entry.status || (old.note ?? "") !== (entry.note ?? "");
        });
        if (!changed) {
          return {
            sheet: await buildSheet(schoolId, input.classId, input.date, true),
            created: false,
            changed: false,
            notificationCount: 0
          };
        }
      }

      const attendance = await db.transaction(async (tx) => {
        let attendanceRow = existing;
        if (!attendanceRow) {
          const [created] = await tx
            .insert(dailyAttendances)
            .values({
              id: randomUUID(),
              schoolId,
              academicYearId: negaran.academicYearId,
              classId: input.classId,
              date: input.date,
              status: "SUBMITTED",
              submittedBy: teacherUserId,
              updatedBy: teacherUserId
            })
            .returning();
          if (!created) throw new Error("Attendance insert did not return a row.");
          attendanceRow = created;
        } else {
          const [updated] = await tx
            .update(dailyAttendances)
            .set({
              status: "CORRECTED",
              updatedBy: teacherUserId,
              updatedAt: new Date()
            })
            .where(and(eq(dailyAttendances.schoolId, schoolId), eq(dailyAttendances.id, attendanceRow.id)))
            .returning();
          attendanceRow = updated ?? attendanceRow;
        }

        const existingMarks = existing
          ? await tx
              .select()
              .from(studentAttendances)
              .where(
                and(
                  eq(studentAttendances.schoolId, schoolId),
                  eq(studentAttendances.attendanceId, attendanceRow.id)
                )
              )
          : [];
        const markByStudent = new Map(existingMarks.map((entry) => [entry.studentId, entry]));

        for (const entry of input.entries) {
          const old = markByStudent.get(entry.studentId);
          if (old) {
            await tx
              .update(studentAttendances)
              .set({
                status: entry.status,
                note: entry.note || null,
                updatedAt: new Date()
              })
              .where(and(eq(studentAttendances.schoolId, schoolId), eq(studentAttendances.id, old.id)));
          } else {
            await tx.insert(studentAttendances).values({
              id: randomUUID(),
              schoolId,
              attendanceId: attendanceRow.id,
              studentId: entry.studentId,
              status: entry.status,
              note: entry.note || null
            });
          }
        }
        return attendanceRow;
      });

      let notificationCount = 0;
      for (const entry of input.entries) {
        const student = classStudents.find((item) => item.id === entry.studentId);
        if (!student) continue;
        if (await syncAttendanceAlert(schoolId, attendance, student, entry.status)) notificationCount += 1;
      }

      return {
        sheet: await buildSheet(schoolId, input.classId, input.date, true),
        created: !existing,
        changed,
        notificationCount
      };
    },

    async getParentAttendance(schoolId, parentUserId, studentId, from, to) {
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
            eq(notifications.id, notificationId)
          )
        )
        .returning();
      return updated ?? null;
    },

    async getAdminReport(schoolId, from, to, classId, academicYearId) {
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

      const [entry] = await db
        .update(studentAttendances)
        .set({ status: input.status, note: input.note || null, updatedAt: new Date() })
        .where(and(eq(studentAttendances.schoolId, schoolId), eq(studentAttendances.id, current.entry.id)))
        .returning();
      if (!entry) throw new AttendanceNotFoundError("Attendance entry not found.");

      const [attendance] = await db
        .update(dailyAttendances)
        .set({ status: "CORRECTED", updatedBy: actorUserId, updatedAt: new Date() })
        .where(and(eq(dailyAttendances.schoolId, schoolId), eq(dailyAttendances.id, attendanceId)))
        .returning();
      if (!attendance) throw new AttendanceNotFoundError("Attendance record not found.");

      await syncAttendanceAlert(schoolId, attendance, current.student, entry.status);
      return { attendance, entry, previousStatus: current.entry.status };
    }
  };
}
