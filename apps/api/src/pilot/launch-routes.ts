import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import {
  PILOT_EVIDENCE_CATEGORIES, PilotWorkflowConflict, PilotWorkflowNotFound,
  type AccountStore, type PilotLaunchStore, type PilotStore
} from "@maktablink/database";
import { requireSchoolAdmin } from "../users/routes.js";

const categorySchema = z.enum(PILOT_EVIDENCE_CATEGORIES);
const ticketStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);
const evidenceSchema = z.object({
  category: categorySchema,
  reference: z.string().trim().min(5).max(500),
  note: z.string().trim().min(10).max(2000)
}).strict();
const newTicketSchema = z.object({
  subject: z.string().trim().min(5).max(160),
  description: z.string().trim().min(10).max(3000),
  category: z.enum(["ACCESS", "ACADEMICS", "DATA", "BILLING", "TECHNICAL", "OTHER"]),
  priority: z.enum(["NORMAL", "HIGH", "CRITICAL"]).default("NORMAL")
}).strict();
const replySchema = z.object({ note: z.string().trim().min(2).max(2000) }).strict();
const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  status: ticketStatusSchema.optional()
}).strict();
const idSchema = z.object({ ticketId: z.string().uuid() }).strict();
const schoolSchema = z.object({ schoolId: z.string().uuid() });
const evidenceParamsSchema = z.object({
  schoolId: z.string().uuid(), category: categorySchema
}).strict();
const operatorSchema = z.object({
  operatorLabel: z.string().trim().min(3).max(80),
  note: z.string().trim().min(10).max(1000)
}).strict();
const reviewSchema = operatorSchema.extend({ status: z.enum(["VERIFIED", "REJECTED"]) });
const decisionSchema = operatorSchema.extend({ status: z.enum(["APPROVED", "NOT_APPROVED"]) });
const platformTicketSchema = operatorSchema.extend({ status: ticketStatusSchema });

function fail(reply: { code: (status: number) => { send: (body: unknown) => unknown } }, error: unknown) {
  if (error instanceof ZodError) return reply.code(400).send({
    error: "validation_error", message: "Invalid pilot workflow request.", issues: error.issues
  });
  if (error instanceof PilotWorkflowNotFound) return reply.code(404).send({
    error: "not_found", message: error.message
  });
  if (error instanceof PilotWorkflowConflict) return reply.code(409).send({
    error: "pilot_conflict", message: error.message
  });
  throw error;
}

export function registerPilotLaunchRoutes(
  app: FastifyInstance, accounts: AccountStore, launch: PilotLaunchStore
) {
  app.get("/v1/admin/pilot/launch", async (request, reply) => {
    const ctx = await requireSchoolAdmin(request, reply, accounts);
    if (!ctx) return;
    reply.header("cache-control", "no-store");
    return launch.getOverview(ctx.user.schoolId);
  });

  app.put("/v1/admin/pilot/launch/evidence", async (request, reply) => {
    const ctx = await requireSchoolAdmin(request, reply, accounts);
    if (!ctx) return;
    try {
      const data = evidenceSchema.parse(request.body);
      return { evidence: await launch.submitEvidence(ctx.user.schoolId, ctx.user.id, data) };
    } catch (error) { return fail(reply, error); }
  });

  app.get("/v1/admin/pilot/support", async (request, reply) => {
    const ctx = await requireSchoolAdmin(request, reply, accounts);
    if (!ctx) return;
    try {
      const query = pageSchema.parse(request.query);
      reply.header("cache-control", "no-store");
      return launch.listTickets(ctx.user.schoolId, query);
    } catch (error) { return fail(reply, error); }
  });

  // Billing and support must still be reachable when a school is suspended.
  app.post("/v1/admin/pilot/support", async (request, reply) => {
    const ctx = await requireSchoolAdmin(request, reply, accounts,
      { allowSecurityWriteWhenSubscriptionBlocked: true });
    if (!ctx) return;
    try {
      const input = newTicketSchema.parse(request.body);
      const ticket = await launch.createTicket(ctx.user.schoolId, ctx.user.id, input);
      return reply.code(201).send({ ticket });
    } catch (error) { return fail(reply, error); }
  });

  app.get("/v1/admin/pilot/support/:ticketId", async (request, reply) => {
    const ctx = await requireSchoolAdmin(request, reply, accounts);
    if (!ctx) return;
    try {
      const { ticketId } = idSchema.parse(request.params);
      const data = await launch.getTicket(ctx.user.schoolId, ticketId);
      if (!data) return reply.code(404).send({ error: "not_found", message: "Ticket not found." });
      reply.header("cache-control", "no-store");
      return data;
    } catch (error) { return fail(reply, error); }
  });

  app.post("/v1/admin/pilot/support/:ticketId/replies", async (request, reply) => {
    const ctx = await requireSchoolAdmin(request, reply, accounts,
      { allowSecurityWriteWhenSubscriptionBlocked: true });
    if (!ctx) return;
    try {
      const { ticketId } = idSchema.parse(request.params);
      const { note } = replySchema.parse(request.body);
      await launch.schoolReply(ctx.user.schoolId, ticketId, ctx.user.id, note);
      return { success: true };
    } catch (error) { return fail(reply, error); }
  });
}

