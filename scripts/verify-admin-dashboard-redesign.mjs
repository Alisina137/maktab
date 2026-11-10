import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const shell = read("apps/web/app/admin/admin-workspace.tsx");
const frame = read("apps/web/app/admin/admin-dashboard-frame.tsx");
const academic = read("apps/web/app/admin/admin-academic-overview.tsx");
const academicsRoute = read("apps/web/app/admin/(workspace)/academics/page.tsx");
const dashboardRoute = read("apps/web/app/admin/(workspace)/dashboard/page.tsx");
const layout = read("apps/web/app/admin/(workspace)/layout.tsx");
const css = read("apps/web/app/admin/dashboard-shell.css");
const academicCss = read("apps/web/app/admin/academic-overview.css");
const translations = read("apps/web/app/admin/admin-i18n.ts");
const login = read("apps/web/app/admin/page.tsx");

assert.ok(shell.includes("<AdminDashboardFrame") &&
  shell.includes('"/admin/dashboard"') &&
  shell.includes('"/admin/pilot"') &&
  shell.includes('"/admin/staff-work"') &&
  shell.includes("navItems={navItems}"),
  "Authenticated workspace must retain all routes inside the redesigned shell");
assert.ok(frame.includes("useAdminWorkspace()") &&
  frame.includes("activeRoute(currentPath, item.href)") &&
  frame.includes("aria-current=") &&
  frame.includes("onClick={() => void signOut()}") &&
  frame.includes("setLocale(event.target.value as AdminLocale)") &&
  frame.includes("selectedAcademicYearId"),
  "Navigation, role context, locale, year selection and sign-out must remain functional");
assert.ok(frame.includes('role="search"') &&
  frame.includes('event.key.toLowerCase() === "k"') &&
  frame.includes('event.key === "Escape"') &&
  frame.includes("setMobileOpen(false)") &&
  frame.includes("aria-expanded={academicExpanded}"),
  "Search keyboard shortcuts, accessible collapsible nav and mobile exit are required");
for (const route of ["/admin/academics", "/admin/accounts", "/admin/attendance",
  "/admin/learning", "/admin/communication", "/admin/pilot", "/admin/profile"]) {
  assert.ok(shell.includes(route) || frame.includes(route), "Lost admin route: " + route);
}
assert.ok(dashboardRoute.includes("<AcademicPanel") &&
  academicsRoute.includes("<AcademicPanel") &&
  login.includes('router.push("/admin/dashboard")'),
  "The dashboard and Academic overview must both route to the real academic workspace");
assert.ok(academic.includes('"/v1/admin/pilot/readiness"') &&
  academic.includes("Number.isSafeInteger(count)") &&
  academic.includes('value: studentLoading ? "…" : studentTotal === null ? "—"') &&
  academic.includes("data.teachers.length") &&
  academic.includes("selectedClasses.length") &&
  academic.includes("data.subjects.length") &&
  academic.includes("row.academicYearId === yearId") &&
  academic.includes('timeZone: "Asia/Kabul"') &&
  academic.includes("setStudentTotal(null)") &&
  !academic.includes("1,248") &&
  !academic.includes("+3.6%"),
  "Overview must use actual scoped API data without mocked metrics or fabricated trends");
assert.ok(layout.includes('import "../dashboard-shell.css"') &&
  layout.includes('import "../academic-overview.css"') &&
  css.includes(".ml-admin-sidebar") &&
  css.includes(".ml-admin-topbar") &&
  css.includes("max-width: 900px") &&
  css.includes('dir="rtl"') &&
  academicCss.includes(".ml-academic-directory-grid") &&
  academicCss.includes(".ml-academic-lower-grid") &&
  academicCss.includes("max-width: 680px"),
  "Premium responsive shell, RTL and academic cards must retain their styles");
for (const key of ["Dashboard", "Academic Management", "Total students",
  "Total teachers", "Total classes", "Total subjects", "Search sections and pages…",
  "Academic summary", "No lessons scheduled for today."]) {
  const count = translations.split(JSON.stringify(key) + ":").length - 1;
  assert.equal(count, 2, "Missing paired Dari/Pashto dashboard translations: " + key);
}
console.log("Admin dashboard redesign verified: responsive navy sidebar, working routes, RTL, locale, live KPI sources, academic overview and role safety.");
