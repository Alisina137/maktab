export const RELEASE_ACCEPTANCE_CHECKS = [
  { id: "20.1", name: "Platform and administrator provisioning" },
  { id: "20.2", name: "Academic setup and timetable" },
  { id: "20.3", name: "Parent/student provisioning and family linking" },
  { id: "20.4", name: "Teacher and Negaran assignment" },
  { id: "20.5", name: "Parent complete journey on Android" },
  { id: "20.6", name: "Student complete journey on Android" },
  { id: "20.7", name: "Teacher complete journey on Android" },
  { id: "20.8", name: "Attendance end to end" },
  { id: "20.9", name: "Homework end to end" },
  { id: "20.10", name: "Exams, grades, publication and correction" },
  { id: "20.11", name: "Announcements, notification delivery and deep links" },
  { id: "20.12", name: "Fees, payment reconciliation and replay protection" },
  { id: "20.13", name: "Subscription and account lifecycle" },
  { id: "20.14", name: "Cross-role, cross-school security and session revocation" },
  { id: "20.15", name: "Dari, Pashto, English and Solar Hijri localization" },
  { id: "20.16", name: "Android, tablet, responsive, keyboard and TalkBack accessibility" },
  { id: "20.17", name: "Offline, reconnection and token refresh" },
  { id: "20.18", name: "Live PostgreSQL migration, backup and restore" },
  { id: "20.19", name: "Exact-commit CI, build, push, scheduler and monitoring" }
] as const;

export const RELEASE_EXTERNAL_GATES = [
  "exact_commit_ci",
  "real_postgres_migrations",
  "encrypted_backup_restore",
  "web_android_role_journeys",
  "cross_school_security",
  "rtl_accessibility",
  "offline_reconnection",
  "live_push_scheduler",
  "concurrent_payments",
  "rollback_incident_runbook",
  "operator_signoff"
] as const;

export type ReleaseManualGateId = typeof RELEASE_EXTERNAL_GATES[number];
export type ReleaseChecklistStatus = "UNVERIFIED" | "NO_GO";

export type SchoolReleaseReadiness = {
  productionDecision: "NO_GO";
  policy: "MANUAL_RELEASE_ACCEPTANCE_REQUIRED";
  setupReady: boolean;
  recordedPilotApproval: boolean;
  effectivePilotApproval: boolean;
  evidenceVerified: number;
  evidenceRequired: number;
  openCriticalTickets: number;
  checks: Array<{ id: string; name: string; status: ReleaseChecklistStatus }>;
  missingExternalGates: readonly ReleaseManualGateId[];
  summary: string;
};

// This endpoint cannot inspect actual CI SHA, deployed devices, the live
// PostgreSQL instance, push providers or independent external proof.
// It MUST NOT infer production GO from school/pilot records.
export function evaluateSchoolReleaseReadiness(input: {
  setupReady: boolean;
  recordedPilotApproval: boolean;
  evidenceVerified: number;
  evidenceRequired: number;
  openCriticalTickets: number;
}): SchoolReleaseReadiness {
  const effectivePilotApproval =
    input.setupReady &&
    input.recordedPilotApproval &&
    input.evidenceRequired > 0 &&
    input.evidenceVerified === input.evidenceRequired &&
    input.openCriticalTickets === 0;
  return {
    productionDecision: "NO_GO",
    policy: "MANUAL_RELEASE_ACCEPTANCE_REQUIRED",
    setupReady: input.setupReady,
    recordedPilotApproval: input.recordedPilotApproval,
    effectivePilotApproval,
    evidenceVerified: input.evidenceVerified,
    evidenceRequired: input.evidenceRequired,
    openCriticalTickets: input.openCriticalTickets,
    checks: [
      ...RELEASE_ACCEPTANCE_CHECKS.map((check) => ({
        ...check, status: "UNVERIFIED" as const
      })),
      { id: "20.20", name: "Final independent production release decision", status: "NO_GO" as const }
    ],
    missingExternalGates: RELEASE_EXTERNAL_GATES,
    summary: effectivePilotApproval
      ? "Pilot approval is recorded; production release remains blocked pending independently verified Step 20 operational evidence and a final operator decision."
      : "Pilot and/or configuration requirements are incomplete; independent Step 20 production release evidence and operator approval remain outstanding."
  };
}
