import type { SessionPayload, SchoolOption } from "./api";

/**
 * Every async auth write must still belong to the exact session which started
 * it. Matching only user ID is insufficient: a password change, session
 * refresh, or logout can rotate credentials for the SAME user.
 */
export function sameSessionEpoch(
  current: SessionPayload | null,
  starting: SessionPayload,
  currentSchool: SchoolOption | null,
  startingSchool: SchoolOption
): boolean {
  return !!current && !!currentSchool &&
    current.user.id === starting.user.id &&
    current.user.schoolId === starting.user.schoolId &&
    current.user.role === starting.user.role &&
    current.accessToken === starting.accessToken &&
    current.refreshToken === starting.refreshToken &&
    currentSchool.id === startingSchool.id;
}
