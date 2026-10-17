import type { FastifyInstance, FastifyReply } from "fastify";
import { AttendanceCalendarConflictError, AttendanceCalendarValidationError } from "@maktablink/database";
import {
  attendanceDateRangeSchema,
  correctAttendanceSchema,
  submitDailyAttendanceSchema
} from "@maktablink/contracts";
import {
  AttendanceConflictError,
  AttendanceHistoryNotFoundError,
  AttendanceNotFoundError,
  AttendanceValidationError,
  FollowupConflictError, FollowupNotFoundError, FollowupValidationError,
  type AccountStore,
  type AttendanceStore
} from "@maktablink/database";
import { z, ZodError } from "zod";
import { requireAccess } from "../auth/routes.js";
import { requireSchoolAdmin } from "../users/routes.js";
import { formatAttendanceAnalyticsCsv } from "./analytics-csv.js";

function sendAttendanceError(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: "validation_error", issues: error.issues });
  }
  if (error instanceof AttendanceCalendarValidationError) {
    return reply.code(400).send({ error: "attendance_calendar_validation", message: error.message });
  }
  if (error instanceof AttendanceCalendarConflictError) {
    return reply.code(409).send({ error: "attendance_calendar_conflict", message: error.message });
  }
  if (error instanceof AttendanceValidationError) {
    return reply.code(400).send({ error: "attendance_validation", message: error.message });
  }
  if (error instanceof AttendanceHistoryNotFoundError) {
    return reply.code(404).send({ error: "not_found", message: error.message });
  }
  if (error instanceof AttendanceNotFoundError) {
    return reply.code(404).send({ error: "not_found", message: error.message });
  }
  if (error instanceof FollowupNotFoundError) {
    return reply.code(404).send({ error: "not_found", message: error.message });
  }
  if (error instanceof FollowupConflictError) {
    return reply.code(409).send({ error: "followup_conflict", message: error.message });
  }
  if (error instanceof FollowupValidationError) {
    return reply.code(400).send({ error: "followup_validation", message: error.message });
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

async function requireStudent(
  request: Parameters<typeof requireAccess>[0],
  reply: Parameters<typeof requireAccess>[1],
  accounts: AccountStore
) {
  const context=await requireAccess(request,reply,accounts);
  if(!context)return null;
  if(context.user.mustChangePassword){
    await reply.code(403).send({
      error:"password_change_required",
      message:"Change the temporary password before accessing student attendance."
    });
    return null;
  }
  if(context.user.role!=="STUDENT"){
    await reply.code(403).send({error:"forbidden",message:"Student access is required."});
    return null;
  }
  return context;
}

const attendanceSheetQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

const parentAttendanceQuerySchema = attendanceDateRangeSchema;
const reportQuerySchema = attendanceDateRangeSchema.extend({
  classId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional()
});

const attendanceMonitoringQuerySchema = z.object({
  academicYearId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  classId: z.string().uuid().optional()
}).strict();

const attendanceClosureQuerySchema = z.object({ academicYearId: z.string().uuid() }).strict();
const attendanceClosureCreateSchema = z.object({
  academicYearId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(1).max(160)
}).strict();

const adminStudentDirectoryQuerySchema = z.object({
  academicYearId: z.string().uuid(),
  classId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0)
}).strict();

const adminStudentHistoryQuerySchema = z.object({
  academicYearId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
}).strict();

const adminClassRegisterQuerySchema = z.object({
  academicYearId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
}).strict();

const adminAttendanceAuditQuerySchema = z.object({
  academicYearId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  classId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(100000).default(0)
}).strict();



const adminAnalyticsFiltersSchema = z.object({
  academicYearId:z.string().uuid(),
  from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  classId:z.string().uuid().optional()
}).strict();
const adminAnalyticsStudentsSchema = adminAnalyticsFiltersSchema.extend({
  limit:z.coerce.number().int().min(1).max(50).default(20),
  offset:z.coerce.number().int().min(0).max(100000).default(0)
}).strict();
const adminAnalyticsExportSchema = adminAnalyticsFiltersSchema.extend({
  kind:z.enum(["classes","days","students"])
}).strict();

