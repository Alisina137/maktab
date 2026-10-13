import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
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
  getAdminOverview(schoolId: string): Promise<AdminLearningOverview>;
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

    async getAdminOverview(schoolId) {
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
        db
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
          .orderBy(desc(exams.publishedAt), asc(classSections.name), asc(subjects.name), asc(students.fullName))
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
