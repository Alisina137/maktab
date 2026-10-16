/** Usage/Adoption improvements Phase 4.
 * Sanitized school-level aggregates only. Never identify users, fabricate daily
 * active usage, or turn a missing denominator into a healthy percentage.
 */
export type AdoptionWindow = "today" | "7d" | "30d";
export type AdoptionRole = "TEACHER" | "PARENT" | "STUDENT";
export type AdoptionRoleMetric = {
  role: AdoptionRole; eligible: number; signedIn: number; activated: number;
  signedInPercent: number | null; activatedPercent: number | null;
};
export type AdoptionActivities = {
  homeworkPublished: number; homeworkSubmissions: number;
  attendanceClassDays: number; attendanceStudentMarks: number;
  announcementsPublished: number;
};
export type AdoptionReport = {
  window: AdoptionWindow; startAt: string; endAt: string; timeZone: "Asia/Kabul";
  roles: AdoptionRoleMetric[]; activities: AdoptionActivities;
};
export type AdoptionFollowUp = {
  key: string; role: AdoptionRole; kind: "empty" | "activation" | "latest_login";
  count: number; total: number; href: string;
};
export type AdoptionSummary = {
  eligible: number; activated: number; signedIn: number;
  activatedPercent: number | null; signedInPercent: number | null;
  followUps: AdoptionFollowUp[];
};
const roles = ["TEACHER", "PARENT", "STUDENT"] as const;
const activityKeys = [
  "homeworkPublished", "homeworkSubmissions", "attendanceClassDays",
  "attendanceStudentMarks", "announcementsPublished"
] as const;
function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Unexpected usage report.");
  return input as Record<string, unknown>;
}
function natural(input: unknown): number {
  if (!Number.isSafeInteger(input) || (input as number) < 0)
    throw new Error("Invalid usage count.");
  return input as number;
}
function percent(denominator: number, numerator: number): number | null {
  return denominator ? Math.round(numerator / denominator * 100) : null;
}
export function parseAdoptionReport(input: unknown, requestedWindow: AdoptionWindow): AdoptionReport {
  const data = object(input);
  if (data.window !== requestedWindow || data.timeZone !== "Asia/Kabul" ||
      typeof data.startAt !== "string" || typeof data.endAt !== "string")
    throw new Error("Mismatched usage reporting scope.");
  const start = Date.parse(data.startAt), end = Date.parse(data.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end ||
      !/^\d{4}-\d{2}-\d{2}T/.test(data.startAt) ||
      !/^\d{4}-\d{2}-\d{2}T/.test(data.endAt))
    throw new Error("Invalid usage reporting period.");
  if (!Array.isArray(data.roles) || data.roles.length !== roles.length)
    throw new Error("Incomplete role coverage.");
  const seen = new Set<string>();
  const parsedRoles = data.roles.map((raw): AdoptionRoleMetric => {
    const row = object(raw);
    const role = row.role;
    if (typeof role !== "string" || !roles.some(value => value === role) || seen.has(role))
      throw new Error("Unknown or repeated role.");
    seen.add(role);
    const eligible = natural(row.eligible);
    const signedIn = natural(row.signedIn);
    const activated = natural(row.activated);
    if (signedIn > eligible || activated > eligible ||
        row.signedInPercent !== percent(eligible, signedIn) ||
        row.activatedPercent !== percent(eligible, activated))
      throw new Error("Contradictory role coverage.");
    return { role: role as AdoptionRole, eligible, signedIn, activated,
      signedInPercent: percent(eligible, signedIn),
      activatedPercent: percent(eligible, activated) };
  });
  const rawActivities = object(data.activities);
  const activities = Object.fromEntries(activityKeys.map(key => [key, natural(rawActivities[key])]))
    as AdoptionActivities;
  return { window: requestedWindow, timeZone: "Asia/Kabul",
    startAt: data.startAt, endAt: data.endAt, roles: parsedRoles, activities };
}
/** Advisory follow-ups describe recorded accounts. Latest-login coverage is
 * an approximation: no sign-in in this window is not proof of inactivity.
 */
export function adoptionSummary(report: AdoptionReport): AdoptionSummary {
  const eligible = report.roles.reduce((sum, item) => sum + item.eligible, 0);
  const activated = report.roles.reduce((sum, item) => sum + item.activated, 0);
  const signedIn = report.roles.reduce((sum, item) => sum + item.signedIn, 0);
  const followUps: AdoptionFollowUp[] = [];
  for (const role of report.roles) {
    const href = role.role === "TEACHER" ? "/admin/academics/teachers" :
      role.role === "STUDENT" ? "/admin/families" : "/admin/accounts";
    if (role.eligible === 0) {
      followUps.push({key: role.role + "-empty", role: role.role, kind: "empty",
        count: 0, total: 0, href });
    } else {
      if (role.activated < role.eligible) followUps.push({
        key: role.role + "-activation", role: role.role, kind: "activation",
        count: role.eligible - role.activated, total: role.eligible, href: "/admin/accounts"
      });
      if (role.signedIn < role.eligible) followUps.push({
        key: role.role + "-latest-login", role: role.role, kind: "latest_login",
        count: role.eligible - role.signedIn, total: role.eligible,
        href: "/admin/accounts"
      });
    }
  }
  return { eligible, activated, signedIn,
    activatedPercent: percent(eligible, activated),
    signedInPercent: percent(eligible, signedIn), followUps };
}
