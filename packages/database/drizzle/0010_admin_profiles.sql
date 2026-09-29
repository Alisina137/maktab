CREATE TABLE "admin_profiles" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "school_id" uuid NOT NULL,
  "full_name" varchar(160) NOT NULL,
  "phone" varchar(32),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "admin_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade,
  CONSTRAINT "admin_profiles_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "admin_profiles_school_idx" ON "admin_profiles" ("school_id");
