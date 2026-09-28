import { eq } from "drizzle-orm";
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
  exportCoreSchoolData(schoolId: string): Promise<Record<string, unknown> | null>;
}

export function createPilotStore(db: FoundationDatabase): PilotStore {
  async function ids<T>(promise: Promise<T[]>): Promise<number> {
    return (await promise).length;
  }

  return {
    async getReadiness(schoolId) {
      const [
        admins,
        teachers,
        parents,
        studentCount,
        activeYears,
        classes,
        subjectCount,
        assignments
      ] = await Promise.all([
        ids(db.select({ id: users.id }).from(users).where(eq(users.schoolId, schoolId)).then((rows) => rows.filter((row) => row.id))),
        ids(db.select({ id: teacherProfiles.userId }).from(teacherProfiles).where(eq(teacherProfiles.schoolId, schoolId))),
        ids(db.select({ id: parentProfiles.userId }).from(parentProfiles).where(eq(parentProfiles.schoolId, schoolId))),
        ids(db.select({ id: students.id }).from(students).where(eq(students.schoolId, schoolId))),
        ids(
          db
            .select({ id: academicYears.id })
            .from(academicYears)
            .where(eq(academicYears.schoolId, schoolId))
            .then((rows) => rows.filter(() => true))
        ),
        ids(db.select({ id: classSections.id }).from(classSections).where(eq(classSections.schoolId, schoolId))),
        ids(db.select({ id: subjects.id }).from(subjects).where(eq(subjects.schoolId, schoolId))),
        ids(db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(eq(teacherAssignments.schoolId, schoolId)))
      ]);

      const adminUsers = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.schoolId, schoolId));
      const yearRows = await db
        .select({ id: academicYears.id, status: academicYears.status })
        .from(academicYears)
        .where(eq(academicYears.schoolId, schoolId));
      const context = await db
        .select({ school: schools, subscription: subscriptions })
        .from(schools)
        .innerJoin(subscriptions, eq(subscriptions.schoolId, schools.id))
        .where(eq(schools.id, schoolId))
        .limit(1);
      if (!context[0]) {
        return {
          ready: false,
          counts: {
            admins: 0,
            teachers: 0,
            parents: 0,
            students: 0,
            activeAcademicYears: 0,
            classes: 0,
            subjects: 0,
            teacherAssignments: 0
          },
          checks: [{ key: "school", passed: false, detail: "School not found." }]
        };
      }

      const realAdmins = adminUsers.filter((user) => user.role === "SCHOOL_ADMIN").length;
      const realActiveYears = yearRows.filter((year) => year.status === "ACTIVE").length;
      const operationalSubscription = !["SUSPENDED", "CANCELLED"].includes(context[0].subscription.status);
      const checks = [
        { key: "school-active", passed: context[0].school.status === "ACTIVE", detail: "School is active." },
        { key: "subscription", passed: operationalSubscription, detail: `Subscription status: ${context[0].subscription.status}.` },
        { key: "admin", passed: realAdmins >= 1, detail: `${realAdmins} school administrator account(s).` },
        { key: "academic-year", passed: realActiveYears === 1, detail: `${realActiveYears} active academic year(s).` },
        { key: "classes", passed: classes >= 1, detail: `${classes} class(es).` },
        { key: "subjects", passed: subjectCount >= 1, detail: `${subjectCount} subject(s).` },
        { key: "teachers", passed: teachers >= 1, detail: `${teachers} teacher profile(s).` },
        { key: "assignments", passed: assignments >= 1, detail: `${assignments} teacher assignment(s).` },
        { key: "families", passed: parents >= 1 && studentCount >= 1, detail: `${parents} parent(s), ${studentCount} student(s).` }
      ];

      return {
        ready: checks.every((check) => check.passed),
        counts: {
          admins: realAdmins,
          teachers,
          parents,
          students: studentCount,
          activeAcademicYears: realActiveYears,
          classes,
          subjects: subjectCount,
          teacherAssignments: assignments
        },
        checks
      };
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
        }).from(users).where(eq(users.schoolId, schoolId)),
        db.select().from(parentProfiles).where(eq(parentProfiles.schoolId, schoolId)),
        db.select().from(students).where(eq(students.schoolId, schoolId)),
        db.select().from(teacherProfiles).where(eq(teacherProfiles.schoolId, schoolId)),
        db.select().from(academicYears).where(eq(academicYears.schoolId, schoolId)),
        db.select().from(gradeLevels).where(eq(gradeLevels.schoolId, schoolId)),
        db.select().from(classSections).where(eq(classSections.schoolId, schoolId)),
        db.select().from(subjects).where(eq(subjects.schoolId, schoolId)),
        db.select().from(teacherAssignments).where(eq(teacherAssignments.schoolId, schoolId)),
        db.select().from(negaranAssignments).where(eq(negaranAssignments.schoolId, schoolId)),
        db.select().from(timetablePeriods).where(eq(timetablePeriods.schoolId, schoolId)),
        db.select().from(dailyAttendances).where(eq(dailyAttendances.schoolId, schoolId)),
        db.select().from(studentAttendances).where(eq(studentAttendances.schoolId, schoolId)),
        db.select().from(homeworks).where(eq(homeworks.schoolId, schoolId)),
        db.select().from(exams).where(eq(exams.schoolId, schoolId)),
        db.select().from(examSubjects).where(eq(examSubjects.schoolId, schoolId)),
        db.select().from(gradeRecords).where(eq(gradeRecords.schoolId, schoolId)),
        db.select().from(announcements).where(eq(announcements.schoolId, schoolId)),
        db.select().from(feeInvoices).where(eq(feeInvoices.schoolId, schoolId)),
        db.select().from(feePayments).where(eq(feePayments.schoolId, schoolId)),
        db.select().from(auditLogs).where(eq(auditLogs.schoolId, schoolId))
      ]);

      return {
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
        auditLogs: auditRows
      };
    }
  };
}
