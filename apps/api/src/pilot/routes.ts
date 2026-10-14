import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import {
  bulkImportEntitySchema,
  type BulkImportEntity
} from "@maktablink/contracts";
import { PilotExportLimitError, type AccountStore, type PilotStore } from "@maktablink/database";
import { requireSchoolAdmin } from "../users/routes.js";

const auditDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Invalid calendar date.");

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  category: z.enum(["all", "accounts", "academics", "attendance", "learning", "communication", "fees", "operations"]).default("all"),
  actorUserId: z.string().uuid().optional(),
  dateFrom: auditDateSchema.optional(),
  dateTo: auditDateSchema.optional(),
  search: z.string().trim().min(2).max(100).optional()
}).strict().refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
  message: "Date range must be chronological."
});

function auditOptions(query: z.infer<typeof auditQuerySchema>) {
  return {
    limit: query.limit, offset: query.offset, category: query.category,
    actorUserId: query.actorUserId, search: query.search,
    dateFrom: query.dateFrom ? new Date(query.dateFrom + "T00:00:00+04:30") : undefined,
    dateTo: query.dateTo ? new Date(Date.parse(query.dateTo + "T00:00:00+04:30") + 86_400_000) : undefined
  };
}

function csvSafeCell(value: string): string {
  // CSV cells must remain inert if opened in a spreadsheet application.
  const escaped = /^\s*[=+@\-\t\r]/.test(value) ? "'" + value : value;
  return '"' + escaped.replaceAll('"', '""').replace(/[\r\n]+/g, " ") + '"';
}

const readinessIssueQuerySchema = z.object({
  metric: z.enum([
    "teaching", "timetable", "negaran", "class_students",
    "family_links", "student_logins", "teacher_logins"
  ]),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0)
}).strict();

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

  app.get("/v1/admin/pilot/readiness/advanced", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    return pilot.getAdvancedReadiness(context.user.schoolId);
  });

  app.get("/v1/admin/pilot/readiness/issues", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const { metric, limit, offset } = readinessIssueQuerySchema.parse(request.query);
      return pilot.listReadinessIssues(context.user.schoolId, metric, { limit, offset });
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({
        error: "validation_error", message: "Invalid readiness issue filter.", issues: error.issues
      });
      throw error;
    }
  });

  app.get("/v1/admin/pilot/export", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    let data: Record<string, unknown> | null;
    try {
      data = await pilot.exportCoreSchoolData(context.user.schoolId);
    } catch (error) {
      if (error instanceof PilotExportLimitError) return reply.code(413).send({
        error: "export_too_large", message: error.message
      });
      throw error;
    }
    if (!data) return reply.code(404).send({ error: "not_found", message: "School not found." });
    // Audit before releasing the file. Failure to log is a fail-closed export.
    await accounts.writeAudit({
      schoolId: context.user.schoolId, actorUserId: context.user.id,
      action: "pilot.exported", entityType: "school", entityId: context.user.schoolId,
      metadata: { format: "json", scope: "core" }
    });
    const date = new Date().toISOString().slice(0, 10);
    reply.header("cache-control", "no-store");
    reply.header("x-content-type-options", "nosniff");
    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="maktablink-school-export-${date}.json"`);
    return data;
  });


  app.get("/v1/admin/pilot/audit", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const query = auditQuerySchema.parse(request.query);
      reply.header("cache-control", "no-store");
      return accounts.listPilotAuditEvents(context.user.schoolId, auditOptions(query));
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({
        error: "validation_error", message: "Invalid audit filter.", issues: error.issues
      });
      throw error;
    }
  });

  app.get("/v1/admin/pilot/audit/export", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const query = auditQuerySchema.parse(request.query);
      const page = await accounts.listPilotAuditEvents(context.user.schoolId, {
        ...auditOptions(query), offset: 0, limit: 501
      });
      if (page.hasMore || page.logs.length > 500) return reply.code(413).send({
        error: "export_too_large", message: "Audit CSV export is limited to 500 events. Narrow your filters."
      });
      const headers = ["Time", "Action", "Category", "Actor", "Entity type", "Target", "Reason"];
      const lines = [headers.map(csvSafeCell).join(",")];
      for (const row of page.logs) {
        lines.push([
          row.createdAt.toISOString(), row.action, row.category,
          row.actorUsername ?? "", row.entityType,
          row.targetLabel ?? "", String(row.metadata.reason ?? "")
        ].map(csvSafeCell).join(","));
      }
      await accounts.writeAudit({
        schoolId: context.user.schoolId, actorUserId: context.user.id,
        action: "pilot.audit_exported", entityType: "school", entityId: context.user.schoolId,
        metadata: { format: "csv", count: page.logs.length }
      });
      reply.header("cache-control", "no-store");
      reply.header("x-content-type-options", "nosniff");
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", 'attachment; filename="maktablink-audit-history.csv"');
      return "\uFEFF" + lines.join("\r\n") + "\r\n";
    } catch (error) {
      if (error instanceof ZodError) return reply.code(400).send({
        error: "validation_error", message: "Invalid audit filter.", issues: error.issues
      });
      throw error;
    }
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
