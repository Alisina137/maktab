// Read-only Neon/PostgreSQL diagnostics. Never log connection URLs, passwords,
// raw driver errors or their stack traces.
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

function parseConnectionString(name, value) {
  if (!value) {
    console.error(`[db:check] ${name} is missing from the root .env.`);
    process.exitCode = 1;
    return null;
  }
  try {
    const parsed = new URL(value);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.hostname || !parsed.pathname.slice(1)) {
      throw new Error("Invalid PostgreSQL connection details.");
    }
    return parsed;
  } catch {
    console.error(`[db:check] ${name} is not a valid PostgreSQL URL.`);
    process.exitCode = 1;
    return null;
  }
}

function helpForError(code) {
  const hints = {
    CONNECT_TIMEOUT: "Connection startup exceeded 30 seconds. Check DNS, outbound TCP port 5432, Neon project/compute state, and VPN/ISP restrictions. Run Test-NetConnection on this host. This is not a migration SQL error.",
    ETIMEDOUT: "TCP connection timed out. Check port 5432 reachability and provider health.",
    ENOTFOUND: "DNS could not resolve the PostgreSQL hostname.",
    EAI_AGAIN: "DNS lookup temporarily failed. Check network or DNS resolver.",
    ECONNRESET: "Connection reset by network, proxy or database host.",
    ECONNREFUSED: "Remote port refused the TCP connection.",
    "28P01": "PostgreSQL authentication failed. Re-copy the connection URL from Neon.",
    "28000": "PostgreSQL authorization failed.",
    "3D000": "Configured database does not exist."
  };
  return hints[code] ?? "Check the endpoint, Neon connection details, TLS requirements, network restrictions and provider status.";
}

async function check(name, value) {
  const parsed = parseConnectionString(name, value);
  if (!parsed) return;
  const host = parsed.hostname;
  console.log(`[db:check] Checking ${name}: ${host}:${parsed.port || "5432"}`);
  const client = postgres(value, {
    max: 1,
    prepare: false,
    // Neon may need several seconds to wake from scale-to-zero; a short 10s
    // limit can incorrectly report an inaccessible host during cold start.
    connect_timeout: 30,
    idle_timeout: 5
  });
  try {
    const [info] = await client`select current_database() as database, current_schema() as schema_name`;
    console.log(`[db:check] ${name} OK; database=${info.database}, schema=${info.schema_name}`);
    const [journal] = await client`select to_regclass('drizzle.__drizzle_migrations')::text as table_name`;
    if (journal.table_name) {
      const [count] = await client`select count(*)::integer as value from drizzle.__drizzle_migrations`;
      console.log(`[db:check] ${name}: Drizzle journal has ${count.value} applied migrations.`);
    } else {
      console.log(`[db:check] ${name}: Drizzle migration journal not found.`);
    }
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
    console.error(`[db:check] ${name} failed (${code}). ${helpForError(code)}`);
    process.exitCode = 1;
  } finally {
    await client.end({ timeout: 3 }).catch(() => {});
  }
}

if (process.env.DATABASE_URL) {
  await check("DATABASE_URL (application)", process.env.DATABASE_URL);
  const direct = process.env.DATABASE_URL_UNPOOLED;
  if (direct && direct !== process.env.DATABASE_URL) {
    await check("DATABASE_URL_UNPOOLED (migrations)", direct);
  } else {
    const parsed = parseConnectionString("DATABASE_URL", process.env.DATABASE_URL);
    if (parsed && /-pooler\./i.test(parsed.hostname)) {
      console.warn("[db:check] Pooled Neon URL detected. Add DATABASE_URL_UNPOOLED from Neon Console (pooling disabled) for schema migrations.");
    }
  }
} else {
  parseConnectionString("DATABASE_URL", process.env.DATABASE_URL);
}
