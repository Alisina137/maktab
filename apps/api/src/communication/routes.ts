import type { FastifyInstance, FastifyReply } from "fastify";
import {
  createAnnouncementSchema,
  createFeeInvoiceSchema,
  recordFeePaymentSchema,
  registerPushDeviceSchema,
  reverseFeePaymentSchema,
  updateFeeReminderSettingsSchema
} from "@maktablink/contracts";
import {
  CommunicationConflictError,
  CommunicationNotFoundError,
  CommunicationValidationError,
  type AccountStore,
  type CommunicationStore,
  type PushProvider
} from "@maktablink/database";
import { ZodError } from "zod";
import { requireAccess } from "../auth/routes.js";
import { requireSchoolAdmin } from "../users/routes.js";

function sendCommunicationError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) return reply.code(400).send({ error: "validation_error", issues: error.issues });
  if (error instanceof CommunicationValidationError) {
    return reply.code(400).send({ error: "communication_validation", message: error.message });
  }
  if (error instanceof CommunicationNotFoundError) {
    return reply.code(404).send({ error: "not_found", message: error.message });
  }
  if (error instanceof CommunicationConflictError) {
    return reply.code(409).send({ error: "communication_conflict", message: error.message });
  }
  throw error;
}

async function requireReadyAccess(
  request: Parameters<typeof requireAccess>[0],
  reply: Parameters<typeof requireAccess>[1],
  accounts: AccountStore
) {
  const context = await requireAccess(request, reply, accounts);
  if (!context) return null;
  if (context.user.mustChangePassword) {
    await reply.code(403).send({
      error: "password_change_required",
      message: "Change the temporary password before using communication features."
    });
    return null;
  }
  return context;
}

function requireProvisioningKey(
  request: Parameters<typeof requireAccess>[0],
  reply: Parameters<typeof requireAccess>[1],
  provisioningKey: string
) {
  const supplied = request.headers["x-platform-provisioning-key"];
  if (typeof supplied !== "string" || supplied !== provisioningKey) {
    void reply.code(401).send({ error: "unauthorized", message: "A valid platform provisioning key is required." });
    return false;
  }
  return true;
}

