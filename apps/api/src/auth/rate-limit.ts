/**
 * A bounded fixed-window limiter for inexpensive per-process defense.
 * Distributed deployments must add a shared, atomic limiter at their edge.
 */
export class LoginRateLimiter {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxAttempts = 10,
    private readonly windowMs = 5 * 60 * 1000,
    private readonly maxKeys = 10_000
  ) {}

  consume(key: string, now = Date.now()): boolean {
    const current = this.attempts.get(key);
    if (!current || current.resetAt <= now) {
      if (!current && this.attempts.size >= this.maxKeys) {
        // Expired keys must not cause a memory leak under username/IP spraying.
        for (const [candidate, record] of this.attempts) {
          if (record.resetAt <= now) this.attempts.delete(candidate);
        }
        // Fail closed if the active-key budget is exhausted.
        if (this.attempts.size >= this.maxKeys) return false;
      }
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (current.count >= this.maxAttempts) return false;
    current.count += 1;
    return true;
  }

  clear(key: string): void {
    this.attempts.delete(key);
  }
}
