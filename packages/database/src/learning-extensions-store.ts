import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, gte, inArray, isNull, lte, or } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";
import {
  academicYears, auditLogs, continuousAssessments, continuousScores, homeworkSubmissions,
  homeworks, learningFiles, notifications, students, teacherAssignments, users
} from "./schema.js";
import { LearningConflictError, LearningNotFoundError, LearningValidationError } from "./learning-store.js";

export type LearningFileInput = { fileName: string; mimeType: string; base64: string };
export type SubmissionInput = { answer: string; attachmentFileId?: string | null };
export type AssessmentInput = {
  assignmentId: string; title: string;
  category: "QUIZ" | "CLASSWORK" | "HOMEWORK" | "PARTICIPATION" | "MONTHLY";
  maxScore: number; assessedOn: string;
};
export interface LearningExtensionsStore {
  uploadFile(schoolId: string, userId: string, input: LearningFileInput): Promise<{ id: string; fileName: string; mimeType: string; byteCount: number }>;
  readFile(schoolId: string, userId: string, fileId: string): Promise<{ fileName: string; mimeType: string; base64: string }>;
  attachHomework(schoolId: string, teacherId: string, homeworkId: string, fileId: string | null): Promise<{ attachmentFileId: string | null }>;
  scheduleHomework(schoolId: string, teacherId: string, homeworkId: string, scheduledAt: Date | null): Promise<{ scheduledAt: Date | null }>;
  publishDueHomeworks(): Promise<number>;
  submitHomework(schoolId: string, userId: string, homeworkId: string, input: SubmissionInput): Promise<unknown>;
  studentSubmissions(schoolId: string, userId: string): Promise<unknown[]>;
  teacherSubmissions(schoolId: string, teacherId: string, homeworkId: string): Promise<unknown[]>;
  reviewSubmission(schoolId: string, teacherId: string, homeworkId: string, submissionId: string, input: { status: "REVIEWED" | "REVISION_REQUESTED"; feedback: string }): Promise<unknown>;
  listAssessments(schoolId: string, teacherId: string, assignmentId: string): Promise<unknown[]>;
  createAssessment(schoolId: string, teacherId: string, input: AssessmentInput): Promise<unknown>;
  getAssessmentSheet(schoolId: string, teacherId: string, assessmentId: string): Promise<{
    assessment: typeof continuousAssessments.$inferSelect;
    students: Array<{ student: { id: string; fullName: string; studentCode: string };
      score: typeof continuousScores.$inferSelect | null }>;
  }>;
  saveAssessmentScores(schoolId: string, teacherId: string, assessmentId: string, entries: Array<{ studentId: string; score: number; remark?: string }>): Promise<unknown>;
}
const allowedMime = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

