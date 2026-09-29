import type { FastifyInstance } from "fastify";
import type { PlatformSchoolStore } from "@maktablink/database";

export function registerPublicRoutes(app: FastifyInstance, schools: PlatformSchoolStore) {
  app.get<{ Querystring: { q?: string } }>("/v1/public/schools", async (request) => ({
    schools: await schools.listPublicSchools(request.query.q)
  }));

  app.get<{ Params: { schoolId: string } }>("/v1/public/schools/:schoolId", async (request, reply) => {
    const context = await schools.getSchoolContext(request.params.schoolId);
    if (!context || context.school.status !== "ACTIVE") {
      return reply.code(404).send({ error: "not_found", message: "School not found." });
    }
    return {
      school: {
        id: context.school.id,
        code: context.school.code,
        name: context.school.name,
        province: context.school.province,
        city: context.school.city,
        imageUrl: context.school.imageUrl,
        defaultLanguage: context.settings.defaultLanguage
      }
    };
  });
}
