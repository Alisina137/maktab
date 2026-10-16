import cors from "@fastify/cors";
import Fastify from "fastify";
import type { AcademicStore, AccountStore, RegistrationStore, AttendanceStore, CommunicationStore, FamilyStore, LearningStore, LearningExtensionsStore, TeacherTeachingStore, TeacherTasksStore, PilotStore, PilotLaunchStore, PlatformSchoolStore, PushProvider } from "@maktablink/database";
import { registerAcademicRoutes } from "./academics/routes.js";
import { registerAttendanceRoutes } from "./attendance/routes.js";
import { LoginRateLimiter } from "./auth/rate-limit.js";
import { registerAuthRoutes } from "./auth/routes.js";
import type { AdminPasswordVerificationDelivery } from "./auth/admin-password-2fa.js";
import { registerFamilyRoutes } from "./families/routes.js";
import { registerCommunicationRoutes } from "./communication/routes.js";
import { registerLearningRoutes } from "./learning/routes.js";
import { registerLearningExtensionsRoutes } from "./learning/extensions-routes.js";
import { registerTeachingRoutes } from "./teaching/routes.js";
import { registerTeacherTasksRoutes } from "./teaching/tasks-routes.js";
import { registerPilotRoutes } from "./pilot/routes.js";
import { registerPilotLaunchRoutes } from "./pilot/launch-routes.js";
import { registerPlatformRoutes } from "./platform/routes.js";
import { registerPublicRoutes } from "./public/routes.js";
import { registerUserRoutes } from "./users/routes.js";
import { registerStaffRoutes } from "./staff/routes.js";
import { ApiMetrics } from "./observability.js";

export interface BuildAppOptions {
  schoolStore: PlatformSchoolStore;
  accountStore: AccountStore;
  academicStore: AcademicStore;
  familyStore: FamilyStore;
  registrationStore?: RegistrationStore;
  attendanceStore: AttendanceStore;
  learningStore: LearningStore;
  learningExtensionsStore?: LearningExtensionsStore;
  teacherTeachingStore?: TeacherTeachingStore;
  teacherTasksStore?: TeacherTasksStore;
  communicationStore: CommunicationStore;
  pilotStore: PilotStore;
  pilotLaunchStore: PilotLaunchStore;
  pushProvider: PushProvider;
  passwordVerificationDelivery: AdminPasswordVerificationDelivery;
  passwordVerificationSecret: string;
  provisioningKey: string;
  webOrigin?: string;
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: options.logger ?? false });
  const metrics = new ApiMetrics();
  const webOrigin = options.webOrigin ?? "http://localhost:3000";

  void app.register(cors, {
    origin: [webOrigin, "http://127.0.0.1:3000"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-platform-provisioning-key"],
    exposedHeaders: ["x-request-id"]
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  app.addHook("onResponse", async (request, reply) => {
    metrics.record(request.method, reply.statusCode, reply.elapsedTime);
    app.log.info({
      event: "http_request_completed",
      requestId: request.id,
      method: request.method,
      route: request.routeOptions.url,
      statusCode: reply.statusCode,
      durationMs: Number(reply.elapsedTime.toFixed(3))
    });
  });

  app.get("/health", async () => ({ status: "ok", service: "maktablink-api", phase: 8 }));
  app.get("/metrics", async (_request, reply) => {
    const databaseReady = await options.schoolStore.healthCheck();
    reply.header("content-type", "text/plain; version=0.0.4; charset=utf-8");
    reply.header("cache-control", "no-store");
    return metrics.render(databaseReady);
  });
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
  registerAuthRoutes(app, options.accountStore, loginLimiter, {
    passwordVerificationDelivery: options.passwordVerificationDelivery,
    passwordVerificationSecret: options.passwordVerificationSecret
  });
  registerUserRoutes(app, options.accountStore);
  registerStaffRoutes(app, options.accountStore, options.registrationStore);
  registerAcademicRoutes(app, options.accountStore, options.academicStore);
  registerFamilyRoutes(app, options.accountStore, options.academicStore, options.familyStore);
  registerAttendanceRoutes(app, options.accountStore, options.attendanceStore);
  registerLearningRoutes(app, options.accountStore, options.learningStore);
  if (options.learningExtensionsStore) registerLearningExtensionsRoutes(app, options.accountStore, options.learningExtensionsStore);
  if (options.teacherTeachingStore) registerTeachingRoutes(app, options.accountStore, options.teacherTeachingStore);
  if (options.teacherTasksStore) registerTeacherTasksRoutes(app, options.accountStore, options.teacherTasksStore);
  registerPilotRoutes(app, options.accountStore, options.pilotStore);
  registerPilotLaunchRoutes(app, options.accountStore, options.pilotLaunchStore, options.pilotStore);
  registerCommunicationRoutes(
    app,
    options.accountStore,
    options.communicationStore,
    options.pushProvider,
    options.provisioningKey
  );
  registerPlatformRoutes(app, options.schoolStore, options.accountStore, options.provisioningKey, options.pilotLaunchStore, options.pilotStore);

  app.setErrorHandler((error, request, reply) => {
    const maybeStatusCode =
      typeof error === "object" && error !== null && "statusCode" in error
        ? (error as { statusCode?: unknown }).statusCode
        : undefined;
    const statusCode =
      typeof maybeStatusCode === "number" && maybeStatusCode >= 400 && maybeStatusCode < 500
        ? maybeStatusCode
        : 500;

    app.log.error({
      event: "request_error",
      requestId: request.id,
      method: request.method,
      route: request.routeOptions.url,
      statusCode,
      error
    });

    if (statusCode < 500) {
      const maybeCode =
        typeof error === "object" && error !== null && "code" in error
          ? (error as { code?: unknown }).code
          : undefined;
      const message =
        maybeCode === "FST_ERR_CTP_EMPTY_JSON_BODY"
          ? "The request body was empty even though JSON content was declared. Refresh the page and try again."
          : "The request could not be processed. Please try again.";
      return reply.code(statusCode).send({
        error: "invalid_request",
        message
      });
    }

    return reply.code(500).send({
      error: "internal_error",
      message: "An unexpected server error occurred."
    });
  });

  return app;
}
