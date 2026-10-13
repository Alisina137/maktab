CREATE TABLE "teacher_tasks" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "teacher_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(160) NOT NULL,
  "details" varchar(1500) DEFAULT '' NOT NULL,
  "priority" varchar(12) DEFAULT 'NORMAL' NOT NULL,
  "status" varchar(12) DEFAULT 'OPEN' NOT NULL,
  "due_on" date,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "teacher_tasks_priority_check" CHECK ("priority" IN ('LOW','NORMAL','HIGH')),
  CONSTRAINT "teacher_tasks_status_check" CHECK ("status" IN ('OPEN','DONE')),
  CONSTRAINT "teacher_tasks_title_check" CHECK (length(trim("title")) > 0)
);
--> statement-breakpoint
CREATE INDEX "teacher_tasks_owner_status_idx" ON "teacher_tasks" ("school_id","teacher_user_id","status");
--> statement-breakpoint
CREATE INDEX "teacher_tasks_due_idx" ON "teacher_tasks" ("school_id","teacher_user_id","due_on");