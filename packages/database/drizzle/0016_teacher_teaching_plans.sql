CREATE TABLE "curriculum_units" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "academic_year_id" uuid NOT NULL REFERENCES "academic_years"("id") ON DELETE RESTRICT,
  "class_id" uuid NOT NULL REFERENCES "class_sections"("id") ON DELETE RESTRICT,
  "subject_id" uuid NOT NULL REFERENCES "subjects"("id") ON DELETE RESTRICT,
  "title" varchar(160) NOT NULL,
  "sort_order" integer NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "curriculum_units_sort_check" CHECK ("sort_order" BETWEEN 1 AND 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "curriculum_unit_order_unique" ON "curriculum_units" ("school_id","academic_year_id","class_id","subject_id","sort_order");
--> statement-breakpoint
CREATE INDEX "curriculum_unit_class_idx" ON "curriculum_units" ("school_id","academic_year_id","class_id");
--> statement-breakpoint
CREATE TABLE "teacher_unit_progress" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "assignment_id" uuid NOT NULL REFERENCES "teacher_assignments"("id") ON DELETE CASCADE,
  "unit_id" uuid NOT NULL REFERENCES "curriculum_units"("id") ON DELETE CASCADE,
  "status" varchar(20) DEFAULT 'NOT_STARTED' NOT NULL,
  "updated_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "teacher_unit_progress_status_check" CHECK ("status" IN ('NOT_STARTED','IN_PROGRESS','COMPLETED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_unit_progress_unique" ON "teacher_unit_progress" ("assignment_id","unit_id");
--> statement-breakpoint
CREATE TABLE "teacher_lesson_plans" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "assignment_id" uuid NOT NULL REFERENCES "teacher_assignments"("id") ON DELETE CASCADE,
  "unit_id" uuid REFERENCES "curriculum_units"("id") ON DELETE SET NULL,
  "lesson_date" date NOT NULL,
  "topic" varchar(160) NOT NULL,
  "objective" text NOT NULL,
  "materials" varchar(500) DEFAULT '' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "status" varchar(20) DEFAULT 'PLANNED' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "teacher_lesson_plans_status_check" CHECK ("status" IN ('PLANNED','COMPLETED','POSTPONED'))
);
--> statement-breakpoint
CREATE INDEX "teacher_lesson_plans_assignment_date_idx" ON "teacher_lesson_plans" ("school_id","assignment_id","lesson_date");