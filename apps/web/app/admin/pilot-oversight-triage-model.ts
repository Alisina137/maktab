/** Phase 6: validate paged, privacy-safe school oversight events.
 * No event implies unresolved ticket state, production approval or uptime.
 */
export type OversightWindow = "7d" | "30d" | "90d";
export type OversightKind = "ALL" | "SUPPORT" | "EVIDENCE" | "DECISION" | "IMPORT" | "EXPORT";
type EventKind = Exclude<OversightKind, "ALL">;
export type OversightEvent = { id: string; kind: EventKind; action: string; occurredAt: string };
export type OversightPage = {
  events: OversightEvent[]; limit: number; offset: number; hasMore: boolean;
  window: OversightWindow; kind: OversightKind; startAt: string; endAt: string; timeZone: "Asia/Kabul";
};
export type OversightRelease = {
  productionDecision: "NO_GO"; setupReady: boolean; effectivePilotApproval: boolean;
  evidenceVerified: number; evidenceRequired: number; openCriticalTickets: number;
  missingExternalGates: string[];
};
export type OversightPageSummary = {
  events: number; needsReview: number; support: number; imports: number;
  evidenceAndDecisions: number; exports: number; start: number; end: number;
};
export const oversightActionKind: Record<string, EventKind> = {
  SUPPORT_OPENED: "SUPPORT", SUPPORT_IN_PROGRESS: "SUPPORT",
  SUPPORT_RESOLVED: "SUPPORT", SUPPORT_CLOSED: "SUPPORT", SUPPORT_REPLIED: "SUPPORT",
  EVIDENCE_SUBMITTED: "EVIDENCE", EVIDENCE_REVIEWED: "EVIDENCE",
  PILOT_APPROVED: "DECISION", PILOT_NOT_APPROVED: "DECISION",
  IMPORT_COMPLETED: "IMPORT", IMPORT_REJECTED: "IMPORT", IMPORT_FAILED: "IMPORT",
  AUDIT_EXPORTED: "EXPORT", SCHOOL_DATA_EXPORTED: "EXPORT"
};
export const oversightReviewActions = new Set([
  "SUPPORT_OPENED", "IMPORT_REJECTED", "IMPORT_FAILED", "PILOT_NOT_APPROVED"
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const externalGates = new Set([
  "exact_commit_ci", "real_postgres_migrations", "encrypted_backup_restore",
  "web_android_role_journeys", "cross_school_security", "rtl_accessibility",
  "offline_reconnection", "live_push_scheduler", "concurrent_payments",
  "rollback_incident_runbook", "operator_signoff"
]);
function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Unverified oversight response.");
  return input as Record<string, unknown>;
}
function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error("Invalid oversight count.");
  return value as number;
}
function instant(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value))
    throw new Error("Invalid oversight timestamp.");
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("Invalid oversight timestamp.");
  return parsed;
}
export function parseOversightPage(
  input: unknown, requested: { window: OversightWindow; kind: OversightKind; limit: number; offset: number }
): OversightPage {
  const data = record(input);
  const start = instant(data.startAt), end = instant(data.endAt);
  if (start > end || data.timeZone !== "Asia/Kabul" || data.window !== requested.window ||
      data.kind !== requested.kind || data.limit !== requested.limit ||
      data.offset !== requested.offset || typeof data.hasMore !== "boolean" ||
      !Array.isArray(data.events) || data.events.length > requested.limit ||
      (data.hasMore && data.events.length !== requested.limit))
    throw new Error("Inconsistent oversight page.");
  const seen = new Set<string>();
  const events = data.events.map((raw): OversightEvent => {
    const row = record(raw);
    if (typeof row.id !== "string" || !uuid.test(row.id) ||
        typeof row.action !== "string" ||
        oversightActionKind[row.action] !== row.kind ||
        (requested.kind !== "ALL" && row.kind !== requested.kind))
      throw new Error("Unknown oversight event.");
    const occurred = instant(row.occurredAt);
    if (occurred < start || occurred > end) throw new Error("Event outside requested reporting period.");
    const key = row.kind + ":" + row.id;
    if (seen.has(key)) throw new Error("Duplicated oversight event.");
    seen.add(key);
    return { id: row.id, action: row.action, kind: row.kind as EventKind,
      occurredAt: row.occurredAt as string };
  });
  return { events, limit: requested.limit, offset: requested.offset, hasMore: data.hasMore,
    window: requested.window, kind: requested.kind, startAt: data.startAt as string,
    endAt: data.endAt as string, timeZone: "Asia/Kabul" };
}
export function parseOversightRelease(input: unknown): OversightRelease {
  const report = record(input);
  if (report.productionDecision !== "NO_GO" ||
      report.policy !== "MANUAL_RELEASE_ACCEPTANCE_REQUIRED" ||
      typeof report.setupReady !== "boolean" ||
      typeof report.recordedPilotApproval !== "boolean" ||
      typeof report.effectivePilotApproval !== "boolean" ||
      !Array.isArray(report.missingExternalGates))
    throw new Error("Unverified production release gate.");
  const evidenceVerified = count(report.evidenceVerified);
  const evidenceRequired = count(report.evidenceRequired);
  const openCriticalTickets = count(report.openCriticalTickets);
  const gates = report.missingExternalGates;
  if (evidenceVerified > evidenceRequired ||
      gates.length !== externalGates.size ||
      new Set(gates).size !== externalGates.size ||
      !gates.every(gate => typeof gate === "string" && externalGates.has(gate)))
    throw new Error("Inconsistent release evidence.");
  const effective = report.setupReady && report.recordedPilotApproval &&
    evidenceRequired > 0 && evidenceVerified === evidenceRequired && openCriticalTickets === 0;
  if (report.effectivePilotApproval !== effective) throw new Error("Inconsistent pilot approval.");
  return { productionDecision: "NO_GO", setupReady: report.setupReady,
    effectivePilotApproval: effective, evidenceVerified, evidenceRequired,
    openCriticalTickets, missingExternalGates: [...externalGates] };
}
/** This is the loaded server PAGE, not an all-time or window-wide total. */
export function summarizeOversightPage(page: OversightPage): OversightPageSummary {
  const events = page.events;
  return {
    events: events.length,
    needsReview: events.filter(e => oversightReviewActions.has(e.action)).length,
    support: events.filter(e => e.kind === "SUPPORT").length,
    imports: events.filter(e => e.kind === "IMPORT").length,
    evidenceAndDecisions: events.filter(e => e.kind === "EVIDENCE" || e.kind === "DECISION").length,
    exports: events.filter(e => e.kind === "EXPORT").length,
    start: events.length ? page.offset + 1 : 0,
    end: events.length ? page.offset + events.length : 0
  };
}
