-- Step 17: safe payment retry after a lost response.
-- NULL keeps legacy payments compatible; new Admin UI supplies a UUID key.
ALTER TABLE "fee_payments" ADD COLUMN "idempotency_key" uuid;
--> statement-breakpoint
CREATE UNIQUE INDEX "fee_payments_idempotency_unique" ON "fee_payments" ("school_id", "invoice_id", "idempotency_key");
