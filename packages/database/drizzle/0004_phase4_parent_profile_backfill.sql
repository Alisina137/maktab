INSERT INTO "parent_profiles" (
  "user_id",
  "school_id",
  "full_name",
  "phone",
  "created_at",
  "updated_at"
)
SELECT
  "users"."id",
  "users"."school_id",
  "users"."username",
  NULL,
  "users"."created_at",
  now()
FROM "users"
WHERE
  "users"."role" = 'PARENT'
  AND NOT EXISTS (
    SELECT 1
    FROM "parent_profiles"
    WHERE "parent_profiles"."user_id" = "users"."id"
  )
ON CONFLICT ("user_id") DO NOTHING;
