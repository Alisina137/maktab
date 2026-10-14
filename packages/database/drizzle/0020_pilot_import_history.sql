-- Durable school-scoped import history and atomic replay marker; no credentials stored.
CREATE TABLE IF NOT EXISTS "family_import_batches" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE cascade,
  "idempotency_key" uuid NOT NULL,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "entity_type" varchar(16) NOT NULL,
  "fingerprint" varchar(64),
  "row_count" integer NOT NULL,
  "imported_count" integer NOT NULL DEFAULT 0,
  "rejected_count" integer NOT NULL DEFAULT 0,
  "status" varchar(16) NOT NULL,
  "reason" varchar(200),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "family_import_batches_entity_check" CHECK ("entity_type" IN ('PARENT','STUDENT','TEACHER')),
  CONSTRAINT "family_import_batches_status_check" CHECK ("status" IN ('COMPLETED','REJECTED','FAILED')),
  CONSTRAINT "family_import_batches_counts_check" CHECK ("row_count" >= 0 AND "imported_count" >= 0 AND "rejected_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "family_import_batches_school_key_unique" ON "family_import_batches" ("school_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "family_import_batches_school_time_idx" ON "family_import_batches" ("school_id","created_at");
