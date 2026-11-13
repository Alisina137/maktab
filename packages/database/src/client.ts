import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDatabaseClient(connectionString: string) {
  const client = postgres(connectionString, {
    max: 10,
    prepare: false,
    // A broken Neon endpoint must not leave new connections waiting forever.
    // /ready has its own shorter response deadline; this bounds the actual
    // underlying TCP connection attempts and regularly retires pooled clients.
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30
  });

  const db = drizzle(client, { schema });

  return {
    db,
    close: () => client.end()
  };
}

export type FoundationDatabase = ReturnType<typeof createDatabaseClient>["db"];
