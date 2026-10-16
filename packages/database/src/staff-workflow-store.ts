import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";
import { auditLogs, notifications, staffMessageDrafts, staffProfiles, staffWorkTasks,
  staffWorkspacePreferences, users } from "./schema.js";

export class StaffWorkflowError extends Error {
  constructor(public readonly statusCode:400|404|409, message:string){super(message);}
}
export type StaffTaskRow = typeof staffWorkTasks.$inferSelect;
export type StaffDraftRow = typeof staffMessageDrafts.$inferSelect;
export type TaskStatus="TODO"|"IN_PROGRESS"|"DONE"|"CANCELLED";
export interface StaffWorkflowStore {
  listTasks(schoolId:string,assigneeId?:string):Promise<StaffTaskRow[]>;
  listStaffDirectory(schoolId:string):Promise<Array<{id:string;fullName:string;employeeCode:string|null}>>;
  createTask(schoolId:string,adminId:string,input:{
    assignedTo:string;title:string;details:string;priority:"LOW"|"NORMAL"|"HIGH";dueDate?:string|null;
  }):Promise<StaffTaskRow>;
  cancelTask(schoolId:string,adminId:string,id:string):Promise<StaffTaskRow>;
  changeTask(schoolId:string,staffId:string,id:string,input:{
    status:"TODO"|"IN_PROGRESS"|"DONE";expectedUpdatedAt:string;
  }):Promise<StaffTaskRow>;
  listDrafts(schoolId:string,authorId?:string):Promise<StaffDraftRow[]>;
  createDraft(schoolId:string,staffId:string,input:{
    title:string;content:string;audienceScope:"SCHOOL"|"ROLE";
    audienceRole?:"TEACHER"|"PARENT"|"STUDENT"|null;
  }):Promise<StaffDraftRow>;
  updateDraft(schoolId:string,staffId:string,id:string,input:{
    title:string;content:string;audienceScope:"SCHOOL"|"ROLE";
    audienceRole?:"TEACHER"|"PARENT"|"STUDENT"|null;expectedUpdatedAt:string;
  }):Promise<StaffDraftRow>;
  submitDraft(schoolId:string,staffId:string,id:string):Promise<StaffDraftRow>;
  decideDraft(schoolId:string,adminId:string,id:string,input:{
    action:"APPROVE"|"REJECT";note:string;
  }):Promise<StaffDraftRow>;
  getPreferences(schoolId:string,staffId:string):Promise<{
    showNotificationBadge:boolean;compactTaskView:boolean;
  }>;
  updatePreferences(schoolId:string,staffId:string,input:{
    showNotificationBadge:boolean;compactTaskView:boolean;
  }):Promise<{showNotificationBadge:boolean;compactTaskView:boolean}>;
}

