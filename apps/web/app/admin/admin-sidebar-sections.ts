import { ATTENDANCE_TABS } from "./attendance-workspace-model";
import { PILOT_TABS } from "./pilot-operations-navigation";
import { FAMILY_TABS } from "./family-tabs-model";

/** Real destinations only: standalone routes and routable existing tabs.
 * No mock screens or new permissions. */
export type AdminSidebarItem = { label: string; href: string };

const academicItems: AdminSidebarItem[] = [
  { label: "Overview", href: "/admin/academics" },
  { label: "Academic years", href: "/admin/academics/years" },
  { label: "Grade levels", href: "/admin/academics/grades" },
  { label: "Classes", href: "/admin/academics/classes" },
  { label: "Subjects", href: "/admin/academics/subjects" },
  { label: "Teacher profiles", href: "/admin/academics/teachers" },
  { label: "Teacher assignments", href: "/admin/academics/assignments" },
  { label: "Negaran assignments", href: "/admin/academics/negaran" },
  { label: "Timetable periods", href: "/admin/academics/timetable" },
  { label: "Curriculum units", href: "/admin/academics/curriculum" }
];

function tabItems(path: string, items: ReadonlyArray<{ id: string; label: string }>): AdminSidebarItem[] {
  return items.map(({ id, label }, index) => ({
    label,
    href: index === 0 ? path : path + "?tab=" + id.toLowerCase()
  }));
}

export const adminSidebarSections: Record<string, readonly AdminSidebarItem[]> = {
  "/admin/academics": academicItems,
  "/admin/accounts": tabItems("/admin/accounts", [
    { id: "DIRECTORY", label: "Account directory" },
    { id: "CREATE", label: "Create account" }
  ]),
  "/admin/families": FAMILY_TABS.map((tab, index) => ({
    label: index === 0 ? "Overview" : tab.label,
    href: index === 0 ? "/admin/families" : "/admin/families?tab=" + tab.id
  })),
  "/admin/staff-work": tabItems("/admin/staff-work", [
    { id: "tasks", label: "Staff work" },
    { id: "drafts", label: "Communication drafts" }
  ]),
  "/admin/attendance": tabItems("/admin/attendance", ATTENDANCE_TABS),
  "/admin/learning": tabItems("/admin/learning", [
    { id: "OVERVIEW", label: "Overview" },
    { id: "HOMEWORK", label: "Homework" },
    { id: "EXAMS", label: "Exams" },
    { id: "RESULTS", label: "Gradebook & results" },
    { id: "TEACHING", label: "Teaching progress" },
    { id: "REPORTS", label: "Reports & audit" }
  ]),
  "/admin/communication": tabItems("/admin/communication", [
    { id: "OVERVIEW", label: "Overview" },
    { id: "COMMUNICATION", label: "Communication" },
    { id: "FEES", label: "Fees" }
  ]),
  "/admin/pilot": PILOT_TABS.map((item) => ({ label: item.label, href: item.href }))
};

export function sidebarItemIsActive(
  itemHref: string, pathname: string, searchTab: string | null, fragment: string
): boolean {
  const url = new URL(itemHref, "http://localhost");
  if (pathname !== url.pathname) return false;
  if (url.hash) return url.hash === fragment;
  if (url.searchParams.has("tab")) return url.searchParams.get("tab") === searchTab?.toLowerCase();
  return !searchTab && !fragment;
}
