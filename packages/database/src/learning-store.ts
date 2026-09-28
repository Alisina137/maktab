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
import {
  academicYears,
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
}

export interface LearningStore {
  getTeacherLearning(schoolId: string, teacherUserId: string): Promise<TeacherLearningView>;
  createHomework(schoolId: string, teacherUserId: string, input: CreateHomeworkInput): Promise<Homework>;
  updateHomework(schoolId: string, teacherUserId: string, homeworkId: string, input: UpdateHomeworkInput): Promise<Homework>;
  setHomeworkStatus(schoolId: string, teacherUserId: string, homeworkId: string, status: HomeworkStatus): Promise<Homework>;
  getGradeSheet(schoolId: string, teacherUserId: string, examSubjectId: string): Promise<GradeSheet>;
  saveDraftGrades(schoolId: string, teacherUserId: string, examSubjectId: string, entries: GradeEntryInput[]): Promise<GradeSheet>;
  getParentAcademicView(schoolId: string, parentUserId: string, studentId: string): Promise<LearnerAcademicView>;
  getStudentAcademicView(schoolId: string, studentUserId: string): Promise<LearnerAcademicView>;
  getAdminOverview(schoolId: string): Promise<AdminLearningOverview>;
  createExam(schoolId: string, input: CreateExamInput): Promise<Exam>;
  createExamSubject(schoolId: string, input: CreateExamSubjectInput): Promise<ExamSubject>;
  setExamStatus(schoolId: string, examId: string, status: ExamStatus): Promise<Exam>;
  publishExam(schoolId: string, examId: string): Promise<{ exam: Exam; notificationCount: number }>;
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
  const message = error instanceof Error ? error.message : String(error);
  return /unique|duplicate/i.test(message);
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
          eq(exams.status, "PUBLISHED")
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
              inArray(exams.status, ["IN_PROGRESS", "RESULTS_READY"])
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

      const [updated] = await db
        .update(homeworks)
        .set({
          title: input.title ?? current.title,
          content: input.content ?? current.content,
          dueAt: input.dueAt ? new Date(input.dueAt) : current.dueAt,
          attachmentUrl: input.attachmentUrl === undefined ? current.attachmentUrl : input.attachmentUrl,
          updatedAt: new Date()
        })
        .where(and(eq(homeworks.schoolId, schoolId), eq(homeworks.id, homeworkId)))
        .returning();
      if (!updated) throw new LearningNotFoundError("Homework not found.");
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
      const [updated] = await db
        .update(homeworks)
        .set({
          status,
          publishedAt: status === "PUBLISHED" ? now : current.publishedAt,
          updatedAt: now
        })
        .where(and(eq(homeworks.schoolId, schoolId), eq(homeworks.id, homeworkId)))
        .returning();
      if (!updated) throw new LearningNotFoundError("Homework not found.");

