import type { FastifyInstance, FastifyReply } from "fastify";
import {
  correctPublishedGradeSchema,
  createExamSchema,
  createExamSubjectSchema,
  updateExamSubjectDateSchema,
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
import { z, ZodError } from "zod";
import { requireAccess } from "../auth/routes.js";
import { requireSchoolAdmin } from "../users/routes.js";

function sendLearningError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) return reply.code(400).send({
    error: "validation_error",
    message: error.issues[0]?.message ?? "Invalid learning request.",
    issues: error.issues
  });
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

  app.get("/v1/student/status", async (request, reply) => {
    const context = await requireRole(request, reply, accounts, "STUDENT");
    if (!context) return;
    try {
      return await learning.getStudentEnrollmentStatus(
        context.user.schoolId,
        context.user.id
      );
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
    try {
      const { includePublishedGrades } = z.object({
        includePublishedGrades: z.enum(["true", "false"]).optional()
      }).parse(request.query);
      return await learning.getAdminOverview(context.user.schoolId, includePublishedGrades !== "false");
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  app.get("/v1/admin/learning/dashboard", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const { academicYearId } = z.object({
        academicYearId: z.string().uuid()
      }).parse(request.query);
      return await learning.getAdminDashboard(context.user.schoolId, academicYearId);
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  // Phase 5 is intentionally read-only: assigned teachers remain the
  // authoritative actors for creation, student feedback and publication.
  app.get("/v1/admin/learning/homework", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const query = z.object({
        academicYearId: z.string().uuid(),
        status: z.enum(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]).optional(),
        classId: z.string().uuid().optional(),
        subjectId: z.string().uuid().optional(),
        teacherUserId: z.string().uuid().optional(),
        search: z.string().trim().max(100).optional(),
        attention: z.enum(["ALL", "PAST_DUE", "AWAITING_REVIEW", "MISSING", "REVISION_REQUESTED"]).default("ALL"),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        offset: z.coerce.number().int().min(0).max(100000).default(0)
      }).parse(request.query);
      return await learning.listAdminHomework(context.user.schoolId, query);
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  app.get<{ Params: { homeworkId: string } }>(
    "/v1/admin/learning/homework/:homeworkId/roster", async (request, reply) => {
      const context = await requireSchoolAdmin(request, reply, accounts);
      if (!context) return;
      try {
        const homeworkId = z.string().uuid().parse(request.params.homeworkId);
        const { filter, limit, offset } = z.object({
          filter: z.enum(["ALL", "MISSING", "SUBMITTED", "REVIEWED", "REVISION_REQUESTED"]).default("ALL"),
          limit: z.coerce.number().int().min(1).max(50).default(20),
          offset: z.coerce.number().int().min(0).max(100000).default(0)
        }).parse(request.query);
        return await learning.getAdminHomeworkRoster(context.user.schoolId, homeworkId, filter, limit, offset);
      } catch (error) {
        return sendLearningError(reply, error);
      }
    }
  );

  app.get("/v1/admin/learning/published-results", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const query = z.object({
        academicYearId: z.string().uuid(),
        examId: z.string().uuid().optional(),
        classId: z.string().uuid().optional(),
        subjectId: z.string().uuid().optional(),
        search: z.string().trim().max(100).optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
        offset: z.coerce.number().int().min(0).max(100000).default(0)
      }).parse(request.query);
      return await learning.listAdminPublishedGrades(context.user.schoolId, query);
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  app.get<{ Params: { gradeId: string } }>("/v1/admin/grades/:gradeId/corrections", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const gradeId = z.string().uuid().parse(request.params.gradeId);
      const { limit, offset } = z.object({
        limit: z.coerce.number().int().min(1).max(50).default(20),
        offset: z.coerce.number().int().min(0).max(100000).default(0)
      }).parse(request.query);
      return await learning.getAdminGradeCorrections(context.user.schoolId, gradeId, limit, offset);
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  app.get<{ Params: { examId: string } }>("/v1/admin/exams/:examId/detail", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const examId = z.string().uuid().parse(request.params.examId);
      return await learning.getAdminExamDetail(context.user.schoolId, examId);
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  app.get<{ Params: { examId: string } }>("/v1/admin/exams/:examId/readiness", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const examId = z.string().uuid().parse(request.params.examId);
      return await learning.getAdminExamReadiness(context.user.schoolId, examId);
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  app.post("/v1/admin/exams", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = createExamSchema.parse(request.body);
      const exam = await learning.createExam(context.user.schoolId, context.user.id, input);
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
      const examSubject = await learning.createExamSubject(context.user.schoolId, context.user.id, input);
      return reply.code(201).send({ examSubject });
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  app.patch<{ Params: { examSubjectId: string } }>(
    "/v1/admin/exam-subjects/:examSubjectId/date",
    async (request, reply) => {
      const context = await requireSchoolAdmin(request, reply, accounts);
      if (!context) return;
      try {
        const { examDate } = updateExamSubjectDateSchema.parse(request.body);
        const examSubject = await learning.updateExamSubjectDate(
          context.user.schoolId, context.user.id,
          request.params.examSubjectId, examDate
        );
        return { examSubject };
      } catch (error) {
        return sendLearningError(reply, error);
      }
    }
  );

  app.post<{ Params: { examId: string } }>("/v1/admin/exams/:examId/status", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = setExamStatusSchema.parse(request.body);
      const exam = await learning.setExamStatus(context.user.schoolId, context.user.id, request.params.examId, input.status);
      return { exam };
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });

  app.post<{ Params: { examId: string } }>("/v1/admin/exams/:examId/publish", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const result = await learning.publishExam(context.user.schoolId, context.user.id, request.params.examId);
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
      return result;
    } catch (error) {
      return sendLearningError(reply, error);
    }
  });
}
