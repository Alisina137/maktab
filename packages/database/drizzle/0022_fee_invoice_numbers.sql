-- School-scoped, immutable invoice numbers. Backfill existing invoices in stable order.
ALTER TABLE "fee_invoices" ADD COLUMN "invoice_number" integer;
--> statement-breakpoint
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "school_id" ORDER BY "created_at", "id") AS invoice_no
  FROM "fee_invoices"
)
UPDATE "fee_invoices" AS target
SET "invoice_number" = ranked.invoice_no
FROM ranked WHERE target."id" = ranked."id";
--> statement-breakpoint
ALTER TABLE "fee_invoices" ALTER COLUMN "invoice_number" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "fee_invoices_school_number_unique" ON "fee_invoices" ("school_id", "invoice_number");
--> statement-breakpoint
CREATE TABLE "fee_invoice_counters" (
  "school_id" uuid PRIMARY KEY NOT NULL REFERENCES "schools"("id") ON DELETE cascade,
  "last_number" integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
INSERT INTO "fee_invoice_counters" ("school_id", "last_number")
SELECT "school_id", MAX("invoice_number")
FROM "fee_invoices"
GROUP BY "school_id";
