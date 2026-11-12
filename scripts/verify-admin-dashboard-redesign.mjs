import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const shell = read("apps/web/app/admin/admin-workspace.tsx");
const frame = read("apps/web/app/admin/admin-dashboard-frame.tsx");
const academic = read("apps/web/app/admin/admin-academic-overview.tsx");
const academicsRoute = read("apps/web/app/admin/(workspace)/academics/page.tsx");
const academicsLayout = read("apps/web/app/admin/(workspace)/academics/layout.tsx");
const academicNavigation = read("apps/web/app/admin/academic-section-navigation.tsx");
const academicSectionRoute = read("apps/web/app/admin/(workspace)/academics/[section]/page.tsx");
const dashboardRoute = read("apps/web/app/admin/(workspace)/dashboard/page.tsx");
const layout = read("apps/web/app/admin/(workspace)/layout.tsx");
const css = read("apps/web/app/admin/dashboard-shell.css");
const academicCss = read("apps/web/app/admin/academic-overview.css");
const adminType = read("apps/web/app/admin/admin-typography.css");
assert.ok(adminType.includes("--ml-admin-type-body: 13.5px") &&
  adminType.includes("--ml-admin-type-list-title: 14px") &&
  adminType.includes("--ml-admin-type-meta: 12px") &&
  adminType.includes("--ml-admin-type-action: 12.5px") &&
  adminType.includes(".account-directory-scaled .admin-user-identity > div > strong") &&
  adminType.includes(".account-directory-scaled .admin-user-identity > div > span") &&
  adminType.includes(".account-directory-scaled .admin-user-row-premium .admin-actions button") &&
  adminType.includes("min-height: 42px") &&
  adminType.includes(".academic-list-panel") &&
  adminType.includes(".learning-section") &&
  adminType.includes(".family-section") &&
  adminType.includes(".communication-section") &&
  adminType.includes("@media (max-width: 650px)") &&
  layout.includes('import "../admin-typography.css"'),
  "Admin typography should balance directory/list text and controls without changing other app surfaces");
const translations = read("apps/web/app/admin/admin-i18n.ts");
const login = read("apps/web/app/admin/page.tsx");
const sidebar = read("apps/web/app/admin/admin-sidebar-sections.ts");
const academicIcons = read("apps/web/app/admin/academic-section-icons.tsx");
const subnavIcons = read("apps/web/app/admin/admin-subnav-icons.tsx");
const sectionRoute = read("apps/web/app/admin/admin-section-route.ts");
const attendance = read("apps/web/app/admin/attendance-panel.tsx");
const learning = read("apps/web/app/admin/learning-panel.tsx");
const communication = read("apps/web/app/admin/communication-panel.tsx");
const accounts = read("apps/web/app/admin/(workspace)/accounts/page.tsx");
const accountCreateCss = read("apps/web/app/admin/account-create-layout.css");
const staffWork = read("apps/web/app/admin/(workspace)/staff-work/page.tsx");


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
  frame.includes("aria-expanded={open}") &&
  frame.includes('data-admin-no-loading="true"') &&
  frame.includes("adminSidebarSections[item.href]"),
  "Search keyboard shortcuts, accessible collapsible nav and mobile exit are required");
// The sidebar width must shrink as a grid column, not merely hide its labels.
assert.ok(css.includes("grid-template-columns: 256px minmax(0, 1fr)") &&
  css.includes("main.ml-admin-dashboard-shell.admin-workspace.admin-shell-premium.ml-admin-compact") &&
  css.includes("grid-template-columns: 73px minmax(0, 1fr)") &&
  css.includes("@media (min-width: 901px)") &&
  css.includes("@media (max-width: 900px)") &&
  frame.includes('(compact ? " ml-admin-compact" : "")') &&
  frame.includes('setCompact((current) => !current)') &&
  frame.includes('aria-expanded={isMobileLayout ? mobileOpen : !compact}') &&
  frame.includes('aria-controls="ml-admin-sidebar"') &&
  frame.includes('data-admin-no-loading="true" onClick={toggleSidebar}') &&
  frame.includes('mobileQuery.addEventListener("change", syncLayout)') &&
  frame.includes('title={t("Administrator profile")}') &&
  ["Open sidebar", "Expand sidebar", "Collapse sidebar"].every((key) =>
    translations.split(JSON.stringify(key) + ":").length === 3),
  "Hamburger must shrink desktop grid to 73px, preserve the mobile drawer and expose localized toggle state");

