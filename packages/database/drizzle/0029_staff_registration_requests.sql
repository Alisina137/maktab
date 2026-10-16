-- Staff Phase 4: intake is separate from student/family accounts.
-- Staff prepare and submit requests; only school admins may approve enrollment.
CREATE TABLE "staff_registration_requests" (
  "id" uuid PRIMARY KEY,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "full_name" varchar(160) NOT NULL,
  "student_code" varchar(32) NOT NULL,
  "parent_name" varchar(160) NOT NULL,
  "academic_year_id" uuid NOT NULL REFERENCES "academic_years"("id") ON DELETE RESTRICT,
  "grade_level_id" uuid NOT NULL REFERENCES "grade_levels"("id") ON DELETE RESTRICT,
  "documents" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "notes" varchar(1000) NOT NULL DEFAULT '',
  "status" varchar(24) NOT NULL DEFAULT 'DRAFT'
    CHECK ("status" IN ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED')),
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "review_note" varchar(1000),
  "approved_student_id" uuid REFERENCES "students"("id") ON DELETE RESTRICT,
  "submitted_at" timestamptz,
  "decided_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "staff_registration_documents_object" CHECK (jsonb_typeof("documents") = 'object')
);
--> statement-breakpoint
CREATE INDEX "staff_registration_school_status_idx"
  ON "staff_registration_requests"("school_id","status","updated_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_registration_pending_code_unique"
  ON "staff_registration_requests"("school_id",lower("student_code"))
  WHERE "status" IN ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED');
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_registration_approved_student_unique"
  ON "staff_registration_requests"("approved_student_id")
  WHERE "approved_student_id" IS NOT NULL;
