import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  bootstrapSchoolAdminSchema,
  createSchoolInputSchema,
  pilotOnboardSchoolSchema,
  updateSchoolSettingsSchema,
  updateSchoolStatusSchema,
  updateSubscriptionSchema
} from "@maktablink/contracts";
import {
  AccountConflictError,
  SchoolConflictError,
  type AccountStore,
  type PlatformSchoolStore
} from "@maktablink/database";
import { ZodError } from "zod";
import { generateTemporaryPassword, hashPassword } from "../auth/security.js";
import { safeUser } from "../auth/session.js";

function secureEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function registerPlatformRoutes(
  app: FastifyInstance,
  schools: PlatformSchoolStore,
  accounts: AccountStore,
  provisioningKey: string
) {
  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/v1/platform/")) return;
    const supplied = request.headers["x-platform-provisioning-key"];
    if (typeof supplied !== "string" || !secureEqual(supplied, provisioningKey)) {
      return reply.code(401).send({ error: "unauthorized", message: "Invalid platform provisioning credential." });
    }
  });

  app.get("/v1/platform/schools", async () => ({ schools: await schools.listSchools() }));

  app.get("/v1/platform/health/summary", async () => schools.getOperationalSummary());

  app.post("/v1/platform/jobs/subscriptions/run", async () => schools.runSubscriptionLifecycle());

  app.get<{ Params: { schoolId: string } }>("/v1/platform/schools/:schoolId", async (request, reply) => {
    const context = await schools.getSchoolContext(request.params.schoolId);
    if (!context) return reply.code(404).send({ error: "not_found", message: "School not found." });
    return context;
  });

  app.post("/v1/platform/schools", async (request, reply) => {
    try {
      const input = createSchoolInputSchema.parse(request.body);
      const context = await schools.createSchool(input);
      return reply.code(201).send(context);
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: "validation_error", issues: error.issues });
      if (error instanceof SchoolConflictError) return reply.code(409).send({ error: "school_conflict", message: error.message });
      throw error;
    }
  });

  app.patch<{ Params: { schoolId: string } }>("/v1/platform/schools/:schoolId/status", async (request, reply) => {
    try {
      const input = updateSchoolStatusSchema.parse(request.body);
      const context = await schools.updateSchoolStatus(request.params.schoolId, input.status);
      if (!context) return reply.code(404).send({ error: "not_found", message: "School not found." });
      await accounts.writeAudit({
        schoolId: context.school.id,
        action: "school.status_updated",
        entityType: "school",
        entityId: context.school.id,
        metadata: { status: input.status }
      });
      return context;
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: "validation_error", issues: error.issues });
      throw error;
    }
  });

  app.patch<{ Params: { schoolId: string } }>("/v1/platform/schools/:schoolId/subscription", async (request, reply) => {
    try {
      const input = updateSubscriptionSchema.parse(request.body);
      const before = await schools.getSchoolContext(request.params.schoolId);
      if (!before) return reply.code(404).send({ error: "not_found", message: "School not found." });
      const context = await schools.updateSubscription(request.params.schoolId, input);
      if (!context) return reply.code(404).send({ error: "not_found", message: "School not found." });
      await accounts.writeAudit({
        schoolId: context.school.id,
        action: "subscription.updated",
        entityType: "subscription",
        metadata: {
          previousStatus: before.subscription.status,
          status: context.subscription.status,
          billingCycle: context.subscription.billingCycle,
          planCode: context.subscription.planCode
        }
      });
      return context;
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: "validation_error", issues: error.issues });
      throw error;
    }
  });

  app.patch<{ Params: { schoolId: string } }>("/v1/platform/schools/:schoolId/settings", async (request, reply) => {
    try {
      const input = updateSchoolSettingsSchema.parse(request.body);
      const context = await schools.updateSchoolSettings(request.params.schoolId, input);
      if (!context) return reply.code(404).send({ error: "not_found", message: "School not found." });
      return context;
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: "validation_error", issues: error.issues });
      throw error;
    }
  });

  app.post("/v1/platform/pilot/onboard", async (request, reply) => {
    try {
      const input = pilotOnboardSchoolSchema.parse(request.body);
      let context = await schools.createSchool(input.school);
      if (input.subscription) {
        const updated = await schools.updateSubscription(context.school.id, input.subscription);
        if (updated) context = updated;
      }

      const temporaryPassword = generateTemporaryPassword();
      const user = await accounts.createUser({
        schoolId: context.school.id,
        username: input.adminUsername,
        passwordHash: await hashPassword(temporaryPassword),
        role: "SCHOOL_ADMIN"
      });
      await accounts.writeAudit({
        schoolId: context.school.id,
        action: "pilot.school_onboarded",
        entityType: "school",
        entityId: context.school.id,
        metadata: {
          code: context.school.code,
          adminUsername: user.username,
          subscriptionStatus: context.subscription.status
        }
      });
      return reply.code(201).send({
        ...context,
        admin: safeUser(user),
        temporaryPassword
      });
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: "validation_error", issues: error.issues });
      if (error instanceof SchoolConflictError) return reply.code(409).send({ error: "school_conflict", message: error.message });
      if (error instanceof AccountConflictError) return reply.code(409).send({ error: "username_conflict", message: error.message });
      throw error;
    }
  });

  app.post<{ Params: { schoolId: string } }>("/v1/platform/schools/:schoolId/admin", async (request, reply) => {
    try {
      const school = await schools.getSchoolContext(request.params.schoolId);
      if (!school) return reply.code(404).send({ error: "not_found", message: "School not found." });

      const input = bootstrapSchoolAdminSchema.parse(request.body);
      const temporaryPassword = generateTemporaryPassword();
      const user = await accounts.createUser({
        schoolId: school.school.id,
        username: input.username,
        passwordHash: await hashPassword(temporaryPassword),
        role: "SCHOOL_ADMIN"
      });

      await accounts.writeAudit({
        schoolId: school.school.id,
        action: "user.platform_admin_bootstrapped",
        entityType: "user",
        entityId: user.id,
        metadata: { username: user.username }
      });

      return reply.code(201).send({ user: safeUser(user), temporaryPassword });
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: "validation_error", issues: error.issues });
      if (error instanceof AccountConflictError) return reply.code(409).send({ error: "username_conflict", message: error.message });
      throw error;
    }
  });
}
