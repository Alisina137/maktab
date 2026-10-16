-- Staff Phase 5: attendance correction review, never direct staff edits.
CREATE TABLE "staff_attendance_correction_requests" (
  "id" uuid PRIMARY KEY,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "attendance_id" uuid NOT NULL REFERENCES "daily_attendances"("id") ON DELETE RESTRICT,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "original_status" attendance_status NOT NULL,
  "requested_status" attendance_status NOT NULL,
  "expected_updated_at" timestamptz NOT NULL,
  "reason" varchar(500) NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'PENDING'
    CHECK ("status" IN ('PENDING','APPROVED','REJECTED')),
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "review_note" varchar(500),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "decided_at" timestamptz,
  CONSTRAINT "staff_attendance_status_change" CHECK ("original_status" <> "requested_status"),
  CONSTRAINT "staff_attendance_reason_nonempty" CHECK (length(trim("reason")) >= 10)
);
--> statement-breakpoint
CREATE INDEX "staff_attendance_requests_school_status_idx"
  ON "staff_attendance_correction_requests"("school_id","status","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_attendance_one_pending_mark_idx"
  ON "staff_attendance_correction_requests"("school_id","attendance_id","student_id")
  WHERE "status" = 'PENDING';
