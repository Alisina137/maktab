-- Each follow-up is anchored to one real, submitted student attendance mark.
CREATE TYPE "attendance_followup_status" AS ENUM ('OPEN','IN_PROGRESS','RESOLVED','DISMISSED');
--> statement-breakpoint
CREATE TYPE "attendance_followup_activity" AS ENUM ('OPENED','NOTE','CALL','MEETING','MESSAGE','STATUS_CHANGE','ASSIGNMENT');
--> statement-breakpoint
CREATE TABLE "attendance_followup_cases" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE cascade,
  "academic_year_id" uuid NOT NULL REFERENCES "academic_years"("id") ON DELETE restrict,
  "student_attendance_id" uuid NOT NULL REFERENCES "student_attendances"("id") ON DELETE restrict,
  "source_status" attendance_status NOT NULL,
  "status" attendance_followup_status DEFAULT 'OPEN' NOT NULL,
  "assigned_to_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "due_on" date,
  "opening_note" varchar(500) NOT NULL,
  "resolution_note" varchar(500),
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "updated_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_followup_mark_unique" ON "attendance_followup_cases" ("student_attendance_id");
--> statement-breakpoint
CREATE INDEX "attendance_followup_school_year_status_idx" ON "attendance_followup_cases" ("school_id","academic_year_id","status");
--> statement-breakpoint
CREATE INDEX "attendance_followup_school_due_idx" ON "attendance_followup_cases" ("school_id","due_on");
--> statement-breakpoint
CREATE TABLE "attendance_followup_activities" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE cascade,
  "case_id" uuid NOT NULL REFERENCES "attendance_followup_cases"("id") ON DELETE restrict,
  "actor_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "kind" attendance_followup_activity NOT NULL,
  "details" varchar(500) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "attendance_followup_activity_case_date_idx" ON "attendance_followup_activities" ("school_id","case_id","created_at");
