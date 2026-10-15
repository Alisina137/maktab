-- Compare-and-swap claim for background push handoffs (not device-delivery receipts).
ALTER TABLE "notifications" ADD COLUMN "push_claim_token" uuid;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "push_claim_until" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "notifications_push_lease_idx" ON "notifications" ("delivery_status", "push_claim_until");