      if (status === "PUBLISHED") {
        const recipients = await recipientUserIds(schoolId, updated.classId);
        for (const userId of recipients) {
          await createNotification(
            schoolId,
            userId,
            `homework:${updated.id}:${userId}`,
            "HOMEWORK_PUBLISHED",
            "New homework",
            updated.title,
            `/homework/${updated.id}`,
            { homeworkId: updated.id, classId: updated.classId, subjectId: updated.subjectId, dueAt: updated.dueAt.toISOString() }
          );
        }
      }
      return updated;
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
        .where(and(eq(students.schoolId, schoolId), eq(students.id, studentId), eq(students.parentUserId, parentUserId)))
        .limit(1);
      if (!student) throw new LearningNotFoundError("Student not found for this parent account.");
      return visibleView(schoolId, student);
    },

    async getStudentAcademicView(schoolId, studentUserId) {
      const [student] = await db
        .select()
        .from(students)
        .where(and(eq(students.schoolId, schoolId), eq(students.userId, studentUserId)))
        .limit(1);
      if (!student) throw new LearningNotFoundError("No student record is linked to this student account.");
      return visibleView(schoolId, student);
    },

    async getAdminOverview(schoolId) {
      const [schoolExams, subjectRows] = await Promise.all([
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
          .orderBy(asc(classSections.name), asc(subjects.name))
      ]);
      return { exams: schoolExams, examSubjects: subjectRows };
    },

    async createExam(schoolId, input) {
      const [year] = await db
        .select()
        .from(academicYears)
        .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, input.academicYearId)))
        .limit(1);
      if (!year) throw new LearningNotFoundError("Academic year not found.");
      if (year.status !== "ACTIVE") throw new LearningConflictError("New exams require the active academic year.");
      try {
        const [exam] = await db
          .insert(exams)
          .values({ id: randomUUID(), schoolId, ...input, status: "DRAFT" })
          .returning();
        if (!exam) throw new Error("Exam insert did not return a row.");
        return exam;
      } catch (error) {
        if (isUniqueError(error)) throw new LearningConflictError("An exam with that name already exists in this academic year.");
        throw error;
      }
    },

    async createExamSubject(schoolId, input) {
      const exam = await getExam(schoolId, input.examId);
      if (exam.status !== "DRAFT" && exam.status !== "SCHEDULED") {
        throw new LearningConflictError("Exam subjects can be configured only before the exam starts.");
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
        const [created] = await db
          .insert(examSubjects)
          .values({ id: randomUUID(), schoolId, ...input })
          .returning();
        if (!created) throw new Error("Exam subject insert did not return a row.");
        return created;
      } catch (error) {
        if (isUniqueError(error)) throw new LearningConflictError("This subject is already configured for that exam and class.");
        throw error;
      }
    },

    async setExamStatus(schoolId, examId, status) {
      const exam = await getExam(schoolId, examId);
      if (status === "PUBLISHED") throw new LearningValidationError("Use the publish-results action to publish an exam.");
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

      if (status === "RESULTS_READY") {
        const subjectsForExam = await db
          .select()
          .from(examSubjects)
          .where(and(eq(examSubjects.schoolId, schoolId), eq(examSubjects.examId, examId)));
        if (subjectsForExam.length === 0) throw new LearningConflictError("An exam needs at least one subject before results can be ready.");
        for (const examSubject of subjectsForExam) {
          const enrolled = await classStudents(schoolId, examSubject.classId, exam.academicYearId);
          const entered = await db
            .select({ studentId: gradeRecords.studentId })
            .from(gradeRecords)
            .where(and(eq(gradeRecords.schoolId, schoolId), eq(gradeRecords.examSubjectId, examSubject.id)));
          const enteredIds = new Set(entered.map((item) => item.studentId));
          if (enrolled.some((student) => !enteredIds.has(student.id))) {
            throw new LearningConflictError("Every active student must have a draft mark before results can be marked ready.");
          }
        }
      }

      const [updated] = await db
        .update(exams)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(exams.schoolId, schoolId), eq(exams.id, examId)))
        .returning();
      if (!updated) throw new LearningNotFoundError("Exam not found.");
      return updated;
    },

    async publishExam(schoolId, examId) {
      const exam = await getExam(schoolId, examId);
      if (exam.status !== "RESULTS_READY") {
        throw new LearningConflictError("Exam results can be published only from RESULTS_READY.");
      }
      const publishedAt = new Date();
      const subjectIds = (
        await db
          .select({ id: examSubjects.id })
          .from(examSubjects)
          .where(and(eq(examSubjects.schoolId, schoolId), eq(examSubjects.examId, examId)))
      ).map((item) => item.id);
      if (subjectIds.length === 0) throw new LearningConflictError("Exam has no subjects to publish.");

      const result = await db.transaction(async (tx) => {
        await tx
          .update(gradeRecords)
          .set({ status: "PUBLISHED", publishedAt, updatedAt: publishedAt })
          .where(and(eq(gradeRecords.schoolId, schoolId), inArray(gradeRecords.examSubjectId, subjectIds)));
        const [published] = await tx
          .update(exams)
          .set({ status: "PUBLISHED", publishedAt, updatedAt: publishedAt })
          .where(and(eq(exams.schoolId, schoolId), eq(exams.id, examId)))
          .returning();
        if (!published) throw new LearningNotFoundError("Exam not found.");
        return published;
      });

      const classRows = await db
        .select({ classId: examSubjects.classId })
        .from(examSubjects)
        .where(and(eq(examSubjects.schoolId, schoolId), eq(examSubjects.examId, examId)));
      const classIds = Array.from(new Set(classRows.map((item) => item.classId)));
      let notificationCount = 0;
      for (const classId of classIds) {
        const recipients = await recipientUserIds(schoolId, classId);
        for (const userId of recipients) {
          if (
            await createNotification(
              schoolId,
              userId,
              `results:${examId}:${userId}`,
              "RESULTS_PUBLISHED",
              "Results published",
              result.name,
              `/results/${examId}`,
              { examId, academicYearId: result.academicYearId }
            )
          ) notificationCount += 1;
        }
      }
      return { exam: result, notificationCount };
    },

    async correctPublishedGrade(schoolId, actorUserId, gradeId, input) {
      const [current] = await db
        .select({ grade: gradeRecords, examSubject: examSubjects, exam: exams })
        .from(gradeRecords)
        .innerJoin(examSubjects, and(eq(examSubjects.id, gradeRecords.examSubjectId), eq(examSubjects.schoolId, gradeRecords.schoolId)))
        .innerJoin(exams, and(eq(exams.id, examSubjects.examId), eq(exams.schoolId, examSubjects.schoolId)))
        .where(and(eq(gradeRecords.schoolId, schoolId), eq(gradeRecords.id, gradeId)))
        .limit(1);
      if (!current) throw new LearningNotFoundError("Grade record not found.");
      if (current.exam.status !== "PUBLISHED" || current.grade.status !== "PUBLISHED") {
        throw new LearningConflictError("Only published grades use the administrator correction workflow.");
      }
      if (input.score > current.examSubject.maxScore) {
        throw new LearningValidationError(`Score cannot exceed the maximum score of ${current.examSubject.maxScore}.`);
      }
      const [grade] = await db
        .update(gradeRecords)
        .set({
          score: input.score,
          remark: input.remark ?? null,
          updatedBy: actorUserId,
          updatedAt: new Date()
        })
        .where(and(eq(gradeRecords.schoolId, schoolId), eq(gradeRecords.id, gradeId)))
        .returning();
      if (!grade) throw new LearningNotFoundError("Grade record not found.");
      return { grade, previousScore: current.grade.score, previousRemark: current.grade.remark };
    }
  };
}
