import type { FastifyInstance, FastifyReply } from "fastify";
import {
  attendanceDateRangeSchema,
  correctAttendanceSchema,
  submitDailyAttendanceSchema
} from "@maktablink/contracts";
import {
  AttendanceConflictError,
  AttendanceNotFoundError,
  AttendanceValidationError,
  type AccountStore,
  type AttendanceStore
} from "@maktablink/database";
import { z, ZodError } from "zod";
import { requireAccess } from "../auth/routes.js";
import { requireSchoolAdmin } from "../users/routes.js";

function sendAttendanceError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: "validation_error", issues: error.issues });
  }
  if (error instanceof AttendanceValidationError) {
    return reply.code(400).send({ error: "attendance_validation", message: error.message });
  }
  if (error instanceof AttendanceNotFoundError) {
    return reply.code(404).send({ error: "not_found", message: error.message });
  }
  if (error instanceof AttendanceConflictError) {
    return reply.code(409).send({ error: "attendance_conflict", message: error.message });
  }
  throw error;
}

async function requireTeacher(
  request: Parameters<typeof requireAccess>[0],
  reply: Parameters<typeof requireAccess>[1],
  accounts: AccountStore
) {
  const context = await requireAccess(request, reply, accounts);
  if (!context) return null;
  if (context.user.mustChangePassword) {
    await reply.code(403).send({
      error: "password_change_required",
      message: "Change the temporary password before using teacher features."
    });
    return null;
  }
  if (context.user.role !== "TEACHER") {
    await reply.code(403).send({ error: "forbidden", message: "Teacher access is required." });
    return null;
  }
  return context;
}

async function requireParent(
  request: Parameters<typeof requireAccess>[0],
  reply: Parameters<typeof requireAccess>[1],
  accounts: AccountStore
) {
  const context = await requireAccess(request, reply, accounts);
  if (!context) return null;
  if (context.user.mustChangePassword) {
    await reply.code(403).send({
      error: "password_change_required",
      message: "Change the temporary password before using parent features."
    });
    return null;
  }
  if (context.user.role !== "PARENT") {
    await reply.code(403).send({ error: "forbidden", message: "Parent access is required." });
    return null;
  }
  return context;
}

const attendanceSheetQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

const parentAttendanceQuerySchema = attendanceDateRangeSchema;
const reportQuerySchema = attendanceDateRangeSchema.extend({
  classId: z.string().uuid().optional()
});

export function registerAttendanceRoutes(
  app: FastifyInstance,
  accounts: AccountStore,
  attendance: AttendanceStore
) {
  app.get("/v1/teacher/today", async (request, reply) => {
    const context = await requireTeacher(request, reply, accounts);
    if (!context) return;
    try {
      return await attendance.getTeacherToday(context.user.schoolId, context.user.id);
    } catch (error) {
      return sendAttendanceError(reply, error);
    }
  });

  app.get<{ Params: { classId: string }; Querystring: { date?: string } }>(
    "/v1/teacher/negaran/:classId/attendance",
    async (request, reply) => {
      const context = await requireTeacher(request, reply, accounts);
      if (!context) return;
      try {
        const query = attendanceSheetQuerySchema.parse(request.query);
        const date = query.date ?? (await attendance.getSchoolToday(context.user.schoolId));
        return await attendance.getTeacherAttendanceSheet(
          context.user.schoolId,
          context.user.id,
          request.params.classId,
          date
        );
      } catch (error) {
        return sendAttendanceError(reply, error);
      }
    }
  );

  app.post("/v1/teacher/negaran/attendance", async (request, reply) => {
    const context = await requireTeacher(request, reply, accounts);
    if (!context) return;
    try {
      const input = submitDailyAttendanceSchema.parse(request.body);
      const result = await attendance.submitDailyAttendance(
        context.user.schoolId,
        context.user.id,
        input
      );
      if (result.changed) {
        await accounts.writeAudit({
          schoolId: context.user.schoolId,
          actorUserId: context.user.id,
          action: result.created ? "attendance.submitted" : "attendance.corrected_by_negaran",
          entityType: "daily_attendance",
          entityId: result.sheet.attendance?.id,
          metadata: {
            classId: input.classId,
            date: input.date,
            notificationCount: result.notificationCount
          }
        });
      }
      return reply.code(result.created ? 201 : 200).send(result);
    } catch (error) {
      return sendAttendanceError(reply, error);
    }
  });

  app.get<{ Params: { studentId: string }; Querystring: { from?: string; to?: string } }>(
    "/v1/parent/children/:studentId/attendance",
    async (request, reply) => {
      const context = await requireParent(request, reply, accounts);
      if (!context) return;
      try {
        const query = parentAttendanceQuerySchema.parse(request.query);
        const today = await attendance.getSchoolToday(context.user.schoolId);
        const days = await attendance.getParentAttendance(
          context.user.schoolId,
          context.user.id,
          request.params.studentId,
          query.from,
          query.to
        );
        return { today, days };
      } catch (error) {
        return sendAttendanceError(reply, error);
      }
    }
  );

  app.get("/v1/parent/notifications", async (request, reply) => {
    const context = await requireParent(request, reply, accounts);
    if (!context) return;
    try {
      return { notifications: await attendance.getParentNotifications(context.user.schoolId, context.user.id) };
    } catch (error) {
      return sendAttendanceError(reply, error);
    }
  });

  app.post<{ Params: { notificationId: string } }>(
    "/v1/parent/notifications/:notificationId/read",
    async (request, reply) => {
      const context = await requireParent(request, reply, accounts);
      if (!context) return;
      try {
        const notification = await attendance.markNotificationRead(
          context.user.schoolId,
          context.user.id,
          request.params.notificationId
        );
        if (!notification) return reply.code(404).send({ error: "not_found", message: "Notification not found." });
        return { notification };
      } catch (error) {
        return sendAttendanceError(reply, error);
      }
    }
  );

  app.get<{ Querystring: { from?: string; to?: string; classId?: string } }>(
    "/v1/admin/attendance/report",
    async (request, reply) => {
      const context = await requireSchoolAdmin(request, reply, accounts);
      if (!context) return;
      try {
        const query = reportQuerySchema.parse(request.query);
        const today = await attendance.getSchoolToday(context.user.schoolId);
        const to = query.to ?? today;
        const from = query.from ?? to;
        return await attendance.getAdminReport(context.user.schoolId, from, to, query.classId);
      } catch (error) {
        return sendAttendanceError(reply, error);
      }
    }
  );

  app.patch<{ Params: { attendanceId: string; studentId: string } }>(
    "/v1/admin/attendance/:attendanceId/students/:studentId",
    async (request, reply) => {
      const context = await requireSchoolAdmin(request, reply, accounts);
      if (!context) return;
      try {
        const input = correctAttendanceSchema.parse(request.body);
        const result = await attendance.correctAttendance(
          context.user.schoolId,
          context.user.id,
          request.params.attendanceId,
          request.params.studentId,
          input
        );
        await accounts.writeAudit({
          schoolId: context.user.schoolId,
          actorUserId: context.user.id,
          action: "attendance.corrected_by_admin",
          entityType: "daily_attendance",
          entityId: result.attendance.id,
          metadata: {
            studentId: request.params.studentId,
            previousStatus: result.previousStatus,
            status: result.entry.status,
            note: result.entry.note
          }
        });
        return result;
      } catch (error) {
        return sendAttendanceError(reply, error);
      }
    }
  );
}
