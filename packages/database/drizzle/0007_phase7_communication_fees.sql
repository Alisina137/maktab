CREATE TYPE "public"."announcement_audience_scope" AS ENUM('SCHOOL', 'CLASS', 'ROLE');
--> statement-breakpoint
CREATE TYPE "public"."fee_invoice_status" AS ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');
--> statement-breakpoint
CREATE TYPE "public"."fee_payment_kind" AS ENUM('PAYMENT', 'REVERSAL');
--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ANDROID', 'IOS');
--> statement-breakpoint
CREATE TYPE "public"."push_delivery_status" AS ENUM('PENDING', 'SENT', 'FAILED');
--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "fee_reminder_days" jsonb DEFAULT '[7,1]'::jsonb NOT NULL;
--> statement-breakpoint
CREATE TABLE "announcements" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "title" varchar(160) NOT NULL,
  "content" text NOT NULL,
  "audience_scope" "announcement_audience_scope" NOT NULL,
  "class_id" uuid,
  "audience_role" "user_role",
  "publish_at" timestamp with time zone NOT NULL,
  "created_by" uuid NOT NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_invoices" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "student_id" uuid NOT NULL,
  "amount" integer NOT NULL,
  "currency" varchar(8) DEFAULT 'AFN' NOT NULL,
  "description" varchar(240),
  "due_date" date NOT NULL,
  "status" "fee_invoice_status" DEFAULT 'DRAFT' NOT NULL,
  "issued_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_payments" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "invoice_id" uuid NOT NULL,
  "kind" "fee_payment_kind" DEFAULT 'PAYMENT' NOT NULL,
  "amount" integer NOT NULL,
  "method" varchar(50) NOT NULL,
  "transaction_reference" varchar(120),
  "reversal_of_payment_id" uuid,
  "reversal_reason" varchar(240),
  "recorded_by" uuid NOT NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "push_token" varchar(512) NOT NULL,
  "platform" "device_platform" NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_push_deliveries" (
  "id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "notification_id" uuid NOT NULL,
  "device_id" uuid NOT NULL,
  "status" "push_delivery_status" DEFAULT 'PENDING' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "provider_message_id" varchar(160),
  "last_error" varchar(500),
  "last_attempt_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_class_id_class_sections_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class_sections"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_invoice_id_fee_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."fee_invoices"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "notification_push_deliveries" ADD CONSTRAINT "notification_push_deliveries_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "notification_push_deliveries" ADD CONSTRAINT "notification_push_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "notification_push_deliveries" ADD CONSTRAINT "notification_push_deliveries_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX "announcements_school_publish_idx" ON "announcements" USING btree ("school_id","publish_at");
--> statement-breakpoint
CREATE INDEX "announcements_class_idx" ON "announcements" USING btree ("school_id","class_id");
--> statement-breakpoint
CREATE INDEX "fee_invoices_student_idx" ON "fee_invoices" USING btree ("school_id","student_id");
--> statement-breakpoint
CREATE INDEX "fee_invoices_due_idx" ON "fee_invoices" USING btree ("school_id","due_date");
--> statement-breakpoint
CREATE INDEX "fee_invoices_status_idx" ON "fee_invoices" USING btree ("school_id","status");
--> statement-breakpoint
CREATE INDEX "fee_payments_invoice_idx" ON "fee_payments" USING btree ("school_id","invoice_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "fee_payments_reversal_unique" ON "fee_payments" USING btree ("school_id","reversal_of_payment_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "devices_push_token_unique" ON "devices" USING btree ("push_token");
--> statement-breakpoint
CREATE INDEX "devices_user_idx" ON "devices" USING btree ("school_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_push_delivery_unique" ON "notification_push_deliveries" USING btree ("notification_id","device_id");
--> statement-breakpoint
CREATE INDEX "notification_push_status_idx" ON "notification_push_deliveries" USING btree ("school_id","status");
