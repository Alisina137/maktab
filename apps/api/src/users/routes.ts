import type { FastifyInstance } from "fastify";
import { createSchoolUserSchema } from "@maktablink/contracts";
import {
  AccountConflictError,
  type AccountStore
} from "@maktablink/database";
import { ZodError } from "zod";
import { requireAccess } from "../auth/routes.js";
import { generateTemporaryPassword, hashPassword } from "../auth/security.js";
import { safeUser } from "../auth/session.js";

async function requireSchoolAdmin(request: Parameters<typeof requireAccess>[0], reply: Parameters<typeof requireAccess>[1], store: AccountStore) {
  const context = await requireAccess(request, reply, store);
  if (!context) return null;
  if (context.user.mustChangePassword) {
    await reply.code(403).send({ error: "password_change_required", message: "Change the temporary password before using administration features." });
    return null;
  }
  if (context.user.role !== "SCHOOL_ADMIN") {
    await reply.code(403).send({ error: "forbidden", message: "School administrator access is required." });
    return null;
  }
  return context;
}

export function registerUserRoutes(app: FastifyInstance, store: AccountStore) {
  app.get("/v1/admin/users", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, store);
    if (!context) return;
    return { users: (await store.listUsers(context.user.schoolId)).map(safeUser) };
  });

  app.post("/v1/admin/users", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, store);
    if (!context) return;

    try {
      const input = createSchoolUserSchema.parse(request.body);
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      const user = await store.createUser({
        schoolId: context.user.schoolId,
        username: input.username,
        role: input.role,
        passwordHash
      });

      await store.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "user.created",
        entityType: "user",
        entityId: user.id,
        metadata: { role: user.role, username: user.username }
      });

      return reply.code(201).send({ user: safeUser(user), temporaryPassword });
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: "validation_error", issues: error.issues });
      if (error instanceof AccountConflictError) return reply.code(409).send({ error: "username_conflict", message: error.message });
      throw error;
    }
  });

  app.post<{ Params: { userId: string } }>("/v1/admin/users/:userId/reset-password", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, store);
    if (!context) return;

    const target = await store.findUserById(context.user.schoolId, request.params.userId);
    if (!target) return reply.code(404).send({ error: "not_found", message: "User not found." });
    if (target.status === "ARCHIVED") return reply.code(409).send({ error: "account_archived", message: "Archived accounts cannot be reset." });

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const user = await store.resetPassword(context.user.schoolId, target.id, passwordHash);
    if (!user) return reply.code(404).send({ error: "not_found", message: "User not found." });

    await store.writeAudit({
      schoolId: context.user.schoolId,
      actorUserId: context.user.id,
      action: "user.password_reset",
      entityType: "user",
      entityId: user.id
    });
    return { user: safeUser(user), temporaryPassword };
  });

  app.post<{ Params: { userId: string } }>("/v1/admin/users/:userId/suspend", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, store);
    if (!context) return;
    if (context.user.id === request.params.userId) {
      return reply.code(409).send({ error: "self_suspend_blocked", message: "You cannot suspend your own administrator account." });
    }

    const user = await store.setUserStatus(context.user.schoolId, request.params.userId, "SUSPENDED");
    if (!user) return reply.code(404).send({ error: "not_found", message: "User not found." });
    await store.writeAudit({
      schoolId: context.user.schoolId,
      actorUserId: context.user.id,
      action: "user.suspended",
      entityType: "user",
      entityId: user.id
    });
    return { user: safeUser(user) };
  });

  app.post<{ Params: { userId: string } }>("/v1/admin/users/:userId/reactivate", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, store);
    if (!context) return;
    const existing = await store.findUserById(context.user.schoolId, request.params.userId);
    if (!existing) return reply.code(404).send({ error: "not_found", message: "User not found." });
    if (existing.status === "ARCHIVED") {
      return reply.code(409).send({ error: "account_archived", message: "Archived accounts cannot be reactivated." });
    }

    const status = existing.mustChangePassword ? "INVITED" : "ACTIVE";
    const user = await store.setUserStatus(context.user.schoolId, existing.id, status);
    if (!user) return reply.code(404).send({ error: "not_found", message: "User not found." });
    await store.writeAudit({
      schoolId: context.user.schoolId,
      actorUserId: context.user.id,
      action: "user.reactivated",
      entityType: "user",
      entityId: user.id
    });
    return { user: safeUser(user) };
  });
}
