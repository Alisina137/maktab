-- Durable pilot launch evidence, support tickets, review trail and platform-only decision.
CREATE TABLE IF NOT EXISTS "pilot_launch_evidence" (
 "id" uuid PRIMARY KEY NOT NULL,
 "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE cascade,
 "category" varchar(40) NOT NULL,
 "reference" varchar(500) NOT NULL,
 "note" varchar(2000) NOT NULL,
 "status" varchar(16) NOT NULL DEFAULT 'SUBMITTED',
 "submitted_by" uuid REFERENCES "users"("id") ON DELETE set null,
 "reviewed_by" varchar(80),
 "review_note" varchar(1000),
 "reviewed_at" timestamp with time zone,
 "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
 CONSTRAINT "pilot_launch_evidence_status_check" CHECK ("status" IN ('SUBMITTED','VERIFIED','REJECTED')),
 CONSTRAINT "pilot_launch_evidence_category_check" CHECK ("category" IN ('CROSS_ROLE','DATABASE','BACKUP_RESTORE','NOTIFICATIONS_JOBS','ACCESSIBILITY_RTL'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pilot_launch_evidence_school_category_unique" ON "pilot_launch_evidence"("school_id","category");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pilot_support_tickets" (
 "id" uuid PRIMARY KEY NOT NULL,
 "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE cascade,
 "created_by" uuid REFERENCES "users"("id") ON DELETE set null,
 "subject" varchar(160) NOT NULL,
 "description" varchar(3000) NOT NULL,
 "category" varchar(32) NOT NULL,
 "priority" varchar(16) NOT NULL DEFAULT 'NORMAL',
 "status" varchar(24) NOT NULL DEFAULT 'OPEN',
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
 CONSTRAINT "pilot_support_category_check" CHECK ("category" IN ('ACCESS','ACADEMICS','DATA','BILLING','TECHNICAL','OTHER')),
 CONSTRAINT "pilot_support_priority_check" CHECK ("priority" IN ('NORMAL','HIGH','CRITICAL')),
 CONSTRAINT "pilot_support_status_check" CHECK ("status" IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pilot_support_tickets_school_time_idx" ON "pilot_support_tickets"("school_id","created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pilot_support_updates" (
 "id" uuid PRIMARY KEY NOT NULL,
 "ticket_id" uuid NOT NULL REFERENCES "pilot_support_tickets"("id") ON DELETE cascade,
 "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE cascade,
 "author_kind" varchar(16) NOT NULL,
 "actor_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
 "note" varchar(2000) NOT NULL,
 "status_after" varchar(24),
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 CONSTRAINT "pilot_support_author_kind_check" CHECK ("author_kind" IN ('SCHOOL','PLATFORM')),
 CONSTRAINT "pilot_support_updates_status_check" CHECK ("status_after" IS NULL OR "status_after" IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pilot_support_updates_ticket_time_idx" ON "pilot_support_updates"("ticket_id","created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pilot_launch_decisions" (
 "school_id" uuid PRIMARY KEY REFERENCES "schools"("id") ON DELETE cascade,
 "status" varchar(24) NOT NULL DEFAULT 'NOT_APPROVED',
 "operator_label" varchar(80),
 "note" varchar(1000),
 "reviewed_at" timestamp with time zone,
 "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
 CONSTRAINT "pilot_launch_decisions_status_check" CHECK ("status" IN ('NOT_APPROVED','APPROVED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pilot_launch_decision_history" (
 "id" uuid PRIMARY KEY NOT NULL,
 "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE cascade,
 "status" varchar(24) NOT NULL,
 "operator_label" varchar(80) NOT NULL,
 "note" varchar(1000) NOT NULL,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 CONSTRAINT "pilot_launch_decision_history_status_check" CHECK ("status" IN ('NOT_APPROVED','APPROVED'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pilot_launch_decision_history_school_idx" ON "pilot_launch_decision_history"("school_id","created_at");
