import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AccountStore } from "@maktablink/database";
import { z, ZodError } from "zod";
import { requireAccess } from "../auth/routes.js";

// The web staff workspace has a separate, least-privilege API surface.
// No school admin endpoints are exposed to staff and no platform mutations exist.
const searchSchema = z.object({
  query: z.string().trim().min(2).max(80),
  group: z.enum(["STUDENT", "PARENT", "TEACHER"]).default("STUDENT"),
  page: z.coerce.number().int().min(1).max(1000).default(1)
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
  app.get("/v1/staff/me", async(request,reply) => {
    reply.header("cache-control","no-store");
    const context=await requireStaff(request,reply,accounts);
    if(!context) return;
    return {
      user: { id:context.user.id,username:context.user.username,role:"SCHOOL_STAFF" as const,
        status:context.user.status },
      school: { id:context.school.id,name:context.school.name,code:context.school.code }
    };
  });
  app.get("/v1/staff/directory", async(request,reply) => {
    reply.header("cache-control","no-store");
    const context=await requireStaff(request,reply,accounts);
    if(!context) return;
    try {
      const filter=searchSchema.parse(request.query);
      const result=await accounts.searchUserDirectory(context.user.schoolId,{
        query:filter.query,group:filter.group,status:"ALL",highlight:"ALL",
        sortBy:"name",order:"asc",page:filter.page,pageSize:10
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
        total:result.total,page:result.page,pages:result.pages,pageSize:10
      };
    } catch(error) {
      if(error instanceof ZodError)
        return reply.code(400).send({error:"validation_error",issues:error.issues});
      throw error;
    }
  });
}
