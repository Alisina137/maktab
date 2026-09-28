DO $$ BEGIN
  CREATE TYPE "user_role" AS ENUM ('SCHOOL_ADMIN', 'SCHOOL_STAFF', 'TEACHER', 'PARENT', 'STUDENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "user_status" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "username" varchar(64) NOT NULL,
  "password_hash" text NOT NULL,
  "role" "user_role" NOT NULL,
  "status" "user_status" DEFAULT 'INVITED' NOT NULL,
  "must_change_password" boolean DEFAULT true NOT NULL,
  "last_login_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_school_username_unique" ON "users" ("school_id", "username");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_school_role_idx" ON "users" ("school_id", "role");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_school_status_idx" ON "users" ("school_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "access_token_hash" varchar(64) NOT NULL,
  "refresh_token_hash" varchar(64) NOT NULL,
  "access_expires_at" timestamptz NOT NULL,
  "refresh_expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "rotated_at" timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_sessions_access_hash_unique" ON "auth_sessions" ("access_token_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_sessions_refresh_hash_unique" ON "auth_sessions" ("refresh_token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_sessions_user_idx" ON "auth_sessions" ("school_id", "user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "action" varchar(80) NOT NULL,
  "entity_type" varchar(80) NOT NULL,
  "entity_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_school_created_idx" ON "audit_logs" ("school_id", "created_at");