assert.ok(frame.includes('ml-admin-nav-row-academic') &&
  frame.includes('ml-admin-nav-row-active') &&
  frame.includes('data-admin-no-loading="true"') &&
  frame.includes('aria-controls={groupId + "-subnav"}') &&
  frame.includes('setExpandedGroup((current) =>') &&
  css.includes('grid-template-columns: minmax(0, 1fr) 40px') &&
  css.includes('.ml-admin-nav-row-academic .ml-admin-side-link-active') &&
  css.includes('position: relative;\n  inset: auto;\n  top: auto;') &&
  css.includes('.ml-admin-compact .ml-admin-nav-row-academic') &&
  css.includes('.ml-admin-subnav-toggle:focus-visible'),
  "All sidebar expand/collapse buttons must stay in bounded tracks in desktop, compact and RTL/mobile layouts");
// Account view controls must remain side by side and the actual creation
// form should present role and account information in parallel at wide widths.
assert.ok(accounts.includes('import "../../account-create-layout.css"') &&
  accounts.includes('className="admin-account-view-switch"') &&
  accounts.includes('className="account-create-step-grid"') &&
  accounts.includes('className="account-create-step account-create-step-role"') &&
  accounts.includes('className="account-create-step account-create-step-details"') &&
  accounts.includes('aria-labelledby="account-create-role-heading"') &&
  accounts.includes('aria-labelledby="account-create-information-heading"') &&
  accounts.includes('className="account-create-footer"') &&
  accounts.includes('noValidate onSubmit={createUser}') &&
  accounts.includes('disabled={busy || (newRole === "STUDENT"') &&
  accountCreateCss.includes("grid-template-columns: repeat(2, minmax(0, 1fr))") &&
  accountCreateCss.includes("width: min(100%, 362px)") &&
  accountCreateCss.includes("width: min(100%, 1160px)") &&
  accountCreateCss.includes("grid-template-columns: minmax(0, .84fr) minmax(0, 1.16fr)") &&
  accountCreateCss.includes("@container (max-width: 780px)") &&
  accountCreateCss.includes("@media (max-width: 650px)") &&
  accountCreateCss.includes(".ml-admin-dashboard-shell .account-create-footer > .admin-primary"),
  "Accounts create layout must have a 2-button switch and 2-column guided form with mobile fallback");

for (const group of ["/admin/academics", "/admin/accounts", "/admin/families",
  "/admin/attendance", "/admin/learning", "/admin/communication",
  "/admin/staff-work", "/admin/pilot"]) {
  assert.ok(sidebar.includes('"' + group + '"'), "Missing sidebar submenu: " + group);
}
// Each of the ten real Academics destinations must have a distinct icon.
for (const route of [
  "/admin/academics", "/admin/academics/years", "/admin/academics/grades",
  "/admin/academics/classes", "/admin/academics/subjects",
  "/admin/academics/teachers", "/admin/academics/assignments",
  "/admin/academics/negaran", "/admin/academics/timetable",
  "/admin/academics/curriculum"
]) {
  assert.ok(academicIcons.includes(JSON.stringify(route) + ":"),
    "Academics subtab missing icon: " + route);
}
assert.ok(frame.includes('const hasIcon = Boolean(adminSubnavIconPaths[entry.href])') &&
  frame.includes('<AdminSubnavIcon href={entry.href} size={16} />') &&
  frame.includes('ml-admin-subnav-dot') &&
  academicNavigation.includes('<AcademicSectionIcon href={item.href} size={16} />') &&
  academicIcons.includes('aria-hidden="true"') &&
  css.includes(".ml-admin-subnav-icon") &&
  css.includes(".ml-admin-subnav-link-active .ml-admin-subnav-icon") &&
  academicCss.includes(".ml-academic-tab > svg"),
  "Academics tab icons must cover the sidebar and overview without changing other submenus");


