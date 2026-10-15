import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gt, ilike, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import type {
  CorrectPublishedGradeInput,
  CreateExamInput,
  CreateExamSubjectInput,
  CreateHomeworkInput,
  ExamStatus,
  GradeEntryInput,
  HomeworkStatus,
  UpdateHomeworkInput
} from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import { isUniqueConstraintViolation } from "./db-errors.js";
import {
  academicYears,
  auditLogs,
  classSections,
  examSubjects,
  exams,
  gradeRecords,
  homeworks,
  homeworkSubmissions,
  curriculumUnits,
  teacherUnitProgress,
  continuousAssessments,
  notifications,
  students,
  subjects,
  teacherAssignments,
  teacherProfiles,
  users,
  type Exam,
  type ExamSubject,
  type GradeRecord,
  type Homework,
  type Student
} from "./schema.js";

export interface LearningAssignmentView {
  assignmentId: string;
  academicYearId: string;
  classId: string;
  className: string;
  classCode: string;
  subjectId: string;
  subjectName: string;
}

export interface TeacherExamSubjectView {
  examSubject: ExamSubject;
  exam: Exam;
  className: string;
  classCode: string;
  subjectName: string;
}

export interface TeacherLearningView {
  assignments: LearningAssignmentView[];
  homeworks: Homework[];
  examSubjects: TeacherExamSubjectView[];
}

export interface GradeSheet {
  examSubject: ExamSubject;
  exam: Exam;
  classSection: { id: string; name: string; code: string };
  subject: { id: string; name: string; code: string };
  students: Array<{ student: Student; grade: GradeRecord | null }>;
  canEdit: boolean;
}

export interface PublishedHomeworkView {
  homework: Homework;
  subjectName: string;
  className: string;
}

export interface PublishedResultView {
  grade: GradeRecord;
  exam: Exam;
  examSubject: ExamSubject;
  subjectName: string;
  className: string;
}

export interface LearnerAcademicView {
  student: Student;
  homework: PublishedHomeworkView[];
  results: PublishedResultView[];
}

export interface AdminLearningOverview {
  exams: Exam[];
  examSubjects: Array<{
    examSubject: ExamSubject;
    className: string;
    classCode: string;
    subjectName: string;
  }>;
  publishedGrades: Array<{
    grade: GradeRecord;
    academicYearId: string;
    examName: string;
    subjectName: string;
    className: string;
    studentName: string;
    studentCode: string;
    maxScore: number;
  }>;
}

export interface AdminPublishedGradesQuery {
  academicYearId: string;
  examId?: string;
  classId?: string;
  subjectId?: string;
  search?: string;
  limit: number;
  offset: number;
}

export interface AdminPublishedGradeRow {
  grade: GradeRecord;
  academicYearId: string;
  examId: string;
  examName: string;
  examStatus: ExamStatus;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  studentName: string;
  studentCode: string;
  maxScore: number;
  canCorrect: boolean;
}

export interface AdminGradeCorrectionEvent {
  id: string;
  createdAt: Date;
  actorUsername: string | null;
  previousScore: number | null;
  score: number | null;
  previousRemark: string | null;
  remark: string | null;
  reason: string;
}

export type AdminHomeworkAttention = "ALL" | "PAST_DUE" | "AWAITING_REVIEW" | "MISSING" | "REVISION_REQUESTED";
export type AdminHomeworkSubmissionFilter = "ALL" | "MISSING" | "SUBMITTED" | "REVIEWED" | "REVISION_REQUESTED";

export interface AdminHomeworkQuery {
  academicYearId: string;
  status?: HomeworkStatus;
  classId?: string;
  subjectId?: string;
  teacherUserId?: string;
  search?: string;
  attention?: AdminHomeworkAttention;
  limit: number;
  offset: number;
}

export interface AdminHomeworkItem {
  homework: Pick<Homework, "id" | "title" | "status" | "dueAt" | "scheduledAt" | "publishedAt" | "createdAt" | "updatedAt">;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherUserId: string;
  teacherName: string;
  expected: number;
  submitted: number;
  awaitingReview: number;
  reviewed: number;
  revisionRequested: number;
  missing: number;
  pastDueWithMissing: boolean;
}

export interface AdminHomeworkRosterEntry {
  student: { id: string; fullName: string; studentCode: string };
  submission: { id: string; status: string; submittedAt: Date; reviewedAt: Date | null;
    feedback: string | null } | null;
}

export interface AdminLearningDashboard {
  academicYearId: string;
  metrics: {
    activeExams: number;
    examsAwaitingPublication: number;
    publishedExams: number;
    publishedHomework: number;
    submissionsAwaitingReview: number;
    classesWithMissingMarks: number;
    continuousAssessments: number;
    curriculumCompletedUnits: number;
    curriculumAssignedUnits: number;
  };
  attention: Array<{
    id: string;
    category: "EXAMS" | "RESULTS" | "HOMEWORK";
    title: string;
    detail: string;
    count: number;
  }>;
}

export interface AdminExamDetail {
  exam: Exam;
  subjects: Array<{
    examSubject: ExamSubject;
    className: string;
    classCode: string;
    subjectName: string;
  }>;
  sameDayWarnings: Array<{
    classId: string;
    className: string;
    examDate: string;
    subjectNames: string[];
  }>;
}

export interface AdminExamReadiness {
  examId: string;
  examStatus: ExamStatus;
  academicYearActive: boolean;
  totals: {
    configuredSubjects: number;
    scheduledSubjects: number;
    participatingClasses: number;
    expectedMarks: number;
    validMarks: number;
    missingMarks: number;
    invalidMarks: number;
    recipients: number;
  };
  subjects: Array<{
    examSubjectId: string;
    classId: string;
    className: string;
    subjectName: string;
    examDate: string | null;
    maxScore: number;
    expected: number;
    valid: number;
    missing: number;
    invalid: number;
  }>;
  checks: Array<{
    code: "SUBJECTS_CONFIGURED" | "DATES_CONFIGURED" | "ACTIVE_STUDENTS" |
      "ALL_DRAFT_MARKS" | "ACTIVE_YEAR" | "STATUS_READY_FOR_PUBLISH";
    passed: boolean;
    affected: number;
  }>;
  canSchedule: boolean;
  canMarkResultsReady: boolean;
  canPublish: boolean;
}

export interface LearningStore {
  getTeacherLearning(schoolId: string, teacherUserId: string): Promise<TeacherLearningView>;
  createHomework(schoolId: string, teacherUserId: string, input: CreateHomeworkInput): Promise<Homework>;
  updateHomework(schoolId: string, teacherUserId: string, homeworkId: string, input: UpdateHomeworkInput): Promise<Homework>;
  setHomeworkStatus(schoolId: string, teacherUserId: string, homeworkId: string, status: HomeworkStatus): Promise<Homework>;
  getGradeSheet(schoolId: string, teacherUserId: string, examSubjectId: string): Promise<GradeSheet>;
  saveDraftGrades(schoolId: string, teacherUserId: string, examSubjectId: string, entries: GradeEntryInput[]): Promise<GradeSheet>;
  getParentAcademicView(schoolId: string, parentUserId: string, studentId: string): Promise<LearnerAcademicView>;
  getStudentEnrollmentStatus(
    schoolId: string,
    studentUserId: string
  ): Promise<{ studentId: string; status: Student["status"] }>;
  getStudentAcademicView(schoolId: string, studentUserId: string): Promise<LearnerAcademicView>;
  listAdminHomework(schoolId: string, query: AdminHomeworkQuery):
    Promise<{ rows: AdminHomeworkItem[]; total: number; limit: number; offset: number }>;
  getAdminHomeworkRoster(schoolId: string, homeworkId: string,
    filter: AdminHomeworkSubmissionFilter, limit: number, offset: number):
    Promise<{ homework: { id: string; title: string; status: HomeworkStatus };
      students: AdminHomeworkRosterEntry[]; total: number; limit: number; offset: number;
      rosterBasis: "CURRENT_ACTIVE_ENROLLMENT" }>;
  getAdminOverview(schoolId: string, includePublishedGrades?: boolean): Promise<AdminLearningOverview>;
  listAdminPublishedGrades(schoolId: string, query: AdminPublishedGradesQuery):
    Promise<{ rows: AdminPublishedGradeRow[]; total: number; limit: number; offset: number }>;
  getAdminGradeCorrections(schoolId: string, gradeId: string, limit: number, offset: number):
    Promise<{ events: AdminGradeCorrectionEvent[]; total: number; limit: number; offset: number }>;
  getAdminExamDetail(schoolId: string, examId: string): Promise<AdminExamDetail>;
  getAdminExamReadiness(schoolId: string, examId: string): Promise<AdminExamReadiness>;
  getAdminDashboard(schoolId: string, academicYearId: string): Promise<AdminLearningDashboard>;
  createExam(schoolId: string, actorUserId: string, input: CreateExamInput): Promise<Exam>;
  createExamSubject(schoolId: string, actorUserId: string, input: CreateExamSubjectInput): Promise<ExamSubject>;
  updateExamSubjectDate(schoolId: string, actorUserId: string, examSubjectId: string, examDate: string): Promise<ExamSubject>;
  setExamStatus(schoolId: string, actorUserId: string, examId: string, status: ExamStatus): Promise<Exam>;
  publishExam(schoolId: string, actorUserId: string, examId: string): Promise<{ exam: Exam; notificationCount: number }>;
  correctPublishedGrade(
    schoolId: string,
    actorUserId: string,
    gradeId: string,
    input: CorrectPublishedGradeInput
  ): Promise<{ grade: GradeRecord; previousScore: number; previousRemark: string | null }>;
}

