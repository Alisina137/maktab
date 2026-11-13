/** Staff portal navigation is capability-driven, never inferred from job title. */
export type StaffWorkspaceTab =
  | "home" | "directory" | "registration" | "attendance"
  | "fees" | "work" | "notifications" | "settings";

export function permittedStaffTabs(permissions: readonly string[] | null | undefined): StaffWorkspaceTab[] {
  const grants = new Set(permissions ?? []);
  return [
    "home",
    ...(grants.has("DIRECTORY_VIEW") ? ["directory" as const] : []),
    ...(grants.has("ENROLLMENT_REQUESTS") ? ["registration" as const] : []),
    ...(grants.has("ATTENDANCE_REVIEW") ? ["attendance" as const] : []),
    ...(grants.has("FEES_VIEW") || grants.has("FEES_COLLECT") ? ["fees" as const] : []),
    ...(grants.has("TASKS_VIEW") || grants.has("COMMUNICATION_DRAFT") ? ["work" as const] : []),
    "notifications",
    "settings"
  ];
}

export function fallbackStaffTab(
  tab: StaffWorkspaceTab, permissions: readonly string[] | null | undefined
): StaffWorkspaceTab {
  return permittedStaffTabs(permissions).includes(tab) ? tab : "home";
}
