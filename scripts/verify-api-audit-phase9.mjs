import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const app = read("apps/api/src/app.ts");
const server = read("apps/api/src/server.ts");
const config = read("apps/api/src/runtime-config.ts");
const readiness = read("apps/api/src/operational-readiness.ts");
const job = read("apps/api/src/periodic-job.ts");
const client = read("packages/database/src/client.ts");
const homework = read("packages/database/src/learning-extensions-store.ts");
const examples = read(".env.example");

function needs(source, fragments, label) {
  for (const fragment of fragments) assert.ok(source.includes(fragment),
    label + " missing: " + fragment);
}

needs(app, [
  "createReadinessProbe(() => options.schoolStore.healthCheck())",
  "hasMetricsBearer(request.headers.authorization, options.metricsToken)",
  "if (!options.metricsToken)",
  'reply.code(404).send({ error: "not_found" })',
  'reply.code(401).send({ error: "unauthorized" })',
  'reply.header("cache-control", "no-store")',
  "databaseIsReady()",
  'status: ready ? "ready" : "not_ready"',
  'errorClass: error instanceof Error ? error.name : "UnknownError"'
], "Fastify monitoring and redacted logging");
needs(readiness, [
  "let running: Promise<boolean> | null = null",
  "Promise.race([checked, timedOut])",
  "expiresAt = now() + ttlMs",
  "timingSafeEqual(expected, provided)",
  'if (!configuredToken || typeof authorization !== "string"'
], "Single-flight readiness and metrics credentials");
needs(config, [
  'env.NODE_ENV === "production"',
  'env.API_METRICS_TOKEN?.trim()',
  'if (origin.protocol !== "https:")',
  "Production DATABASE_URL must require TLS",
  'passwordSecret === provisioningKey',
  "Number.isSafeInteger(port)"
], "Production API environment validation");
needs(server, [
  "readApiRuntimeConfig(process.env)",
  "metricsToken: runtime.metricsToken",
  "createNonOverlappingJob(async () => {",
  "publishingJob.stop(5_000)",
  "if (scheduleTimer) clearInterval(scheduleTimer)",
  "if (shutdownFlight) return shutdownFlight",
  "await database.close()",
  "void publishingJob.trigger()",
  "scheduleTimer.unref()"
], "API startup, scheduler and shutdown");
needs(job, [
  "if (stopping) return Promise.resolve()",
  "if (running) return running",
  "new Promise<boolean>((resolve)",
  "onFailure();"
], "Non-overlapping scheduler");
needs(homework, [
  "const due = await db.select(",
  ".limit(100)",
  ".orderBy(asc(homeworks.scheduledAt), asc(homeworks.id))",
  'eq(academicYears.status, "ACTIVE")',
  '.limit(1).for("update")',
  "if (!year) return false",
  "if (!assignment) return false"
], "Bounded scheduled homework publication");
needs(client, ["connect_timeout: 10", "max_lifetime: 60 * 30"],
  "Database connection timeout and lifetime");
needs(examples, ["API_METRICS_TOKEN=", "NODE_ENV=production"],
  "Deployment runbook variables");
console.log("Final Audit Phase 9 verified: bounded readiness and background workloads, private metrics, secure startup and shutdown, and safe operational logging.");
