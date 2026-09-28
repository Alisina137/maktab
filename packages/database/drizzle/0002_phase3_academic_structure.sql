DO $$ BEGIN
  CREATE TYPE "academic_year_status" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "weekday" AS ENUM ('SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "academic_years" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "name" varchar(80) NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "status" "academic_year_status" DEFAULT 'DRAFT' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "academic_years_school_name_unique" ON "academic_years" ("school_id", "name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_years_school_status_idx" ON "academic_years" ("school_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "grade_levels" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "code" varchar(32) NOT NULL,
  "name" varchar(80) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "grade_levels_school_code_unique" ON "grade_levels" ("school_id", "code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "grade_levels_school_name_unique" ON "grade_levels" ("school_id", "name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "class_sections" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "academic_year_id" uuid NOT NULL REFERENCES "academic_years"("id") ON DELETE RESTRICT,
  "grade_level_id" uuid NOT NULL REFERENCES "grade_levels"("id") ON DELETE RESTRICT,
  "code" varchar(32) NOT NULL,
  "name" varchar(80) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "class_sections_school_year_code_unique" ON "class_sections" ("school_id", "academic_year_id", "code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "class_sections_school_year_idx" ON "class_sections" ("school_id", "academic_year_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "class_sections_grade_idx" ON "class_sections" ("grade_level_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subjects" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "code" varchar(32) NOT NULL,
  "name" varchar(120) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_school_code_unique" ON "subjects" ("school_id", "code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subjects_school_name_unique" ON "subjects" ("school_id", "name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teacher_profiles" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "employee_code" varchar(32) NOT NULL,
  "full_name" varchar(160) NOT NULL,
  "phone" varchar(32),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_profiles_school_employee_unique" ON "teacher_profiles" ("school_id", "employee_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teacher_profiles_school_idx" ON "teacher_profiles" ("school_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teacher_assignments" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "academic_year_id" uuid NOT NULL REFERENCES "academic_years"("id") ON DELETE RESTRICT,
  "teacher_user_id" uuid NOT NULL REFERENCES "teacher_profiles"("user_id") ON DELETE RESTRICT,
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE RESTRICT,
  "class_id" uuid NOT NULL REFERENCES "class_sections"("id") ON DELETE RESTRICT,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_assignments_unique" ON "teacher_assignments" ("school_id", "academic_year_id", "teacher_user_id", "subject_id", "class_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teacher_assignments_teacher_idx" ON "teacher_assignments" ("school_id", "teacher_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teacher_assignments_class_idx" ON "teacher_assignments" ("school_id", "class_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "negaran_assignments" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "academic_year_id" uuid NOT NULL REFERENCES "academic_years"("id") ON DELETE RESTRICT,
  "teacher_user_id" uuid NOT NULL REFERENCES "teacher_profiles"("user_id") ON DELETE RESTRICT,
  "class_id" uuid NOT NULL REFERENCES "class_sections"("id") ON DELETE RESTRICT,
  "start_date" date NOT NULL,
  "end_date" date,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "negaran_assignments_class_idx" ON "negaran_assignments" ("school_id", "academic_year_id", "class_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "negaran_assignments_teacher_idx" ON "negaran_assignments" ("school_id", "teacher_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "timetable_periods" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "academic_year_id" uuid NOT NULL REFERENCES "academic_years"("id") ON DELETE RESTRICT,
  "class_id" uuid NOT NULL REFERENCES "class_sections"("id") ON DELETE RESTRICT,
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE RESTRICT,
  "teacher_user_id" uuid NOT NULL REFERENCES "teacher_profiles"("user_id") ON DELETE RESTRICT,
  "weekday" "weekday" NOT NULL,
  "starts_at" varchar(5) NOT NULL,
  "ends_at" varchar(5) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timetable_periods_class_day_idx" ON "timetable_periods" ("school_id", "academic_year_id", "class_id", "weekday");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "timetable_periods_teacher_day_idx" ON "timetable_periods" ("school_id", "academic_year_id", "teacher_user_id", "weekday");
