import type { StoredSession } from "./session.js";

const ROLES = new Set(["TEACHER", "PARENT", "STUDENT"]);
const STATUSES = new Set(["INVITED", "ACTIVE", "SUSPENDED", "ARCHIVED"]);
const LANGUAGES = new Set(["fa-AF", "ps-AF", "en"]);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const plain = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const nonempty = (v: unknown, max = 400): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
const isoDate = (v: unknown): v is string => typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(v) &&
  Number.isFinite(Date.parse(v));

/** Untrusted persisted JSON must never reach the mobile UI as a trusted session. */
export function validStoredSession(input: unknown): input is StoredSession {
  if (!plain(input) || !plain(input.auth) || !plain(input.school)) return false;
  const { auth, school } = input;
  if (!plain(auth.user)) return false;
  const user = auth.user;
  return typeof school.id === "string" && UUID.test(school.id) &&
    nonempty(school.code, 80) && nonempty(school.name, 180) &&
    nonempty(school.province, 120) && nonempty(school.city, 120) &&
    (school.imageUrl === null || typeof school.imageUrl === "string" &&
      school.imageUrl.length <= 2048) && LANGUAGES.has(String(school.defaultLanguage)) &&
    typeof user.id === "string" && UUID.test(user.id) &&
    user.schoolId === school.id &&
    nonempty(user.username, 160) && ROLES.has(String(user.role)) &&
    STATUSES.has(String(user.status)) &&
    typeof user.mustChangePassword === "boolean" &&
    typeof auth.mustChangePassword === "boolean" &&
    nonempty(auth.accessToken, 4096) && nonempty(auth.refreshToken, 4096) &&
    isoDate(auth.accessExpiresAt) && isoDate(auth.refreshExpiresAt);
}

/** Used to limit preference records to real school+parent+student UUIDs. */
export function validStudentPreferenceId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function parseParentChildPreferences(input: unknown): Record<string, string> {
  if (!plain(input)) return Object.create(null) as Record<string, string>;
  const prefs: Record<string, string> = Object.create(null) as Record<string, string>;
  // Old/modified SecureStore data can be arbitrarily large or contain
  // dangerous prototype keys. Retain only recent structurally valid entries.
  for (const [key, value] of Object.entries(input).slice(-100)) {
    const [school, parent, extra] = key.split(":");
    if (extra !== undefined || !validStudentPreferenceId(school) ||
        !validStudentPreferenceId(parent) || !validStudentPreferenceId(value)) continue;
    prefs[key] = value;
  }
  return prefs;
}
