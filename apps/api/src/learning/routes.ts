import type { FastifyInstance, FastifyReply } from "fastify";
import {
  correctPublishedGradeSchema,
  createExamSchema,
  createExamSubjectSchema,
  createHomeworkSchema,
  saveGradeEntriesSchema,
  setExamStatusSchema,
  updateHomeworkSchema
} from "@maktablink/contracts";
import {
  LearningConflictError,
  LearningNotFoundError,
  LearningValidationError,
  type AccountStore,
  type LearningStore
} from "@maktablink/database";
import { ZodError } from "zod";
import { requireAccess } from "../auth/routes.js";
import { requireSchoolAdmin } from "../users/routes.js";

function sendLearningError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) return reply.code(400).send({ error: "validation_error", issues: error.issues });
  if (error instanceof LearningValidationError) {
    return reply.code(400).send({ error: "learning_validation", message: error.message });
  }
  if (error instanceof LearningNotFoundError) {
    return reply.code(404).send({ error: "not_found", message: error.message });
  }
  if (error instanceof LearningConflictError) {
    return reply.code(409).send({ error: "learning_conflict", message: error.message });
  }
  throw error;
}

async function requireRole(
  request: Parameters<typeof requireAccess>[0],
  reply: Parameters<typeof requireAccess>[1],
  accounts: AccountStore,
  role: "TEACHER" | "PARENT" | "STUDENT"
) {
  const context = await requireAccess(request, reply, accounts);
  if (!context) return null;
  if (context.user.mustChangePassword) {
    await reply.code(403).send({
      error: "password_change_required",
      message: "Change the temporary password before using academic features."
    });
    return null;
  }
  if (context.user.role !== role) {
    await reply.code(403).send({ error: "forbidden", message: `${role} access is required.` });
    return null;
  }
  return context;
}

