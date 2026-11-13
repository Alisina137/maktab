import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import {
  createAcademicStore,
  createAccountStore,
  createAttendanceStore,
  createCommunicationStore,
  createDatabaseClient,
  createFamilyStore,
  createRegistrationStore,
  createStaffAttendanceCorrectionStore,
  createStaffFeeReadStore,
  createStaffWorkflowStore,
  createExpoPushProvider,
  createLearningStore,
  createLearningExtensionsStore,
  createTeacherTeachingStore,
  createTeacherTasksStore,
  createPilotStore,
  createPilotLaunchStore,
  createSchoolStore
} from "@maktablink/database";
import { buildApp } from "./app.js";
import { createAdminPasswordVerificationDelivery } from "./auth/admin-password-2fa.js";
import { createNonOverlappingJob } from "./periodic-job.js";
import { readApiRuntimeConfig } from "./runtime-config.js";

loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url))
});

const runtime = readApiRuntimeConfig(process.env);
const database = createDatabaseClient(runtime.databaseUrl);
const learningExtensionsStore = createLearningExtensionsStore(database.db);
const app = buildApp({
  schoolStore: createSchoolStore(database.db),
  accountStore: createAccountStore(database.db),
  academicStore: createAcademicStore(database.db),
  familyStore: createFamilyStore(database.db),
  registrationStore: createRegistrationStore(database.db),
  staffAttendanceCorrectionStore: createStaffAttendanceCorrectionStore(database.db),
  staffFeeReadStore: createStaffFeeReadStore(database.db),
  staffWorkflowStore: createStaffWorkflowStore(database.db),
  attendanceStore: createAttendanceStore(database.db),
  learningStore: createLearningStore(database.db),
  learningExtensionsStore,
  teacherTeachingStore: createTeacherTeachingStore(database.db),
  teacherTasksStore: createTeacherTasksStore(database.db),
  communicationStore: createCommunicationStore(database.db),
  pilotStore: createPilotStore(database.db),
  pilotLaunchStore: createPilotLaunchStore(database.db),
  pushProvider: createExpoPushProvider(),
  passwordVerificationDelivery: createAdminPasswordVerificationDelivery(),
  passwordVerificationSecret: runtime.passwordVerificationSecret,
  provisioningKey: runtime.provisioningKey,
  webOrigin: runtime.webOrigin,
  metricsToken: runtime.metricsToken,
  logger: process.env.NODE_ENV === "production" || process.env.API_STRUCTURED_LOGS === "true"
});

const publishingJob = createNonOverlappingJob(async () => {
  const published = await learningExtensionsStore.publishDueHomeworks();
  if (published) app.log.info({ event: "scheduled_homework_published", count: published });
}, () => {
  app.log.error({ event: "scheduled_homework_publish_failed" });
});

let scheduleTimer: ReturnType<typeof setInterval> | null = null;
let shutdownFlight: Promise<void> | null = null;

function shutdown(): Promise<void> {
  if (shutdownFlight) return shutdownFlight;
  shutdownFlight = (async () => {
    if (scheduleTimer) clearInterval(scheduleTimer);
    scheduleTimer = null;
    const drained = await publishingJob.stop(5_000);
    if (!drained) {
      app.log.warn({ event: "scheduled_homework_shutdown_timeout" });
    }
    try {
      await app.close();
    } finally {
      // Even if the HTTP listener fails to close, release PostgreSQL handles.
      await database.close();
    }
  })();
  return shutdownFlight;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown().catch(() => {
      process.exitCode = 1;
      // A generic event avoids emitting connection URLs or account data.
      app.log.error({ event: "api_shutdown_failed" });
    });
  });
}

try {
  await app.listen({ host: runtime.host, port: runtime.port });
} catch (error) {
  await database.close().catch(() => undefined);
  throw error;
}

void publishingJob.trigger();
scheduleTimer = setInterval(() => {
  void publishingJob.trigger();
}, 60_000);
scheduleTimer.unref();
