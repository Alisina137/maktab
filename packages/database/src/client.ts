import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDatabaseClient(connectionString: string) {
  const client = postgres(connectionString, {
    max: 10,
    prepare: false,
    idle_timeout: 20
  });

  const db = drizzle(client, { schema });

  return {
    db,
    close: () => client.end()
  };
}

export type FoundationDatabase = ReturnType<typeof createDatabaseClient>["db"];
