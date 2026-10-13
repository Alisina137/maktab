/** Stability thresholds for noisy Expo/ngrok development networks. */
export const NETWORK_WARNING_GRACE_MS = 6500;
export const NETWORK_RECOVERY_CHECK_INTERVAL_MS = 4500;
export const NETWORK_AUTO_RECOVERY_SUCCESSES = 2;
export const NETWORK_RECOVERY_NOTICE_AFTER_MS = 30_000;

/** Reset the streak on ANY failed health or authenticated session probe. */
export function recoveryProbeStreak(previous: number, success: boolean): number {
  return success ? previous + 1 : 0;
}

export function recoveryIsStable(streak: number, manual: boolean): boolean {
  return manual || streak >= NETWORK_AUTO_RECOVERY_SUCCESSES;
}

/** Short, self-healing interruptions must not create another popup. */
export function showRecoveryNotice(
  manual: boolean,
  warningShownAt: number | null,
  now: number
): boolean {
  return manual || (warningShownAt !== null && now - warningShownAt >= NETWORK_RECOVERY_NOTICE_AFTER_MS);
}
