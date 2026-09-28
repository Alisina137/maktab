import cors from "@fastify/cors";
import Fastify from "fastify";
import type { AcademicStore, AccountStore, AttendanceStore, FamilyStore, PlatformSchoolStore } from "@maktablink/database";
import { registerAcademicRoutes } from "./academics/routes.js";
import { registerAttendanceRoutes } from "./attendance/routes.js";
import { LoginRateLimiter } from "./auth/rate-limit.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { registerFamilyRoutes } from "./families/routes.js";
import { registerPlatformRoutes } from "./platform/routes.js";
import { registerPublicRoutes } from "./public/routes.js";
import { registerUserRoutes } from "./users/routes.js";

export interface BuildAppOptions {
  schoolStore: PlatformSchoolStore;
  accountStore: AccountStore;
  academicStore: AcademicStore;
  familyStore: FamilyStore;
  attendanceStore: AttendanceStore;
  provisioningKey: string;
  webOrigin?: string;
}

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: false });
  const webOrigin = options.webOrigin ?? "http://localhost:3000";

  void app.register(cors, {
    origin: [webOrigin, "http://127.0.0.1:3000"],
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-platform-provisioning-key"]
  });

  app.get("/health", async () => ({ status: "ok", service: "maktablink-api", phase: 5 }));

  const loginLimiter = new LoginRateLimiter();
  registerPublicRoutes(app, options.schoolStore);
  registerAuthRoutes(app, options.accountStore, loginLimiter);
  registerUserRoutes(app, options.accountStore);
  registerAcademicRoutes(app, options.accountStore, options.academicStore);
  registerFamilyRoutes(app, options.accountStore, options.academicStore, options.familyStore);
  registerAttendanceRoutes(app, options.accountStore, options.attendanceStore);
  registerPlatformRoutes(app, options.schoolStore, options.accountStore, options.provisioningKey);

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    return reply.code(500).send({ error: "internal_error", message: "An unexpected server error occurred." });
  });

  return app;
}
