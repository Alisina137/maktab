-- Final audit Phase 3: prevent cross-school references even if a future API path forgets tenant checks.
-- Non-destructive migration: intentionally fails on inconsistent legacy rows. Never silently reassign schools.
-- Take an encrypted backup, run the preflight report and correct discrepancies before production migration.
-- A school must have at most one ACTIVE academic year, including under concurrent writes.
DO $$
BEGIN
  IF EXISTS (SELECT school_id FROM academic_years WHERE status = 'ACTIVE' GROUP BY school_id HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Multiple ACTIVE academic years already exist within a school. Resolve them before Phase 3 migration.';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM class_sections c LEFT JOIN academic_years y ON y.id=c.academic_year_id AND y.school_id=c.school_id LEFT JOIN grade_levels g ON g.id=c.grade_level_id AND g.school_id=c.school_id WHERE y.id IS NULL OR g.id IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'Class sections contain school/year/grade mismatches. Repair existing rows before Phase 3 migration.';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM students s LEFT JOIN parent_profiles p ON p.user_id=s.parent_user_id AND p.school_id=s.school_id LEFT JOIN class_sections c ON c.id=s.class_id AND c.school_id=s.school_id AND c.academic_year_id=s.academic_year_id WHERE p.user_id IS NULL OR c.id IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'Students contain parent-school or class-year mismatches. Repair existing rows before Phase 3 migration.';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM fee_invoices i LEFT JOIN students s ON s.id=i.student_id AND s.school_id=i.school_id WHERE s.id IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'Fee invoices reference a student from another school. Repair existing rows before Phase 3 migration.';
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM fee_payments p LEFT JOIN fee_invoices i ON i.id=p.invoice_id AND i.school_id=p.school_id WHERE i.id IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'Payments reference an invoice from another school. Repair existing rows before Phase 3 migration.';
  END IF;
END
$$;
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_years_school_id_unique" ON "academic_years" ("school_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "grade_levels_school_id_unique" ON "grade_levels" ("school_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_school_id_unique" ON "subjects" ("school_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "class_sections_school_year_id_unique" ON "class_sections" ("school_id", "academic_year_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "parent_profiles_school_user_unique" ON "parent_profiles" ("school_id", "user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_profiles_school_user_unique" ON "teacher_profiles" ("school_id", "user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "students_school_id_unique" ON "students" ("school_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "fee_invoices_school_id_unique" ON "fee_invoices" ("school_id", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_years_one_active_per_school" ON "academic_years" ("school_id") WHERE "status" = 'ACTIVE';
--> statement-breakpoint
ALTER TABLE "class_sections" ADD CONSTRAINT "class_sections_year_school_fk" FOREIGN KEY ("school_id", "academic_year_id") REFERENCES "academic_years" ("school_id", "id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "class_sections" ADD CONSTRAINT "class_sections_grade_school_fk" FOREIGN KEY ("school_id", "grade_level_id") REFERENCES "grade_levels" ("school_id", "id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "parent_profiles" ADD CONSTRAINT "parent_profiles_owner_school_fk" FOREIGN KEY ("school_id", "user_id") REFERENCES "users" ("school_id", "id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_owner_school_fk" FOREIGN KEY ("school_id", "user_id") REFERENCES "users" ("school_id", "id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_parent_school_fk" FOREIGN KEY ("school_id", "parent_user_id") REFERENCES "parent_profiles" ("school_id", "user_id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_year_school_fk" FOREIGN KEY ("school_id", "academic_year_id", "class_id") REFERENCES "class_sections" ("school_id", "academic_year_id", "id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "student_class_history" ADD CONSTRAINT "student_history_student_school_fk" FOREIGN KEY ("school_id", "student_id") REFERENCES "students" ("school_id", "id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "student_class_history" ADD CONSTRAINT "student_history_class_year_school_fk" FOREIGN KEY ("school_id", "academic_year_id", "class_id") REFERENCES "class_sections" ("school_id", "academic_year_id", "id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_teacher_school_fk" FOREIGN KEY ("school_id", "teacher_user_id") REFERENCES "teacher_profiles" ("school_id", "user_id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_subject_school_fk" FOREIGN KEY ("school_id", "subject_id") REFERENCES "subjects" ("school_id", "id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_class_year_school_fk" FOREIGN KEY ("school_id", "academic_year_id", "class_id") REFERENCES "class_sections" ("school_id", "academic_year_id", "id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_student_school_fk" FOREIGN KEY ("school_id", "student_id") REFERENCES "students" ("school_id", "id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_invoice_school_fk" FOREIGN KEY ("school_id", "invoice_id") REFERENCES "fee_invoices" ("school_id", "id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_school_fk" FOREIGN KEY ("school_id", "user_id") REFERENCES "users" ("school_id", "id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "admin_password_verifications" ADD CONSTRAINT "admin_password_verifications_user_school_fk" FOREIGN KEY ("school_id", "user_id") REFERENCES "users" ("school_id", "id") ON DELETE CASCADE;
