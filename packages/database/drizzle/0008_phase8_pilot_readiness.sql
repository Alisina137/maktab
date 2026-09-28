CREATE TYPE "public"."subscription_status" AS ENUM('TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE', 'SUSPENDED', 'CANCELLED');
--> statement-breakpoint
CREATE TYPE "public"."billing_cycle" AS ENUM('MONTHLY', 'ANNUAL');
--> statement-breakpoint
CREATE TABLE "subscriptions" (
  "school_id" uuid PRIMARY KEY NOT NULL,
  "plan_code" varchar(64) DEFAULT 'PILOT' NOT NULL,
  "status" "subscription_status" DEFAULT 'TRIAL' NOT NULL,
  "billing_cycle" "billing_cycle" DEFAULT 'ANNUAL' NOT NULL,
  "price_afn" integer DEFAULT 0 NOT NULL,
  "setup_fee_afn" integer DEFAULT 0 NOT NULL,
  "starts_on" date,
  "expires_on" date,
  "grace_ends_on" date,
  "support_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "subscriptions_expiry_idx" ON "subscriptions" USING btree ("expires_on");
--> statement-breakpoint
INSERT INTO "subscriptions" (
  "school_id",
  "plan_code",
  "status",
  "billing_cycle",
  "price_afn",
  "setup_fee_afn",
  "starts_on",
  "expires_on",
  "grace_ends_on"
)
SELECT
  "id",
  'PILOT',
  'ACTIVE',
  'ANNUAL',
  0,
  0,
  CURRENT_DATE,
  NULL,
  NULL
FROM "schools"
ON CONFLICT ("school_id") DO NOTHING;
