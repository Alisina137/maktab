CREATE TABLE "learning_files" (
 "id" uuid PRIMARY KEY NOT NULL,
 "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
 "uploaded_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "file_name" varchar(160) NOT NULL,
 "mime_type" varchar(80) NOT NULL,
 "byte_count" integer NOT NULL,
 "base64_data" text NOT NULL,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT "learning_files_size_check" CHECK ("byte_count" > 0 AND "byte_count" <= 1048576)
);
--> statement-breakpoint
CREATE INDEX "learning_files_school_uploader_idx" ON "learning_files" ("school_id","uploaded_by");
--> statement-breakpoint
ALTER TABLE "homeworks" ADD COLUMN "attachment_file_id" uuid REFERENCES "learning_files"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "homeworks" ADD COLUMN "scheduled_at" timestamptz;
--> statement-breakpoint
CREATE INDEX "homeworks_scheduled_idx" ON "homeworks" ("status","scheduled_at");
--> statement-breakpoint
CREATE TABLE "homework_submissions" (
 "id" uuid PRIMARY KEY NOT NULL,
 "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
 "homework_id" uuid NOT NULL REFERENCES "homeworks"("id") ON DELETE CASCADE,
 "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
 "answer" text NOT NULL,
 "attachment_file_id" uuid REFERENCES "learning_files"("id") ON DELETE SET NULL,
 "status" varchar(24) DEFAULT 'SUBMITTED' NOT NULL,
 "feedback" varchar(2000),
 "reviewed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
 "submitted_at" timestamptz DEFAULT now() NOT NULL,
 "reviewed_at" timestamptz,
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT "homework_submissions_status_check" CHECK ("status" IN ('SUBMITTED','REVIEWED','REVISION_REQUESTED')),
 CONSTRAINT "homework_submissions_unique" UNIQUE ("homework_id","student_id")
);
--> statement-breakpoint
CREATE INDEX "homework_submissions_class_idx" ON "homework_submissions" ("school_id","homework_id");
--> statement-breakpoint
CREATE TABLE "continuous_assessments" (
 "id" uuid PRIMARY KEY NOT NULL,
 "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
 "assignment_id" uuid NOT NULL REFERENCES "teacher_assignments"("id") ON DELETE RESTRICT,
 "teacher_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "title" varchar(160) NOT NULL,
 "category" varchar(24) NOT NULL,
 "max_score" integer NOT NULL,
 "assessed_on" date NOT NULL,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT "continuous_assessments_category_check" CHECK ("category" IN ('QUIZ','CLASSWORK','HOMEWORK','PARTICIPATION','MONTHLY')),
 CONSTRAINT "continuous_assessments_max_check" CHECK ("max_score" BETWEEN 1 AND 10000)
);
--> statement-breakpoint
CREATE INDEX "continuous_assessments_assignment_idx" ON "continuous_assessments" ("school_id","assignment_id");
--> statement-breakpoint
CREATE TABLE "continuous_scores" (
 "id" uuid PRIMARY KEY NOT NULL,
 "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
 "assessment_id" uuid NOT NULL REFERENCES "continuous_assessments"("id") ON DELETE CASCADE,
 "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
 "score" integer NOT NULL,
 "remark" varchar(500),
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT "continuous_scores_unique" UNIQUE ("assessment_id","student_id"),
 CONSTRAINT "continuous_scores_nonnegative_check" CHECK ("score" >= 0)
);
--> statement-breakpoint
CREATE INDEX "continuous_scores_school_idx" ON "continuous_scores" ("school_id","assessment_id");