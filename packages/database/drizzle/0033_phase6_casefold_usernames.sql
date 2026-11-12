-- Final audit Phase 6: school-scoped identity uniqueness is case-insensitive.
-- No user is renamed/deleted automatically. Existing collisions must be
-- resolved on a restored staging database before migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM users
    GROUP BY school_id, lower(username)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Phase 6 username case-fold collisions detected. Resolve duplicate usernames before migration 0033.';
  END IF;
END
$$;
--> statement-breakpoint
CREATE UNIQUE INDEX "users_school_username_casefold_unique"
  ON "users" ("school_id", lower("username"));
