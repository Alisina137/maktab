import { and, eq } from "drizzle-orm";
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
