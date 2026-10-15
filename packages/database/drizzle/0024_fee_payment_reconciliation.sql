-- External cash/bank matching is recorded separately from append-only fee payments.
CREATE TABLE "fee_payment_reconciliations" (
  "payment_id" uuid PRIMARY KEY NOT NULL REFERENCES "fee_payments"("id") ON DELETE restrict,
  "school_id" uuid NOT NULL REFERENCES "schools"("id") ON DELETE cascade,
  "reference" varchar(120),
  "reconciled_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "reconciled_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "fee_payment_reconciliations_school_idx" ON "fee_payment_reconciliations" ("school_id");
