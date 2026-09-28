import { timingSafeEqual } from "node:crypto";
import Fastify from "fastify";
import { createSchoolInputSchema, updateSchoolSettingsSchema } from "@maktablink/contracts";
import { SchoolConflictError, type PlatformSchoolStore } from "@maktablink/database";
import { ZodError } from "zod";

export interface BuildAppOptions {
  schoolStore: PlatformSchoolStore;
  provisioningKey: string;
}

function secureEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok", service: "maktablink-api", phase: 1 }));

  app.addHook("preHandler", async (request, reply) => {
    if (!request.url.startsWith("/v1/platform/")) return;
    const supplied = request.headers["x-platform-provisioning-key"];
    if (typeof supplied !== "string" || !secureEqual(supplied, options.provisioningKey)) {
      return reply.code(401).send({ error: "unauthorized", message: "Invalid platform provisioning credential." });
    }
  });

  app.get("/v1/platform/schools", async () => ({ schools: await options.schoolStore.listSchools() }));

  app.get<{ Params: { schoolId: string } }>("/v1/platform/schools/:schoolId", async (request, reply) => {
    const context = await options.schoolStore.getSchoolContext(request.params.schoolId);
    if (!context) return reply.code(404).send({ error: "not_found", message: "School not found." });
    return context;
  });

  app.post("/v1/platform/schools", async (request, reply) => {
    try {
      const input = createSchoolInputSchema.parse(request.body);
      const context = await options.schoolStore.createSchool(input);
      return reply.code(201).send(context);
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({ error: "validation_error", issues: error.issues });
      }
      if (error instanceof SchoolConflictError) {
        return reply.code(409).send({ error: "school_conflict", message: error.message });
      }
      throw error;
    }
  });

  app.patch<{ Params: { schoolId: string } }>("/v1/platform/schools/:schoolId/settings", async (request, reply) => {
    try {
      const input = updateSchoolSettingsSchema.parse(request.body);
      const context = await options.schoolStore.updateSchoolSettings(request.params.schoolId, input);
      if (!context) return reply.code(404).send({ error: "not_found", message: "School not found." });
      return context;
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.code(400).send({ error: "validation_error", issues: error.issues });
      }
      throw error;
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    return reply.code(500).send({ error: "internal_error", message: "An unexpected server error occurred." });
  });

  return app;
}
