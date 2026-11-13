import { createHash, timingSafeEqual } from "node:crypto";

export interface ReadinessProbeOptions {
  /** Prevent repeated DB probes during load-balancer and monitoring scrapes. */
  ttlMs?: number;
  /** A hanging database cannot hang an HTTP readiness request indefinitely. */
  timeoutMs?: number;
  now?: () => number;
}

/** A bounded single-flight, fail-closed health check (no DB credentials exposed). */
export function createReadinessProbe(
  check: () => Promise<boolean>,
  options: ReadinessProbeOptions = {}
): () => Promise<boolean> {
  const { ttlMs = 1_500, timeoutMs = 3_500, now = Date.now } = options;
  if (!(ttlMs > 0 && Number.isFinite(ttlMs)) ||
      !(timeoutMs > 0 && Number.isFinite(timeoutMs))) {
    throw new Error("Readiness probe intervals must be positive.");
  }

  let expiresAt = 0;
  let cached = false;
  let running: Promise<boolean> | null = null;

  return async () => {
    if (expiresAt > now()) return cached;
    if (running) return running;

    const work = (async () => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      try {
        const checked = Promise.resolve().then(check).then(Boolean, () => false);
        const timedOut = new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), timeoutMs);
        });
        cached = await Promise.race([checked, timedOut]);
        expiresAt = now() + ttlMs;
        return cached;
      } finally {
        if (timer) clearTimeout(timer);
      }
    })();

    running = work;
    try {
      return await work;
    } finally {
      if (running === work) running = null;
    }
  };
}

/**
 * Metrics are process-wide operational data, not school-user data.
 * Require a dedicated secret, NOT a provision/admin credential; never
 * expose internal counters just because /health is public.
 */
export function hasMetricsBearer(
  authorization: unknown,
  configuredToken: string | undefined
): boolean {
  if (!configuredToken || typeof authorization !== "string" ||
      !authorization.startsWith("Bearer ")) return false;
  const expected = createHash("sha256").update(configuredToken, "utf8").digest();
  const provided = createHash("sha256").update(authorization.slice(7), "utf8").digest();
  return timingSafeEqual(expected, provided);
}
