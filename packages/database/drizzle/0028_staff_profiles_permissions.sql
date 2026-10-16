-- Separate web staff role, per-school job profiles and explicit permissions.
-- Existing staff have no permissions until a school administrator assigns them.
CREATE TABLE "staff_profiles" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "full_name" varchar(160) NOT NULL,
  "employee_code" varchar(32),
  "position" varchar(40) NOT NULL,
  "department" varchar(100) NOT NULL,
  "permissions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "staff_profiles_permissions_array" CHECK (jsonb_typeof("permissions") = 'array'),
  CONSTRAINT "staff_profiles_position_allowlist" CHECK (
    "position" IN ('RECEPTIONIST','REGISTRATION_OFFICER','ATTENDANCE_OFFICER',
      'ACCOUNTANT','ADMIN_ASSISTANT','COMMUNICATIONS_OFFICER','LIBRARIAN',
      'OPERATIONS_SUPERVISOR','OTHER')
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_profiles_school_code_unique" ON "staff_profiles"("school_id","employee_code");
--> statement-breakpoint
CREATE INDEX "staff_profiles_school_idx" ON "staff_profiles"("school_id");
--> statement-breakpoint
-- Deny cross-school staff profile records even if a faulty caller bypasses the API.
CREATE UNIQUE INDEX IF NOT EXISTS "users_school_user_compound_unique" ON "users"("school_id","id");
--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_school_fk"
  FOREIGN KEY ("school_id","user_id") REFERENCES "users"("school_id","id") ON DELETE CASCADE;