// These routes are registered inside the existing x-platform-provisioning-key
// authenticated platform router. School-admin tokens alone cannot access them.
export function registerPlatformPilotWorkflowRoutes(
  app: FastifyInstance, launch: PilotLaunchStore, pilot: PilotStore
) {
  app.get("/v1/platform/pilot/schools/:schoolId/launch", async (request, reply) => {
    try {
      const { schoolId } = schoolSchema.parse(request.params);
      const result = await launch.getOverview(schoolId);
      return { ...result, configurationReady: (await pilot.getAdvancedReadiness(schoolId)).ready };
    } catch (error) { return fail(reply, error); }
  });

  app.patch("/v1/platform/pilot/schools/:schoolId/evidence/:category", async (request, reply) => {
    try {
      const { schoolId, category } = evidenceParamsSchema.parse(request.params);
      const data = reviewSchema.parse(request.body);
      return { evidence: await launch.reviewEvidence(schoolId, { category, ...data }) };
    } catch (error) { return fail(reply, error); }
  });

  app.get("/v1/platform/pilot/schools/:schoolId/support", async (request, reply) => {
    try {
      const { schoolId } = schoolSchema.parse(request.params);
      const query = pageSchema.parse(request.query);
      return launch.listTickets(schoolId, query);
    } catch (error) { return fail(reply, error); }
  });

  app.get("/v1/platform/pilot/schools/:schoolId/support/:ticketId", async (request, reply) => {
    try {
      const { schoolId } = schoolSchema.parse(request.params);
      const { ticketId } = idSchema.parse({ ticketId: (request.params as { ticketId?: string }).ticketId });
      const data = await launch.getTicket(schoolId, ticketId);
      if (!data) return reply.code(404).send({ error: "not_found", message: "Ticket not found." });
      return data;
    } catch (error) { return fail(reply, error); }
  });

  app.patch("/v1/platform/pilot/schools/:schoolId/support/:ticketId", async (request, reply) => {
    try {
      const { schoolId } = schoolSchema.parse(request.params);
      const { ticketId } = idSchema.parse({ ticketId: (request.params as { ticketId?: string }).ticketId });
      const data = platformTicketSchema.parse(request.body);
      await launch.platformUpdateTicket(schoolId, ticketId, data.status, data.operatorLabel, data.note);
      return { success: true };
    } catch (error) { return fail(reply, error); }
  });

  app.post("/v1/platform/pilot/schools/:schoolId/launch/decision", async (request, reply) => {
    try {
      const { schoolId } = schoolSchema.parse(request.params);
      const data = decisionSchema.parse(request.body);
      // Advanced includes all core subscription/school/academic checks. Only
      // the platform can decide; setup readiness can never grant approval.
      const configurationReady = (await pilot.getAdvancedReadiness(schoolId)).ready;
      return { decision: await launch.decideLaunch(
        schoolId, data.status, data.operatorLabel, data.note, configurationReady
      ) };
    } catch (error) { return fail(reply, error); }
  });
}
