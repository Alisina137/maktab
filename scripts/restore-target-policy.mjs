/**
 * Destructive backup recovery must never silently reuse the main DATABASE_URL.
 * A restore requires a separate staging connection and a typed database-name
 * confirmation, not just a one-word approval flag.
 */
export function validateRestoreTarget(env) {
  if (env.CONFIRM_RESTORE !== "YES") {
    throw new Error("Restore requires CONFIRM_RESTORE=YES.");
  }
  if (env.RESTORE_TARGET !== "staging") {
    throw new Error("Restore is restricted to an explicitly designated staging target.");
  }
  const candidate = env.RESTORE_DATABASE_URL?.trim();
  if (!candidate) throw new Error("RESTORE_DATABASE_URL must point to a separate disposable staging database.");

  let target;
  try { target = new URL(candidate); } catch {
    throw new Error("RESTORE_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(target.protocol) ||
      !target.hostname || !target.pathname.slice(1)) {
    throw new Error("RESTORE_DATABASE_URL must be a complete PostgreSQL URL.");
  }
  const databaseName = decodeURIComponent(target.pathname.slice(1));
  if (!databaseName || /[\r\n\0]/.test(databaseName)) {
    throw new Error("Invalid restore target database name.");
  }
  if (env.CONFIRM_RESTORE_DATABASE !== databaseName) {
    throw new Error("CONFIRM_RESTORE_DATABASE must exactly match the staging database name.");
  }
  if (!env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL must identify the original protected application database.");
  }
  let original;
  try { original = new URL(env.DATABASE_URL); } catch {
    throw new Error("DATABASE_URL must be valid before comparing restore targets.");
  }
  if (!["postgres:", "postgresql:"].includes(original.protocol) ||
      !original.hostname || !original.pathname.slice(1)) {
    throw new Error("DATABASE_URL must be a complete PostgreSQL URL.");
  }
  // Neon pooled and direct hosts represent the SAME logical DB. Comparing
  // string URLs, usernames or SSL flags alone would miss that equivalence.
  const projectHost = (url) => url.hostname.toLowerCase().replace("-pooler.", ".");
  const sameCluster = projectHost(original) === projectHost(target);
  const sameDatabase = decodeURIComponent(original.pathname.slice(1)) === databaseName;
  if (sameCluster && sameDatabase) {
    throw new Error("Refusing restore: staging target resolves to the main application database.");
  }

  return candidate;
}
