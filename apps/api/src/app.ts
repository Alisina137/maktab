import cors from "@fastify/cors";
import Fastify from "fastify";
import type { AcademicStore, AccountStore, AttendanceStore, CommunicationStore, FamilyStore, LearningStore, PilotStore, PlatformSchoolStore, PushProvider } from "@maktablink/database";
import { registerAcademicRoutes } from "./academics/routes.js";
import { registerAttendanceRoutes } from "./attendance/routes.js";
import { LoginRateLimiter } from "./auth/rate-limit.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { registerFamilyRoutes } from "./families/routes.js";
import { registerCommunicationRoutes } from "./communication/routes.js";
import { registerLearningRoutes } from "./learning/routes.js";
import { registerPilotRoutes } from "./pilot/routes.js";
import { registerPlatformRoutes } from "./platform/routes.js";
import { registerPublicRoutes } from "./public/routes.js";
import { registerUserRoutes } from "./users/routes.js";

export interface BuildAppOptions {
  schoolStore: PlatformSchoolStore;
  accountStore: AccountStore;
  academicStore: AcademicStore;
  familyStore: FamilyStore;
  attendanceStore: AttendanceStore;
  learningStore: LearningStore;
  communicationStore: CommunicationStore;
  pilotStore: PilotStore;
  pushProvider: PushProvider;
  provisioningKey: string;
  webOrigin?: string;
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: options.logger ?? false });
  const webOrigin = options.webOrigin ?? "http://localhost:3000";

  void app.register(cors, {
    origin: [webOrigin, "http://127.0.0.1:3000"],
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-platform-provisioning-key"],
    exposedHeaders: ["x-request-id"]
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  app.addHook("onResponse", async (request, reply) => {
    app.log.info({
      event: "http_request_completed",
      requestId: request.id,
      method: request.method,
      route: request.routeOptions.url,
      statusCode: reply.statusCode
    });
  });

  app.get("/health", async () => ({ status: "ok", service: "maktablink-api", phase: 8 }));
  app.get("/ready", async (_request, reply) => {
    const ready = await options.schoolStore.healthCheck();
    return reply.code(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      service: "maktablink-api",
      database: ready ? "ok" : "unavailable"
    });
  });

  const loginLimiter = new LoginRateLimiter();
  registerPublicRoutes(app, options.schoolStore);
  registerAuthRoutes(app, options.accountStore, loginLimiter);
  registerUserRoutes(app, options.accountStore);
  registerAcademicRoutes(app, options.accountStore, options.academicStore);
  registerFamilyRoutes(app, options.accountStore, options.academicStore, options.familyStore);
  registerAttendanceRoutes(app, options.accountStore, options.attendanceStore);
  registerLearningRoutes(app, options.accountStore, options.learningStore);
  registerPilotRoutes(app, options.accountStore, options.pilotStore);
  registerCommunicationRoutes(
    app,
    options.accountStore,
    options.communicationStore,
    options.pushProvider,
    options.provisioningKey
  );
  registerPlatformRoutes(app, options.schoolStore, options.accountStore, options.provisioningKey);

  app.setErrorHandler((error, request, reply) => {
    app.log.error({
      event: "request_error",
      requestId: request.id,
      method: request.method,
      route: request.routeOptions.url,
      error
    });
    return reply.code(500).send({ error: "internal_error", message: "An unexpected server error occurred." });
  });

  return app;
}
