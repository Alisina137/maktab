DO $$ BEGIN
  CREATE TYPE "school_status" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "language_code" AS ENUM ('fa-AF', 'ps-AF', 'en');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "schools" (
  "id" uuid PRIMARY KEY NOT NULL,
  "code" varchar(32) NOT NULL UNIQUE,
  "name" varchar(160) NOT NULL,
  "slug" varchar(100) NOT NULL UNIQUE,
  "province" varchar(100) NOT NULL,
  "city" varchar(100) NOT NULL,
  "status" "school_status" DEFAULT 'ACTIVE' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "school_settings" (
  "school_id" uuid PRIMARY KEY NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "default_language" "language_code" DEFAULT 'fa-AF' NOT NULL,
  "timezone" varchar(64) DEFAULT 'Asia/Kabul' NOT NULL,
  "date_system" varchar(32) DEFAULT 'solar-hijri' NOT NULL,
  "week_starts_on" integer DEFAULT 6 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