export class LearningConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LearningConflictError";
  }
}
export class LearningValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LearningValidationError";
  }
}
export class LearningNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LearningNotFoundError";
  }
}

function isUniqueError(error: unknown): boolean {
  return isUniqueConstraintViolation(error);
}

export function createLearningStore(db: FoundationDatabase): LearningStore {
  async function getAssignment(schoolId: string, teacherUserId: string, assignmentId: string) {
    const [row] = await db
      .select({ assignment: teacherAssignments, year: academicYears })
      .from(teacherAssignments)
      .innerJoin(
        academicYears,
        and(
          eq(academicYears.id, teacherAssignments.academicYearId),
          eq(academicYears.schoolId, teacherAssignments.schoolId)
        )
      )
      .where(
        and(
          eq(teacherAssignments.schoolId, schoolId),
          eq(teacherAssignments.id, assignmentId),
          eq(teacherAssignments.teacherUserId, teacherUserId)
        )
      )
      .limit(1);
    if (!row) throw new LearningNotFoundError("Teacher assignment not found.");
    if (row.year.status !== "ACTIVE") {
      throw new LearningConflictError("Homework and marks require an assignment in the active academic year.");
    }
    return row.assignment;
  }

  async function getExam(schoolId: string, examId: string) {
    const [exam] = await db
      .select()
      .from(exams)
      .where(and(eq(exams.schoolId, schoolId), eq(exams.id, examId)))
      .limit(1);
    if (!exam) throw new LearningNotFoundError("Exam not found.");
    return exam;
  }

  async function getExamSubject(schoolId: string, examSubjectId: string) {
    const [row] = await db
      .select({
        examSubject: examSubjects,
        exam: exams,
        classSection: classSections,
        subject: subjects
      })
      .from(examSubjects)
      .innerJoin(exams, and(eq(exams.id, examSubjects.examId), eq(exams.schoolId, examSubjects.schoolId)))
      .innerJoin(classSections, and(eq(classSections.id, examSubjects.classId), eq(classSections.schoolId, examSubjects.schoolId)))
      .innerJoin(subjects, and(eq(subjects.id, examSubjects.subjectId), eq(subjects.schoolId, examSubjects.schoolId)))
      .where(and(eq(examSubjects.schoolId, schoolId), eq(examSubjects.id, examSubjectId)))
      .limit(1);
    if (!row) throw new LearningNotFoundError("Exam subject not found.");
    return row;
  }

  async function requireTeacherExamSubject(schoolId: string, teacherUserId: string, examSubjectId: string) {
    const row = await getExamSubject(schoolId, examSubjectId);
    const [assignment] = await db
      .select({ id: teacherAssignments.id })
      .from(teacherAssignments)
      .innerJoin(
        academicYears,
        and(
          eq(academicYears.id, teacherAssignments.academicYearId),
          eq(academicYears.schoolId, teacherAssignments.schoolId)
        )
      )
      .where(
        and(
          eq(teacherAssignments.schoolId, schoolId),
          eq(teacherAssignments.teacherUserId, teacherUserId),
          eq(teacherAssignments.academicYearId, row.exam.academicYearId),
          eq(teacherAssignments.classId, row.examSubject.classId),
          eq(teacherAssignments.subjectId, row.examSubject.subjectId),
          eq(academicYears.status, "ACTIVE")
        )
      )
      .limit(1);
    if (!assignment) {
      throw new LearningValidationError("You are not assigned to this subject and class in the active academic year.");
    }
    return row;
  }

  async function classStudents(schoolId: string, classId: string, academicYearId: string) {
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

  async function recipientUserIds(schoolId: string, classId: string) {
    const classStudentsRows = await db
      .select({ parentUserId: students.parentUserId, userId: students.userId })
      .from(students)
      .where(and(eq(students.schoolId, schoolId), eq(students.classId, classId), eq(students.status, "ACTIVE")));
    return Array.from(
      new Set(
        classStudentsRows.flatMap((student) =>
          student.userId ? [student.parentUserId, student.userId] : [student.parentUserId]
        )
      )
    );
  }

  async function createNotification(
    schoolId: string,
    userId: string,
    dedupKey: string,
    type: string,
    title: string,
    message: string,
    deepLink: string,
    metadata: Record<string, unknown>
  ) {
    const result = await db
      .insert(notifications)
      .values({
        id: randomUUID(),
        schoolId,
        userId,
        dedupKey,
        type,
        title,
        message,
        deepLink,
        metadata,
        deliveryStatus: "PENDING"
      })
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    return result.length > 0;
  }

  async function visibleView(schoolId: string, student: Student): Promise<LearnerAcademicView> {
    const homeworkRows = await db
      .select({
        homework: homeworks,
        subjectName: subjects.name,
        className: classSections.name
      })
      .from(homeworks)
      .innerJoin(subjects, and(eq(subjects.id, homeworks.subjectId), eq(subjects.schoolId, homeworks.schoolId)))
      .innerJoin(classSections, and(eq(classSections.id, homeworks.classId), eq(classSections.schoolId, homeworks.schoolId)))
      .where(
        and(
          eq(homeworks.schoolId, schoolId),
          eq(homeworks.classId, student.classId),
          eq(homeworks.academicYearId, student.academicYearId),
          inArray(homeworks.status, ["PUBLISHED", "CLOSED"])
        )
      )
      .orderBy(asc(homeworks.dueAt));

    const resultRows = await db
      .select({
        grade: gradeRecords,
        exam: exams,
        examSubject: examSubjects,
        subjectName: subjects.name,
        className: classSections.name
      })
      .from(gradeRecords)
      .innerJoin(examSubjects, and(eq(examSubjects.id, gradeRecords.examSubjectId), eq(examSubjects.schoolId, gradeRecords.schoolId)))
      .innerJoin(exams, and(eq(exams.id, examSubjects.examId), eq(exams.schoolId, examSubjects.schoolId)))
      .innerJoin(subjects, and(eq(subjects.id, examSubjects.subjectId), eq(subjects.schoolId, examSubjects.schoolId)))
      .innerJoin(classSections, and(eq(classSections.id, examSubjects.classId), eq(classSections.schoolId, examSubjects.schoolId)))
      .where(
        and(
          eq(gradeRecords.schoolId, schoolId),
          eq(gradeRecords.studentId, student.id),
          eq(gradeRecords.status, "PUBLISHED"),
          inArray(exams.status, ["PUBLISHED", "ARCHIVED"])
        )
      )
      .orderBy(desc(exams.publishedAt), asc(subjects.name));

    return { student, homework: homeworkRows, results: resultRows };
  }

  return {
    async getTeacherLearning(schoolId, teacherUserId) {
      const assignments = await db
        .select({
          assignmentId: teacherAssignments.id,
          academicYearId: teacherAssignments.academicYearId,
          classId: classSections.id,
          className: classSections.name,
          classCode: classSections.code,
          subjectId: subjects.id,
          subjectName: subjects.name
        })
        .from(teacherAssignments)
        .innerJoin(
          academicYears,
          and(
            eq(academicYears.id, teacherAssignments.academicYearId),
            eq(academicYears.schoolId, teacherAssignments.schoolId),
            eq(academicYears.status, "ACTIVE")
          )
        )
        .innerJoin(classSections, and(eq(classSections.id, teacherAssignments.classId), eq(classSections.schoolId, teacherAssignments.schoolId)))
        .innerJoin(subjects, and(eq(subjects.id, teacherAssignments.subjectId), eq(subjects.schoolId, teacherAssignments.schoolId)))
        .where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.teacherUserId, teacherUserId)))
        .orderBy(asc(classSections.name), asc(subjects.name));

      const [teacherHomework, candidateExamSubjects] = await Promise.all([
        db.select().from(homeworks).where(and(eq(homeworks.schoolId, schoolId), eq(homeworks.teacherUserId, teacherUserId))).orderBy(desc(homeworks.createdAt)),
        db
          .select({
            examSubject: examSubjects,
            exam: exams,
            className: classSections.name,
            classCode: classSections.code,
            subjectName: subjects.name
          })
          .from(examSubjects)
          .innerJoin(exams, and(eq(exams.id, examSubjects.examId), eq(exams.schoolId, examSubjects.schoolId)))
          .innerJoin(classSections, and(eq(classSections.id, examSubjects.classId), eq(classSections.schoolId, examSubjects.schoolId)))
          .innerJoin(subjects, and(eq(subjects.id, examSubjects.subjectId), eq(subjects.schoolId, examSubjects.schoolId)))
          .where(
            and(
              eq(examSubjects.schoolId, schoolId),
              inArray(exams.status, ["IN_PROGRESS", "RESULTS_READY", "PUBLISHED", "ARCHIVED"])
            )
          )
          .orderBy(asc(exams.name), asc(classSections.name), asc(subjects.name))
      ]);
      const assignmentKeys = new Set(assignments.map((item) => `${item.academicYearId}:${item.classId}:${item.subjectId}`));
      return {
        assignments,
        homeworks: teacherHomework,
        examSubjects: candidateExamSubjects.filter((item) =>
          assignmentKeys.has(`${item.exam.academicYearId}:${item.examSubject.classId}:${item.examSubject.subjectId}`)
        )
      };
    },

    async createHomework(schoolId, teacherUserId, input) {
      const assignment = await getAssignment(schoolId, teacherUserId, input.assignmentId);
      if (new Date(input.dueAt).getTime() <= Date.now()) {
        throw new LearningValidationError("Homework deadline must be in the future.");
      }
      const [homework] = await db
        .insert(homeworks)
        .values({
          id: randomUUID(),
          schoolId,
          assignmentId: assignment.id,
          academicYearId: assignment.academicYearId,
          classId: assignment.classId,
          subjectId: assignment.subjectId,
          teacherUserId,
          title: input.title,
          content: input.content,
          dueAt: new Date(input.dueAt),
          attachmentUrl: input.attachmentUrl ?? null,
          status: "DRAFT"
        })
        .returning();
      if (!homework) throw new Error("Homework insert did not return a row.");
      return homework;
    },

    async updateHomework(schoolId, teacherUserId, homeworkId, input) {
      const [current] = await db
        .select()
        .from(homeworks)
        .where(and(eq(homeworks.schoolId, schoolId), eq(homeworks.id, homeworkId), eq(homeworks.teacherUserId, teacherUserId)))
        .limit(1);
      if (!current) throw new LearningNotFoundError("Homework not found.");
      if (current.status !== "DRAFT") throw new LearningConflictError("Only draft homework can be edited.");
      await getAssignment(schoolId, teacherUserId, current.assignmentId);
      if (input.dueAt && new Date(input.dueAt).getTime() <= Date.now()) {
        throw new LearningValidationError("Homework deadline must be in the future.");
      }
      if (input.dueAt && current.scheduledAt && new Date(input.dueAt) <= current.scheduledAt) {
        throw new LearningValidationError("Due date must remain after the scheduled publication.");
      }

      const [updated] = await db
        .update(homeworks)
        .set({
          title: input.title ?? current.title,
          content: input.content ?? current.content,
          dueAt: input.dueAt ? new Date(input.dueAt) : current.dueAt,
          attachmentUrl: input.attachmentUrl === undefined ? current.attachmentUrl : input.attachmentUrl,
          updatedAt: new Date()
        })
        .where(and(eq(homeworks.schoolId, schoolId), eq(homeworks.id, homeworkId),
          eq(homeworks.teacherUserId, teacherUserId), eq(homeworks.status, "DRAFT")))
        .returning();
      if (!updated) throw new LearningConflictError("Homework was published or changed. Refresh and retry.");
      return updated;
    },

    async setHomeworkStatus(schoolId, teacherUserId, homeworkId, status) {
      const [current] = await db
        .select()
        .from(homeworks)
        .where(and(eq(homeworks.schoolId, schoolId), eq(homeworks.id, homeworkId), eq(homeworks.teacherUserId, teacherUserId)))
        .limit(1);
      if (!current) throw new LearningNotFoundError("Homework not found.");

      const allowed: Record<HomeworkStatus, HomeworkStatus[]> = {
        DRAFT: ["PUBLISHED"],
        PUBLISHED: ["CLOSED"],
        CLOSED: ["ARCHIVED"],
        ARCHIVED: []
      };
      if (!allowed[current.status].includes(status)) {
        throw new LearningConflictError(`Homework cannot move from ${current.status} to ${status}.`);
      }

      if (status === "PUBLISHED") {
        await getAssignment(schoolId, teacherUserId, current.assignmentId);
        if (current.dueAt.getTime() < Date.now()) {
          throw new LearningConflictError("Homework due date cannot precede publication.");
        }
      }

      const now = new Date();
      return db.transaction(async (tx) => {
        const [updated] = await tx.update(homeworks).set({
          status, publishedAt: status === "PUBLISHED" ? now : current.publishedAt,
          scheduledAt: status === "PUBLISHED" ? null : current.scheduledAt,
          updatedAt: now
        }).where(and(eq(homeworks.schoolId, schoolId), eq(homeworks.id, homeworkId),
          eq(homeworks.teacherUserId, teacherUserId), eq(homeworks.status, current.status)))
          .returning();
        if (!updated) throw new LearningConflictError("Homework status changed. Refresh and retry.");
        if (status === "PUBLISHED") {
          const enrolled = await tx.select({
            parentId: students.parentUserId, childId: students.userId
          }).from(students).where(and(eq(students.schoolId, schoolId),
            eq(students.classId, updated.classId),
            eq(students.academicYearId, updated.academicYearId),
            eq(students.status, "ACTIVE")));
          for (const userId of new Set(enrolled.flatMap(x =>
            [x.parentId, x.childId].filter((id): id is string => !!id)))) {
            await tx.insert(notifications).values({
              id: randomUUID(), schoolId, userId, type: "HOMEWORK_PUBLISHED",
              title: "New homework", message: updated.title,
              deepLink: `/homework/${updated.id}`,
              dedupKey: `homework:${updated.id}:${userId}`,
              metadata: { homeworkId: updated.id, classId: updated.classId,
                subjectId: updated.subjectId, dueAt: updated.dueAt.toISOString() },
              deliveryStatus: "PENDING"
            }).onConflictDoNothing();
          }
        }
        await tx.insert(auditLogs).values({
          id: randomUUID(), schoolId, actorUserId: teacherUserId,
          action: status === "PUBLISHED" ? "homework.published" :
            status === "CLOSED" ? "homework.closed" : "homework.archived",
          entityType: "homework", entityId: updated.id,
          metadata: { classId: updated.classId, subjectId: updated.subjectId,
            dueAt: updated.dueAt.toISOString() }
        });
        return updated;
      });
    },

    async getGradeSheet(schoolId, teacherUserId, examSubjectId) {
      const row = await requireTeacherExamSubject(schoolId, teacherUserId, examSubjectId);
      const classStudentRows = await classStudents(schoolId, row.examSubject.classId, row.exam.academicYearId);
      const existing = await db
        .select()
        .from(gradeRecords)
        .where(and(eq(gradeRecords.schoolId, schoolId), eq(gradeRecords.examSubjectId, examSubjectId)));
      const byStudent = new Map(existing.map((grade) => [grade.studentId, grade]));
      return {
        examSubject: row.examSubject,
        exam: row.exam,
        classSection: { id: row.classSection.id, name: row.classSection.name, code: row.classSection.code },
        subject: { id: row.subject.id, name: row.subject.name, code: row.subject.code },
        students: classStudentRows.map((student) => ({ student, grade: byStudent.get(student.id) ?? null })),
        canEdit: row.exam.status === "IN_PROGRESS"
      };
    },

    async saveDraftGrades(schoolId, teacherUserId, examSubjectId, entries) {
      const row = await requireTeacherExamSubject(schoolId, teacherUserId, examSubjectId);
      if (row.exam.status !== "IN_PROGRESS") {
        throw new LearningConflictError("Marks can be entered only while the exam is IN_PROGRESS.");
      }
      const classStudentRows = await classStudents(schoolId, row.examSubject.classId, row.exam.academicYearId);
      const validIds = new Set(classStudentRows.map((student) => student.id));
      const seen = new Set<string>();
      for (const entry of entries) {
        if (!validIds.has(entry.studentId)) throw new LearningValidationError("A grade entry references a student outside this exam class.");
        if (seen.has(entry.studentId)) throw new LearningValidationError("Each student may appear only once in a grade save request.");
        if (entry.score > row.examSubject.maxScore) {
          throw new LearningValidationError(`Score cannot exceed the maximum score of ${row.examSubject.maxScore}.`);
        }
        seen.add(entry.studentId);
      }

      await db.transaction(async (tx) => {
        // Serialize mark saves against results-ready/publish lifecycle changes.
        const [lockedExam] = await tx.select({ status: exams.status }).from(exams)
          .where(and(eq(exams.schoolId, schoolId), eq(exams.id, row.exam.id)))
          .limit(1).for("update");
        if (lockedExam?.status !== "IN_PROGRESS") {
          throw new LearningConflictError("Mark entry closed because the exam status changed.");
        }
        let changed = 0;
        for (const entry of entries) {
          const [existing] = await tx
            .select()
            .from(gradeRecords)
            .where(
              and(
                eq(gradeRecords.schoolId, schoolId),
                eq(gradeRecords.examSubjectId, examSubjectId),
                eq(gradeRecords.studentId, entry.studentId)
              )
            )
            .limit(1);
          if (existing) {
            if (existing.status === "PUBLISHED") throw new LearningConflictError("Published grade records require administrator correction.");
            if (existing.score === entry.score && (existing.remark ?? null) === (entry.remark ?? null)) continue;
            changed += 1;
            await tx
              .update(gradeRecords)
              .set({
                score: entry.score,
                remark: entry.remark ?? null,
                updatedBy: teacherUserId,
                updatedAt: new Date()
              })
              .where(eq(gradeRecords.id, existing.id));
          } else {
            changed += 1;
            await tx.insert(gradeRecords).values({
              id: randomUUID(),
              schoolId,
              examSubjectId,
              studentId: entry.studentId,
              score: entry.score,
              remark: entry.remark ?? null,
              status: "DRAFT",
              updatedBy: teacherUserId
            });
          }
        }
        if (changed > 0) {
          await tx.insert(auditLogs).values({
            id: randomUUID(), schoolId, actorUserId: teacherUserId,
            action: "grades.draft_saved", entityType: "exam_subject", entityId: examSubjectId,
            metadata: { entryCount: changed, examId: row.exam.id }
          });
        }
      });
      const refreshed = await requireTeacherExamSubject(schoolId, teacherUserId, examSubjectId);
      const refreshedStudents = await classStudents(schoolId, refreshed.examSubject.classId, refreshed.exam.academicYearId);
      const refreshedGrades = await db
        .select()
        .from(gradeRecords)
        .where(and(eq(gradeRecords.schoolId, schoolId), eq(gradeRecords.examSubjectId, examSubjectId)));
      const refreshedByStudent = new Map(refreshedGrades.map((grade) => [grade.studentId, grade]));
      return {
        examSubject: refreshed.examSubject,
        exam: refreshed.exam,
        classSection: { id: refreshed.classSection.id, name: refreshed.classSection.name, code: refreshed.classSection.code },
        subject: { id: refreshed.subject.id, name: refreshed.subject.name, code: refreshed.subject.code },
        students: refreshedStudents.map((student) => ({ student, grade: refreshedByStudent.get(student.id) ?? null })),
        canEdit: refreshed.exam.status === "IN_PROGRESS"
      };
    },

    async getParentAcademicView(schoolId, parentUserId, studentId) {
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
      if (!student) throw new LearningNotFoundError("Student not found for this parent account.");
      return visibleView(schoolId, student);
    },

    async getStudentEnrollmentStatus(schoolId, studentUserId) {
      const [student] = await db
        .select({ id: students.id, status: students.status })
        .from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.userId, studentUserId)))
        .limit(1);
      if (!student || student.status !== "ACTIVE") {
        throw new LearningNotFoundError("No active student record is linked to this student account.");
      }
      return { studentId: student.id, status: student.status };
    },

    async getStudentAcademicView(schoolId, studentUserId) {
      const [student] = await db
        .select()
        .from(students)
        .where(
          and(
            eq(students.schoolId, schoolId),
            eq(students.userId, studentUserId),
            eq(students.status, "ACTIVE")
          )
        )
        .limit(1);
      if (!student) {
        throw new LearningNotFoundError("No active student record is linked to this student account.");
      }
      return visibleView(schoolId, student);
    },

    async getAdminDashboard(schoolId, academicYearId) {
      const [year] = await db.select({ id: academicYears.id }).from(academicYears).where(and(
        eq(academicYears.schoolId, schoolId), eq(academicYears.id, academicYearId)
      )).limit(1);
      if (!year) throw new LearningNotFoundError("Academic year not found.");

      const [schoolExams, rosters, homework, units, assignments] = await Promise.all([
        db.select().from(exams).where(and(eq(exams.schoolId, schoolId),
          eq(exams.academicYearId, academicYearId))),
        db.select({ id: students.id, classId: students.classId }).from(students).where(and(
          eq(students.schoolId, schoolId), eq(students.academicYearId, academicYearId),
          eq(students.status, "ACTIVE"))),
        db.select().from(homeworks).where(and(
          eq(homeworks.schoolId, schoolId), eq(homeworks.academicYearId, academicYearId))),
        db.select().from(curriculumUnits).where(and(
          eq(curriculumUnits.schoolId, schoolId), eq(curriculumUnits.academicYearId, academicYearId))),
        db.select().from(teacherAssignments).where(and(
          eq(teacherAssignments.schoolId, schoolId),
          eq(teacherAssignments.academicYearId, academicYearId)))
      ]);
      const examIds = schoolExams.map(item => item.id);
      const homeworkIds = homework.map(item => item.id);
      const unitIds = units.map(item => item.id);
      const assignmentIds = assignments.map(item => item.id);
      const [subjects, submissions, progress, assessments] = await Promise.all([
        examIds.length ? db.select().from(examSubjects).where(and(
          eq(examSubjects.schoolId, schoolId), inArray(examSubjects.examId, examIds))) : [],
        homeworkIds.length ? db.select().from(homeworkSubmissions).where(and(
          eq(homeworkSubmissions.schoolId, schoolId),
          inArray(homeworkSubmissions.homeworkId, homeworkIds))) : [],
        unitIds.length ? db.select().from(teacherUnitProgress).where(and(
          eq(teacherUnitProgress.schoolId, schoolId),
          inArray(teacherUnitProgress.unitId, unitIds))) : [],
        assignmentIds.length ? db.select({ id: continuousAssessments.id })
          .from(continuousAssessments).where(and(eq(continuousAssessments.schoolId, schoolId),
            inArray(continuousAssessments.assignmentId, assignmentIds))) : []
      ]);
      const subjectIds = subjects.map(item => item.id);
      const grades = subjectIds.length ? await db.select({
        examSubjectId: gradeRecords.examSubjectId, studentId: gradeRecords.studentId
      }).from(gradeRecords).where(and(eq(gradeRecords.schoolId, schoolId),
        inArray(gradeRecords.examSubjectId, subjectIds))) : [];

      const studentsByClass = new Map<string, Set<string>>();
      for (const student of rosters) {
        const ids = studentsByClass.get(student.classId) ?? new Set<string>();
        ids.add(student.id);
        studentsByClass.set(student.classId, ids);
      }
      const recordedBySubject = new Map<string, Set<string>>();
      for (const grade of grades) {
        const ids = recordedBySubject.get(grade.examSubjectId) ?? new Set<string>();
        ids.add(grade.studentId);
        recordedBySubject.set(grade.examSubjectId, ids);
      }
      const missingClasses = new Set<string>();
      const attention: AdminLearningDashboard["attention"] = [];
      for (const exam of schoolExams) {
        if (exam.status === "RESULTS_READY") {
          attention.push({ id: exam.id, category: "RESULTS",
            title: exam.name, detail: "Results ready for publication", count: 1 });
        }
        if (exam.status !== "IN_PROGRESS" && exam.status !== "RESULTS_READY") continue;
        let missing = 0;
        for (const subject of subjects.filter(row => row.examId === exam.id)) {
          const roster = studentsByClass.get(subject.classId) ?? new Set<string>();
          const marked = recordedBySubject.get(subject.id) ?? new Set<string>();
          for (const id of roster) if (!marked.has(id)) {
            missing += 1;
            missingClasses.add(subject.classId);
          }
        }
        if (missing > 0) attention.push({ id: exam.id, category: "EXAMS",
          title: exam.name, detail: "Required examination marks not entered", count: missing });
      }
      const eligibleHomework = new Set(homework.filter(item =>
        item.status === "PUBLISHED" || item.status === "CLOSED").map(item => item.id));
      const pendingReviews = submissions.filter(item =>
        item.status === "SUBMITTED" && eligibleHomework.has(item.homeworkId));
      if (pendingReviews.length) attention.push({
        id: "homework-reviews", category: "HOMEWORK", title: "Homework submissions awaiting review",
        detail: "Teacher review pending", count: pendingReviews.length
      });
      const completedProgress = new Set(progress.filter(item => item.status === "COMPLETED")
        .map(item => `${item.assignmentId}:${item.unitId}`));
      let curriculumAssignedUnits = 0;
      let curriculumCompletedUnits = 0;
      for (const assignment of assignments) {
        for (const unit of units) {
          if (assignment.classId !== unit.classId || assignment.subjectId !== unit.subjectId) continue;
          curriculumAssignedUnits++;
          if (completedProgress.has(`${assignment.id}:${unit.id}`)) curriculumCompletedUnits++;
        }
      }
      attention.sort((a,b) => b.count - a.count || a.title.localeCompare(b.title));
      return {
        academicYearId,
        metrics: {
          activeExams: schoolExams.filter(item =>
            ["SCHEDULED", "IN_PROGRESS", "RESULTS_READY"].includes(item.status)).length,
          examsAwaitingPublication: schoolExams.filter(item => item.status === "RESULTS_READY").length,
          publishedExams: schoolExams.filter(item =>
            item.status === "PUBLISHED" || item.status === "ARCHIVED").length,
          publishedHomework: eligibleHomework.size,
          submissionsAwaitingReview: pendingReviews.length,
          classesWithMissingMarks: missingClasses.size,
          continuousAssessments: assessments.length,
          curriculumCompletedUnits, curriculumAssignedUnits
        },
        attention: attention.slice(0, 8)
      };
    },

    async getAdminExamReadiness(schoolId, examId) {
      const [exam] = await db.select().from(exams).where(and(
        eq(exams.schoolId, schoolId), eq(exams.id, examId)
      )).limit(1);
      if (!exam) throw new LearningNotFoundError("Exam not found.");
      const [year] = await db.select({ status: academicYears.status }).from(academicYears)
        .where(and(eq(academicYears.schoolId, schoolId),
          eq(academicYears.id, exam.academicYearId))).limit(1);
      if (!year) throw new LearningNotFoundError("Academic year not found.");

      const subjectsForExam = await db.select({
        examSubject: examSubjects,
        className: classSections.name,
        subjectName: subjects.name
      }).from(examSubjects)
        .innerJoin(classSections, and(eq(classSections.id, examSubjects.classId),
          eq(classSections.schoolId, examSubjects.schoolId)))
        .innerJoin(subjects, and(eq(subjects.id, examSubjects.subjectId),
          eq(subjects.schoolId, examSubjects.schoolId)))
        .where(and(eq(examSubjects.schoolId, schoolId), eq(examSubjects.examId, examId)))
        .orderBy(asc(classSections.name), asc(subjects.name));

      const classIds = [...new Set(subjectsForExam.map(row => row.examSubject.classId))];
      const subjectIds = subjectsForExam.map(row => row.examSubject.id);
      const [roster, marks] = await Promise.all([
        classIds.length ? db.select({
          id: students.id, classId: students.classId,
          parentUserId: students.parentUserId, userId: students.userId
        }).from(students).where(and(eq(students.schoolId, schoolId),
          eq(students.academicYearId, exam.academicYearId),
          eq(students.status, "ACTIVE"), inArray(students.classId, classIds))) : [],
        subjectIds.length ? db.select({
          examSubjectId: gradeRecords.examSubjectId,
          studentId: gradeRecords.studentId,
          score: gradeRecords.score,
          status: gradeRecords.status
        }).from(gradeRecords).where(and(eq(gradeRecords.schoolId, schoolId),
          inArray(gradeRecords.examSubjectId, subjectIds))) : []
      ]);
      const byClass = new Map<string, typeof roster>();
      const recipients = new Set<string>();
      for (const student of roster) {
        const rows = byClass.get(student.classId) ?? [];
        rows.push(student);
        byClass.set(student.classId, rows);
        recipients.add(student.parentUserId);
        if (student.userId) recipients.add(student.userId);
      }
      const bySubject = new Map<string, Map<string, (typeof marks)[number]>>();
      for (const mark of marks) {
        const rows = bySubject.get(mark.examSubjectId) ?? new Map();
        rows.set(mark.studentId, mark);
        bySubject.set(mark.examSubjectId, rows);
      }
      const requiredStatus = exam.status === "PUBLISHED" || exam.status === "ARCHIVED"
        ? "PUBLISHED" : "DRAFT";
      const perSubject: AdminExamReadiness["subjects"] = subjectsForExam.map(row => {
        const active = byClass.get(row.examSubject.classId) ?? [];
        const recorded = bySubject.get(row.examSubject.id) ?? new Map();
        let valid = 0, missing = 0, invalid = 0;
        for (const student of active) {
          const mark = recorded.get(student.id);
          if (!mark) missing++;
          else if (mark.status !== requiredStatus ||
            mark.score < 0 || mark.score > row.examSubject.maxScore) invalid++;
          else valid++;
        }
        return {
          examSubjectId: row.examSubject.id,
          classId: row.examSubject.classId,
          className: row.className, subjectName: row.subjectName,
          examDate: row.examSubject.examDate, maxScore: row.examSubject.maxScore,
          expected: active.length, valid, missing, invalid
        };
      });
      const configuredSubjects = perSubject.length;
      const scheduledSubjects = perSubject.filter(row => !!row.examDate).length;
      const expectedMarks = perSubject.reduce((total, row) => total + row.expected, 0);
      const validMarks = perSubject.reduce((total, row) => total + row.valid, 0);
      const missingMarks = perSubject.reduce((total, row) => total + row.missing, 0);
      const invalidMarks = perSubject.reduce((total, row) => total + row.invalid, 0);
      const emptyClasses = perSubject.filter(row => row.expected === 0).length;
      const academicYearActive = year.status === "ACTIVE";
      const checks: AdminExamReadiness["checks"] = [
        { code: "ACTIVE_YEAR", passed: academicYearActive, affected: academicYearActive ? 0 : 1 },
        { code: "SUBJECTS_CONFIGURED", passed: configuredSubjects > 0,
          affected: configuredSubjects > 0 ? 0 : 1 },
        { code: "DATES_CONFIGURED", passed: scheduledSubjects === configuredSubjects,
          affected: configuredSubjects - scheduledSubjects },
        { code: "ACTIVE_STUDENTS", passed: configuredSubjects > 0 && emptyClasses === 0,
          affected: emptyClasses },
        { code: "ALL_DRAFT_MARKS", passed: configuredSubjects > 0 &&
          missingMarks === 0 && invalidMarks === 0 && expectedMarks > 0,
          affected: missingMarks + invalidMarks },
        { code: "STATUS_READY_FOR_PUBLISH", passed: exam.status === "RESULTS_READY",
          affected: exam.status === "RESULTS_READY" ? 0 : 1 }
      ];
      const checkPassed = (code: AdminExamReadiness["checks"][number]["code"]) =>
        checks.find(item => item.code === code)?.passed ?? false;
      return {
        examId, examStatus: exam.status, academicYearActive,
        totals: { configuredSubjects, scheduledSubjects, participatingClasses: classIds.length,
          expectedMarks, validMarks, missingMarks, invalidMarks, recipients: recipients.size },
        subjects: perSubject, checks,
        canSchedule: exam.status === "DRAFT" && academicYearActive &&
          checkPassed("SUBJECTS_CONFIGURED") && checkPassed("DATES_CONFIGURED"),
        canMarkResultsReady: exam.status === "IN_PROGRESS" && academicYearActive &&
          checkPassed("SUBJECTS_CONFIGURED") && checkPassed("ACTIVE_STUDENTS") &&
          checkPassed("ALL_DRAFT_MARKS"),
        canPublish: exam.status === "RESULTS_READY" && academicYearActive &&
          checkPassed("SUBJECTS_CONFIGURED") && checkPassed("ACTIVE_STUDENTS") &&
          checkPassed("ALL_DRAFT_MARKS")
      };
    },

    async getAdminExamDetail(schoolId, examId) {
      const [exam] = await db.select().from(exams)
        .where(and(eq(exams.schoolId, schoolId), eq(exams.id, examId))).limit(1);
      if (!exam) throw new LearningNotFoundError("Exam not found.");

      const configured = await db.select({
        examSubject: examSubjects,
        className: classSections.name,
        classCode: classSections.code,
        subjectName: subjects.name
      }).from(examSubjects)
        .innerJoin(classSections, and(eq(classSections.id, examSubjects.classId),
          eq(classSections.schoolId, examSubjects.schoolId)))
        .innerJoin(subjects, and(eq(subjects.id, examSubjects.subjectId),
          eq(subjects.schoolId, examSubjects.schoolId)))
        .where(and(eq(examSubjects.schoolId, schoolId), eq(examSubjects.examId, examId)))
        .orderBy(asc(examSubjects.examDate), asc(classSections.name), asc(subjects.name));
      // Dates are calendar days only. More than one subject on the same day
      // for the same class is an advisory, NOT a proven time/room conflict.
      const byDayClass = new Map<string, typeof configured>();
      for (const row of configured) {
        const date = row.examSubject.examDate;
        if (!date) continue;
        const key = row.examSubject.classId + ":" + date;
        const group = byDayClass.get(key) ?? [];
        group.push(row);
        byDayClass.set(key, group);
      }
      const sameDayWarnings: AdminExamDetail["sameDayWarnings"] = [];
      for (const group of byDayClass.values()) {
        if (group.length < 2) continue;
        const first = group[0]!;
        sameDayWarnings.push({
          classId: first.examSubject.classId,
          className: first.className,
          examDate: first.examSubject.examDate!,
          subjectNames: group.map(item => item.subjectName)
        });
      }
      return { exam, subjects: configured, sameDayWarnings };
    },

    async listAdminHomework(schoolId, query) {
      // Counts are based on students *currently actively enrolled* in the
      // homework's year/class. Historical enrollment is not reconstructed.
      // The correlated subqueries are bounded by the filtered, paged list.
      const roster = sql<number>`(select count(*)::int from students hw_student
        where hw_student.school_id = ${homeworks.schoolId}
          and hw_student.academic_year_id = ${homeworks.academicYearId}
          and hw_student.class_id = ${homeworks.classId}
          and hw_student.status = 'ACTIVE')`;
      const submitted = sql<number>`(select count(*)::int from homework_submissions hw_sub
        join students hw_student on hw_student.id = hw_sub.student_id
          and hw_student.school_id = hw_sub.school_id
          and hw_student.academic_year_id = ${homeworks.academicYearId}
          and hw_student.class_id = ${homeworks.classId}
          and hw_student.status = 'ACTIVE'
        where hw_sub.school_id = ${homeworks.schoolId}
          and hw_sub.homework_id = ${homeworks.id})`;
      function byStatus(status: "SUBMITTED" | "REVIEWED" | "REVISION_REQUESTED") {
        return sql<number>`(select count(*)::int from homework_submissions hw_sub
          join students hw_student on hw_student.id = hw_sub.student_id
            and hw_student.school_id = hw_sub.school_id
            and hw_student.academic_year_id = ${homeworks.academicYearId}
            and hw_student.class_id = ${homeworks.classId}
            and hw_student.status = 'ACTIVE'
          where hw_sub.school_id = ${homeworks.schoolId}
            and hw_sub.homework_id = ${homeworks.id}
            and hw_sub.status = ${status})`;
      }
      const pending = byStatus("SUBMITTED");
      const reviewed = byStatus("REVIEWED");
      const revisions = byStatus("REVISION_REQUESTED");
      const visible = inArray(homeworks.status, ["PUBLISHED", "CLOSED", "ARCHIVED"]);
      const conditions = [
        eq(homeworks.schoolId, schoolId),
        eq(homeworks.academicYearId, query.academicYearId)
      ];
      if (query.status) conditions.push(eq(homeworks.status, query.status));
      if (query.classId) conditions.push(eq(homeworks.classId, query.classId));
      if (query.subjectId) conditions.push(eq(homeworks.subjectId, query.subjectId));
      if (query.teacherUserId) conditions.push(eq(homeworks.teacherUserId, query.teacherUserId));
      if (query.search) {
        const searchTerm = "%" + query.search.trim().replace(/[\\%_]/g, match => "\\" + match) + "%";
        conditions.push(ilike(homeworks.title, searchTerm));
      }
      if (query.attention === "PAST_DUE") conditions.push(and(
        eq(homeworks.status, "PUBLISHED"), lt(homeworks.dueAt, new Date()), gt(roster, submitted))!);
      if (query.attention === "AWAITING_REVIEW") conditions.push(and(visible, gt(pending, 0))!);
      if (query.attention === "MISSING") conditions.push(and(visible, gt(roster, submitted))!);
      if (query.attention === "REVISION_REQUESTED") conditions.push(and(visible, gt(revisions, 0))!);
      const where = and(...conditions);
      const [totals, rows] = await Promise.all([
        db.select({ total: count() }).from(homeworks).where(where),
        db.select({
          homework: {
            id: homeworks.id, title: homeworks.title, status: homeworks.status,
            dueAt: homeworks.dueAt, scheduledAt: homeworks.scheduledAt,
            publishedAt: homeworks.publishedAt, createdAt: homeworks.createdAt,
            updatedAt: homeworks.updatedAt
          },
          classId: homeworks.classId, className: classSections.name,
          subjectId: homeworks.subjectId, subjectName: subjects.name,
          teacherUserId: homeworks.teacherUserId, teacherName: teacherProfiles.fullName,
          expected: roster, submitted, awaitingReview: pending, reviewed,
          revisionRequested: revisions
        }).from(homeworks)
          .innerJoin(classSections, and(eq(classSections.id, homeworks.classId),
            eq(classSections.schoolId, homeworks.schoolId)))
          .innerJoin(subjects, and(eq(subjects.id, homeworks.subjectId),
            eq(subjects.schoolId, homeworks.schoolId)))
          .innerJoin(teacherProfiles, and(eq(teacherProfiles.userId, homeworks.teacherUserId),
            eq(teacherProfiles.schoolId, homeworks.schoolId)))
          .where(where).orderBy(desc(homeworks.createdAt), asc(homeworks.id))
          .limit(query.limit).offset(query.offset)
      ]);
      return {
        rows: rows.map(row => {
          const assigned = row.homework.status !== "DRAFT";
          const expected = assigned ? Number(row.expected) : 0;
          const submittedCount = assigned ? Number(row.submitted) : 0;
          return {
            ...row, expected, submitted: submittedCount,
            awaitingReview: assigned ? Number(row.awaitingReview) : 0,
            reviewed: assigned ? Number(row.reviewed) : 0,
            revisionRequested: assigned ? Number(row.revisionRequested) : 0,
            missing: Math.max(0, expected - submittedCount),
            pastDueWithMissing: row.homework.status === "PUBLISHED"
              && row.homework.dueAt < new Date() && expected > submittedCount
          };
        }), total: totals[0]?.total ?? 0, limit: query.limit, offset: query.offset
      };
    },

    async getAdminHomeworkRoster(schoolId, homeworkId, filter, limit, offset) {
      const [homework] = await db.select({
        id: homeworks.id, title: homeworks.title, status: homeworks.status,
        classId: homeworks.classId, academicYearId: homeworks.academicYearId
      }).from(homeworks).where(and(eq(homeworks.schoolId, schoolId),
        eq(homeworks.id, homeworkId))).limit(1);
      if (!homework) throw new LearningNotFoundError("Homework not found.");
      // Draft homework never generated a legitimate recipient roster.
      if (homework.status === "DRAFT") {
        return { homework: { id: homework.id, title: homework.title, status: homework.status },
          students: [], total: 0, limit, offset, rosterBasis: "CURRENT_ACTIVE_ENROLLMENT" as const };
      }
      const conditions = [
        eq(students.schoolId, schoolId), eq(students.academicYearId, homework.academicYearId),
        eq(students.classId, homework.classId), eq(students.status, "ACTIVE")
      ];
      if (filter === "MISSING") conditions.push(isNull(homeworkSubmissions.id));
      if (filter !== "ALL" && filter !== "MISSING") conditions.push(eq(homeworkSubmissions.status, filter));
      const where = and(...conditions);
      const [totals, rows] = await Promise.all([
        db.select({ total: count() }).from(students)
          .leftJoin(homeworkSubmissions, and(eq(homeworkSubmissions.studentId, students.id),
            eq(homeworkSubmissions.schoolId, schoolId),
            eq(homeworkSubmissions.homeworkId, homeworkId))).where(where),
        db.select({
          id: students.id, fullName: students.fullName, studentCode: students.studentCode,
          submissionId: homeworkSubmissions.id, submissionStatus: homeworkSubmissions.status,
          submittedAt: homeworkSubmissions.submittedAt, reviewedAt: homeworkSubmissions.reviewedAt,
          feedback: homeworkSubmissions.feedback
        }).from(students)
          .leftJoin(homeworkSubmissions, and(eq(homeworkSubmissions.studentId, students.id),
            eq(homeworkSubmissions.schoolId, schoolId),
            eq(homeworkSubmissions.homeworkId, homeworkId)))
          .where(where).orderBy(asc(students.fullName), asc(students.id))
          .limit(limit).offset(offset)
      ]);
      return {
        homework: { id: homework.id, title: homework.title, status: homework.status },
        students: rows.map(row => ({
          student: { id: row.id, fullName: row.fullName, studentCode: row.studentCode },
          submission: row.submissionId && row.submissionStatus && row.submittedAt
            ? { id: row.submissionId, status: row.submissionStatus,
                submittedAt: row.submittedAt, reviewedAt: row.reviewedAt, feedback: row.feedback }
            : null
        })), total: totals[0]?.total ?? 0, limit, offset,
        rosterBasis: "CURRENT_ACTIVE_ENROLLMENT" as const
      };
    },

    async listAdminPublishedGrades(schoolId, query) {
      // Apply every filter in SQL before pagination and always enforce school
      // scope and publication status on the grade and its joined entities.
      const conditions = [
        eq(gradeRecords.schoolId, schoolId),
        eq(gradeRecords.status, "PUBLISHED"),
        eq(exams.academicYearId, query.academicYearId)
      ];
      if (query.examId) conditions.push(eq(exams.id, query.examId));
      if (query.classId) conditions.push(eq(examSubjects.classId, query.classId));
      if (query.subjectId) conditions.push(eq(examSubjects.subjectId, query.subjectId));
      if (query.search) {
        const term = "%" + query.search.trim().replace(/[\\%_]/g, "\\$&") + "%";
        const matching = or(ilike(students.fullName, term),
          ilike(students.studentCode, term), ilike(exams.name, term));
        if (matching) conditions.push(matching);
      }
      const where = and(...conditions);
      const [totals, found] = await Promise.all([
        db.select({ value: count() }).from(gradeRecords)
          .innerJoin(examSubjects, and(eq(examSubjects.id, gradeRecords.examSubjectId),
            eq(examSubjects.schoolId, gradeRecords.schoolId)))
          .innerJoin(exams, and(eq(exams.id, examSubjects.examId),
            eq(exams.schoolId, gradeRecords.schoolId)))
          .innerJoin(students, and(eq(students.id, gradeRecords.studentId),
            eq(students.schoolId, gradeRecords.schoolId)))
          .where(where),
        db.select({
          grade: gradeRecords,
          academicYearId: exams.academicYearId,
          examId: exams.id,
          examName: exams.name,
          examStatus: exams.status,
          classId: classSections.id,
          className: classSections.name,
          subjectId: subjects.id,
          subjectName: subjects.name,
          studentName: students.fullName,
          studentCode: students.studentCode,
          maxScore: examSubjects.maxScore,
          yearStatus: academicYears.status
        }).from(gradeRecords)
          .innerJoin(examSubjects, and(eq(examSubjects.id, gradeRecords.examSubjectId),
            eq(examSubjects.schoolId, gradeRecords.schoolId)))
          .innerJoin(exams, and(eq(exams.id, examSubjects.examId),
            eq(exams.schoolId, gradeRecords.schoolId)))
          .innerJoin(academicYears, and(eq(academicYears.id, exams.academicYearId),
            eq(academicYears.schoolId, gradeRecords.schoolId)))
          .innerJoin(subjects, and(eq(subjects.id, examSubjects.subjectId),
            eq(subjects.schoolId, gradeRecords.schoolId)))
          .innerJoin(classSections, and(eq(classSections.id, examSubjects.classId),
            eq(classSections.schoolId, gradeRecords.schoolId)))
          .innerJoin(students, and(eq(students.id, gradeRecords.studentId),
            eq(students.schoolId, gradeRecords.schoolId)))
          .where(where)
          .orderBy(desc(exams.publishedAt), asc(students.fullName), asc(gradeRecords.id))
          .limit(query.limit).offset(query.offset)
      ]);
      // Source is intentionally duplicated above: aggregates and projected
      // rows use identical tenant/filter joins and cannot leak draft marks.
      return { rows: found.map(({ yearStatus, ...row }) => ({
        ...row, canCorrect: row.examStatus === "PUBLISHED" && yearStatus === "ACTIVE"
      })), total: totals[0]?.value ?? 0, limit: query.limit, offset: query.offset };
    },

    async getAdminGradeCorrections(schoolId, gradeId, limit, offset) {
      const [grade] = await db.select({ id: gradeRecords.id }).from(gradeRecords)
        .where(and(eq(gradeRecords.schoolId, schoolId), eq(gradeRecords.id, gradeId),
          eq(gradeRecords.status, "PUBLISHED"))).limit(1);
      if (!grade) throw new LearningNotFoundError("Published grade not found.");
      const conditions = and(eq(auditLogs.schoolId, schoolId),
        eq(auditLogs.action, "grade.corrected"), eq(auditLogs.entityType, "grade_record"),
        eq(auditLogs.entityId, gradeId));
      const [totals, entries] = await Promise.all([
        db.select({ value: count() }).from(auditLogs).where(conditions),
        db.select({ id: auditLogs.id, createdAt: auditLogs.createdAt,
          actorUsername: users.username, metadata: auditLogs.metadata })
          .from(auditLogs).leftJoin(users, and(eq(users.id, auditLogs.actorUserId),
            eq(users.schoolId, auditLogs.schoolId)))
          .where(conditions).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
          .limit(limit).offset(offset)
      ]);
      const events = entries.map(({ metadata, ...entry }) => ({
        ...entry,
        previousScore: typeof metadata.previousScore === "number" ? metadata.previousScore : null,
        score: typeof metadata.score === "number" ? metadata.score : null,
        previousRemark: typeof metadata.previousRemark === "string" ? metadata.previousRemark : null,
        remark: typeof metadata.remark === "string" ? metadata.remark : null,
        reason: typeof metadata.reason === "string" ? metadata.reason : ""
      }));
      return { events, total: totals[0]?.value ?? 0, limit, offset };
    },

    async getAdminOverview(schoolId, includePublishedGrades = true) {
      const [schoolExams, subjectRows, publishedGrades] = await Promise.all([
        db.select().from(exams).where(eq(exams.schoolId, schoolId)).orderBy(desc(exams.createdAt)),
        db
          .select({
            examSubject: examSubjects,
            className: classSections.name,
            classCode: classSections.code,
            subjectName: subjects.name
          })
          .from(examSubjects)
          .innerJoin(classSections, and(eq(classSections.id, examSubjects.classId), eq(classSections.schoolId, examSubjects.schoolId)))
          .innerJoin(subjects, and(eq(subjects.id, examSubjects.subjectId), eq(subjects.schoolId, examSubjects.schoolId)))
          .where(eq(examSubjects.schoolId, schoolId))
          .orderBy(asc(classSections.name), asc(subjects.name)),
        includePublishedGrades ? db
          .select({
            grade: gradeRecords,
            academicYearId: exams.academicYearId,
            examName: exams.name,
            subjectName: subjects.name,
            className: classSections.name,
            studentName: students.fullName,
            studentCode: students.studentCode,
            maxScore: examSubjects.maxScore
          })
          .from(gradeRecords)
          .innerJoin(examSubjects, and(eq(examSubjects.id, gradeRecords.examSubjectId), eq(examSubjects.schoolId, gradeRecords.schoolId)))
          .innerJoin(exams, and(eq(exams.id, examSubjects.examId), eq(exams.schoolId, gradeRecords.schoolId)))
          .innerJoin(subjects, and(eq(subjects.id, examSubjects.subjectId), eq(subjects.schoolId, gradeRecords.schoolId)))
          .innerJoin(classSections, and(eq(classSections.id, examSubjects.classId), eq(classSections.schoolId, gradeRecords.schoolId)))
          .innerJoin(students, and(eq(students.id, gradeRecords.studentId), eq(students.schoolId, gradeRecords.schoolId)))
          .where(and(eq(gradeRecords.schoolId, schoolId), eq(gradeRecords.status, "PUBLISHED")))
          .orderBy(desc(exams.publishedAt), asc(classSections.name), asc(subjects.name), asc(students.fullName)) : Promise.resolve([])
      ]);
      return { exams: schoolExams, examSubjects: subjectRows, publishedGrades };
    },

    async createExam(schoolId, actorUserId, input) {
      const [year] = await db
        .select()
        .from(academicYears)
        .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, input.academicYearId)))
        .limit(1);
      if (!year) throw new LearningNotFoundError("Academic year not found.");
      if (year.status !== "ACTIVE") throw new LearningConflictError("New exams require the active academic year.");
      try {
        return await db.transaction(async (tx) => {
          const [exam] = await tx.insert(exams)
            .values({ id: randomUUID(), schoolId, ...input, status: "DRAFT" }).returning();
          if (!exam) throw new Error("Exam insert did not return a row.");
          await tx.insert(auditLogs).values({
            id: randomUUID(), schoolId, actorUserId,
            action: "exam.created", entityType: "exam", entityId: exam.id,
            metadata: { name: exam.name, type: exam.type, academicYearId: exam.academicYearId }
          });
          return exam;
        });
      } catch (error) {
        if (isUniqueError(error)) throw new LearningConflictError("An exam with that name already exists in this academic year.");
        throw error;
      }
    },

    async createExamSubject(schoolId, actorUserId, input) {
      const exam = await getExam(schoolId, input.examId);
      if (exam.status !== "DRAFT" && exam.status !== "SCHEDULED") {
        throw new LearningConflictError("Exam subjects can be configured only before the exam starts.");
      }
      const [year] = await db.select().from(academicYears).where(and(
        eq(academicYears.schoolId, schoolId), eq(academicYears.id, exam.academicYearId)
      )).limit(1);
      if (!year || year.status !== "ACTIVE") {
        throw new LearningConflictError("Exam setup requires the active academic year.");
      }
      if (input.examDate < year.startDate || input.examDate > year.endDate) {
        throw new LearningValidationError("Exam date must fall within the selected academic year.");
      }
      const [classSection, subject] = await Promise.all([
        db.select().from(classSections).where(and(eq(classSections.schoolId, schoolId), eq(classSections.id, input.classId))).limit(1),
        db.select().from(subjects).where(and(eq(subjects.schoolId, schoolId), eq(subjects.id, input.subjectId))).limit(1)
      ]);
      if (!classSection[0]) throw new LearningNotFoundError("Class not found.");
      if (!subject[0]) throw new LearningNotFoundError("Subject not found.");
      if (classSection[0].academicYearId !== exam.academicYearId) {
        throw new LearningValidationError("Exam class must belong to the exam academic year.");
      }
      const [assignment] = await db
        .select({ id: teacherAssignments.id })
        .from(teacherAssignments)
        .where(
          and(
            eq(teacherAssignments.schoolId, schoolId),
            eq(teacherAssignments.academicYearId, exam.academicYearId),
            eq(teacherAssignments.classId, input.classId),
            eq(teacherAssignments.subjectId, input.subjectId)
          )
        )
        .limit(1);
      if (!assignment) {
        throw new LearningValidationError("Exam subject requires an existing teacher assignment for the selected class and subject.");
      }
      try {
        return await db.transaction(async (tx) => {
          // Do not add a new exam subject after another administrator has
          // started the exam while this form was open.
          const [locked] = await tx.select({ status: exams.status }).from(exams)
            .where(and(eq(exams.schoolId, schoolId), eq(exams.id, exam.id)))
            .limit(1).for("update");
          if (!locked || !["DRAFT", "SCHEDULED"].includes(locked.status)) {
            throw new LearningConflictError("Exam is no longer accepting subject setup.");
          }
          const [created] = await tx.insert(examSubjects)
            .values({ id: randomUUID(), schoolId, ...input }).returning();
          if (!created) throw new Error("Exam subject insert did not return a row.");
          await tx.insert(auditLogs).values({
            id: randomUUID(), schoolId, actorUserId,
            action: "exam.subject_added", entityType: "exam_subject", entityId: created.id,
            metadata: { examId: created.examId, classId: created.classId,
              subjectId: created.subjectId, maxScore: created.maxScore, examDate: created.examDate }
          });
          return created;
        });
      } catch (error) {
        if (isUniqueError(error)) throw new LearningConflictError("This subject is already configured for that exam and class.");
        throw error;
      }
    },

    async updateExamSubjectDate(schoolId, actorUserId, examSubjectId, examDate) {
      const [row] = await db.select({
        subject: examSubjects, exam: exams, year: academicYears
      }).from(examSubjects)
        .innerJoin(exams, and(eq(exams.schoolId, examSubjects.schoolId),
          eq(exams.id, examSubjects.examId)))
        .innerJoin(academicYears, and(eq(academicYears.schoolId, exams.schoolId),
          eq(academicYears.id, exams.academicYearId)))
        .where(and(eq(examSubjects.schoolId, schoolId),
          eq(examSubjects.id, examSubjectId))).limit(1);
      if (!row) throw new LearningNotFoundError("Exam subject not found.");
      if (row.year.status !== "ACTIVE") {
        throw new LearningConflictError("Exam date changes require the active academic year.");
      }
      if (examDate < row.year.startDate || examDate > row.year.endDate) {
        throw new LearningValidationError("Exam date must fall within the selected academic year.");
      }
      return db.transaction(async (tx) => {
        const [exam] = await tx.select({ status: exams.status }).from(exams).where(and(
          eq(exams.schoolId, schoolId), eq(exams.id, row.exam.id)
        )).limit(1).for("update");
        if (!exam || !["DRAFT", "SCHEDULED"].includes(exam.status)) {
          throw new LearningConflictError("An exam date cannot be edited after the exam starts.");
        }
        if (row.subject.examDate === examDate) return row.subject;
        const [updated] = await tx.update(examSubjects).set({ examDate })
          .where(and(eq(examSubjects.schoolId, schoolId),
            eq(examSubjects.id, examSubjectId))).returning();
        if (!updated) throw new LearningNotFoundError("Exam subject not found.");
        await tx.insert(auditLogs).values({
          id: randomUUID(), schoolId, actorUserId,
          action: "exam.subject_date_changed", entityType: "exam_subject",
          entityId: updated.id,
          metadata: { examId: updated.examId, previousDate: row.subject.examDate,
            examDate: updated.examDate }
        });
        return updated;
      });
    },

    async setExamStatus(schoolId, actorUserId, examId, status) {
      if (status === "PUBLISHED") {
        throw new LearningValidationError("Use the publish-results action to publish an exam.");
      }
      return db.transaction(async (tx) => {
        const [exam] = await tx.select().from(exams).where(and(
          eq(exams.schoolId, schoolId), eq(exams.id, examId)
        )).limit(1).for("update");
        if (!exam) throw new LearningNotFoundError("Exam not found.");
        const allowed: Record<ExamStatus, ExamStatus[]> = {
          DRAFT: ["SCHEDULED"],
          SCHEDULED: ["IN_PROGRESS"],
          IN_PROGRESS: ["RESULTS_READY"],
          RESULTS_READY: [],
          PUBLISHED: ["ARCHIVED"],
          ARCHIVED: []
        };
        if (!allowed[exam.status].includes(status)) {
          throw new LearningConflictError(`Exam cannot move from ${exam.status} to ${status}.`);
        }
        if (status === "SCHEDULED" || status === "RESULTS_READY") {
          const configured = await tx.select().from(examSubjects).where(and(
            eq(examSubjects.schoolId, schoolId), eq(examSubjects.examId, examId)
          ));
          if (configured.length === 0) {
            throw new LearningConflictError("Configure at least one exam subject before advancing.");
          }
          if (status === "SCHEDULED" && configured.some(item => !item.examDate)) {
            throw new LearningConflictError("Every subject needs an exam date before scheduling.");
          }
          if (status === "RESULTS_READY") {
            for (const subject of configured) {
              const roster = await tx.select({ id: students.id }).from(students).where(and(
                eq(students.schoolId, schoolId), eq(students.classId, subject.classId),
                eq(students.academicYearId, exam.academicYearId), eq(students.status, "ACTIVE")
              ));
              if (!roster.length) {
                throw new LearningConflictError("Every exam class needs an active student before results are ready.");
              }
              const marks = await tx.select().from(gradeRecords).where(and(
                eq(gradeRecords.schoolId, schoolId),
                eq(gradeRecords.examSubjectId, subject.id)
              ));
              const marksByStudent = new Map(marks.map(mark => [mark.studentId, mark]));
              if (roster.some(student => {
                const grade = marksByStudent.get(student.id);
                return !grade || grade.status !== "DRAFT" ||
                  grade.score < 0 || grade.score > subject.maxScore;
              })) {
                throw new LearningConflictError("Complete valid draft marks for every active student before results are ready.");
              }
            }
          }
        }
        const [updated] = await tx.update(exams).set({ status, updatedAt: new Date() })
          .where(and(eq(exams.schoolId, schoolId), eq(exams.id, examId),
            eq(exams.status, exam.status))).returning();
        if (!updated) throw new LearningConflictError("Exam status changed. Refresh and retry.");
        await tx.insert(auditLogs).values({
          id: randomUUID(), schoolId, actorUserId,
          action: "exam.status_changed", entityType: "exam", entityId: examId,
          metadata: { previousStatus: exam.status, status }
        });
        return updated;
      });
    },

    async publishExam(schoolId, actorUserId, examId) {
      const publishedAt = new Date();
      return db.transaction(async (tx) => {
        const [exam] = await tx.select().from(exams).where(and(
          eq(exams.schoolId, schoolId), eq(exams.id, examId)
        )).limit(1).for("update");
        if (!exam) throw new LearningNotFoundError("Exam not found.");
        if (exam.status !== "RESULTS_READY") {
          throw new LearningConflictError("Exam results can be published only from RESULTS_READY.");
        }
        const configured = await tx.select().from(examSubjects).where(and(
          eq(examSubjects.schoolId, schoolId), eq(examSubjects.examId, examId)
        ));
        if (!configured.length) throw new LearningConflictError("Exam has no subjects to publish.");

        const recipientIds = new Set<string>();
        for (const subject of configured) {
          const roster = await tx.select({
            id: students.id, parentUserId: students.parentUserId,
            userId: students.userId
          }).from(students).where(and(
            eq(students.schoolId, schoolId), eq(students.classId, subject.classId),
            eq(students.academicYearId, exam.academicYearId), eq(students.status, "ACTIVE")
          ));
          if (!roster.length) {
            throw new LearningConflictError("Cannot publish results for a class without active students.");
          }
          const grades = await tx.select().from(gradeRecords).where(and(
            eq(gradeRecords.schoolId, schoolId), eq(gradeRecords.examSubjectId, subject.id)
          ));
          const marks = new Map(grades.map(grade => [grade.studentId, grade]));
          if (roster.some(student => {
            const grade = marks.get(student.id);
            return !grade || grade.status !== "DRAFT" ||
              grade.score < 0 || grade.score > subject.maxScore;
          })) {
            throw new LearningConflictError("Result marks changed after readiness. Recheck the roster before publishing.");
          }
          for (const student of roster) {
            recipientIds.add(student.parentUserId);
            if (student.userId) recipientIds.add(student.userId);
          }
        }
        await tx.update(gradeRecords)
          .set({ status: "PUBLISHED", publishedAt, updatedAt: publishedAt })
          .where(and(eq(gradeRecords.schoolId, schoolId),
            inArray(gradeRecords.examSubjectId, configured.map(subject => subject.id)),
            eq(gradeRecords.status, "DRAFT")));
        const [published] = await tx.update(exams)
          .set({ status: "PUBLISHED", publishedAt, updatedAt: publishedAt })
          .where(and(eq(exams.schoolId, schoolId), eq(exams.id, examId),
            eq(exams.status, "RESULTS_READY"))).returning();
        if (!published) throw new LearningConflictError("Exam changed. Refresh and retry.");

        let notificationCount = 0;
        for (const userId of recipientIds) {
          const rows = await tx.insert(notifications).values({
            id: randomUUID(), schoolId, userId,
            dedupKey: `results:${examId}:${userId}`,
            type: "RESULTS_PUBLISHED", title: "Results published",
            message: published.name, deepLink: `/results/${examId}`,
            metadata: { examId, academicYearId: published.academicYearId },
            deliveryStatus: "PENDING"
          }).onConflictDoNothing().returning({ id: notifications.id });
          notificationCount += rows.length;
        }
        await tx.insert(auditLogs).values({
          id: randomUUID(), schoolId, actorUserId,
          action: "exam.results_published", entityType: "exam", entityId: examId,
          metadata: { notificationCount, academicYearId: published.academicYearId }
        });
        return { exam: published, notificationCount };
      });
    },

    async correctPublishedGrade(schoolId, actorUserId, gradeId, input) {
      return db.transaction(async (tx) => {
        // Lock the grade so audit.previousScore reflects exactly the value
        // being replaced, even when two administrators correct concurrently.
        const [previous] = await tx.select().from(gradeRecords).where(and(
          eq(gradeRecords.schoolId, schoolId), eq(gradeRecords.id, gradeId)
        )).limit(1).for("update");
        if (!previous) throw new LearningNotFoundError("Grade record not found.");
        const [context] = await tx.select({
          examSubject: examSubjects, exam: exams
        }).from(examSubjects)
          .innerJoin(exams, and(eq(exams.id, examSubjects.examId),
            eq(exams.schoolId, examSubjects.schoolId)))
          .where(and(eq(examSubjects.schoolId, schoolId),
            eq(examSubjects.id, previous.examSubjectId))).limit(1);
        if (!context || context.exam.status !== "PUBLISHED" || previous.status !== "PUBLISHED") {
          throw new LearningConflictError("Only published grades use the administrator correction workflow.");
        }
        const [year] = await tx.select({ status: academicYears.status }).from(academicYears)
          .where(and(eq(academicYears.schoolId, schoolId),
            eq(academicYears.id, context.exam.academicYearId))).limit(1);
        if (year?.status !== "ACTIVE") {
          throw new LearningConflictError("Historical academic year results are read-only.");
        }
        if (input.score > context.examSubject.maxScore) {
          throw new LearningValidationError(`Score cannot exceed the maximum score of ${context.examSubject.maxScore}.`);
        }
        if (input.expectedUpdatedAt &&
            previous.updatedAt.toISOString() !== input.expectedUpdatedAt) {
          throw new LearningConflictError("This grade changed since you opened it. Reload before correcting.");
        }
        const remark = input.remark ?? null;
        if (previous.score === input.score && (previous.remark ?? null) === remark) {
          throw new LearningValidationError("A correction must change the score or remark.");
        }
        const [grade] = await tx.update(gradeRecords).set({
          score: input.score, remark, updatedBy: actorUserId,
          updatedAt: new Date(Math.max(Date.now(), previous.updatedAt.getTime() + 1))
        }).where(and(eq(gradeRecords.schoolId, schoolId), eq(gradeRecords.id, gradeId),
          eq(gradeRecords.status, "PUBLISHED"))).returning();
        if (!grade) throw new LearningConflictError("Grade was changed. Reload and retry.");
        await tx.insert(auditLogs).values({
          id: randomUUID(), schoolId, actorUserId,
          action: "grade.corrected", entityType: "grade_record", entityId: gradeId,
          metadata: { previousScore: previous.score, score: grade.score,
            previousRemark: previous.remark, remark: grade.remark,
            reason: input.reason, examId: context.exam.id,
            examSubjectId: previous.examSubjectId, studentId: previous.studentId }
        });
        return { grade, previousScore: previous.score, previousRemark: previous.remark };
      });
    }
  };
}