const followupStateSchema = z.enum(["OPEN","IN_PROGRESS","RESOLVED","DISMISSED"]);
const followupPageSchema = z.object({
  academicYearId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  classId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  status: followupStateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(100000).default(0)
}).strict();
const followupCreateSchema = z.object({
  academicYearId: z.string().uuid(),
  attendanceId: z.string().uuid(),
  studentId: z.string().uuid(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  openingNote: z.string().trim().min(5).max(500)
}).strict();
const followupUpdateSchema = z.object({
  expectedUpdatedAt: z.string().datetime({offset:true}),
  status: followupStateSchema.optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  note: z.string().trim().min(5).max(500)
}).strict().refine(v=>v.status!==undefined || v.assignedToUserId!==undefined || v.dueOn!==undefined,{
  message:"Specify a status, assignee or due date."
});
const followupActivitySchema = z.object({
  kind: z.enum(["NOTE","CALL","MEETING","MESSAGE"]),
  details: z.string().trim().min(5).max(500)
}).strict();
const followupActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(100000).default(0)
}).strict();

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

  app.get<{ Params: { classId: string }; Querystring: { from: string; to: string } }>(
    "/v1/teacher/negaran/:classId/history",
    async (request, reply) => {
      const context = await requireTeacher(request, reply, accounts);
      if (!context) return;
      try {
        const classId = z.string().uuid().parse(request.params.classId);
        const dates = z.object({
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
        }).strict().parse(request.query);
        return await attendance.getTeacherAttendanceHistory(
          context.user.schoolId,
          context.user.id,
          classId,
          dates.from,
          dates.to
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

  // Student access is read-only and derived from their authenticated account.
  // It accepts no studentId, classId or schoolId to prevent cross-user lookup.
  app.get<{Querystring:{from?:string;to?:string}}>(
    "/v1/student/attendance", async(request,reply)=>{
      const context=await requireStudent(request,reply,accounts);
      if(!context)return;
      try{
        const query=parentAttendanceQuerySchema.parse(request.query);
        const today=await attendance.getSchoolToday(context.user.schoolId);
        const days=await attendance.getStudentAttendance(
          context.user.schoolId,context.user.id,query.from,query.to);
        reply.header("cache-control","no-store");
        return {today,days};
      }catch(error){return sendAttendanceError(reply,error);}
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



  // Class/day trends count only submitted attendance marks. Students are
  // paginated separately; no unsubmitted day is inferred to be ABSENT.
  app.get("/v1/admin/attendance/analytics",async(request,reply)=>{
    const context=await requireSchoolAdmin(request,reply,accounts);
    if(!context)return;
    try{
      const filters=adminAnalyticsFiltersSchema.parse(request.query);
      reply.header("cache-control","no-store");
      return await attendance.getAdminAttendanceAnalytics(context.user.schoolId,filters);
    }catch(error){return sendAttendanceError(reply,error);}
  });

  app.get("/v1/admin/attendance/analytics/students",async(request,reply)=>{
    const context=await requireSchoolAdmin(request,reply,accounts);
    if(!context)return;
    try{
      const {limit,offset,...filters}=adminAnalyticsStudentsSchema.parse(request.query);
      reply.header("cache-control","no-store");
      return await attendance.getAdminAttendanceAnalyticsStudents(
        context.user.schoolId,filters,limit,offset);
    }catch(error){return sendAttendanceError(reply,error);}
  });

  app.get("/v1/admin/attendance/analytics/export",async(request,reply)=>{
    const context=await requireSchoolAdmin(request,reply,accounts);
    if(!context)return;
    try{
      const {kind,...filters}=adminAnalyticsExportSchema.parse(request.query);
      let result:string;
      if(kind==="students"){
        const first=await attendance.getAdminAttendanceAnalyticsStudents(
          context.user.schoolId,filters,1,0);
        // Never transfer an unlimited student directory to an API consumer.
        if(first.total>2000)return reply.code(413).send({
          error:"analytics_export_too_large",
          message:"More than 2,000 student-class rows match. Narrow the date or class filters."
        });
        const page=first.total?await attendance.getAdminAttendanceAnalyticsStudents(
          context.user.schoolId,filters,first.total,0):first;
        result=formatAttendanceAnalyticsCsv(kind,page.rows);
      }else{
        const report=await attendance.getAdminAttendanceAnalytics(context.user.schoolId,filters);
        result=formatAttendanceAnalyticsCsv(kind,kind==="classes"?report.classes:report.days);
      }
      reply.header("cache-control","private, no-store");
      reply.header("content-type","text/csv; charset=utf-8");
      reply.header("content-disposition",
        `attachment; filename="attendance-${kind}-${filters.from}-to-${filters.to}.csv"`);
      return result;
    }catch(error){return sendAttendanceError(reply,error);}
  });

  // Only submitted ABSENT/LATE marks can be promoted to a human-managed case.
  // These endpoints never contact families or fabricate absences from empty registers.
  app.get("/v1/admin/attendance/followups/assignees", async (request, reply) => {
    const context=await requireSchoolAdmin(request,reply,accounts);
    if(!context)return;
    try { return {assignees:await attendance.getFollowupAssignees(context.user.schoolId)}; }
    catch(error){ return sendAttendanceError(reply,error); }
  });

  app.get("/v1/admin/attendance/followups/candidates", async (request,reply) => {
    const context=await requireSchoolAdmin(request,reply,accounts);
    if(!context)return;
    try {
      const query=followupPageSchema.omit({status:true}).parse(request.query);
      return await attendance.getFollowupCandidates(context.user.schoolId,query);
    } catch(error){return sendAttendanceError(reply,error);}
  });

  app.get("/v1/admin/attendance/followups", async(request,reply)=>{
    const context=await requireSchoolAdmin(request,reply,accounts);
    if(!context)return;
    try {
      const query=followupPageSchema.parse(request.query);
      return await attendance.listFollowupCases(context.user.schoolId,query);
    } catch(error){return sendAttendanceError(reply,error);}
  });

  app.post("/v1/admin/attendance/followups",async(request,reply)=>{
    const context=await requireSchoolAdmin(request,reply,accounts);
    if(!context)return;
    try {
      const input=followupCreateSchema.parse(request.body);
      const result=await attendance.createFollowupCase(context.user.schoolId,context.user.id,input);
      return reply.code(201).send(result);
    } catch(error){return sendAttendanceError(reply,error);}
  });

  app.patch<{Params:{caseId:string}}>("/v1/admin/attendance/followups/:caseId",async(request,reply)=>{
    const context=await requireSchoolAdmin(request,reply,accounts);
    if(!context)return;
    try {
      const caseId=z.string().uuid().parse(request.params.caseId);
      const input=followupUpdateSchema.parse(request.body);
      return await attendance.updateFollowupCase(context.user.schoolId,context.user.id,caseId,input);
    } catch(error){return sendAttendanceError(reply,error);}
  });

  app.get<{Params:{caseId:string}}>("/v1/admin/attendance/followups/:caseId/activities",async(request,reply)=>{
    const context=await requireSchoolAdmin(request,reply,accounts);
    if(!context)return;
    try {
      const caseId=z.string().uuid().parse(request.params.caseId);
      const page=followupActivityQuerySchema.parse(request.query);
      return await attendance.listFollowupActivities(context.user.schoolId,caseId,page.limit,page.offset);
    } catch(error){return sendAttendanceError(reply,error);}
  });

  app.post<{Params:{caseId:string}}>("/v1/admin/attendance/followups/:caseId/activities",async(request,reply)=>{
    const context=await requireSchoolAdmin(request,reply,accounts);
    if(!context)return;
    try {
      const caseId=z.string().uuid().parse(request.params.caseId);
      const input=followupActivitySchema.parse(request.body);
      return reply.code(201).send(
        await attendance.recordFollowupActivity(context.user.schoolId,context.user.id,caseId,input)
      );
    } catch(error){return sendAttendanceError(reply,error);}
  });

  app.get("/v1/admin/attendance/audit", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const query = adminAttendanceAuditQuerySchema.parse(request.query);
      reply.header("cache-control", "no-store");
      return await attendance.getAdminAttendanceAudit(context.user.schoolId, query);
    } catch (error) {
      return sendAttendanceError(reply, error);
    }
  });

  app.get("/v1/admin/attendance/students", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const query = adminStudentDirectoryQuerySchema.parse(request.query);
      return await attendance.getAdminStudentAttendanceDirectory(context.user.schoolId, query);
    } catch(error) { return sendAttendanceError(reply,error); }
  });

  app.get<{Params:{studentId:string}}>("/v1/admin/attendance/students/:studentId/history",
    async (request,reply) => {
      const context = await requireSchoolAdmin(request, reply, accounts);
      if (!context) return;
      try {
        const studentId = z.string().uuid().parse(request.params.studentId);
        const query = adminStudentHistoryQuerySchema.parse(request.query);
        return await attendance.getAdminStudentAttendanceHistory(context.user.schoolId, {
          ...query,studentId
        });
      } catch(error) { return sendAttendanceError(reply,error); }
    });

  app.get<{Params:{classId:string}}>("/v1/admin/attendance/classes/:classId/register",
    async (request,reply) => {
      const context = await requireSchoolAdmin(request, reply, accounts);
      if (!context) return;
      try {
        const classId = z.string().uuid().parse(request.params.classId);
        const query = adminClassRegisterQuerySchema.parse(request.query);
        const date = query.date ?? await attendance.getSchoolToday(context.user.schoolId);
        return await attendance.getAdminClassAttendanceRegister(context.user.schoolId, {
          ...query,date,classId
        });
      } catch(error) { return sendAttendanceError(reply,error); }
    });

  app.get("/v1/admin/attendance/monitor", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const query = attendanceMonitoringQuerySchema.parse(request.query);
      const date = query.date ?? await attendance.getSchoolToday(context.user.schoolId);
      return await attendance.getAdminDailyMonitoring(
        context.user.schoolId, query.academicYearId, date, query.classId
      );
    } catch(error) { return sendAttendanceError(reply,error); }
  });

  app.get("/v1/admin/attendance/closures", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const query = attendanceClosureQuerySchema.parse(request.query);
      return { closures: await attendance.getAdminAttendanceClosures(
        context.user.schoolId, query.academicYearId
      ) };
    } catch(error) { return sendAttendanceError(reply,error); }
  });

  app.post("/v1/admin/attendance/closures", async (request, reply) => {
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const input = attendanceClosureCreateSchema.parse(request.body);
      const closure = await attendance.addAdminAttendanceClosure(
        context.user.schoolId, context.user.id, input
      );
      return reply.code(201).send({ closure });
    } catch(error) { return sendAttendanceError(reply,error); }
  });

  app.delete<{Params:{closureId:string}}>("/v1/admin/attendance/closures/:closureId",
    async (request, reply) => {
      const context = await requireSchoolAdmin(request, reply, accounts);
      if (!context) return;
      try {
        const closureId=z.string().uuid().parse(request.params.closureId);
        const removed=await attendance.removeAdminAttendanceClosure(
          context.user.schoolId,context.user.id,closureId
        );
        if(!removed)return reply.code(404).send({error:"not_found",message:"Closure not found."});
        return {removed:true};
      } catch(error) { return sendAttendanceError(reply,error); }
    }
  );

  app.get<{ Querystring: { from?: string; to?: string; classId?: string; academicYearId?: string } }>(
    "/v1/admin/attendance/report",
    async (request, reply) => {
      const context = await requireSchoolAdmin(request, reply, accounts);
      if (!context) return;
      try {
        const query = reportQuerySchema.parse(request.query);
        const today = await attendance.getSchoolToday(context.user.schoolId);
        const to = query.to ?? today;
        const from = query.from ?? to;
        return await attendance.getAdminReport(
          context.user.schoolId,
          from,
          to,
          query.classId,
          query.academicYearId
        );
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
        return result;
      } catch (error) {
        return sendAttendanceError(reply, error);
      }
    }
  );
}