export function createLearningExtensionsStore(db: FoundationDatabase): LearningExtensionsStore {
  async function requireAssignment(schoolId: string, teacherId: string, id: string) {
    const [row] = await db.select({ assignment: teacherAssignments })
      .from(teacherAssignments)
      .innerJoin(academicYears, and(eq(academicYears.id, teacherAssignments.academicYearId),
        eq(academicYears.schoolId, schoolId), eq(academicYears.status, "ACTIVE")))
      .where(and(eq(teacherAssignments.id, id), eq(teacherAssignments.schoolId, schoolId),
        eq(teacherAssignments.teacherUserId, teacherId))).limit(1);
    if (!row) throw new LearningNotFoundError("Active teaching assignment not found.");
    return row.assignment;
  }
  async function requireOwnedHomework(schoolId: string, teacherId: string, homeworkId: string) {
    const [row] = await db.select().from(homeworks)
      .where(and(eq(homeworks.schoolId, schoolId), eq(homeworks.id, homeworkId),
        eq(homeworks.teacherUserId, teacherId))).limit(1);
    if (!row) throw new LearningNotFoundError("Homework not assigned to this teacher.");
    await requireAssignment(schoolId, teacherId, row.assignmentId);
    return row;
  }
  async function requireStudent(schoolId: string, userId: string) {
    const [student] = await db.select().from(students)
      .where(and(eq(students.schoolId, schoolId), eq(students.userId, userId),
        eq(students.status, "ACTIVE"))).limit(1);
    if (!student) throw new LearningNotFoundError("Active student enrollment not found.");
    return student;
  }
  async function requireOwnedFile(schoolId: string, userId: string, id: string) {
    const [file] = await db.select().from(learningFiles)
      .where(and(eq(learningFiles.id, id), eq(learningFiles.schoolId, schoolId),
        eq(learningFiles.uploadedBy, userId))).limit(1);
    if (!file) throw new LearningNotFoundError("File not found for this account.");
    return file;
  }
  async function requireAssessment(schoolId: string, teacherId: string, id: string) {
    const [assessment] = await db.select().from(continuousAssessments)
      .where(and(eq(continuousAssessments.id, id), eq(continuousAssessments.schoolId, schoolId),
        eq(continuousAssessments.teacherUserId, teacherId))).limit(1);
    if (!assessment) throw new LearningNotFoundError("Assessment not found.");
    const assignment = await requireAssignment(schoolId, teacherId, assessment.assignmentId);
    return { assessment, assignment };
  }

  return {
    async uploadFile(schoolId, userId, input) {
      const [actor] = await db.select({ role: users.role }).from(users)
        .where(and(eq(users.id, userId), eq(users.schoolId, schoolId))).limit(1);
      if (!actor || !["TEACHER", "STUDENT"].includes(actor.role)) {
        throw new LearningNotFoundError("Academic uploader not found.");
      }
      if (actor.role === "STUDENT") await requireStudent(schoolId, userId);
      // Bound database-backed pilot storage to prevent a signed-in account
      // from filling PostgreSQL with repeated orphan uploads.
      const recent = await db.select({ id: learningFiles.id }).from(learningFiles)
        .where(and(eq(learningFiles.schoolId, schoolId), eq(learningFiles.uploadedBy, userId),
          gte(learningFiles.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))))
        .limit(actor.role === "STUDENT" ? 11 : 41);
      if (recent.length >= (actor.role === "STUDENT" ? 10 : 40)) {
        throw new LearningConflictError("Daily attachment quota reached. Try again tomorrow.");
      }
      if (!allowedMime.has(input.mimeType) || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64) ||
          input.base64.length % 4 !== 0) {
        throw new LearningValidationError("Allowed attachments: PDF, PNG, JPEG, or WebP.");
      }
      const bytes = Buffer.from(input.base64, "base64");
      if (bytes.length === 0 || bytes.length > 1_048_576 ||
          bytes.toString("base64") !== input.base64) {
        throw new LearningValidationError("Attachment must be 1 MB or less.");
      }
      // Signature detection prevents a forged MIME type from becoming active HTML.
      const signature = input.mimeType === "application/pdf" ? bytes.subarray(0, 5).toString("ascii") === "%PDF-" :
        input.mimeType === "image/png" ? bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" :
        input.mimeType === "image/jpeg" ? bytes.subarray(0, 3).toString("hex") === "ffd8ff" :
        bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
      if (!signature) throw new LearningValidationError("File signature does not match the selected type.");
      const name = input.fileName.replace(/[\\/\r\n\x00-\x1f]/g, "").trim().slice(0, 160);
      if (!name) throw new LearningValidationError("A file name is required.");
      const [row] = await db.insert(learningFiles).values({
        id: randomUUID(), schoolId, uploadedBy: userId, fileName: name,
        mimeType: input.mimeType, byteCount: bytes.length, base64Data: input.base64
      }).returning({ id: learningFiles.id, fileName: learningFiles.fileName,
        mimeType: learningFiles.mimeType, byteCount: learningFiles.byteCount });
      if (!row) throw new Error("File upload failed.");
      return row;
    },
    async readFile(schoolId, userId, fileId) {
      const [file] = await db.select().from(learningFiles).where(and(
        eq(learningFiles.schoolId, schoolId), eq(learningFiles.id, fileId))).limit(1);
      if (!file) throw new LearningNotFoundError("File not found.");
      if (file.uploadedBy !== userId) {
        const [teacherAccess] = await db.select({ id: homeworks.id }).from(homeworks).where(and(
          eq(homeworks.schoolId, schoolId), eq(homeworks.attachmentFileId, fileId),
          eq(homeworks.teacherUserId, userId))).limit(1);
        const [studentAccess] = await db.select({ id: students.id }).from(students)
          .innerJoin(homeworks, and(eq(homeworks.schoolId, students.schoolId),
            eq(homeworks.classId, students.classId),
            eq(homeworks.academicYearId, students.academicYearId),
            inArray(homeworks.status, ["PUBLISHED", "CLOSED"]),
            eq(homeworks.attachmentFileId, fileId)))
          .where(and(eq(students.schoolId, schoolId), eq(students.userId, userId),
            eq(students.status, "ACTIVE"))).limit(1);
        const [parentAccess] = await db.select({ id: students.id }).from(students)
          .innerJoin(homeworks, and(eq(homeworks.schoolId, students.schoolId),
            eq(homeworks.classId, students.classId),
            eq(homeworks.academicYearId, students.academicYearId),
            inArray(homeworks.status, ["PUBLISHED", "CLOSED"]),
            eq(homeworks.attachmentFileId, fileId)))
          .where(and(eq(students.schoolId, schoolId), eq(students.parentUserId, userId),
            eq(students.status, "ACTIVE"))).limit(1);
        const [reviewAccess] = await db.select({ id: homeworkSubmissions.id }).from(homeworkSubmissions)
          .innerJoin(homeworks, and(eq(homeworks.id, homeworkSubmissions.homeworkId),
            eq(homeworks.schoolId, homeworkSubmissions.schoolId),
            eq(homeworks.teacherUserId, userId)))
          .where(and(eq(homeworkSubmissions.schoolId, schoolId),
            eq(homeworkSubmissions.attachmentFileId, fileId))).limit(1);
        if (!teacherAccess && !studentAccess && !parentAccess && !reviewAccess) throw new LearningNotFoundError("File unavailable.");
      }
      return { fileName: file.fileName, mimeType: file.mimeType, base64: file.base64Data };
    },
    async attachHomework(schoolId, teacherId, homeworkId, fileId) {
      const homework = await requireOwnedHomework(schoolId, teacherId, homeworkId);
      if (homework.status !== "DRAFT") throw new LearningConflictError("Only draft homework can change attachments.");
      if (fileId) await requireOwnedFile(schoolId, teacherId, fileId);
      const [updated] = await db.update(homeworks).set({ attachmentFileId: fileId, updatedAt: new Date() })
        .where(and(eq(homeworks.id, homeworkId), eq(homeworks.schoolId, schoolId), eq(homeworks.status, "DRAFT")))
        .returning({ attachmentFileId: homeworks.attachmentFileId });
      if (!updated) throw new LearningConflictError("Homework is no longer a draft.");
      return updated;
    },
    async scheduleHomework(schoolId, teacherId, homeworkId, scheduledAt) {
      const homework = await requireOwnedHomework(schoolId, teacherId, homeworkId);
      if (homework.status !== "DRAFT") throw new LearningConflictError("Only draft homework can be scheduled.");
      if (scheduledAt && (scheduledAt.getTime() <= Date.now() || scheduledAt >= homework.dueAt)) {
        throw new LearningValidationError("Publication must be in the future and before the homework deadline.");
      }
      const [updated] = await db.update(homeworks).set({ scheduledAt, updatedAt: new Date() })
        .where(and(eq(homeworks.id, homeworkId), eq(homeworks.schoolId, schoolId), eq(homeworks.status, "DRAFT")))
        .returning({ scheduledAt: homeworks.scheduledAt });
      if (!updated) throw new LearningConflictError("Homework is no longer a draft.");
      return updated;
    },
    async publishDueHomeworks() {
      const now = new Date();
      const due = await db.select({ id: homeworks.id, schoolId: homeworks.schoolId, assignmentId: homeworks.assignmentId })
        .from(homeworks).where(and(eq(homeworks.status, "DRAFT"), lte(homeworks.scheduledAt, now),
          gt(homeworks.dueAt, now)));
      let completed = 0;
      for (const item of due) {
        try {
          const [assignment] = await db.select({ id: teacherAssignments.id }).from(teacherAssignments)
            .innerJoin(academicYears, and(eq(academicYears.id, teacherAssignments.academicYearId),
              eq(academicYears.status, "ACTIVE")))
            .where(and(eq(teacherAssignments.id, item.assignmentId),
              eq(teacherAssignments.schoolId, item.schoolId))).limit(1);
          if (!assignment) continue;
          const published = await db.transaction(async (tx) => {
            // Publication and fan-out are ONE atomic transaction. If notifying
            // recipients fails, the draft remains scheduled and is retried.
            const [changed] = await tx.update(homeworks)
              .set({ status: "PUBLISHED", publishedAt: now, scheduledAt: null, updatedAt: now })
              .where(and(eq(homeworks.id, item.id), eq(homeworks.schoolId, item.schoolId),
                eq(homeworks.status, "DRAFT"), lte(homeworks.scheduledAt, now),
                gt(homeworks.dueAt, now)))
              .returning({ id: homeworks.id, schoolId: homeworks.schoolId, classId: homeworks.classId,
                title: homeworks.title, subjectId: homeworks.subjectId,
                academicYearId: homeworks.academicYearId, teacherUserId: homeworks.teacherUserId,
                dueAt: homeworks.dueAt });
            if (!changed) return false; // Atomic claim across API workers.
            const recipients = await tx.select({ parentId: students.parentUserId, userId: students.userId })
              .from(students).where(and(eq(students.schoolId, changed.schoolId),
                eq(students.classId, changed.classId), eq(students.academicYearId, changed.academicYearId),
                eq(students.status, "ACTIVE")));
            for (const userId of new Set(recipients.flatMap(x => [x.parentId, x.userId].filter((id): id is string => !!id)))) {
              await tx.insert(notifications).values({
                id: randomUUID(), schoolId: changed.schoolId, userId,
                type: "HOMEWORK_PUBLISHED", title: "New homework", message: changed.title,
                deepLink: `/homework/${changed.id}`,
                metadata: { homeworkId: changed.id, classId: changed.classId, subjectId: changed.subjectId,
                  dueAt: changed.dueAt.toISOString() },
                dedupKey: `homework:${changed.id}:${userId}`, deliveryStatus: "PENDING"
              }).onConflictDoNothing();
            }
            await tx.insert(auditLogs).values({
              id: randomUUID(), schoolId: changed.schoolId, actorUserId: changed.teacherUserId,
              action: "homework.published", entityType: "homework", entityId: changed.id,
              metadata: { classId: changed.classId, subjectId: changed.subjectId,
                dueAt: changed.dueAt.toISOString(), automated: true }
            });
            return true;
          });
          if (published) completed++;
        } catch {
          // A rolled-back transaction leaves this scheduled draft eligible
          // for the next run; no visible partial publication is exposed.
        }
      }
      return completed;
    },
    async submitHomework(schoolId, userId, homeworkId, input) {
      const student = await requireStudent(schoolId, userId);
      const [homework] = await db.select().from(homeworks).where(and(
        eq(homeworks.id, homeworkId), eq(homeworks.schoolId, schoolId),
        eq(homeworks.classId, student.classId),
        eq(homeworks.academicYearId, student.academicYearId),
        eq(homeworks.status, "PUBLISHED"))).limit(1);
      if (!homework) throw new LearningNotFoundError("Published homework not found for this class.");
      if (homework.dueAt <= new Date()) throw new LearningConflictError("Homework deadline has passed.");
      if (!input.answer.trim() && !input.attachmentFileId) throw new LearningValidationError("Answer or attachment required.");
      if (input.attachmentFileId) await requireOwnedFile(schoolId, userId, input.attachmentFileId);
      const [existing] = await db.select().from(homeworkSubmissions).where(and(
        eq(homeworkSubmissions.schoolId, schoolId), eq(homeworkSubmissions.homeworkId, homeworkId),
        eq(homeworkSubmissions.studentId, student.id))).limit(1);
      if (existing && existing.status !== "REVISION_REQUESTED")
        throw new LearningConflictError("Homework already submitted; wait for feedback.");
      const now = new Date();
      const [row] = existing ? await db.update(homeworkSubmissions)
        .set({ answer: input.answer.trim(), attachmentFileId: input.attachmentFileId ?? null,
          status: "SUBMITTED", feedback: null, reviewedBy: null, reviewedAt: null,
          submittedAt: now, updatedAt: now })
        .where(and(eq(homeworkSubmissions.id, existing.id),
          eq(homeworkSubmissions.status, "REVISION_REQUESTED"))).returning()
        : await db.insert(homeworkSubmissions).values({
          id: randomUUID(), schoolId, homeworkId, studentId: student.id, answer: input.answer.trim(),
          attachmentFileId: input.attachmentFileId ?? null, status: "SUBMITTED"
        }).onConflictDoNothing().returning();
      if (!row) throw new LearningConflictError("Homework submission changed. Refresh and retry.");
      return row;
    },
    async studentSubmissions(schoolId, userId) {
      const student = await requireStudent(schoolId, userId);
      return db.select({ submission: homeworkSubmissions }).from(homeworkSubmissions)
        .innerJoin(homeworks, and(eq(homeworks.id, homeworkSubmissions.homeworkId),
          eq(homeworks.schoolId, schoolId), eq(homeworks.classId, student.classId),
          eq(homeworks.academicYearId, student.academicYearId),
          inArray(homeworks.status, ["PUBLISHED", "CLOSED"])))
        .where(and(eq(homeworkSubmissions.schoolId, schoolId), eq(homeworkSubmissions.studentId, student.id)));
    },
    async teacherSubmissions(schoolId, teacherId, homeworkId) {
      await requireOwnedHomework(schoolId, teacherId, homeworkId);
      return db.select({
        submission: homeworkSubmissions,
        student: { id: students.id, fullName: students.fullName, studentCode: students.studentCode }
      }).from(homeworkSubmissions)
        .innerJoin(students, and(eq(students.id, homeworkSubmissions.studentId), eq(students.schoolId, schoolId)))
        .where(and(eq(homeworkSubmissions.schoolId, schoolId),
          eq(homeworkSubmissions.homeworkId, homeworkId)))
        .orderBy(asc(students.fullName));
    },
    async reviewSubmission(schoolId, teacherId, homeworkId, submissionId, input) {
      await requireOwnedHomework(schoolId, teacherId, homeworkId);
      const [row] = await db.update(homeworkSubmissions).set({
        status: input.status, feedback: input.feedback, reviewedBy: teacherId,
        reviewedAt: new Date(), updatedAt: new Date()
      }).where(and(eq(homeworkSubmissions.schoolId, schoolId),
        eq(homeworkSubmissions.homeworkId, homeworkId), eq(homeworkSubmissions.id, submissionId),
        eq(homeworkSubmissions.status, "SUBMITTED"))).returning();
      if (!row) throw new LearningConflictError("Submission is not awaiting review.");
      return row;
    },
    async listAssessments(schoolId, teacherId, assignmentId) {
      await requireAssignment(schoolId, teacherId, assignmentId);
      return db.select().from(continuousAssessments).where(and(
        eq(continuousAssessments.schoolId, schoolId), eq(continuousAssessments.assignmentId, assignmentId),
        eq(continuousAssessments.teacherUserId, teacherId))).orderBy(asc(continuousAssessments.assessedOn));
    },
    async createAssessment(schoolId, teacherId, input) {
      await requireAssignment(schoolId, teacherId, input.assignmentId);
      const [row] = await db.insert(continuousAssessments).values({
        id: randomUUID(), schoolId, assignmentId: input.assignmentId,
        teacherUserId: teacherId, title: input.title,
        category: input.category, maxScore: input.maxScore, assessedOn: input.assessedOn
      }).returning();
      if (!row) throw new Error("Continuous assessment creation failed.");
      return row;
    },
    async getAssessmentSheet(schoolId, teacherId, assessmentId) {
      const { assessment, assignment } = await requireAssessment(schoolId, teacherId, assessmentId);
      const [roster, saved] = await Promise.all([
        db.select({ id: students.id, fullName: students.fullName, studentCode: students.studentCode })
          .from(students).where(and(eq(students.schoolId, schoolId),
            eq(students.classId, assignment.classId),
            eq(students.academicYearId, assignment.academicYearId),
            eq(students.status, "ACTIVE"))).orderBy(asc(students.fullName)),
        db.select().from(continuousScores).where(and(eq(continuousScores.schoolId, schoolId),
          eq(continuousScores.assessmentId, assessmentId)))
      ]);
      const scoreMap = new Map(saved.map(row => [row.studentId, row]));
      return { assessment, students: roster.map(student => ({ student, score: scoreMap.get(student.id) ?? null })) };
    },
    async saveAssessmentScores(schoolId, teacherId, assessmentId, entries) {
      const sheet = await this.getAssessmentSheet(schoolId, teacherId, assessmentId);
      const valid = new Set(sheet.students.map(row => row.student.id));
      if (new Set(entries.map(e => e.studentId)).size !== entries.length ||
        entries.some(e => !valid.has(e.studentId) || !Number.isInteger(e.score) ||
          e.score < 0 || e.score > sheet.assessment.maxScore)) {
        throw new LearningValidationError("Scores must belong to actively enrolled students and be within the assessment maximum.");
      }
      for (const entry of entries) {
        await db.insert(continuousScores).values({
          id: randomUUID(), schoolId, assessmentId, studentId: entry.studentId,
          score: entry.score, remark: entry.remark ?? null
        }).onConflictDoUpdate({
          target: [continuousScores.assessmentId, continuousScores.studentId],
          set: { score: entry.score, remark: entry.remark ?? null, updatedAt: new Date() }
        });
      }
      return this.getAssessmentSheet(schoolId, teacherId, assessmentId);
    }
  };
}
