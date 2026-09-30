ALTER TABLE "admin_profiles" ADD COLUMN "two_factor_email" varchar(254);
--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN "two_factor_phone" varchar(32);
--> statement-breakpoint
UPDATE "admin_profiles"
SET "two_factor_email" = "email"
WHERE "two_factor_email" IS NULL AND "email" IS NOT NULL;
--> statement-breakpoint
UPDATE "admin_profiles"
SET "two_factor_phone" = "phone"
WHERE "two_factor_phone" IS NULL AND "phone" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "admin_password_verifications" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "email_code_hash" varchar(64) NOT NULL,
  "sms_code_hash" varchar(64) NOT NULL,
  "verification_token_hash" varchar(64),
  "attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "verified_at" timestamp with time zone,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "admin_password_verifications_school_id_schools_id_fk"
    FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "admin_password_verifications_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "admin_password_verifications_user_idx"
ON "admin_password_verifications" USING btree ("school_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_password_verifications_token_unique"
ON "admin_password_verifications" USING btree ("verification_token_hash");
