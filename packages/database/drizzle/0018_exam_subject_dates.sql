-- Step 15: schedule an exam separately for each class/subject.
-- Historical exam subjects remain nullable; newly configured subjects must
-- provide a valid date through the API.
ALTER TABLE "exam_subjects" ADD COLUMN "exam_date" date;
--> statement-breakpoint
CREATE INDEX "exam_subjects_date_idx" ON "exam_subjects" ("school_id", "exam_date");