// Every other administrator sidebar subsection must have a route-bound icon.
const subtabIconRoutes = [
  "/admin/accounts", "/admin/accounts?tab=create",
  "/admin/families", "/admin/families?tab=parent-account",
  "/admin/families?tab=student-account", "/admin/families?tab=bulk-import",
  "/admin/staff-work", "/admin/staff-work?tab=drafts",
  "/admin/attendance", ...["registers", "students", "followups", "reports", "audit", "staff_requests"].map(tab => "/admin/attendance?tab=" + tab),
  "/admin/learning", ...["homework", "exams", "results", "teaching", "reports"].map(tab => "/admin/learning?tab=" + tab),
  "/admin/communication", "/admin/communication?tab=communication", "/admin/communication?tab=fees",
  "/admin/pilot", ...["readiness", "onboarding", "adoption", "service", "oversight", "subscription", "audit", "launch"].map(section => "/admin/pilot/" + section)
];
for(const route of subtabIconRoutes) {
  assert.ok(subnavIcons.includes(JSON.stringify(route) + ":"),
    "Missing administrator sidebar icon: " + route);
}
for(const extra of ["invoices", "payments", "balances", "reports"]) {
  assert.ok(subnavIcons.includes(JSON.stringify("/admin/communication#" + extra) + ":"),
    "Fee module missing icon: " + extra);
}
assert.ok(subnavIcons.includes("...academicSectionIconPaths") &&
  frame.includes('const hasIcon = Boolean(adminSubnavIconPaths[entry.href])') &&
  css.includes(".ml-admin-tab-with-icon") &&
  accounts.includes('<AdminSubnavIcon href="/admin/accounts" />') &&
  attendance.includes("<AdminSubnavIcon href=") &&
  learning.includes("<AdminSubnavIcon href=") &&
  communication.includes("<AdminSubnavIcon href=") &&
  staffWork.includes('<AdminSubnavIcon href="/admin/staff-work" />'),
  "All administrator sidebar and page subtabs need icons");

assert.ok(sidebar.includes("PILOT_TABS.map") && sidebar.includes("ATTENDANCE_TABS") &&
  sidebar.includes("sidebarItemIsActive") && frame.includes("sidebarItemIsActive(") &&
  frame.includes("aria-current={selected ?") &&
  sectionRoute.includes('searchParams.get("tab")') &&
  sectionRoute.includes('scroll: false'), "Sidebar deep links, selected states or history navigation regressed");
for (const panel of [attendance, learning, communication, accounts, staffWork]) {
  assert.ok(panel.includes("useAdminSectionRoute(") && panel.includes("navigateTab(") &&
    panel.includes("routedTab"), "An existing admin tab view lost URL synchronization");
}
for (const route of ["/admin/academics", "/admin/accounts", "/admin/attendance",
  "/admin/learning", "/admin/communication", "/admin/pilot", "/admin/profile"]) {
  assert.ok(shell.includes(route) || frame.includes(route), "Lost admin route: " + route);
}
assert.ok(dashboardRoute.includes("<AcademicPanel") &&
  academicsRoute.includes("<AcademicPanel") &&
  login.includes('router.push("/admin/dashboard")'),
  "The dashboard and Academic overview must both route to the real academic workspace");
assert.ok(academicsLayout.includes("<AcademicSectionNavigation />") &&
  academicsLayout.includes("{children}") &&
  academicNavigation.includes('adminSidebarSections["/admin/academics"]') &&
  academicNavigation.includes('usePathname()') &&
  academicNavigation.includes('pathname === item.href') &&
  academicNavigation.includes('aria-current={selected ? "page" : undefined}') &&
  academicNavigation.includes('<AcademicSectionIcon href={item.href} size={16} />') &&
  academicNavigation.includes('aria-label={t("Academic sections")}') &&
  academicSectionRoute.includes('return <AcademicPanel') &&
  !academic.includes('className="ml-academic-tabbar"') &&
  academic.includes('className="ml-academic-overview-tools"') &&
  academicCss.includes('grid-template-columns: repeat(5, minmax(0, 1fr))') &&
  academicCss.includes('.ml-academic-tab-active') &&
  academicCss.includes('@media (max-width: 550px)'),
  "Academic navigation must be complete, persistent on every section route, and highlight the current page");
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
