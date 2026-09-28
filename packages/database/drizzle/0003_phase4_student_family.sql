CREATE TYPE "public"."student_status" AS ENUM('ACTIVE', 'WITHDRAWN');
--> statement-breakpoint
CREATE TABLE "parent_profiles" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "full_name" varchar(160) NOT NULL,
  "phone" varchar(32),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "parent_user_id" uuid NOT NULL,
  "student_code" varchar(32) NOT NULL,
  "full_name" varchar(160) NOT NULL,
  "academic_year_id" uuid NOT NULL,
  "class_id" uuid NOT NULL,
  "status" "student_status" DEFAULT 'ACTIVE' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_class_history" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "academic_year_id" uuid NOT NULL,
  "class_id" uuid NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "parent_profiles" ADD CONSTRAINT "parent_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "parent_profiles" ADD CONSTRAINT "parent_profiles_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_parent_user_id_parent_profiles_user_id_fk" FOREIGN KEY ("parent_user_id") REFERENCES "public"."parent_profiles"("user_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_class_sections_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class_sections"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_class_history" ADD CONSTRAINT "student_class_history_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_class_history" ADD CONSTRAINT "student_class_history_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_class_history" ADD CONSTRAINT "student_class_history_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_class_history" ADD CONSTRAINT "student_class_history_class_id_class_sections_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class_sections"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "parent_profiles_school_idx" ON "parent_profiles" USING btree ("school_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "students_school_code_unique" ON "students" USING btree ("school_id","student_code");
--> statement-breakpoint
CREATE INDEX "students_school_class_idx" ON "students" USING btree ("school_id","class_id");
--> statement-breakpoint
CREATE INDEX "students_parent_idx" ON "students" USING btree ("parent_user_id");
--> statement-breakpoint
CREATE INDEX "student_class_history_student_idx" ON "student_class_history" USING btree ("school_id","student_id");
--> statement-breakpoint
CREATE INDEX "student_class_history_class_idx" ON "student_class_history" USING btree ("school_id","class_id");