export function registerLearningRoutes(
  app: FastifyInstance,
  accounts: AccountStore,
  learning: LearningStore
) {
  app.get("/v1/teacher/learning", async (request, reply) => {
    const context = await requireRole(request, reply, accounts, "TEACHER");
    if (!context) return;
    try {
      return await learning.getTeacherLearning(context.user.schoolId, context.user.id);
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  app.post("/v1/teacher/homework", async (request, reply) => {
    const context = await requireRole(request, reply, accounts, "TEACHER");
    if (!context) return;
    try {
      const input = createHomeworkSchema.parse(request.body);
      const homework = await learning.createHomework(context.user.schoolId, context.user.id, input);
      return reply.code(201).send({ homework });
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  app.patch<{ Params: { homeworkId: string } }>("/v1/teacher/homework/:homeworkId", async (request, reply) => {
    const context = await requireRole(request, reply, accounts, "TEACHER");
    if (!context) return;
    try {
      const input = updateHomeworkSchema.parse(request.body);
      return {
        homework: await learning.updateHomework(
          context.user.schoolId,
          context.user.id,
          request.params.homeworkId,
          input
        )
      };
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  for (const action of ["publish", "close", "archive"] as const) {
    app.post<{ Params: { homeworkId: string } }>(
      `/v1/teacher/homework/:homeworkId/${action}`,
      async (request, reply) => {
        const context = await requireRole(request, reply, accounts, "TEACHER");
        if (!context) return;
        try {
          const status = action === "publish" ? "PUBLISHED" : action === "close" ? "CLOSED" : "ARCHIVED";
          const homework = await learning.setHomeworkStatus(
            context.user.schoolId,
            context.user.id,
            request.params.homeworkId,
            status
          );
          if (status === "PUBLISHED") {
            await accounts.writeAudit({
              schoolId: context.user.schoolId,
              actorUserId: context.user.id,
              action: "homework.published",
              entityType: "homework",
              entityId: homework.id,
              metadata: { classId: homework.classId, subjectId: homework.subjectId, dueAt: homework.dueAt.toISOString() }
            });
          }
          return { homework };
        } catch (error) {
          return sendLearningError(reply, error);
        }
      }
    );
  }

  app.get<{ Params: { examSubjectId: string } }>(
    "/v1/teacher/exam-subjects/:examSubjectId/grades",
    async (request, reply) => {
      const context = await requireRole(request, reply, accounts, "TEACHER");
      if (!context) return;
      try {
        return await learning.getGradeSheet(
          context.user.schoolId,
          context.user.id,
          request.params.examSubjectId
        );
      } catch (error) {
        return sendLearningError(reply, error);
      }
    }
  );

  app.post<{ Params: { examSubjectId: string } }>(
    "/v1/teacher/exam-subjects/:examSubjectId/grades",
    async (request, reply) => {
      const context = await requireRole(request, reply, accounts, "TEACHER");
      if (!context) return;
      try {
        const input = saveGradeEntriesSchema.parse(request.body);
        const sheet = await learning.saveDraftGrades(
          context.user.schoolId,
          context.user.id,
          request.params.examSubjectId,
          input.entries
        );
        await accounts.writeAudit({
          schoolId: context.user.schoolId,
          actorUserId: context.user.id,
          action: "grades.draft_saved",
          entityType: "exam_subject",
          entityId: request.params.examSubjectId,
          metadata: { entryCount: input.entries.length }
        });
        return { sheet };
      } catch (error) {
        return sendLearningError(reply, error);
      }
    }
  );

  app.get<{ Params: { studentId: string } }>(
    "/v1/parent/children/:studentId/learning",
    async (request, reply) => {
      const context = await requireRole(request, reply, accounts, "PARENT");
      if (!context) return;
      try {
        return await learning.getParentAcademicView(
          context.user.schoolId,
          context.user.id,
          request.params.studentId
        );
      } catch (error) {
        return sendLearningError(reply, error);
      }
    }
  );

  app.get("/v1/student/home", async (request, reply) => {
    const context = await requireRole(request, reply, accounts, "STUDENT");
    if (!context) return;
    try {
      return await learning.getStudentAcademicView(context.user.schoolId, context.user.id);
    } catch (error) {
      if (error instanceof LearningNotFoundError) {
        return reply.code(403).send({
          error: "account_unavailable",
          message: "This student is no longer actively enrolled. Contact the school administration."
        });
      }
      return sendLearningError(reply, error);
    }
  });

  app.get("/v1/admin/learning", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    return learning.getAdminOverview(context.user.schoolId);
  });

  app.post("/v1/admin/exams", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = createExamSchema.parse(request.body);
      const exam = await learning.createExam(context.user.schoolId, input);
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "exam.created",
        entityType: "exam",
        entityId: exam.id,
        metadata: { name: exam.name, type: exam.type, academicYearId: exam.academicYearId }
      });
      return reply.code(201).send({ exam });
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  app.post("/v1/admin/exam-subjects", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = createExamSubjectSchema.parse(request.body);
      const examSubject = await learning.createExamSubject(context.user.schoolId, input);
      return reply.code(201).send({ examSubject });
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  app.post<{ Params: { examId: string } }>("/v1/admin/exams/:examId/status", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = setExamStatusSchema.parse(request.body);
      const exam = await learning.setExamStatus(context.user.schoolId, request.params.examId, input.status);
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "exam.status_changed",
        entityType: "exam",
        entityId: exam.id,
        metadata: { status: exam.status }
      });
      return { exam };
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  app.post<{ Params: { examId: string } }>("/v1/admin/exams/:examId/publish", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const result = await learning.publishExam(context.user.schoolId, request.params.examId);
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "exam.results_published",
        entityType: "exam",
        entityId: result.exam.id,
        metadata: { notificationCount: result.notificationCount }
      });
      return result;
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  app.patch<{ Params: { gradeId: string } }>("/v1/admin/grades/:gradeId/correct", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = correctPublishedGradeSchema.parse(request.body);
      const result = await learning.correctPublishedGrade(
        context.user.schoolId,
        context.user.id,
        request.params.gradeId,
        input
      );
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "grade.corrected",
        entityType: "grade_record",
        entityId: result.grade.id,
        metadata: {
          previousScore: result.previousScore,
          score: result.grade.score,
          previousRemark: result.previousRemark,
          remark: result.grade.remark,
          reason: input.reason
        }
      });
      return result;
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });
}
