import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import {
  createAcademicStore,
  createAccountStore,
  createAttendanceStore,
  createCommunicationStore,
  createDatabaseClient,
  createFamilyStore,
  createExpoPushProvider,
  createLearningStore,
  createPilotStore,
  createSchoolStore
} from "@maktablink/database";
import { buildApp } from "./app.js";
import { createAdminPasswordVerificationDelivery } from "./auth/admin-password-2fa.js";

loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url))
});

const databaseUrl = process.env.DATABASE_URL;
const provisioningKey = process.env.PLATFORM_PROVISIONING_KEY;
const host = process.env.API_HOST ?? "0.0.0.0";
const port = Number(process.env.API_PORT ?? 4000);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Add it to the repository root .env file.");
}
if (!provisioningKey || provisioningKey.length < 24) {
  throw new Error("PLATFORM_PROVISIONING_KEY must be at least 24 characters in the repository root .env file.");
}

const database = createDatabaseClient(databaseUrl);
const app = buildApp({
  schoolStore: createSchoolStore(database.db),
  accountStore: createAccountStore(database.db),
  academicStore: createAcademicStore(database.db),
  familyStore: createFamilyStore(database.db),
  attendanceStore: createAttendanceStore(database.db),
  learningStore: createLearningStore(database.db),
  communicationStore: createCommunicationStore(database.db),
  pilotStore: createPilotStore(database.db),
  pushProvider: createExpoPushProvider(),
  passwordVerificationDelivery: createAdminPasswordVerificationDelivery(),
  passwordVerificationSecret: process.env.PASSWORD_2FA_SECRET ?? provisioningKey,
  provisioningKey,
  webOrigin,
  logger: process.env.NODE_ENV === "production" || process.env.API_STRUCTURED_LOGS === "true"
});

const close = async () => {
  await app.close();
  await database.close();
};

process.once("SIGINT", () => void close().finally(() => process.exit(0)));
process.once("SIGTERM", () => void close().finally(() => process.exit(0)));

await app.listen({ host, port });
