import type { StaffSession } from "./staff-client.js";

/** Persisted sessionStorage is user-controlled input, never an authorization source. */
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 512): value is string =>
  typeof value === "string" && !!value.trim() && value.length <= max;
const instant = (value: unknown): number =>
  typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value)
    ? Date.parse(value) : NaN;

/** Never restore suspended/archived/cross-school/expired Staff credentials. */
export function validStoredStaffSession(value: unknown, now = Date.now()): value is StaffSession {
  if (!record(value) || !record(value.school) || !record(value.session)) return false;
  const { school, session } = value;
  if (!record(session.user)) return false;
  const user = session.user;
  return typeof school.id === "string" && uuid.test(school.id) &&
    text(school.name, 180) && text(school.code, 80) &&
    typeof user.id === "string" && uuid.test(user.id) &&
    user.schoolId === school.id && user.role === "SCHOOL_STAFF" &&
    user.status === "ACTIVE" && user.mustChangePassword === false &&
    session.mustChangePassword === false && text(user.username, 160) &&
    text(session.accessToken, 4096) && text(session.refreshToken, 4096) &&
    Number.isFinite(instant(session.accessExpiresAt)) &&
    Number.isFinite(instant(session.refreshExpiresAt)) &&
    instant(session.refreshExpiresAt) > now;
}

/** Staff profile must be independently verified against the same school and user. */
export function verifiedStaffProfileIdentity(
  stored: StaffSession, profile: unknown
): boolean {
  if (!record(profile) || !record(profile.user) || !record(profile.school)) return false;
  return profile.user.id === stored.session.user.id &&
    profile.user.role === "SCHOOL_STAFF" && profile.user.status === "ACTIVE" &&
    profile.school.id === stored.school.id;
}

/** Only an explicit revocation is terminal; a provider outage is recoverable. */
export function staffSessionMustExit(
  error: unknown,
  path: string
): boolean {
  if (!record(error) || typeof error.status !== "number") return false;
  const code = typeof error.code === "string" ? error.code : "";
  if (path === "/v1/auth/change-password" &&
    error.status === 401 && code === "current_password_invalid") return false;
  if (error.status === 401) return true;
  if (error.status === 403 && code !== "permission_denied") return true;
  // 503 / network failures should display retry and preserve identity.
  return false;
}

/** Discard responses from before logout, account switch or route removal. */
export function staffRequestIdentityCurrent(
  startEpoch: number,
  nowEpoch: number,
  startId: string,
  startSchoolId: string,
  current: StaffSession | null
): boolean {
  return startEpoch === nowEpoch &&
    current?.session.user.id === startId &&
    current.school.id === startSchoolId;
}