export function registerCommunicationRoutes(
  app: FastifyInstance,
  accounts: AccountStore,
  communication: CommunicationStore,
  pushProvider: PushProvider,
  provisioningKey: string
) {
  app.get("/v1/announcements", async (request, reply) => {
    const context = await requireReadyAccess(request, reply, accounts);
    if (!context) return;
    try {
      return {
        announcements: await communication.getAnnouncementsForUser(
          context.user.schoolId,
          context.user.id,
          context.user.role
        )
      };
    } catch (error) {
      return sendCommunicationError(reply, error);
    }
  });

  app.post("/v1/teacher/announcements", async (request, reply) => {
    const context = await requireReadyAccess(request, reply, accounts);
    if (!context) return;
    if (context.user.role !== "TEACHER") {
      return reply.code(403).send({ error: "forbidden", message: "Teacher access is required." });
    }
    try {
      const input = createAnnouncementSchema.parse(request.body);
      const announcement = await communication.createNegaranAnnouncement(
        context.user.schoolId,
        context.user.id,
        input
      );
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "announcement.created_by_negaran",
        entityType: "announcement",
        entityId: announcement.id,
        metadata: { classId: announcement.classId, audienceScope: announcement.audienceScope }
      });
      return reply.code(201).send({ announcement });
    } catch (error) {
      return sendCommunicationError(reply, error);
    }
  });

  app.get("/v1/notifications", async (request, reply) => {
    const context = await requireReadyAccess(request, reply, accounts);
    if (!context) return;
    return { notifications: await communication.getUserNotifications(context.user.schoolId, context.user.id) };
  });

  app.post<{ Params: { notificationId: string } }>(
    "/v1/notifications/:notificationId/read",
    async (request, reply) => {
      const context = await requireReadyAccess(request, reply, accounts);
      if (!context) return;
      const notification = await communication.markNotificationRead(
        context.user.schoolId,
        context.user.id,
        request.params.notificationId
      );
      if (!notification) return reply.code(404).send({ error: "not_found", message: "Notification not found." });
      return { notification };
    }
  );

  app.post("/v1/notifications/devices", async (request, reply) => {
    const context = await requireReadyAccess(request, reply, accounts);
    if (!context) return;
    try {
      const input = registerPushDeviceSchema.parse(request.body);
      const device = await communication.registerDevice(
        context.user.schoolId,
        context.user.id,
        input.pushToken,
        input.platform
      );
      return reply.code(201).send({ device });
    } catch (error) {
      return sendCommunicationError(reply, error);
    }
  });

  app.post("/v1/notifications/devices/deactivate", async (request, reply) => {
    const context = await requireReadyAccess(request, reply, accounts);
    if (!context) return;
    try {
      const input = registerPushDeviceSchema.parse(request.body);
      await communication.deactivateDevice(
        context.user.schoolId,
        context.user.id,
        input.pushToken
      );
      return reply.code(204).send();
    } catch (error) {
      return sendCommunicationError(reply, error);
    }
  });

  app.get<{ Params: { studentId: string } }>(
    "/v1/parent/children/:studentId/fees",
    async (request, reply) => {
      const context = await requireReadyAccess(request, reply, accounts);
      if (!context) return;
      if (context.user.role !== "PARENT") {
        return reply.code(403).send({ error: "forbidden", message: "Parent access is required." });
      }
      try {
        return {
          invoices: await communication.getParentFees(
            context.user.schoolId,
            context.user.id,
            request.params.studentId
          )
        };
      } catch (error) {
        return sendCommunicationError(reply, error);
      }
    }
  );

  app.get("/v1/student/fees", async (request, reply) => {
    const context = await requireReadyAccess(request, reply, accounts);
    if (!context) return;
    if (context.user.role !== "STUDENT") {
      return reply.code(403).send({ error: "forbidden", message: "Student access is required." });
    }
    try {
      return { invoices: await communication.getStudentFees(context.user.schoolId, context.user.id) };
    } catch (error) {
      return sendCommunicationError(reply, error);
    }
  });

  app.get("/v1/admin/communication", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    return communication.getAdminOverview(context.user.schoolId);
  });

  app.post("/v1/admin/announcements", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = createAnnouncementSchema.parse(request.body);
      const announcement = await communication.createAnnouncement(context.user.schoolId, context.user.id, input);
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "announcement.created",
        entityType: "announcement",
        entityId: announcement.id,
        metadata: {
          audienceScope: announcement.audienceScope,
          classId: announcement.classId,
          audienceRole: announcement.audienceRole,
          publishAt: announcement.publishAt.toISOString()
        }
      });
      return reply.code(201).send({ announcement });
    } catch (error) {
      return sendCommunicationError(reply, error);
    }
  });

  app.post<{ Params: { announcementId: string } }>(
    "/v1/admin/announcements/:announcementId/archive",
    async (request, reply) => {
      const context = await requireSchoolAdmin(request, reply, accounts);
      if (!context) return;
      try {
        const announcement = await communication.archiveAnnouncement(
          context.user.schoolId,
          request.params.announcementId
        );
        await accounts.writeAudit({
          schoolId: context.user.schoolId,
          actorUserId: context.user.id,
          action: "announcement.archived",
          entityType: "announcement",
          entityId: announcement.id
        });
        return { announcement };
      } catch (error) {
        return sendCommunicationError(reply, error);
      }
    }
  );

  app.post("/v1/admin/fees/invoices", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = createFeeInvoiceSchema.parse(request.body);
      const invoice = await communication.createFeeInvoice(context.user.schoolId, context.user.id, input);
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "fee_invoice.created",
        entityType: "fee_invoice",
        entityId: invoice.id,
        metadata: { studentId: invoice.studentId, amount: invoice.amount, dueDate: invoice.dueDate }
      });
      return reply.code(201).send({ invoice });
    } catch (error) {
      return sendCommunicationError(reply, error);
    }
  });

  for (const action of ["issue", "cancel"] as const) {
    app.post<{ Params: { invoiceId: string } }>(
      `/v1/admin/fees/invoices/:invoiceId/${action}`,
      async (request, reply) => {
        const context = await requireSchoolAdmin(request, reply, accounts);
        if (!context) return;
        try {
          const invoice =
            action === "issue"
              ? await communication.issueFeeInvoice(context.user.schoolId, request.params.invoiceId)
              : await communication.cancelFeeInvoice(context.user.schoolId, request.params.invoiceId);
          await accounts.writeAudit({
            schoolId: context.user.schoolId,
            actorUserId: context.user.id,
            action: `fee_invoice.${action}d`,
            entityType: "fee_invoice",
            entityId: invoice.id,
            metadata: { status: invoice.status }
          });
          return { invoice };
        } catch (error) {
          return sendCommunicationError(reply, error);
        }
      }
    );
  }

  app.post<{ Params: { invoiceId: string } }>(
    "/v1/admin/fees/invoices/:invoiceId/payments",
    async (request, reply) => {
      const context = await requireSchoolAdmin(request, reply, accounts);
      if (!context) return;
      try {
        const input = recordFeePaymentSchema.parse(request.body);
        const invoice = await communication.recordFeePayment(
          context.user.schoolId,
          context.user.id,
          request.params.invoiceId,
          input
        );
        const payment = invoice.payments.at(-1);
        await accounts.writeAudit({
          schoolId: context.user.schoolId,
          actorUserId: context.user.id,
          action: "fee_payment.recorded",
          entityType: "fee_payment",
          entityId: payment?.id,
          metadata: {
            invoiceId: request.params.invoiceId,
            amount: input.amount,
            method: input.method,
            transactionReference: input.transactionReference
          }
        });
        return reply.code(201).send(invoice);
      } catch (error) {
        return sendCommunicationError(reply, error);
      }
    }
  );

  app.post<{ Params: { paymentId: string } }>(
    "/v1/admin/fees/payments/:paymentId/reverse",
    async (request, reply) => {
      const context = await requireSchoolAdmin(request, reply, accounts);
      if (!context) return;
      try {
        const input = reverseFeePaymentSchema.parse(request.body);
        const invoice = await communication.reverseFeePayment(
          context.user.schoolId,
          context.user.id,
          request.params.paymentId,
          input
        );
        const reversal = invoice.payments.at(-1);
        await accounts.writeAudit({
          schoolId: context.user.schoolId,
          actorUserId: context.user.id,
          action: "fee_payment.reversed",
          entityType: "fee_payment",
          entityId: reversal?.id,
          metadata: {
            originalPaymentId: request.params.paymentId,
            invoiceId: invoice.invoice.id,
            amount: reversal?.amount,
            reason: input.reason
          }
        });
        return reply.code(201).send(invoice);
      } catch (error) {
        return sendCommunicationError(reply, error);
      }
    }
  );

  app.patch("/v1/admin/fees/reminder-settings", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = updateFeeReminderSettingsSchema.parse(request.body);
      const daysBeforeDue = await communication.updateFeeReminderDays(
        context.user.schoolId,
        input.daysBeforeDue
      );
      await accounts.writeAudit({
        schoolId: context.user.schoolId,
        actorUserId: context.user.id,
        action: "fee_reminder_settings.updated",
        entityType: "school_settings",
        entityId: context.user.schoolId,
        metadata: { daysBeforeDue }
      });
      return { daysBeforeDue };
    } catch (error) {
      return sendCommunicationError(reply, error);
    }
  });

  app.post("/v1/platform/jobs/communication/run", async (request, reply) => {
    if (!requireProvisioningKey(request, reply, provisioningKey)) return;
    const scheduled = await communication.runScheduledNotifications();
    const push = await communication.deliverPendingPush(pushProvider);
    return { scheduled, push };
  });
}
