import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { STAFF_PERMISSIONS, STAFF_POSITIONS,
  hasStaffPermission, type AccountStore } from "@maktablink/database";
import { z, ZodError } from "zod";
import { requireAccess } from "../auth/routes.js";
import { requireSchoolAdmin } from "../users/routes.js";

// The web staff workspace has a separate, least-privilege API surface.
// No school admin endpoints are exposed to staff and no platform mutations exist.
const searchSchema = z.object({
  query: z.string().trim().min(2).max(80),
  group: z.enum(["STUDENT", "PARENT", "TEACHER"]).default("STUDENT"),
  status: z.enum(["ALL","ACTIVE","INVITED","SUSPENDED","ARCHIVED"]).default("ALL"),
  sortBy: z.enum(["name","username"]).default("name"),
  order: z.enum(["asc","desc"]).default("asc"),
  pageSize: z.coerce.number().int().refine(value=>[10,20].includes(value)).default(10),
  page: z.coerce.number().int().min(1).max(1000).default(1)
}).strict();

const staffProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  employeeCode: z.string().trim().min(2).max(32)
    .regex(/^[A-Za-z0-9_-]+$/).nullable(),
  position: z.enum(STAFF_POSITIONS),
  department: z.string().trim().min(2).max(100),
  permissions: z.array(z.enum(STAFF_PERMISSIONS)).max(STAFF_PERMISSIONS.length)
    .refine(values => new Set(values).size === values.length, "Duplicate permission grants")
}).strict();

async function requireStaff(request: FastifyRequest, reply: FastifyReply, accounts: AccountStore) {
  const context = await requireAccess(request, reply, accounts);
  if (!context) return null;
  if (context.user.role !== "SCHOOL_STAFF") {
    await reply.code(403).send({ error:"forbidden", message:"School staff credentials are required." });
    return null;
  }
  if (context.user.mustChangePassword) {
    await reply.code(403).send({
      error:"password_change_required",
      message:"Change your temporary password before opening staff records."
    });
    return null;
  }
  if (context.user.status !== "ACTIVE") {
    await reply.code(403).send({
      error:"account_unavailable",
      message:"An active staff account is required."
    });
    return null;
  }
  return context;
}

export function registerStaffRoutes(app: FastifyInstance, accounts: AccountStore) {
  // Administrator-only staff profile management. This never inherits admin
  // privileges for staff users and cannot cross school boundaries.
  app.get<{Params:{userId:string}}>("/v1/admin/staff/:userId/profile", async(request, reply) => {
    reply.header("cache-control", "no-store");
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    const checked = z.string().uuid().safeParse(request.params.userId);
    if (!checked.success) return reply.code(400).send({error:"validation_error"});
    const user = await accounts.findUserById(context.user.schoolId, checked.data);
    if (!user || user.role !== "SCHOOL_STAFF")
      return reply.code(404).send({error:"not_found"});
    const profile = await accounts.getStaffProfile(context.user.schoolId, user.id);
    return { profile, permissionCatalog: STAFF_PERMISSIONS, positionCatalog: STAFF_POSITIONS };
  });
  app.put<{Params:{userId:string}}>("/v1/admin/staff/:userId/profile", async(request, reply) => {
    reply.header("cache-control", "no-store");
    const context = await requireSchoolAdmin(request, reply, accounts);
    if (!context) return;
    try {
      const userId = z.string().uuid().parse(request.params.userId);
      const input = staffProfileSchema.parse(request.body);
      const profile = await accounts.upsertStaffProfile(context.user.schoolId, userId,
        input, context.user.id);
      if (!profile) return reply.code(404).send({ error:"not_found" });
      return { profile };
    } catch(error) {
      if (error instanceof ZodError)
        return reply.code(400).send({error:"validation_error",issues:error.issues});
      if (error && typeof error === "object" && "code" in error &&
          error.code === "23505")
        return reply.code(409).send({error:"employee_code_conflict",
          message:"Employee code already exists in this school."});
      throw error;
    }
  });

  app.get("/v1/staff/me", async(request,reply) => {
    reply.header("cache-control","no-store");
    const context=await requireStaff(request,reply,accounts);
    if(!context) return;
    return {
      user: { id:context.user.id,username:context.user.username,role:"SCHOOL_STAFF" as const,
        status:context.user.status },
      school: { id:context.school.id,name:context.school.name,code:context.school.code },
      profile: await accounts.getStaffProfile(context.user.schoolId, context.user.id)
    };
  });
  app.get("/v1/staff/directory", async(request,reply) => {
    reply.header("cache-control","no-store");
    const context=await requireStaff(request,reply,accounts);
    if(!context) return;
    const profile = await accounts.getStaffProfile(context.user.schoolId, context.user.id);
    if (!hasStaffPermission(profile?.permissions, "DIRECTORY_VIEW"))
      return reply.code(403).send({error:"permission_denied",
        message:"Ask your school administrator for directory access."});
    try {
      const filter=searchSchema.parse(request.query);
      const result=await accounts.searchUserDirectory(context.user.schoolId,{
        query:filter.query,group:filter.group,status:filter.status,highlight:"ALL",
        sortBy:filter.sortBy,order:filter.order,page:filter.page,pageSize:filter.pageSize,
        safeStaffSearch:true
      });
      // Important: do not serialize full User records (password hash, session,
      // profile phone, family relationships) to this staff-only directory.
      return {
        entries:result.entries
          .filter(entry=>entry.user.role===filter.group)
          .map(entry=>({
            username:entry.user.username,
            fullName:entry.profile.fullName || entry.user.username,
            code:entry.profile.code,
            role:entry.user.role,
            status:entry.user.status
          })),
        total:result.total,page:result.page,pages:result.pages,pageSize:result.pageSize
      };
    } catch(error) {
      if(error instanceof ZodError)
        return reply.code(400).send({error:"validation_error",issues:error.issues});
      throw error;
    }
  });
}
