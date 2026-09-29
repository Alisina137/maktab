ALTER TABLE "admin_profiles" ADD COLUMN "job_title" varchar(120);
--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN "image_url" text;
--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN "email" varchar(254);
--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN "whatsapp" varchar(32);
--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN "office_location" varchar(200);
--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN "office_hours" varchar(160);
--> statement-breakpoint
ALTER TABLE "admin_profiles" ADD COLUMN "bio" text;
