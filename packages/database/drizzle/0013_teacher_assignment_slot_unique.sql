-- One class + subject slot may have only one assigned teacher in an academic year.
-- Existing duplicates must be resolved intentionally before this constraint is installed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM teacher_assignments
    GROUP BY school_id, academic_year_id, class_id, subject_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate class-subject teacher assignments exist. Remove the extra assignment, then run the migration again.';
  END IF;
END
$$;
--> statement-breakpoint
DROP INDEX IF EXISTS "teacher_assignments_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_assignments_unique"
ON "teacher_assignments" ("school_id", "academic_year_id", "class_id", "subject_id");
