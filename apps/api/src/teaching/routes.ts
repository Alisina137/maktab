import type { FastifyInstance, FastifyReply } from "fastify";
import { z, ZodError } from "zod";
import type { AccountStore, TeacherTeachingStore } from "@maktablink/database";
import {
  TeachingNotFoundError, TeachingValidationError, TeachingConflictError
} from "@maktablink/database";
import { requireAccess } from "../auth/routes.js";
import { requireSchoolAdmin } from "../users/routes.js";

const uuid = z.string().uuid();
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const lessonInput = z.object({
  lessonDate: isoDay,
  topic: z.string().trim().min(1).max(160),
  objective: z.string().trim().min(1).max(4000),
  materials: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(4000).default(""),
  unitId: uuid.nullish()
}).strict();
const lessonPatch = lessonInput.partial().extend({
  status: z.enum(["PLANNED", "COMPLETED", "POSTPONED"]).optional()
}).strict().refine((input) => Object.keys(input).length > 0, "Changes are required.");
const unitInput = z.object({
  academicYearId: uuid, classId: uuid, subjectId: uuid,
  title: z.string().trim().min(1).max(160),
  sortOrder: z.number().int().min(1).max(500)
}).strict();
const unitStatus = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"])
}).strict();
const monthRange = z.object({ from: isoDay, to: isoDay }).strict();
function respond(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) return reply.code(400).send({
    error: "validation_error", issues: error.issues
  });
  if (error instanceof TeachingValidationError) return reply.code(400).send({
    error: "teaching_validation", message: error.message
  });
  if (error instanceof TeachingConflictError) return reply.code(409).send({
    error: "teaching_conflict", message: error.message
  });
  if (error instanceof TeachingNotFoundError) return reply.code(404).send({
    error: "not_found", message: error.message
  });
  throw error;
}
export function registerTeachingRoutes(
  app: FastifyInstance, accounts: AccountStore, teaching: TeacherTeachingStore
) {
  async function teacher(request: Parameters<typeof requireAccess>[0], reply: Parameters<typeof requireAccess>[1]) {
    const context = await requireAccess(request, reply, accounts);
    if (!context) return null;
    if (context.user.mustChangePassword || context.user.role !== "TEACHER") {
      await reply.code(403).send({ error: "forbidden", message: "Active Teacher permissions required." });
      return null;
    }
    return context.user;
  }

  app.get<{ Querystring: { academicYearId: string; classId: string; subjectId: string } }>(
    "/v1/admin/teaching/curriculum", async (request, reply) => {
      const context = await requireSchoolAdmin(request, reply, accounts);
      if (!context) return;
      try {
        const params = z.object({ academicYearId: uuid, classId: uuid, subjectId: uuid })
          .strict().parse(request.query);
        return { units: await teaching.listCurriculum(
          context.user.schoolId, params.academicYearId, params.classId, params.subjectId
        ) };
      } catch (error) { return respond(reply, error); }
    }
  );
  app.post("/v1/admin/teaching/curriculum", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = unitInput.parse(request.body);
      const unit = await teaching.addCurriculumUnit(context.user.schoolId, context.user.id, input);
      await accounts.writeAudit({
        schoolId: context.user.schoolId, actorUserId: context.user.id,
        action: "curriculum.unit_created", entityType: "curriculum_unit", entityId: unit.id,
        metadata: { classId: input.classId, subjectId: input.subjectId }
      });
      return reply.code(201).send({ unit });
    } catch (error) { return respond(reply, error); }
  });
  app.get<{ Params: { assignmentId: string } }>(
    "/v1/teacher/teaching/:assignmentId", async (request, reply) => {
      const user = await teacher(request, reply);
      if (!user) return;
      try {
        return await teaching.teacherWorkspace(user.schoolId, user.id, uuid.parse(request.params.assignmentId));
      } catch (error) { return respond(reply, error); }
    }
  );
  app.post<{ Params: { assignmentId: string } }>(
    "/v1/teacher/teaching/:assignmentId/lessons", async (request, reply) => {
      const user = await teacher(request, reply);
      if (!user) return;
      try {
        const lesson = await teaching.createLesson(
          user.schoolId, user.id, uuid.parse(request.params.assignmentId), lessonInput.parse(request.body)
        );
        return reply.code(201).send({ lesson });
      } catch (error) { return respond(reply, error); }
    }
  );
  app.patch<{ Params: { assignmentId: string; lessonId: string } }>(
    "/v1/teacher/teaching/:assignmentId/lessons/:lessonId", async (request, reply) => {
      const user = await teacher(request, reply);
      if (!user) return;
      try {
        const lesson = await teaching.updateLesson(
          user.schoolId, user.id, uuid.parse(request.params.assignmentId),
          uuid.parse(request.params.lessonId), lessonPatch.parse(request.body)
        );
        return { lesson };
      } catch (error) { return respond(reply, error); }
    }
  );
  app.put<{ Params: { assignmentId: string; unitId: string } }>(
    "/v1/teacher/teaching/:assignmentId/units/:unitId", async (request, reply) => {
      const user = await teacher(request, reply);
      if (!user) return;
      try {
        return await teaching.updateUnit(
          user.schoolId, user.id, uuid.parse(request.params.assignmentId),
          uuid.parse(request.params.unitId), unitStatus.parse(request.body).status
        );
      } catch (error) { return respond(reply, error); }
    }
  );
  app.get<{ Params: { assignmentId: string }; Querystring: { from: string; to: string } }>(
    "/v1/teacher/teaching/:assignmentId/report", async (request, reply) => {
      const user = await teacher(request, reply);
      if (!user) return;
      try {
        const period = monthRange.parse(request.query);
        return await teaching.report(
          user.schoolId, user.id, uuid.parse(request.params.assignmentId), period.from, period.to
        );
      } catch (error) { return respond(reply, error); }
    }
  );
}
