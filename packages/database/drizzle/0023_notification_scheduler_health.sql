-- Per-school notification materialization heartbeat; provider acceptance and recipient reads are separate.
ALTER TABLE "communication_settings" ADD COLUMN "scheduler_last_attempt_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "communication_settings" ADD COLUMN "scheduler_last_success_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "communication_settings" ADD COLUMN "scheduler_last_error" varchar(240);
