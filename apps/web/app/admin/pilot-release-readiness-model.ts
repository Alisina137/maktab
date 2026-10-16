/** Final pilot-integration gate: normalize read-only school release evidence.
 * School setup or pilot approval NEVER authorizes production deployment.
 * Keep private/unrecognized response fields out of the UI.
 */
export type PilotReleaseCheck = { id: string; name: string; status: "UNVERIFIED" | "NO_GO" };
export type PilotReleaseResult = {
  productionDecision: "NO_GO";
  policy: "MANUAL_RELEASE_ACCEPTANCE_REQUIRED";
  setupReady: boolean; recordedPilotApproval: boolean;
  effectivePilotApproval: boolean;
  evidenceVerified: number; evidenceRequired: number;
  openCriticalTickets: number;
  checks: PilotReleaseCheck[];
  missingExternalGates: string[];
};
export const REQUIRED_EXTERNAL_GATES = [
  "exact_commit_ci", "real_postgres_migrations", "encrypted_backup_restore",
  "web_android_role_journeys", "cross_school_security", "rtl_accessibility",
  "offline_reconnection", "live_push_scheduler", "concurrent_payments",
  "rollback_incident_runbook", "operator_signoff"
] as const;
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Release status is not independently verified.");
  return value as Record<string, unknown>;
}
function natural(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error("Invalid release evidence count.");
  return value as number;
}
/** Fail closed on a forged GO, missing checks, unexpected gates, unsafe counts,
 * or a pilot-approval flag inconsistent with the school evidence.
 */
export function parsePilotReleaseResult(raw: unknown): PilotReleaseResult {
  const data = record(raw);
  if (data.productionDecision !== "NO_GO" ||
      data.policy !== "MANUAL_RELEASE_ACCEPTANCE_REQUIRED" ||
      typeof data.setupReady !== "boolean" ||
      typeof data.recordedPilotApproval !== "boolean" ||
      typeof data.effectivePilotApproval !== "boolean")
    throw new Error("Unrecognized production release decision.");
  const evidenceVerified = natural(data.evidenceVerified);
  const evidenceRequired = natural(data.evidenceRequired);
  const openCriticalTickets = natural(data.openCriticalTickets);
  if (evidenceVerified > evidenceRequired) throw new Error("Inconsistent release evidence.");
  const effectivePilotApproval = data.setupReady && data.recordedPilotApproval &&
    evidenceRequired > 0 && evidenceVerified === evidenceRequired && openCriticalTickets === 0;
  if (data.effectivePilotApproval !== effectivePilotApproval)
    throw new Error("Contradictory pilot approval.");
  const missingExternalGates = data.missingExternalGates;
  if (!Array.isArray(missingExternalGates) ||
      missingExternalGates.length !== REQUIRED_EXTERNAL_GATES.length ||
      new Set(missingExternalGates).size !== REQUIRED_EXTERNAL_GATES.length ||
      !REQUIRED_EXTERNAL_GATES.every(gate => missingExternalGates.includes(gate)))
    throw new Error("Incomplete independent release gates.");
  if (!Array.isArray(data.checks) || data.checks.length !== 20)
    throw new Error("Incomplete Step 20 release checklist.");
  const checks = data.checks.map((rawCheck, i): PilotReleaseCheck => {
    const c = record(rawCheck);
    const id = "20." + (i + 1);
    if (c.id !== id || typeof c.name !== "string" || c.name.trim().length < 4 ||
        c.name.length > 180 ||
        c.status !== (i === 19 ? "NO_GO" : "UNVERIFIED"))
      throw new Error("Invalid or out-of-order release check.");
    return { id, name: c.name, status: i === 19 ? "NO_GO" : "UNVERIFIED" };
  });
  return { productionDecision:"NO_GO", policy:"MANUAL_RELEASE_ACCEPTANCE_REQUIRED",
    setupReady:data.setupReady, recordedPilotApproval:data.recordedPilotApproval,
    effectivePilotApproval, evidenceVerified, evidenceRequired,
    openCriticalTickets, checks,
    missingExternalGates:[...REQUIRED_EXTERNAL_GATES] };
}
export type PilotReleaseSummary = {
  checked: number; unverified: number; productionDecision: "NO_GO";
};
/** Count only independently checked steps, never treat school configuration as a gate. */
export function pilotReleaseSummary(release: PilotReleaseResult): PilotReleaseSummary {
  return {
    checked: 0,
    unverified: release.checks.filter(c => c.status === "UNVERIFIED").length +
      (release.checks.some(c => c.status === "NO_GO") ? 1 : 0),
    productionDecision:"NO_GO"
  };
}
