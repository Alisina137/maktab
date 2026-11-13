/**
 * Instance-local scheduler guard: a slower-than-interval job is not launched
 * a second time. Database-level idempotent claims still protect multiple
 * API instances; this guard prevents redundant local load.
 */
export function createNonOverlappingJob(
  run: () => Promise<void>,
  onFailure: () => void
) {
  let running: Promise<void> | null = null;
  let stopping = false;

  function trigger(): Promise<void> {
    if (stopping) return Promise.resolve();
    if (running) return running;
    const task = Promise.resolve().then(run).catch(() => {
      // Do not pass raw exceptions to logs: DB/SMTP errors may contain
      // connection strings, tokens or student information.
      try { onFailure(); } catch { /* Logging may be unavailable during shutdown. */ }
    }).finally(() => {
      if (running === task) running = null;
    });
    running = task;
    return task;
  }

  async function stop(graceMs = 5_000): Promise<boolean> {
    stopping = true;
    if (!running) return true;
    if (!Number.isFinite(graceMs) || graceMs < 1) {
      throw new Error("Scheduler shutdown grace period must be positive.");
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        running.then(() => true),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), graceMs);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return { trigger, stop };
}
