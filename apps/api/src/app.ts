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
import { ApiMetrics } from "./observability.js";

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
  const metrics = new ApiMetrics();
  const webOrigin = options.webOrigin ?? "http://localhost:3000";

  void app.register(cors, {
    origin: [webOrigin, "http://127.0.0.1:3000"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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
