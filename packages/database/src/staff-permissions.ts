/** Staff positions are descriptive only. Permissions are always explicit,
 * school-scoped grants, never inferred from job title or UI navigation. */
export const STAFF_POSITIONS = [
  "RECEPTIONIST", "REGISTRATION_OFFICER", "ATTENDANCE_OFFICER",
  "ACCOUNTANT", "ADMIN_ASSISTANT", "COMMUNICATIONS_OFFICER",
  "LIBRARIAN", "OPERATIONS_SUPERVISOR", "OTHER"
] as const;
export type StaffPosition = typeof STAFF_POSITIONS[number];
export const STAFF_PERMISSIONS = [
  "DIRECTORY_VIEW", "ENROLLMENT_REQUESTS", "ATTENDANCE_REVIEW",
  "FEES_VIEW", "FEES_COLLECT", "TASKS_VIEW", "COMMUNICATION_DRAFT", "REPORTS_VIEW"
] as const;
export type StaffPermission = typeof STAFF_PERMISSIONS[number];

export interface StaffProfileInput {
  fullName: string;
  employeeCode: string | null;
  position: StaffPosition;
  department: string;
  permissions: StaffPermission[];
}
export interface StaffProfile extends StaffProfileInput {
  schoolId: string;
  userId: string;
  updatedAt: Date;
}
export function isStaffPermission(value: unknown): value is StaffPermission {
  return typeof value === "string" && (STAFF_PERMISSIONS as readonly string[]).includes(value);
}
export function normalizeStaffPermissions(input: unknown): StaffPermission[] {
  if (!Array.isArray(input) || input.length > STAFF_PERMISSIONS.length ||
      input.some(item => !isStaffPermission(item)) ||
      new Set(input).size !== input.length) throw new Error("Invalid staff permissions.");
  // Fail-closed: unknown persisted permissions can never grant access.
  return [...input].sort() as StaffPermission[];
}
export function hasStaffPermission(input: unknown, permission: StaffPermission): boolean {
  try { return normalizeStaffPermissions(input).includes(permission); }
  catch { return false; }
}
