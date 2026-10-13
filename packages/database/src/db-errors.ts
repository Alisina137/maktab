/**
 * Drizzle may wrap driver errors (for example, PostgreSQL 23505) in a
 * DrizzleQueryError whose outer message only says "Failed query".
 * Detect constraint failures through the complete cause chain, without
 * mistaking arbitrary SQL or network errors for a duplicate record.
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current = error;
  while (current != null && !seen.has(current)) {
    seen.add(current);
    if (typeof current === "object") {
      const candidate = current as { code?: unknown; message?: unknown; cause?: unknown };
      if (candidate.code === "23505") return true;
      if (
        typeof candidate.message === "string" &&
        /duplicate key|unique constraint|unique violation/i.test(candidate.message)
      ) {
        return true;
      }
      current = candidate.cause;
    } else {
      break;
    }
  }
  return false;
}
