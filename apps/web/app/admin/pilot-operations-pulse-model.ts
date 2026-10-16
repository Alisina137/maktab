/** Phase 8 — fail-closed normalization of read-only operations snapshots.
 * Unknown API payloads are NEVER treated as empty/healthy data.
 * This model has no React/Node imports so it can be tested independently.
 */
export type PilotPulseRole = {
  role: "TEACHER" | "PARENT" | "STUDENT";
  eligible: number;
  signedIn: number;
};
export type PilotPulseAdoption = { roles: PilotPulseRole[] };
export type PilotPulseService = {
  report: {
    notificationQueue: { stalePending: number; failed: number };
    support: { unresolvedCritical: number };
    imports: { failedLast7Days: number };
  };
};
export type PilotPulseRelease = {
  productionDecision: "NO_GO";
  missingExternalGates: string[];
};
export type PilotPulseSnapshot = {
  adoption: PilotPulseAdoption | null;
  service: PilotPulseService | null;
  release: PilotPulseRelease | null;
  failed: number;
};

function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Unexpected response shape.");
  }
  return input as Record<string, unknown>;
}
function natural(input: unknown): number {
  if (!Number.isSafeInteger(input) || (input as number) < 0) {
    throw new Error("Invalid operational count.");
  }
  return input as number;
}

export function parsePulseAdoption(input: unknown): PilotPulseAdoption {
  const obj = record(input);
  if (!Array.isArray(obj.roles) || obj.roles.length !== 3) {
    throw new Error("Invalid adoption role summary.");
  }
  const unique = new Set<string>();
  const roles = obj.roles.map((raw): PilotPulseRole => {
    const row = record(raw);
    if (row.role !== "TEACHER" && row.role !== "PARENT" && row.role !== "STUDENT") {
      throw new Error("Unknown adoption role.");
    }
    if (unique.has(row.role)) throw new Error("Duplicate adoption role.");
    unique.add(row.role);
    const eligible = natural(row.eligible);
    const signedIn = natural(row.signedIn);
    if (signedIn > eligible) throw new Error("Invalid adoption denominator.");
    return { role: row.role, eligible, signedIn };
  });
  return { roles };
}

export function parsePulseService(input: unknown): PilotPulseService {
  const report = record(record(input).report);
  const queue = record(report.notificationQueue);
  const support = record(report.support);
  const imports = record(report.imports);
  return { report: {
    notificationQueue: {
      stalePending: natural(queue.stalePending),
      failed: natural(queue.failed)
    },
    support: { unresolvedCritical: natural(support.unresolvedCritical) },
    imports: { failedLast7Days: natural(imports.failedLast7Days) }
  } };
}

export function parsePulseRelease(input: unknown): PilotPulseRelease {
  const row = record(input);
  if (row.productionDecision !== "NO_GO") {
    throw new Error("Unrecognized production decision.");
  }
  if (!Array.isArray(row.missingExternalGates) ||
    !row.missingExternalGates.every((x: unknown) => typeof x === "string")) {
    throw new Error("Invalid release gate summary.");
  }
  return { productionDecision: "NO_GO", missingExternalGates: row.missingExternalGates };
}

/** No eligible accounts is unknown, not 0%/100%. */
export function pulseSignInCoverage(data: PilotPulseAdoption | null) {
  if (!data) return null;
  const eligible = data.roles.reduce((sum, row) => sum + row.eligible, 0);
  const signedIn = data.roles.reduce((sum, row) => sum + row.signedIn, 0);
  if (!Number.isSafeInteger(eligible) || !Number.isSafeInteger(signedIn) ||
    eligible <= 0 || signedIn > eligible) return null;
  return { signedIn, eligible };
}

/** Distinct event categories can overlap: this is a count of warning
 * observations, not an incidence rate or affected-user count.
 */
export function pulseAlertCount(data: PilotPulseService | null): number | null {
  if (!data) return null;
  const { notificationQueue, support, imports } = data.report;
  const total = notificationQueue.stalePending + notificationQueue.failed +
    support.unresolvedCritical + imports.failedLast7Days;
  return Number.isSafeInteger(total) ? total : null;
}

/** Report-based follow-ups: unavailable is not a green status, and never GO. */
export type PilotPulseAction = {
  kind: "SERVICE_ALERTS" | "SERVICE_UNAVAILABLE" | "SIGN_IN_GAP" |
    "ADOPTION_NO_COHORT" | "ADOPTION_UNAVAILABLE" | "MANUAL_RELEASE" | "RELEASE_UNAVAILABLE";
  href: string; severity: "attention" | "review" | "unverified";
  count?: number; signedIn?: number; eligible?: number;
};
export function pilotPulseActions(snapshot: PilotPulseSnapshot | null): PilotPulseAction[] {
  if (!snapshot) return [];
  const actions: PilotPulseAction[] = [];
  const alerts = pulseAlertCount(snapshot.service);
  if (alerts === null) {
    actions.push({ kind: "SERVICE_UNAVAILABLE", href: "/admin/pilot/service", severity: "unverified" });
  } else if (alerts > 0) {
    actions.push({ kind: "SERVICE_ALERTS", href: "/admin/pilot/service", severity: "attention", count: alerts });
  }
  if (!snapshot.adoption) {
    actions.push({ kind: "ADOPTION_UNAVAILABLE", href: "/admin/pilot/adoption", severity: "unverified" });
  } else {
    const coverage = pulseSignInCoverage(snapshot.adoption);
    const eligible = snapshot.adoption.roles.reduce((total, row) => total + row.eligible, 0);
    if (eligible === 0) {
      actions.push({ kind: "ADOPTION_NO_COHORT", href: "/admin/pilot/onboarding", severity: "review" });
    } else if (!coverage) {
      actions.push({ kind: "ADOPTION_UNAVAILABLE", href: "/admin/pilot/adoption", severity: "unverified" });
    } else if (coverage.signedIn < coverage.eligible) {
      actions.push({ kind: "SIGN_IN_GAP", href: "/admin/pilot/adoption",
        severity: "review", signedIn: coverage.signedIn, eligible: coverage.eligible });
    }
  }
  // A release API response is trustworthy only after parsePulseRelease validates NO_GO.
  actions.push(snapshot.release
    ? { kind: "MANUAL_RELEASE", href: "/admin/pilot/launch", severity: "review" }
    : { kind: "RELEASE_UNAVAILABLE", href: "/admin/pilot/launch", severity: "unverified" });
  return actions;
}
