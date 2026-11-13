/**
 * Only user-facing read-only data may be saved in the account's offline
 * snapshot store. In particular NEVER persist auth/me, credentials, file
 * downloads, public lookups, upload endpoints or device/push responses.
 */
const OFFLINE_READS = new Set([
  "/v1/school/admin-contact",
  "/v1/parent/home",
  "/v1/notifications",
  "/v1/announcements",
  "/v1/student/home",
  "/v1/student/timetable",
  "/v1/student/attendance",
  "/v1/student/fees",
  "/v1/teacher/today",
  "/v1/teacher/academics",
  "/v1/teacher/tasks",
  "/v1/teacher/learning"
]);

const OFFLINE_READ_PATTERNS = [
  /^\/v1\/parent\/children\/[a-z0-9-]{1,80}\/(?:attendance|timetable|fees|learning)$/,
  /^\/v1\/teacher\/classes\/[a-z0-9-]{1,80}$/,
  /^\/v1\/teacher\/negaran\/[a-z0-9-]{1,80}\/(?:history|attendance)$/,
  /^\/v1\/teacher\/exam-subjects\/[a-z0-9-]{1,80}\/grades$/
];

/** A future endpoint must be consciously reviewed before offline persistence. */
export function offlineReadPathAllowed(path: string): boolean {
  if (!path.startsWith("/v1/") || path.length > 800 ||
      /[\u0000-\u001f#]/.test(path) ||
      /[?&](?:token|access_token|refresh_token|secret|password|code)=/i.test(path))
    return false;
  const pathname = path.split("?")[0]!;
  return OFFLINE_READS.has(pathname) ||
    OFFLINE_READ_PATTERNS.some(pattern => pattern.test(pathname));
}

export function canPersistOfflineRead(
  path: string, method: string, hasBearer: boolean,
  hasScope: boolean, cacheEnabled: boolean
): boolean {
  return method.toUpperCase() === "GET" && hasBearer && hasScope &&
    cacheEnabled && offlineReadPathAllowed(path);
}

/** An async call's identity epoch must survive all network and storage awaits. */
export function requestIdentityCurrent(
  startingScope: string | null, startingEpoch: number,
  currentScope: string | null, currentEpoch: number
): boolean {
  return typeof startingScope === "string" && startingScope.length > 0 &&
    startingScope === currentScope && startingEpoch === currentEpoch;
}
