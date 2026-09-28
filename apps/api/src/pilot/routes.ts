import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import {
  bulkImportEntitySchema,
  type BulkImportEntity
} from "@maktablink/contracts";
import type {
  AccountStore,
  PilotStore
} from "@maktablink/database";
import { requireSchoolAdmin } from "../users/routes.js";

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

const templates: Record<BulkImportEntity, string> = {
  PARENT: "username,fullName,phone\nparent.001,Parent Full Name,0700000000\n",
  STUDENT: "studentCode,fullName,parentUsername,academicYear,classCode\nS-001,Student Full Name,parent.001,1405,7A\n",
  TEACHER: "username,employeeCode,fullName,phone\nteacher.001,T-001,Teacher Full Name,0700000000\n"
};

export function registerPilotRoutes(
  app: FastifyInstance,
  accounts: AccountStore,
  pilot: PilotStore
) {
  app.get("/v1/admin/subscription", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    return { subscription: context.subscription };
  });

  app.get("/v1/admin/pilot/readiness", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    return pilot.getReadiness(context.user.schoolId);
  });

  app.get("/v1/admin/pilot/export", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    const data = await pilot.exportCoreSchoolData(context.user.schoolId);
    if (!data) return reply.code(404).send({ error: "not_found", message: "School not found." });
    const date = new Date().toISOString().slice(0, 10);
    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="maktablink-school-export-${date}.json"`);
    return data;
  });

  app.get("/v1/admin/audit", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const query = auditQuerySchema.parse(request.query);
      return accounts.listAuditLogs(context.user.schoolId, query);
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: "validation_error", issues: error.issues });
      throw error;
    }
  });

  app.get<{ Params: { entityType: string } }>("/v1/admin/pilot/import-template/:entityType", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const entityType = bulkImportEntitySchema.parse(request.params.entityType.toUpperCase());
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", `attachment; filename="maktablink-${entityType.toLowerCase()}-import.csv"`);
      return templates[entityType];
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({ error: "validation_error", issues: error.issues });
      throw error;
    }
  });
}
