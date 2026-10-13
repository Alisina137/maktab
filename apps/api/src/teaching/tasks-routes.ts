import type { FastifyInstance, FastifyReply } from "fastify";
import { z, ZodError } from "zod";
import type { AccountStore, TeacherTasksStore } from "@maktablink/database";
import { TeacherTaskLimitError, TeacherTaskNotFoundError } from "@maktablink/database";
import { requireAccess } from "../auth/routes.js";

const id = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
const form = z.object({
  title: z.string().trim().min(1).max(160),
  details: z.string().trim().max(1500).default(""),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
  dueOn: isoDate.nullable().default(null)
}).strict();
const edit = form.partial().extend({
  status: z.enum(["OPEN", "DONE"]).optional()
}).strict().refine((value) => Object.keys(value).length > 0, "Supply at least one change.");

function errorReply(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) return reply.code(400).send({ error: "validation_error", issues: error.issues });
  if (error instanceof TeacherTaskNotFoundError) {
    return reply.code(404).send({ error: "not_found", message: error.message });
  }
  if (error instanceof TeacherTaskLimitError) {
    return reply.code(409).send({ error: "task_limit", message: error.message });
  }
  throw error;
}
export function registerTeacherTasksRoutes(
  app: FastifyInstance, accounts: AccountStore, tasks: TeacherTasksStore
) {
  async function teacher(request: Parameters<typeof requireAccess>[0], reply: Parameters<typeof requireAccess>[1]) {
    const context = await requireAccess(request, reply, accounts);
    if (!context) return null;
    if (context.user.mustChangePassword || context.user.role !== "TEACHER") {
      await reply.code(403).send({ error: "forbidden", message: "Teacher access is required." });
      return null;
    }
    return context.user;
  }
  app.get("/v1/teacher/tasks", async (request, reply) => {
    const user = await teacher(request, reply);
    if (!user) return;
    return { tasks: await tasks.list(user.schoolId, user.id) };
  });
  app.post("/v1/teacher/tasks", async (request, reply) => {
    const user = await teacher(request, reply);
    if (!user) return;
    try {
      return reply.code(201).send({ task: await tasks.create(user.schoolId, user.id, form.parse(request.body)) });
    } catch (error) { return errorReply(reply, error); }
  });
  app.patch<{ Params: { taskId: string } }>("/v1/teacher/tasks/:taskId", async (request, reply) => {
    const user = await teacher(request, reply);
    if (!user) return;
    try {
      return { task: await tasks.update(user.schoolId, user.id, id.parse(request.params.taskId), edit.parse(request.body)) };
    } catch (error) { return errorReply(reply, error); }
  });
  app.delete<{ Params: { taskId: string } }>("/v1/teacher/tasks/:taskId", async (request, reply) => {
    const user = await teacher(request, reply);
    if (!user) return;
    try {
      await tasks.remove(user.schoolId, user.id, id.parse(request.params.taskId));
      return { deleted: true };
    } catch (error) { return errorReply(reply, error); }
  });
}
