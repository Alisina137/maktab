import { and, eq } from "drizzle-orm";
import { safeAuditMetadata } from "./audit-safe.js";
import {
  getAdvancedPilotReadiness, listPilotReadinessIssues,
  type AdvancedPilotReadiness, type PilotCoverageIssues, type PilotCoverageKey
} from "./pilot-readiness-advanced.js";
import {
  getOperationalReadiness, listOperationalIssues,
  type OperationalReadiness, type OperationalIssues, type OperationalReadinessKey
} from "./pilot-readiness-operational.js";
import type { FoundationDatabase } from "./client.js";
import {
  academicYears,
  announcements,
  auditLogs,
  classSections,
  dailyAttendances,
  examSubjects,
  exams,
  feeInvoices,
  feePayments,
  gradeLevels,
  gradeRecords,
  homeworks,
  negaranAssignments,
  parentProfiles,
  schoolSettings,
  schools,
  studentAttendances,
  students,
  subjects,
  subscriptions,
  teacherAssignments,
  teacherProfiles,
  timetablePeriods,
  users
} from "./schema.js";


const EXPORT_ROW_CAP = 1500;
const EXPORT_BYTE_CAP = 5 * 1024 * 1024;
const EXPORT_PRIVATE_FIELDS = new Set([
  "passwordHash", "refreshToken", "accessToken", "tokenHash",
  "verificationCode", "verificationToken", "phone", "email",
  "twoFactorPhone", "twoFactorEmail", "whatsapp",
  "transactionReference", "reversalReason", "supportNotes",
  "idempotencyKey", "fingerprint"
]);

export class PilotExportLimitError extends Error {}

function redactPilotExport(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPilotExport);
  if (value instanceof Date || value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) =>
    !EXPORT_PRIVATE_FIELDS.has(key)
  ).map(([key, entry]) => [key, redactPilotExport(entry)]));
}

export interface PilotReadiness {
  ready: boolean;
  counts: {
    admins: number;
    teachers: number;
    parents: number;
    students: number;
    activeAcademicYears: number;
    classes: number;
    subjects: number;
    teacherAssignments: number;
  };
  checks: Array<{ key: string; passed: boolean; detail: string }>;
}

export interface PilotStore {
  getReadiness(schoolId: string): Promise<PilotReadiness>;
  getAdvancedReadiness(schoolId: string): Promise<AdvancedPilotReadiness>;
  listReadinessIssues(schoolId: string, metric: PilotCoverageKey, options: { limit: number; offset: number }): Promise<PilotCoverageIssues>;
  getOperationalReadiness(schoolId: string): Promise<OperationalReadiness>;
  listOperationalIssues(schoolId: string, metric: OperationalReadinessKey, options: {
    limit: number; offset: number;
  }): Promise<OperationalIssues>;
  exportCoreSchoolData(schoolId: string): Promise<Record<string, unknown> | null>;
}

