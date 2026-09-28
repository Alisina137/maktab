import "dotenv/config";
import { createDatabaseClient, createSchoolStore } from "@maktablink/database";
import { buildApp } from "./app.js";

const databaseUrl = process.env.DATABASE_URL;
const provisioningKey = process.env.PLATFORM_PROVISIONING_KEY;
const host = process.env.API_HOST ?? "0.0.0.0";
const port = Number(process.env.API_PORT ?? 4000);

if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (!provisioningKey || provisioningKey.length < 24) {
  throw new Error("PLATFORM_PROVISIONING_KEY must be at least 24 characters.");
}

const database = createDatabaseClient(databaseUrl);
const app = buildApp({
  schoolStore: createSchoolStore(database.db),
  provisioningKey
});

const close = async () => {
  await app.close();
  await database.close();
};

process.once("SIGINT", () => void close().finally(() => process.exit(0)));
process.once("SIGTERM", () => void close().finally(() => process.exit(0)));

await app.listen({ host, port });
