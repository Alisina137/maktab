import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AccountStore, AttendanceStore, StaffAttendanceCorrectionStore } from "@maktablink/database";
import { StaffAttendanceCorrectionError, hasStaffPermission } from "@maktablink/database";
import { z, ZodError } from "zod";
import { requireAccess } from "../auth/routes.js";
import { requireSchoolAdmin } from "../users/routes.js";

const correctionInput=z.object({
  attendanceId:z.string().uuid(),studentId:z.string().uuid(),
  requestedStatus:z.enum(["PRESENT","ABSENT","LATE","EXCUSED"]),
  expectedUpdatedAt:z.string().datetime(),
  reason:z.string().trim().min(10).max(500)
}).strict();
const decisionInput=z.discriminatedUnion("action",[
  z.object({action:z.literal("APPROVE"),note:z.string().trim().max(500).default("")}).strict(),
  z.object({action:z.literal("REJECT"),note:z.string().trim().min(3).max(500)}).strict()
]);
const idParam=z.object({id:z.string().uuid()}).strict();
const reportQuery=z.object({
  from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  classId:z.string().uuid().optional(),
  academicYearId:z.string().uuid().optional(),
  offset:z.coerce.number().int().min(0).max(10000).default(0)
}).strict();

function validDay(day:string):boolean{
  const time=new Date(day+"T12:00:00Z");
  return Number.isFinite(time.getTime())&&time.toISOString().slice(0,10)===day;
}
function fail(reply:FastifyReply,error:unknown){
  if(error instanceof ZodError)return reply.code(400).send({
    error:"validation_error",message:"Check attendance request fields.",issues:error.issues
  });
  if(error instanceof StaffAttendanceCorrectionError)return reply.code(error.statusCode).send({
    error:"attendance_correction_error",message:error.message
  });
  throw error;
}
async function requireAttendanceStaff(request:FastifyRequest,reply:FastifyReply,accounts:AccountStore){
  const ctx=await requireAccess(request,reply,accounts);
  if(!ctx)return null;
  if(ctx.user.role!=="SCHOOL_STAFF"||ctx.user.mustChangePassword||ctx.user.status!=="ACTIVE"){
    await reply.code(403).send({error:"forbidden",message:"An active staff account is required."});
    return null;
  }
  const profile=await accounts.getStaffProfile(ctx.user.schoolId,ctx.user.id);
  if(!hasStaffPermission(profile?.permissions,"ATTENDANCE_REVIEW")){
    await reply.code(403).send({error:"permission_denied",message:"Attendance review permission required."});
    return null;
  }
  return ctx;
}
export function registerStaffAttendanceRoutes(
  app:FastifyInstance,accounts:AccountStore,attendance:AttendanceStore,
  corrections:StaffAttendanceCorrectionStore
):void{
  app.get("/v1/staff/attendance/report",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const ctx=await requireAttendanceStaff(request,reply,accounts);if(!ctx)return;
    try{
      const query=reportQuery.parse(request.query);
      const today=await attendance.getSchoolToday(ctx.user.schoolId);
      const to=query.to??today,from=query.from??to;
      if(!validDay(from)||!validDay(to)||from>to||to>today||
         (Date.parse(to+"T12:00:00Z")-Date.parse(from+"T12:00:00Z"))/86400000>6)
        return reply.code(400).send({error:"validation_error",message:"Select up to 7 valid school days, not in the future."});
      const report=await attendance.getAdminReport(ctx.user.schoolId,from,to,query.classId,query.academicYearId);
      return {
        from,to,today,summary:report.summary,total:report.rows.length,
        offset:query.offset,hasMore:query.offset+50<report.rows.length,
        rows:report.rows.slice(query.offset,query.offset+50).map(row=>({
          attendanceId:row.attendanceId,studentId:row.studentId,
          studentName:row.studentName,studentCode:row.studentCode,
          className:row.className,classId:row.classId,date:row.date,
          status:row.status,updatedAt:row.updatedAt
        }))
      };
    }catch(error){return fail(reply,error);}
  });
  app.get("/v1/staff/attendance/requests",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const ctx=await requireAttendanceStaff(request,reply,accounts);if(!ctx)return;
    return {requests:await corrections.list(ctx.user.schoolId,ctx.user.id)};
  });
  app.post("/v1/staff/attendance/requests",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const ctx=await requireAttendanceStaff(request,reply,accounts);if(!ctx)return;
    try{
      const row=await corrections.create(ctx.user.schoolId,ctx.user.id,correctionInput.parse(request.body));
      await accounts.writeAudit({schoolId:ctx.user.schoolId,actorUserId:ctx.user.id,
        action:"attendance.staff_correction_requested",entityType:"daily_attendance",
        entityId:row.attendanceId,metadata:{requestId:row.id,studentId:row.studentId}});
      return reply.code(201).send({request:row});
    }catch(error){return fail(reply,error);}
  });
  app.get("/v1/admin/staff-attendance/requests",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const ctx=await requireSchoolAdmin(request,reply,accounts);if(!ctx)return;
    return {requests:await corrections.list(ctx.user.schoolId)};
  });
  app.post<{Params:{id:string}}>("/v1/admin/staff-attendance/requests/:id/decision",
    async(request,reply)=>{
      reply.header("cache-control","no-store");
      const ctx=await requireSchoolAdmin(request,reply,accounts);if(!ctx)return;
      try{
        const {id}=idParam.parse(request.params);
        const row=await corrections.decide(ctx.user.schoolId,id,ctx.user.id,
          decisionInput.parse(request.body));
        return {request:row};
      }catch(error){return fail(reply,error);}
    });
}
