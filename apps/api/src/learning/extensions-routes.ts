import type { FastifyInstance, FastifyReply } from "fastify";
import { z, ZodError } from "zod";
import { requireAccess } from "../auth/routes.js";
import type { AccountStore, LearningExtensionsStore } from "@maktablink/database";
import { LearningConflictError, LearningNotFoundError, LearningValidationError } from "@maktablink/database";

const uuid = z.string().uuid();
const fileSchema = z.object({
  fileName: z.string().trim().min(1).max(160),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(4).max(1_400_000)
});
const submissionSchema = z.object({
  answer: z.string().trim().max(10_000).default(""),
  attachmentFileId: uuid.nullish()
}).refine(input => !!input.answer || !!input.attachmentFileId, "Answer or file is required.");
const assessmentSchema = z.object({
  assignmentId: uuid,
  title: z.string().trim().min(1).max(160),
  category: z.enum(["QUIZ", "CLASSWORK", "HOMEWORK", "PARTICIPATION", "MONTHLY"]),
  maxScore: z.number().int().min(1).max(10_000),
  assessedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
function responseError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) return reply.code(400).send({ error: "validation_error", issues: error.issues });
  if (error instanceof LearningValidationError) return reply.code(400).send({ error: "learning_validation", message: error.message });
  if (error instanceof LearningNotFoundError) return reply.code(404).send({ error: "not_found", message: error.message });
  if (error instanceof LearningConflictError) return reply.code(409).send({ error: "learning_conflict", message: error.message });
  throw error;
}
export function registerLearningExtensionsRoutes(app: FastifyInstance, accounts: AccountStore, extra: LearningExtensionsStore) {
  async function auth(request: Parameters<typeof requireAccess>[0], reply: Parameters<typeof requireAccess>[1], role: "STUDENT" | "TEACHER") {
    const context = await requireAccess(request, reply, accounts);
    if (!context) return null;
    if (context.user.mustChangePassword || context.user.role !== role) {
      await reply.code(403).send({ error: "forbidden", message: "Assigned account privileges required." });
      return null;
    }
    return context.user;
  }
  app.post("/v1/learning/files", { bodyLimit: 1_600_000 }, async (request, reply) => {
    const context = await requireAccess(request, reply, accounts);
    if (!context) return;
    if (context.user.mustChangePassword || !["TEACHER", "STUDENT"].includes(context.user.role)) {
      return reply.code(403).send({ error: "forbidden" });
    }
    try {
      const input = fileSchema.parse(request.body);
      return reply.code(201).send({ file: await extra.uploadFile(context.user.schoolId, context.user.id, input) });
    } catch (error) { return responseError(reply, error); }
  });
  app.get<{ Params: { fileId: string } }>("/v1/learning/files/:fileId", async (request, reply) => {
    const context = await requireAccess(request, reply, accounts);
    if (!context) return;
    if (context.user.mustChangePassword) return reply.code(403).send({ error: "forbidden" });
    try {
      return { file: await extra.readFile(context.user.schoolId, context.user.id, uuid.parse(request.params.fileId)) };
    } catch (error) { return responseError(reply, error); }
  });
  app.put<{ Params: { homeworkId: string } }>("/v1/teacher/homework/:homeworkId/file", async (request, reply) => {
    const user = await auth(request, reply, "TEACHER");
    if (!user) return;
    try {
      const input = z.object({ fileId: uuid.nullable() }).parse(request.body);
      return await extra.attachHomework(user.schoolId, user.id, uuid.parse(request.params.homeworkId), input.fileId);
    } catch (error) { return responseError(reply, error); }
  });
  app.put<{ Params: { homeworkId: string } }>("/v1/teacher/homework/:homeworkId/schedule", async (request, reply) => {
    const user = await auth(request, reply, "TEACHER");
    if (!user) return;
    try {
      const input = z.object({ scheduledAt: z.iso.datetime({ offset: true }).nullable() }).parse(request.body);
      return await extra.scheduleHomework(user.schoolId, user.id, uuid.parse(request.params.homeworkId),
        input.scheduledAt ? new Date(input.scheduledAt) : null);
    } catch (error) { return responseError(reply, error); }
  });
  app.post<{ Params: { homeworkId: string } }>("/v1/student/homework/:homeworkId/submission", async (request, reply) => {
    const user = await auth(request, reply, "STUDENT");
    if (!user) return;
    try {
      return { submission: await extra.submitHomework(user.schoolId, user.id,
        uuid.parse(request.params.homeworkId), submissionSchema.parse(request.body)) };
    } catch (error) { return responseError(reply, error); }
  });
  app.get("/v1/student/homework/submissions", async (request, reply) => {
    const user = await auth(request, reply, "STUDENT");
    if (!user) return;
    try { return { submissions: await extra.studentSubmissions(user.schoolId, user.id) }; }
    catch (error) { return responseError(reply, error); }
  });
  app.get<{ Params: { homeworkId: string } }>("/v1/teacher/homework/:homeworkId/submissions", async (request, reply) => {
    const user = await auth(request, reply, "TEACHER");
    if (!user) return;
    try {
      return { submissions: await extra.teacherSubmissions(user.schoolId, user.id, uuid.parse(request.params.homeworkId)) };
    } catch (error) { return responseError(reply, error); }
  });
  app.post<{ Params: { homeworkId: string; submissionId: string } }>(
    "/v1/teacher/homework/:homeworkId/submissions/:submissionId/review", async (request, reply) => {
      const user = await auth(request, reply, "TEACHER");
      if (!user) return;
      try {
        const input = z.object({
          status: z.enum(["REVIEWED", "REVISION_REQUESTED"]),
          feedback: z.string().trim().min(1).max(2000)
        }).parse(request.body);
        return { submission: await extra.reviewSubmission(user.schoolId, user.id,
          uuid.parse(request.params.homeworkId), uuid.parse(request.params.submissionId), input) };
      } catch (error) { return responseError(reply, error); }
    }
  );
  app.get<{ Params: { assignmentId: string } }>("/v1/teacher/assignments/:assignmentId/assessments", async (request, reply) => {
    const user = await auth(request, reply, "TEACHER");
    if (!user) return;
    try { return { assessments: await extra.listAssessments(user.schoolId, user.id, uuid.parse(request.params.assignmentId)) }; }
    catch (error) { return responseError(reply, error); }
  });
  app.post("/v1/teacher/assessments", async (request, reply) => {
    const user = await auth(request, reply, "TEACHER");
    if (!user) return;
    try { return reply.code(201).send({ assessment: await extra.createAssessment(user.schoolId, user.id, assessmentSchema.parse(request.body)) }); }
    catch (error) { return responseError(reply, error); }
  });
  app.get<{ Params: { assessmentId: string } }>("/v1/teacher/assessments/:assessmentId", async (request, reply) => {
    const user = await auth(request, reply, "TEACHER");
    if (!user) return;
    try { return await extra.getAssessmentSheet(user.schoolId, user.id, uuid.parse(request.params.assessmentId)); }
    catch (error) { return responseError(reply, error); }
  });
  app.post<{ Params: { assessmentId: string } }>("/v1/teacher/assessments/:assessmentId/scores", async (request, reply) => {
    const user = await auth(request, reply, "TEACHER");
    if (!user) return;
    try {
      const input = z.object({ entries: z.array(z.object({
        studentId: uuid, score: z.number().int().min(0),
        remark: z.string().max(500).optional()
      })).min(1).max(250) }).parse(request.body);
      return await extra.saveAssessmentScores(user.schoolId, user.id, uuid.parse(request.params.assessmentId), input.entries);
    } catch (error) { return responseError(reply, error); }
  });
}