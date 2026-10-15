CREATE TABLE "attendance_closures" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE cascade,
  "academic_year_id" uuid NOT NULL REFERENCES "academic_years"("id") ON DELETE restrict,
  "date" date NOT NULL,
  "reason" varchar(160) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_closures_school_year_date_unique"
  ON "attendance_closures" ("school_id", "academic_year_id", "date");
--> statement-breakpoint
CREATE INDEX "attendance_closures_school_date_idx"
  ON "attendance_closures" ("school_id", "date");
