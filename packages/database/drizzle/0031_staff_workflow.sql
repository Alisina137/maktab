-- Phase 7: assigned staff tasks, draft communications, and personal display settings.
CREATE TABLE "staff_work_tasks" (
  "id" uuid PRIMARY KEY,
  "school_id" uuid NOT NULL,
  "assigned_to" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "title" varchar(160) NOT NULL,
  "details" varchar(2000) NOT NULL DEFAULT '',
  "priority" varchar(12) NOT NULL DEFAULT 'NORMAL',
  "status" varchar(20) NOT NULL DEFAULT 'TODO',
  "due_date" date,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "staff_work_priority" CHECK ("priority" IN ('LOW','NORMAL','HIGH')),
  CONSTRAINT "staff_work_status" CHECK ("status" IN ('TODO','IN_PROGRESS','DONE','CANCELLED')),
  CONSTRAINT "staff_work_assignee_school_fk" FOREIGN KEY ("school_id","assigned_to") REFERENCES "users"("school_id","id") ON DELETE CASCADE,
  CONSTRAINT "staff_work_creator_school_fk" FOREIGN KEY ("school_id","created_by") REFERENCES "users"("school_id","id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX "staff_work_assignee_idx" ON "staff_work_tasks"("school_id","assigned_to","status","due_date");
--> statement-breakpoint
CREATE TABLE "staff_message_drafts" (
  "id" uuid PRIMARY KEY,
  "school_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "title" varchar(160) NOT NULL,
  "content" text NOT NULL,
  "audience_scope" varchar(16) NOT NULL DEFAULT 'SCHOOL',
  "audience_role" varchar(16),
  "status" varchar(16) NOT NULL DEFAULT 'DRAFT',
  "reviewed_by" uuid,
  "review_note" varchar(500),
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "staff_message_audience" CHECK (
    ("audience_scope"='SCHOOL' AND "audience_role" IS NULL)
    OR ("audience_scope"='ROLE' AND "audience_role" IN ('TEACHER','PARENT','STUDENT'))
  ),
  CONSTRAINT "staff_message_status" CHECK ("status" IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
  CONSTRAINT "staff_message_author_school_fk" FOREIGN KEY ("school_id","created_by") REFERENCES "users"("school_id","id") ON DELETE CASCADE,
  CONSTRAINT "staff_message_reviewer_school_fk" FOREIGN KEY ("school_id","reviewed_by") REFERENCES "users"("school_id","id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX "staff_message_review_idx" ON "staff_message_drafts"("school_id","status","created_at");
--> statement-breakpoint
CREATE TABLE "staff_workspace_preferences" (
  "school_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "show_notification_badge" boolean NOT NULL DEFAULT true,
  "compact_task_view" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("school_id","user_id"),
  CONSTRAINT "staff_workspace_owner_fk" FOREIGN KEY ("school_id","user_id") REFERENCES "users"("school_id","id") ON DELETE CASCADE
);
