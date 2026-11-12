/** Canonical family workflow tabs, shared by the sidebar and family panel. */
export const FAMILY_TABS = [
  { id: "add-student", label: "Add student" },
  { id: "parent-account", label: "Parent account" },
  { id: "student-account", label: "Student account" },
  { id: "bulk-import", label: "Bulk import" }
] as const;

export type FamilyTab = (typeof FAMILY_TABS)[number]["id"];
