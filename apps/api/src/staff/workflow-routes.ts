import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { hasStaffPermission, StaffWorkflowError,
  type AccountStore, type CommunicationStore, type StaffWorkflowStore } from "@maktablink/database";
import { requireAccess } from "../auth/routes.js";
import { requireSchoolAdmin } from "../users/routes.js";

const uuid=z.string().uuid();
const idParam=z.object({id:uuid}).strict();
const taskCreate=z.object({
  assignedTo:uuid,title:z.string().trim().min(3).max(160),
  details:z.string().trim().max(2000).default(""),
  priority:z.enum(["LOW","NORMAL","HIGH"]).default("NORMAL"),
  dueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(value=>{const day=new Date(value+"T12:00:00Z");
      return !Number.isNaN(day.getTime())&&day.toISOString().slice(0,10)===value;
    },"Use a real calendar date.").nullable().optional()
}).strict();
const taskUpdate=z.object({
  status:z.enum(["TODO","IN_PROGRESS","DONE"]),
  expectedUpdatedAt:z.string().datetime({offset:true})
}).strict();
const draftFields=z.object({
  title:z.string().trim().min(3).max(160),
  content:z.string().trim().min(5).max(5000),
  audienceScope:z.enum(["SCHOOL","ROLE"]),
  audienceRole:z.enum(["TEACHER","PARENT","STUDENT"]).nullable().optional()
}).strict();
const draftBody=draftFields.superRefine((body,ctx)=>{
  if(body.audienceScope==="ROLE"&&!body.audienceRole)
    ctx.addIssue({code:"custom",message:"Select an audience role.",path:["audienceRole"]});
  if(body.audienceScope==="SCHOOL"&&body.audienceRole)
    ctx.addIssue({code:"custom",message:"School-wide messages cannot select a role.",path:["audienceRole"]});
});
const draftEdit=draftFields.extend({
  expectedUpdatedAt:z.string().datetime({offset:true})
}).superRefine((body,ctx)=>{
  if(body.audienceScope==="ROLE"&&!body.audienceRole)
    ctx.addIssue({code:"custom",message:"Select an audience role.",path:["audienceRole"]});
  if(body.audienceScope==="SCHOOL"&&body.audienceRole)
    ctx.addIssue({code:"custom",message:"School-wide messages cannot select a role.",path:["audienceRole"]});
});
const decision=z.discriminatedUnion("action",[
  z.object({action:z.literal("APPROVE"),note:z.string().trim().max(500).default("")}).strict(),
  z.object({action:z.literal("REJECT"),note:z.string().trim().min(3).max(500)}).strict()
]);
const preferences=z.object({
  showNotificationBadge:z.boolean(),compactTaskView:z.boolean()
}).strict();
function sendError(reply:FastifyReply,error:unknown){
  if(error instanceof ZodError)return reply.code(400).send({error:"validation_error",issues:error.issues});
  if(error instanceof StaffWorkflowError)return reply.code(error.statusCode).send({
    error:"staff_workflow_error",message:error.message
  });
  throw error;
}
async function staffSession(request:FastifyRequest,reply:FastifyReply,accounts:AccountStore){
  const ctx=await requireAccess(request,reply,accounts);
  if(!ctx)return null;
  if(ctx.user.role!=="SCHOOL_STAFF"||ctx.user.mustChangePassword||ctx.user.status!=="ACTIVE"){
    await reply.code(403).send({error:"forbidden",message:"An active school staff account is required."});
    return null;
  }
  const profile=await accounts.getStaffProfile(ctx.user.schoolId,ctx.user.id);
  return {ctx,permissions:profile?.permissions??[]};
}
function allow(reply:FastifyReply,permissions:unknown,permission:"TASKS_VIEW"|"COMMUNICATION_DRAFT"){
  if(hasStaffPermission(permissions,permission))return true;
  void reply.code(403).send({error:"permission_denied",message:"Your administrator has not granted this permission."});
  return false;
}
export function registerStaffWorkflowRoutes(
  app:FastifyInstance,accounts:AccountStore,communication:CommunicationStore,workflow:StaffWorkflowStore
):void{
  app.get("/v1/staff/tasks",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const actor=await staffSession(request,reply,accounts);if(!actor)return;
    if(!allow(reply,actor.permissions,"TASKS_VIEW"))return;
    return {tasks:await workflow.listTasks(actor.ctx.user.schoolId,actor.ctx.user.id)};
  });
  app.patch<{Params:{id:string}}>("/v1/staff/tasks/:id",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const actor=await staffSession(request,reply,accounts);if(!actor)return;
    if(!allow(reply,actor.permissions,"TASKS_VIEW"))return;
    try{
      const {id}=idParam.parse(request.params),body=taskUpdate.parse(request.body);
      return {task:await workflow.changeTask(actor.ctx.user.schoolId,actor.ctx.user.id,id,body)};
    }catch(error){return sendError(reply,error);}
  });
  app.get("/v1/admin/staff-work/tasks",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const actor=await requireSchoolAdmin(request,reply,accounts);if(!actor)return;
    return {tasks:await workflow.listTasks(actor.user.schoolId),
      staff:await workflow.listStaffDirectory(actor.user.schoolId)};
  });
  app.post("/v1/admin/staff-work/tasks",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const actor=await requireSchoolAdmin(request,reply,accounts);if(!actor)return;
    try{
      const task=await workflow.createTask(actor.user.schoolId,actor.user.id,taskCreate.parse(request.body));
      return reply.code(201).send({task});
    }catch(error){return sendError(reply,error);}
  });

  app.get("/v1/staff/message-drafts",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const actor=await staffSession(request,reply,accounts);if(!actor)return;
    if(!allow(reply,actor.permissions,"COMMUNICATION_DRAFT"))return;
    return {drafts:await workflow.listDrafts(actor.ctx.user.schoolId,actor.ctx.user.id)};
  });
  app.post("/v1/staff/message-drafts",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const actor=await staffSession(request,reply,accounts);if(!actor)return;
    if(!allow(reply,actor.permissions,"COMMUNICATION_DRAFT"))return;
    try{
      const draft=await workflow.createDraft(actor.ctx.user.schoolId,actor.ctx.user.id,draftBody.parse(request.body));
      return reply.code(201).send({draft});
    }catch(error){return sendError(reply,error);}
  });
  app.put<{Params:{id:string}}>("/v1/staff/message-drafts/:id",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const actor=await staffSession(request,reply,accounts);if(!actor)return;
    if(!allow(reply,actor.permissions,"COMMUNICATION_DRAFT"))return;
    try{
      const {id}=idParam.parse(request.params);
      const draft=await workflow.updateDraft(actor.ctx.user.schoolId,actor.ctx.user.id,id,draftEdit.parse(request.body));
      return {draft};
    }catch(error){return sendError(reply,error);}
  });
  app.post<{Params:{id:string}}>("/v1/staff/message-drafts/:id/submit",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const actor=await staffSession(request,reply,accounts);if(!actor)return;
    if(!allow(reply,actor.permissions,"COMMUNICATION_DRAFT"))return;
    try{
      const {id}=idParam.parse(request.params);
      return {draft:await workflow.submitDraft(actor.ctx.user.schoolId,actor.ctx.user.id,id)};
    }catch(error){return sendError(reply,error);}
  });
  app.get("/v1/admin/staff-work/drafts",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const actor=await requireSchoolAdmin(request,reply,accounts);if(!actor)return;
    return {drafts:await workflow.listDrafts(actor.user.schoolId)};
  });
  app.post<{Params:{id:string}}>("/v1/admin/staff-work/drafts/:id/decision",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const actor=await requireSchoolAdmin(request,reply,accounts);if(!actor)return;
    try{
      const {id}=idParam.parse(request.params);
      return {draft:await workflow.decideDraft(actor.user.schoolId,actor.user.id,id,decision.parse(request.body))};
    }catch(error){return sendError(reply,error);}
  });

  // Staff notifications belong to the current user only. No arbitrary recipient IDs.
  app.get("/v1/staff/work-notifications",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const actor=await staffSession(request,reply,accounts);if(!actor)return;
    const items=(await communication.getUserNotifications(actor.ctx.user.schoolId,actor.ctx.user.id))
      .filter(item=>item.type==="STAFF_WORKFLOW").slice(0,80)
      .map(item=>({id:item.id,title:item.title,message:item.message,
        readAt:item.readAt,createdAt:item.createdAt}));
    return {notifications:items,unreadCount:items.filter(item=>!item.readAt).length};
  });
  app.post<{Params:{id:string}}>("/v1/staff/work-notifications/:id/read",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const actor=await staffSession(request,reply,accounts);if(!actor)return;
    try{
      const {id}=idParam.parse(request.params);
      const list=await communication.getUserNotifications(actor.ctx.user.schoolId,actor.ctx.user.id);
      if(!list.some(row=>row.id===id&&row.type==="STAFF_WORKFLOW"))
        return reply.code(404).send({error:"not_found"});
      const notification=await communication.markNotificationRead(actor.ctx.user.schoolId,actor.ctx.user.id,id);
      return {readAt:notification?.readAt};
    }catch(error){return sendError(reply,error);}
  });
  app.get("/v1/staff/work-preferences",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const actor=await staffSession(request,reply,accounts);if(!actor)return;
    return {preferences:await workflow.getPreferences(actor.ctx.user.schoolId,actor.ctx.user.id)};
  });
  app.put("/v1/staff/work-preferences",async(request,reply)=>{
    reply.header("cache-control","no-store");
    const actor=await staffSession(request,reply,accounts);if(!actor)return;
    try{
      const body=preferences.parse(request.body);
      return {preferences:await workflow.updatePreferences(actor.ctx.user.schoolId,actor.ctx.user.id,body)};
    }catch(error){return sendError(reply,error);}
  });
}
