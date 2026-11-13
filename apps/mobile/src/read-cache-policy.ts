/**
 * Pure identity and timestamp guards for read-only offline snapshots.
 *
 * No authenticated request may read/write the cache belonging to a different
 * school or account when the user signs out while a fetch is still pending.
 */
export function cacheScopeMatches(expectedScope: string | null, currentScope: string | null): boolean {
  return typeof expectedScope === "string" &&
    expectedScope.length > 0 && expectedScope === currentScope;
}

/** Future-dated, invalid and stale snapshots are unusable. */
export function cacheIsCurrent(savedAt: unknown, now: number, maxAge: number): boolean {
  if (typeof savedAt !== "string" || !Number.isFinite(now) ||
      !Number.isFinite(maxAge) || maxAge <= 0) return false;
  const timestamp = Date.parse(savedAt);
  return Number.isFinite(timestamp) && timestamp <= now &&
    now - timestamp <= maxAge;
}
