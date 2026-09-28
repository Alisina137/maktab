import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadEnv({
  path: fileURLToPath(new URL("../../.env", import.meta.url))
});

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Drizzle commands. Add it to the repository root .env file.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL
  },
  strict: true,
  verbose: true
});