export function createPilotStore(db: FoundationDatabase): PilotStore {
  return {
    async getReadiness(schoolId) {
      const [schoolContext] = await db.select({ school: schools, subscription: subscriptions })
        .from(schools).innerJoin(subscriptions, eq(subscriptions.schoolId, schools.id))
        .where(eq(schools.id, schoolId)).limit(1);
      if (!schoolContext) {
        return {
          ready: false,
          counts: { admins: 0, teachers: 0, parents: 0, students: 0,
            activeAcademicYears: 0, classes: 0, subjects: 0, teacherAssignments: 0 },
          checks: [{ key: "school", passed: false, detail: "School not found." }]
        };
      }

      // Only currently usable accounts/enrollments and active-year assignments
      // count toward readiness. A suspended or archived account must not
      // make an unstaffed school appear pilot-ready.
      const [adminRows, teacherRows, parentRows, studentRows,
        yearRows, classRows, subjectRows, assignmentRows] = await Promise.all([
        db.select({ id: users.id }).from(users).where(and(
          eq(users.schoolId, schoolId), eq(users.role, "SCHOOL_ADMIN"), eq(users.status, "ACTIVE")
        )),
        db.select({ id: teacherProfiles.userId }).from(teacherProfiles)
          .innerJoin(users, and(eq(users.id, teacherProfiles.userId),
            eq(users.schoolId, teacherProfiles.schoolId)))
          .where(and(eq(teacherProfiles.schoolId, schoolId),
            eq(users.role, "TEACHER"), eq(users.status, "ACTIVE"))),
        db.select({ id: parentProfiles.userId }).from(parentProfiles)
          .innerJoin(users, and(eq(users.id, parentProfiles.userId),
            eq(users.schoolId, parentProfiles.schoolId)))
          .where(and(eq(parentProfiles.schoolId, schoolId),
            eq(users.role, "PARENT"), eq(users.status, "ACTIVE"))),
        db.select({ id: students.id }).from(students)
          .where(and(eq(students.schoolId, schoolId), eq(students.status, "ACTIVE"))),
        db.select({ id: academicYears.id }).from(academicYears)
          .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.status, "ACTIVE"))),
        db.select({ id: classSections.id }).from(classSections)
          .innerJoin(academicYears, and(eq(academicYears.id, classSections.academicYearId),
            eq(academicYears.schoolId, classSections.schoolId)))
          .where(and(eq(classSections.schoolId, schoolId), eq(academicYears.status, "ACTIVE"))),
        db.select({ id: subjects.id }).from(subjects).where(eq(subjects.schoolId, schoolId)),
        db.select({ id: teacherAssignments.id }).from(teacherAssignments)
          .innerJoin(academicYears, and(eq(academicYears.id, teacherAssignments.academicYearId),
            eq(academicYears.schoolId, teacherAssignments.schoolId)))
          .innerJoin(users, and(eq(users.id, teacherAssignments.teacherUserId),
            eq(users.schoolId, teacherAssignments.schoolId)))
          .where(and(eq(teacherAssignments.schoolId, schoolId),
            eq(academicYears.status, "ACTIVE"), eq(users.role, "TEACHER"), eq(users.status, "ACTIVE")))
      ]);

      const admins = adminRows.length;
      const teachers = teacherRows.length;
      const parents = parentRows.length;
      const studentCount = studentRows.length;
      const activeYears = yearRows.length;
      const classes = classRows.length;
      const subjectCount = subjectRows.length;
      const assignments = assignmentRows.length;
      const operationalSubscription = !["SUSPENDED", "CANCELLED"].includes(schoolContext.subscription.status);
      const checks = [
        { key: "school-active", passed: schoolContext.school.status === "ACTIVE", detail: "School is active." },
        { key: "subscription", passed: operationalSubscription, detail: `Subscription status: ${schoolContext.subscription.status}.` },
        { key: "admin", passed: admins >= 1, detail: `${admins} active school administrator account(s).` },
        { key: "academic-year", passed: activeYears === 1, detail: `${activeYears} active academic year(s).` },
        { key: "classes", passed: classes >= 1, detail: `${classes} active-year class(es).` },
        { key: "subjects", passed: subjectCount >= 1, detail: `${subjectCount} subject(s).` },
        { key: "teachers", passed: teachers >= 1, detail: `${teachers} active teacher profile(s).` },
        { key: "assignments", passed: assignments >= 1, detail: `${assignments} active-year teacher assignment(s).` },
        { key: "families", passed: parents >= 1 && studentCount >= 1,
          detail: `${parents} active parent(s), ${studentCount} enrolled student(s).` }
      ];

      return {
        ready: checks.every((check) => check.passed),
        counts: {
          admins, teachers, parents, students: studentCount,
          activeAcademicYears: activeYears, classes, subjects: subjectCount, teacherAssignments: assignments
        },
        checks
      };
    },

    async getAdvancedReadiness(schoolId) {
      const core = await this.getReadiness(schoolId);
      return getAdvancedPilotReadiness(db, schoolId, core.ready);
    },

    async listReadinessIssues(schoolId, metric, options) {
      return listPilotReadinessIssues(db, schoolId, metric, options);
    },

    async getOperationalReadiness(schoolId) {
      return getOperationalReadiness(db, schoolId);
    },

    async listOperationalIssues(schoolId, metric, options) {
      return listOperationalIssues(db, schoolId, metric, options);
    },

    async exportCoreSchoolData(schoolId) {
      const [schoolContext] = await db
        .select({ school: schools, settings: schoolSettings, subscription: subscriptions })
        .from(schools)
        .innerJoin(schoolSettings, eq(schoolSettings.schoolId, schools.id))
        .innerJoin(subscriptions, eq(subscriptions.schoolId, schools.id))
        .where(eq(schools.id, schoolId))
        .limit(1);
      if (!schoolContext) return null;

      const [
        userRows,
        parentRows,
        studentRows,
        teacherRows,
        yearRows,
        gradeRows,
        classRows,
        subjectRows,
        assignmentRows,
        negaranRows,
        timetableRows,
        dailyRows,
        studentAttendanceRows,
        homeworkRows,
        examRows,
        examSubjectRows,
        gradeRecordRows,
        announcementRows,
        invoiceRows,
        paymentRows,
        auditRows
      ] = await Promise.all([
        db.select({
          id: users.id,
          username: users.username,
          role: users.role,
          status: users.status,
          mustChangePassword: users.mustChangePassword,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt
        }).from(users).where(eq(users.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(parentProfiles).where(eq(parentProfiles.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(students).where(eq(students.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(teacherProfiles).where(eq(teacherProfiles.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(academicYears).where(eq(academicYears.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(gradeLevels).where(eq(gradeLevels.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(classSections).where(eq(classSections.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(subjects).where(eq(subjects.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(teacherAssignments).where(eq(teacherAssignments.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(negaranAssignments).where(eq(negaranAssignments.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(timetablePeriods).where(eq(timetablePeriods.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(dailyAttendances).where(eq(dailyAttendances.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(studentAttendances).where(eq(studentAttendances.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(homeworks).where(eq(homeworks.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(exams).where(eq(exams.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(examSubjects).where(eq(examSubjects.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(gradeRecords).where(eq(gradeRecords.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(announcements).where(eq(announcements.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(feeInvoices).where(eq(feeInvoices.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(feePayments).where(eq(feePayments.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1),
        db.select().from(auditLogs).where(eq(auditLogs.schoolId, schoolId)).limit(EXPORT_ROW_CAP + 1)
      ]);

      const collections = [
        userRows, parentRows, studentRows, teacherRows, yearRows, gradeRows,
        classRows, subjectRows, assignmentRows, negaranRows, timetableRows,
        dailyRows, studentAttendanceRows, homeworkRows, examRows, examSubjectRows,
        gradeRecordRows, announcementRows, invoiceRows, paymentRows, auditRows
      ];
      if (collections.some(rows => rows.length > EXPORT_ROW_CAP)) {
        throw new PilotExportLimitError("School export exceeds the safe row limit. Contact platform support for a managed export.");
      }
      const exportData = {
        exportedAt: new Date().toISOString(),
        school: schoolContext.school,
        settings: schoolContext.settings,
        subscription: schoolContext.subscription,
        users: userRows,
        parentProfiles: parentRows,
        students: studentRows,
        teacherProfiles: teacherRows,
        academicYears: yearRows,
        gradeLevels: gradeRows,
        classes: classRows,
        subjects: subjectRows,
        teacherAssignments: assignmentRows,
        negaranAssignments: negaranRows,
        timetable: timetableRows,
        dailyAttendance: dailyRows,
        studentAttendance: studentAttendanceRows,
        homework: homeworkRows,
        exams: examRows,
        examSubjects: examSubjectRows,
        gradeRecords: gradeRecordRows,
        announcements: announcementRows,
        feeInvoices: invoiceRows,
        feePayments: paymentRows,
        auditLogs: auditRows.map(row => ({ ...row, metadata: safeAuditMetadata(row.metadata) }))
      };
      // Exports are portable school reports, not database backups. Remove fields
      // that are unnecessary for school-admin reporting, including raw contact
      // details and integration/payment references.
      const safeData = redactPilotExport(exportData) as Record<string, unknown>;
      if (Buffer.byteLength(JSON.stringify(safeData), "utf8") > EXPORT_BYTE_CAP) {
        throw new PilotExportLimitError("School export exceeds the safe file size. Contact platform support for a managed export.");
      }
      return safeData;
    }
  };
}
