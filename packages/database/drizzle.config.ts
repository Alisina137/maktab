import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadEnv({
  path: fileURLToPath(new URL("../../.env", import.meta.url))
});

const migrationUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!migrationUrl) {
  throw new Error("DATABASE_URL_UNPOOLED (preferred for migrations) or DATABASE_URL is required in the root .env.");
}

// Neon recommends a direct, unpooled connection for migration sessions.
// Preserve backwards compatibility for local PostgreSQL without an unpooled URL.
if (!process.env.DATABASE_URL_UNPOOLED && /-pooler\./i.test(new URL(migrationUrl).hostname)) {
  console.warn("[db:migrate] DATABASE_URL uses a pooled endpoint. For Neon, set DATABASE_URL_UNPOOLED to the direct connection URL from the Neon Console.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: migrationUrl
  },
  strict: true,
  verbose: true
});
