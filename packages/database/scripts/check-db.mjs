// Non-destructive PostgreSQL connectivity and migration-journal diagnostic.
// The connection string, password, and provisioning secrets are never printed.
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[db:check] DATABASE_URL is missing from the project root .env.");
  process.exitCode = 1;
} else {
  let parsed;
  try {
    parsed = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname) {
      throw new Error("invalid scheme or host");
    }
  } catch {
    parsed = null;
    console.error("[db:check] DATABASE_URL is not a valid PostgreSQL URL.");
    process.exitCode = 1;
  }

  if (parsed) {
    console.log(`[db:check] Checking PostgreSQL endpoint: ${parsed.hostname}:${parsed.port || "5432"}`);
    const client = postgres(connectionString, {
      max: 1,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 5
    });
    try {
      const [info] = await client`select current_database() as database, current_schema() as schema_name`;
      console.log(`[db:check] Connection OK; database=${info.database}, schema=${info.schema_name}`);
      const [journal] = await client`select to_regclass('drizzle.__drizzle_migrations')::text as table_name`;
      if (journal.table_name) {
        const [count] = await client`select count(*)::integer as value from drizzle.__drizzle_migrations`;
        console.log(`[db:check] Drizzle migration journal: ${count.value} applied migrations.`);
      } else {
        console.log("[db:check] Drizzle migration journal not found (initial migration may be pending).");
      }
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
      const help = {
        ENOTFOUND: "DNS cannot resolve the configured PostgreSQL host.",
        EAI_AGAIN: "DNS temporarily unavailable; try the network again.",
        ECONNRESET: "Connection reset by network, proxy or database host.",
        ECONNREFUSED: "Database host refused the connection.",
        ETIMEDOUT: "Database connection timed out.",
        "28P01": "PostgreSQL authentication failed; verify database username/password.",
        "28000": "PostgreSQL authorization failed.",
        "3D000": "The configured database does not exist.",
        "42P01": "The migration journal or schema is missing."
      }[code] ?? "Inspect database provider connectivity, credentials, SSL settings and migration state.";
      console.error(`[db:check] PostgreSQL check failed (${code}). ${help}`);
      // Never print raw errors or DATABASE_URL: driver exception text can
      // contain connection strings or credentials.
      process.exitCode = 1;
    } finally {
      await client.end({ timeout: 3 }).catch(() => {});
    }
  }
}
