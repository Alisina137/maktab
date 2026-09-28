CREATE TYPE "public"."attendance_status" AS ENUM('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');
--> statement-breakpoint
CREATE TYPE "public"."attendance_record_status" AS ENUM('SUBMITTED', 'CORRECTED');
--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'CANCELLED');
--> statement-breakpoint
CREATE TABLE "daily_attendances" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "academic_year_id" uuid NOT NULL,
  "class_id" uuid NOT NULL,
  "date" date NOT NULL,
  "status" "attendance_record_status" DEFAULT 'SUBMITTED' NOT NULL,
  "submitted_by" uuid NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" uuid NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_attendances" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "attendance_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "status" "attendance_status" NOT NULL,
  "note" varchar(240),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "type" varchar(64) NOT NULL,
  "title" varchar(160) NOT NULL,
  "message" text NOT NULL,
  "deep_link" varchar(240),
  "dedup_key" varchar(180) NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "delivery_status" "notification_delivery_status" DEFAULT 'PENDING' NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_attendances" ADD CONSTRAINT "daily_attendances_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "daily_attendances" ADD CONSTRAINT "daily_attendances_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "daily_attendances" ADD CONSTRAINT "daily_attendances_class_id_class_sections_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class_sections"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "daily_attendances" ADD CONSTRAINT "daily_attendances_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "daily_attendances" ADD CONSTRAINT "daily_attendances_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_attendances" ADD CONSTRAINT "student_attendances_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_attendances" ADD CONSTRAINT "student_attendances_attendance_id_daily_attendances_id_fk" FOREIGN KEY ("attendance_id") REFERENCES "public"."daily_attendances"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_attendances" ADD CONSTRAINT "student_attendances_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "daily_attendances_school_class_date_unique" ON "daily_attendances" USING btree ("school_id","class_id","date");
--> statement-breakpoint
CREATE INDEX "daily_attendances_school_date_idx" ON "daily_attendances" USING btree ("school_id","date");
--> statement-breakpoint
CREATE INDEX "daily_attendances_class_date_idx" ON "daily_attendances" USING btree ("school_id","class_id","date");
--> statement-breakpoint
CREATE UNIQUE INDEX "student_attendances_attendance_student_unique" ON "student_attendances" USING btree ("attendance_id","student_id");
--> statement-breakpoint
CREATE INDEX "student_attendances_student_idx" ON "student_attendances" USING btree ("school_id","student_id");
--> statement-breakpoint
CREATE INDEX "student_attendances_status_idx" ON "student_attendances" USING btree ("school_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_school_dedup_unique" ON "notifications" USING btree ("school_id","dedup_key");
--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("school_id","user_id","created_at");