export function createStaffWorkflowStore(db:FoundationDatabase):StaffWorkflowStore {
  const fail=(message:string)=>new StaffWorkflowError(409,message);
  const notFound=()=>new StaffWorkflowError(404,"Staff record was not found.");
  const nextDate=(previous:Date)=>new Date(Math.max(Date.now(),previous.getTime()+1));
  function audit(tx:Parameters<Parameters<FoundationDatabase["transaction"]>[0]>[0],
    schoolId:string,actorUserId:string,action:string,entityType:string,entityId:string,
    metadata:Record<string,unknown>={}){
    return tx.insert(auditLogs).values({id:randomUUID(),schoolId,actorUserId,
      action,entityType,entityId,metadata});
  }
  async function notify(tx:Parameters<Parameters<FoundationDatabase["transaction"]>[0]>[0],
    schoolId:string,userId:string,dedupKey:string,title:string,message:string,deepLink:string){
    await tx.insert(notifications).values({id:randomUUID(),schoolId,userId,
      dedupKey,type:"STAFF_WORKFLOW",title,message,deepLink,deliveryStatus:"PENDING"
    }).onConflictDoNothing();
  }
  return {
    async listTasks(schoolId,assigneeId){
      return db.select().from(staffWorkTasks).where(and(
        eq(staffWorkTasks.schoolId,schoolId),
        ...(assigneeId?[eq(staffWorkTasks.assignedTo,assigneeId)]:[])
      )).orderBy(asc(staffWorkTasks.dueDate),desc(staffWorkTasks.createdAt)).limit(150);
    },
    async listStaffDirectory(schoolId){
      const rows=await db.select({id:users.id,fullName:staffProfiles.fullName,
        employeeCode:staffProfiles.employeeCode,permissions:staffProfiles.permissions}).from(staffProfiles)
        .innerJoin(users,and(eq(users.schoolId,staffProfiles.schoolId),
          eq(users.id,staffProfiles.userId)))
        .where(and(eq(staffProfiles.schoolId,schoolId),eq(users.role,"SCHOOL_STAFF"),
          eq(users.status,"ACTIVE")))
        .orderBy(asc(staffProfiles.fullName)).limit(150);
      return rows.filter(row=>Array.isArray(row.permissions)&&row.permissions.includes("TASKS_VIEW"))
        .map(({id,fullName,employeeCode})=>({id,fullName,employeeCode}));
    },
    async createTask(schoolId,adminId,input){
      return db.transaction(async tx=>{
        const [staff]=await tx.select({role:users.role,status:users.status,
          permissions:staffProfiles.permissions}).from(users)
          .innerJoin(staffProfiles,and(eq(staffProfiles.schoolId,users.schoolId),
            eq(staffProfiles.userId,users.id)))
          .where(and(eq(users.schoolId,schoolId),eq(users.id,input.assignedTo))).limit(1);
        if(!staff||staff.role!=="SCHOOL_STAFF"||staff.status!=="ACTIVE"||
          !Array.isArray(staff.permissions)||!staff.permissions.includes("TASKS_VIEW"))
          throw new StaffWorkflowError(400,"Choose an active staff member with tasks permission.");
        const [task]=await tx.insert(staffWorkTasks).values({
          id:randomUUID(),schoolId,assignedTo:input.assignedTo,createdBy:adminId,
          title:input.title,details:input.details,priority:input.priority,dueDate:input.dueDate??null
        }).returning();
        if(!task)throw Error("Task creation failed.");
        await audit(tx,schoolId,adminId,"staff_task.assigned","staff_task",task.id,{
          assigneeId:task.assignedTo,priority:task.priority,dueDate:task.dueDate});
        await notify(tx,schoolId,task.assignedTo,`staff-task:${task.id}`,
          "New assigned task",task.title,"/staff/dashboard");
        return task;
      });
    },
    async cancelTask(schoolId,adminId,id){
      return db.transaction(async tx=>{
        const [current]=await tx.select().from(staffWorkTasks).where(and(
          eq(staffWorkTasks.id,id),eq(staffWorkTasks.schoolId,schoolId))).limit(1).for("update");
        if(!current)throw notFound();
        if(current.status==="CANCELLED")throw fail("This task has already been cancelled.");
        const [updated]=await tx.update(staffWorkTasks).set({
          status:"CANCELLED",completedAt:null,updatedAt:nextDate(current.updatedAt)
        }).where(and(eq(staffWorkTasks.schoolId,schoolId),eq(staffWorkTasks.id,id),
          eq(staffWorkTasks.updatedAt,current.updatedAt))).returning();
        if(!updated)throw fail("Task changed during cancellation.");
        await audit(tx,schoolId,adminId,"staff_task.cancelled","staff_task",id);
        await notify(tx,schoolId,current.assignedTo,`staff-task-cancelled:${id}`,
          "Task cancelled",current.title,"/staff/dashboard");
        return updated;
      });
    },
    async changeTask(schoolId,staffId,id,input){
      return db.transaction(async tx=>{
        const [current]=await tx.select().from(staffWorkTasks)
          .where(and(eq(staffWorkTasks.id,id),eq(staffWorkTasks.schoolId,schoolId),
            eq(staffWorkTasks.assignedTo,staffId))).limit(1).for("update");
        if(!current)throw notFound();
        if(current.updatedAt.toISOString()!==input.expectedUpdatedAt)throw fail("Task changed. Refresh before saving.");
        if(current.status==="CANCELLED")throw fail("Cancelled tasks cannot be changed.");
        if(current.status===input.status)throw fail("Choose a new task status.");
        const [updated]=await tx.update(staffWorkTasks).set({
          status:input.status,completedAt:input.status==="DONE"?new Date():null,
          updatedAt:nextDate(current.updatedAt)
        }).where(and(eq(staffWorkTasks.id,id),eq(staffWorkTasks.schoolId,schoolId),
          eq(staffWorkTasks.assignedTo,staffId),eq(staffWorkTasks.updatedAt,current.updatedAt)))
          .returning();
        if(!updated)throw fail("Task changed while saving.");
        await audit(tx,schoolId,staffId,"staff_task.status_changed","staff_task",id,{
          from:current.status,to:updated.status});
        await notify(tx,schoolId,current.createdBy,`staff-task-update:${id}:${updated.updatedAt.getTime()}`,
          "Staff task updated",current.title+" — "+updated.status,"/admin");
        return updated;
      });
    },
    async listDrafts(schoolId,authorId){
      return db.select().from(staffMessageDrafts).where(and(
        eq(staffMessageDrafts.schoolId,schoolId),
        ...(authorId?[eq(staffMessageDrafts.createdBy,authorId)]:[])
      )).orderBy(desc(staffMessageDrafts.createdAt)).limit(150);
    },
    async createDraft(schoolId,staffId,input){
      return db.transaction(async tx=>{
        const [draft]=await tx.insert(staffMessageDrafts).values({
          id:randomUUID(),schoolId,createdBy:staffId,
          title:input.title,content:input.content,
          audienceScope:input.audienceScope,
          audienceRole:input.audienceScope==="ROLE"?(input.audienceRole??null):null
        }).returning();
        if(!draft)throw Error("Could not create communication draft.");
        await audit(tx,schoolId,staffId,"staff_message.draft_created","staff_message_draft",draft.id);
        return draft;
      });
    },
    async updateDraft(schoolId,staffId,id,input){
      return db.transaction(async tx=>{
        const [draft]=await tx.select().from(staffMessageDrafts).where(and(
          eq(staffMessageDrafts.id,id),eq(staffMessageDrafts.schoolId,schoolId),
          eq(staffMessageDrafts.createdBy,staffId))).limit(1).for("update");
        if(!draft)throw notFound();
        if(!["DRAFT","REJECTED"].includes(draft.status))throw fail("Only draft or rejected messages can be edited.");
        if(draft.updatedAt.toISOString()!==input.expectedUpdatedAt)throw fail("Draft has changed. Refresh before editing.");
        const [saved]=await tx.update(staffMessageDrafts).set({
          title:input.title,content:input.content,audienceScope:input.audienceScope,
          audienceRole:input.audienceScope==="ROLE"?(input.audienceRole??null):null,
          status:"DRAFT",reviewedBy:null,reviewedAt:null,reviewNote:null,
          updatedAt:nextDate(draft.updatedAt)
        }).where(and(eq(staffMessageDrafts.id,id),eq(staffMessageDrafts.schoolId,schoolId),
          eq(staffMessageDrafts.updatedAt,draft.updatedAt))).returning();
        if(!saved)throw fail("Draft changed during save.");
        await audit(tx,schoolId,staffId,"staff_message.draft_updated","staff_message_draft",id);
        return saved;
      });
    },
    async submitDraft(schoolId,staffId,id){
      return db.transaction(async tx=>{
        const [draft]=await tx.update(staffMessageDrafts)
          .set({status:"SUBMITTED",reviewNote:null,reviewedBy:null,reviewedAt:null,
            updatedAt:new Date()})
          .where(and(eq(staffMessageDrafts.id,id),eq(staffMessageDrafts.schoolId,schoolId),
            eq(staffMessageDrafts.createdBy,staffId),eq(staffMessageDrafts.status,"DRAFT")))
          .returning();
        if(!draft)throw fail("Only your saved drafts can be submitted.");
        await audit(tx,schoolId,staffId,"staff_message.submitted","staff_message_draft",id);
        const admins=await tx.select({id:users.id}).from(users).where(and(
          eq(users.schoolId,schoolId),eq(users.role,"SCHOOL_ADMIN"),eq(users.status,"ACTIVE")));
        for(const admin of admins){
          await notify(tx,schoolId,admin.id,`staff-message:${draft.id}:${draft.updatedAt.getTime()}:${admin.id}`,
            "Staff message needs review",draft.title,"/admin");
        }
        return draft;
      });
    },
    async decideDraft(schoolId,adminId,id,input){
      return db.transaction(async tx=>{
        const [draft]=await tx.update(staffMessageDrafts)
          .set({status:input.action==="APPROVE"?"APPROVED":"REJECTED",
            reviewedBy:adminId,reviewNote:input.note,reviewedAt:new Date(),updatedAt:new Date()})
          .where(and(eq(staffMessageDrafts.schoolId,schoolId),
            eq(staffMessageDrafts.id,id),eq(staffMessageDrafts.status,"SUBMITTED"))).returning();
        if(!draft)throw fail("This communication request is no longer awaiting review.");
        await audit(tx,schoolId,adminId,"staff_message.reviewed","staff_message_draft",draft.id,{
          status:draft.status,authorId:draft.createdBy
        });
        await notify(tx,schoolId,draft.createdBy,`staff-message-review:${draft.id}:${draft.reviewedAt?.getTime() ?? draft.updatedAt.getTime()}`,
          "Communication draft reviewed",draft.title+" — "+draft.status,"/staff/dashboard");
        // APPROVED means admin reviewed the copy; it is NOT published or sent.
        // Only the separately authorized admin announcement workflow may publish.
        return draft;
      });
    },
    async getPreferences(schoolId,staffId){
      const [row]=await db.select().from(staffWorkspacePreferences)
        .where(and(eq(staffWorkspacePreferences.schoolId,schoolId),
          eq(staffWorkspacePreferences.userId,staffId))).limit(1);
      return {showNotificationBadge:row?.showNotificationBadge??true,
        compactTaskView:row?.compactTaskView??false};
    },
    async updatePreferences(schoolId,staffId,input){
      const [row]=await db.insert(staffWorkspacePreferences).values({
        schoolId,userId:staffId,...input
      }).onConflictDoUpdate({
        target:[staffWorkspacePreferences.schoolId,staffWorkspacePreferences.userId],
        set:{...input,updatedAt:new Date()}
      }).returning();
      if(!row)throw Error("Could not update workspace settings.");
      return {showNotificationBadge:row.showNotificationBadge,compactTaskView:row.compactTaskView};
    }
  };
}
