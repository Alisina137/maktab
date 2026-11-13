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

/**
 * A compact hash is used only to fit the SecureStore key; it is not a
 * cryptographic identity boundary. The persisted envelope MUST carry the
 * exact tenant/user namespace and URL path to reject key collisions.
 */
export function cacheEnvelopeBelongsTo(
  envelope: unknown, expectedScope: string | null, expectedPath: string, version: number
): boolean {
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return false;
  const row = envelope as Record<string, unknown>;
  return typeof version === "number" && Number.isInteger(version) &&
    row.version === version &&
    cacheScopeMatches(expectedScope, row.owner as string | null) &&
    typeof row.path === "string" && row.path === expectedPath &&
    Object.prototype.hasOwnProperty.call(row, "data");
}
