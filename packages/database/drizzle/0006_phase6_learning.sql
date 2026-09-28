CREATE TYPE "public"."homework_status" AS ENUM('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');
--> statement-breakpoint
CREATE TYPE "public"."exam_status" AS ENUM('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'RESULTS_READY', 'PUBLISHED', 'ARCHIVED');
--> statement-breakpoint
CREATE TYPE "public"."grade_record_status" AS ENUM('DRAFT', 'PUBLISHED');
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "user_id" uuid;
--> statement-breakpoint
CREATE TABLE "homeworks" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "assignment_id" uuid NOT NULL,
  "academic_year_id" uuid NOT NULL,
  "class_id" uuid NOT NULL,
  "subject_id" uuid NOT NULL,
  "teacher_user_id" uuid NOT NULL,
  "title" varchar(160) NOT NULL,
  "content" text NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "attachment_url" varchar(500),
  "status" "homework_status" DEFAULT 'DRAFT' NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exams" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "academic_year_id" uuid NOT NULL,
  "name" varchar(120) NOT NULL,
  "type" varchar(80) NOT NULL,
  "status" "exam_status" DEFAULT 'DRAFT' NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_subjects" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "exam_id" uuid NOT NULL,
  "subject_id" uuid NOT NULL,
  "class_id" uuid NOT NULL,
  "max_score" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_records" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "exam_subject_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "score" integer NOT NULL,
  "remark" varchar(500),
  "status" "grade_record_status" DEFAULT 'DRAFT' NOT NULL,
  "updated_by" uuid NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_assignment_id_teacher_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."teacher_assignments"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_class_id_class_sections_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class_sections"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_teacher_user_id_teacher_profiles_user_id_fk" FOREIGN KEY ("teacher_user_id") REFERENCES "public"."teacher_profiles"("user_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_class_id_class_sections_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class_sections"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "grade_records" ADD CONSTRAINT "grade_records_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "grade_records" ADD CONSTRAINT "grade_records_exam_subject_id_exam_subjects_id_fk" FOREIGN KEY ("exam_subject_id") REFERENCES "public"."exam_subjects"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "grade_records" ADD CONSTRAINT "grade_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "grade_records" ADD CONSTRAINT "grade_records_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "students_user_unique" ON "students" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "homeworks_teacher_idx" ON "homeworks" USING btree ("school_id","teacher_user_id");
--> statement-breakpoint
CREATE INDEX "homeworks_class_due_idx" ON "homeworks" USING btree ("school_id","class_id","due_at");
--> statement-breakpoint
CREATE INDEX "homeworks_status_idx" ON "homeworks" USING btree ("school_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "exams_school_year_name_unique" ON "exams" USING btree ("school_id","academic_year_id","name");
--> statement-breakpoint
CREATE INDEX "exams_school_status_idx" ON "exams" USING btree ("school_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "exam_subjects_unique" ON "exam_subjects" USING btree ("school_id","exam_id","class_id","subject_id");
--> statement-breakpoint
CREATE INDEX "exam_subjects_exam_idx" ON "exam_subjects" USING btree ("school_id","exam_id");
--> statement-breakpoint
CREATE INDEX "exam_subjects_class_idx" ON "exam_subjects" USING btree ("school_id","class_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "grade_records_subject_student_unique" ON "grade_records" USING btree ("exam_subject_id","student_id");
--> statement-breakpoint
CREATE INDEX "grade_records_student_idx" ON "grade_records" USING btree ("school_id","student_id");
--> statement-breakpoint
CREATE INDEX "grade_records_status_idx" ON "grade_records" USING btree ("school_id","status");
