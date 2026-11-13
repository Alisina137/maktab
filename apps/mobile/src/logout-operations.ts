/**
 * Run independent remote cleanup after local credential removal succeeds.
 * Failure of push deactivation must never prevent refresh-token revocation.
 * The caller deliberately does not await these network tasks before exposing
 * the signed-out onboarding screen.
 */
export async function revokeSignedOutSession(
  accessToken: string | null,
  refreshToken: string | null,
  deactivatePush: (token: string) => Promise<unknown>,
  revokeRefresh: (token: string) => Promise<unknown>
): Promise<{ push: "fulfilled" | "rejected" | "skipped"; auth: "fulfilled" | "rejected" | "skipped" }> {
  const tasks: Promise<unknown>[] = [];
  const kinds: Array<"push" | "auth"> = [];
  if (accessToken) {
    kinds.push("push");
    tasks.push(Promise.resolve().then(() => deactivatePush(accessToken)));
  }
  if (refreshToken) {
    kinds.push("auth");
    tasks.push(Promise.resolve().then(() => revokeRefresh(refreshToken)));
  }
  const settled = await Promise.allSettled(tasks);
  const result: { push: "fulfilled" | "rejected" | "skipped"; auth: "fulfilled" | "rejected" | "skipped" } = {
    push: "skipped", auth: "skipped"
  };
  for (let i = 0; i < settled.length; i += 1)
    result[kinds[i]!] = settled[i]!.status;
  return result;
}

/**
 * A successful local logout must actually delete persisted credentials.
 * One failed native SecureStore write is retried. If both attempts fail, do
 * not pretend logout completed: keep the account available to retry sign out.
 */
export async function removeLocalSessionForLogout(
  clear: () => Promise<void>
): Promise<boolean> {
  try {
    await clear();
    return true;
  } catch {
    try {
      await clear();
      return true;
    } catch {
      return false;
    }
  }
}
