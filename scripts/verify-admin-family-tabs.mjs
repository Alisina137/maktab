// Four real Family workflows remain functional, with exactly one content
// panel mounted and a single URL-backed active tab at a time.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const family = read("apps/web/app/admin/family-panel.tsx");
const tabs = read("apps/web/app/admin/family-tabs-model.ts");
const nav = read("apps/web/app/admin/admin-sidebar-sections.ts");
const css = read("apps/web/app/admin/family-tabs.css");
const i18n = read("apps/web/app/admin/admin-i18n.ts");
const routes = read("apps/web/app/admin/admin-section-route.ts");
const layout = read("apps/web/app/admin/(workspace)/layout.tsx");
const pagerModel = read("apps/web/app/admin/family-list-paging.ts");

const sections = ["add-student", "parent-account", "student-account", "bulk-import"];
assert.equal((tabs.match(/\{ id: "/g) ?? []).length, 4,
  "Family navigation must have exactly four tabs");
for (const [index, id] of sections.entries()) {
  assert.ok(tabs.includes('id: "' + id + '"'),
    "Family navigation tab missing: " + id);
  assert.ok(family.includes('activeTab === "' + id + '"') &&
    family.includes('id="family-panel-' + id + '"') &&
    family.includes('aria-labelledby="family-tab-' + id + '"') &&
    family.includes('role="tabpanel"'),
    "Only the selected family workflow should be rendered: " + id);
  assert.ok(tabs.indexOf('id: "' + id + '"') >
    (index === 0 ? -1 : tabs.indexOf('id: "' + sections[index - 1] + '"')),
    "Family workflow order must be preserved");
}
assert.ok(family.includes('useAdminSectionRoute<FamilyTab>(') &&
  family.includes('"/admin/families", FAMILY_TABS.map((tab) => tab.id), "add-student"') &&
  family.includes('role="tablist" aria-label={t("Family sections")}') &&
  family.includes('aria-selected={selected}') &&
  family.includes('tabIndex={selected ? 0 : -1}') &&
  family.includes('data-admin-no-loading="true"') &&
  family.includes('event.key === "ArrowRight"') &&
  family.includes('event.key === "ArrowLeft"') &&
  family.includes('event.key === "Home"') &&
  family.includes('event.key === "End"') &&
  family.includes('locale === "en" ? 1 : -1') &&
  routes.includes('searchParams.get("tab")') &&
  layout.includes("Suspense"),
  "Accessible bilingual keyboard navigation, deep links and Back/Forward are required");
assert.ok(nav.includes('"/admin/families": FAMILY_TABS.map') &&
  nav.includes('href: index === 0 ? "/admin/families" : "/admin/families?tab=" + tab.id') &&
  !nav.includes("/admin/families#family-parents"),
  "Sidebar must link to visible tab panels rather than hidden anchors");
const bounds = sections.map((id) => family.indexOf('activeTab === "' + id + '"'));
assert.ok(bounds.every((index) => index > 0) &&
  bounds.every((index, i) => i === 0 || index > bounds[i - 1]),
  "Family content tabs must be in the expected order");
const ranges = sections.map((id,i) =>
  family.slice(bounds[i],i === sections.length-1 ?
    family.indexOf("\n    </section>\n  );\n}",bounds[i]) : bounds[i+1]));
assert.ok(ranges[0].includes('onSubmit={createStudent}') &&
  !ranges[0].includes('onSubmit={createParent}') &&
  !ranges[0].includes('onSubmit={createStudentAccount}'),
  "Add student must be the default standalone form");
assert.ok(ranges[1].includes('onSubmit={createParent}') &&
  ranges[1].includes('id="family-parents"') &&
  ranges[1].indexOf('onSubmit={createParent}') < ranges[1].indexOf('id="family-parents"') &&
  !ranges[1].includes('onSubmit={createStudentAccount}'),
  "Parent account tab must show its creation form above the parent list");
assert.ok(ranges[2].includes('onSubmit={createStudentAccount}') &&
  ranges[2].includes('id="family-students"') &&
  ranges[2].indexOf('onSubmit={createStudentAccount}') < ranges[2].indexOf('id="family-students"') &&
  !ranges[2].includes('onSubmit={createParent}'),
  "Student account tab must show its login form above the student list");
assert.ok(ranges[3].includes('id="family-import"') &&
  ranges[3].includes('commitImport()') &&
  ranges[3].includes('validateImport()'),
  "Bulk Import must retain file validation and confirmed import actions");
assert.ok(family.indexOf('className="credential-card family-account-preview"') < bounds[0] &&
  family.includes('exportAccountPreviewPdf(accountPreview)') &&
  family.includes('accountPreviewClosePrompt'),
  "Secure one-time credentials and confirmation must remain visible on every tab");
assert.ok(family.includes('className="ml-family-tabbar"'),
  "Family tab switcher must remain mounted for every section");
for (const phrase of [
  ".ml-family-tab-active", ".ml-family-tab-content",
  ".family-account-layout", ".family-account-column",
  "grid-template-columns: minmax(0, 1fr)",
  "@media (max-width: 1160px)", "@media (max-width: 520px)",
  "@media (prefers-reduced-motion: reduce)"
]) {
  assert.ok(css.includes(phrase), "Family tab layout missing " + phrase);
}
for (const key of ["Family management","Family sections","Parent account","Student account"]) {
  assert.equal(i18n.split(JSON.stringify(key) + ":").length, 3,
    "Family tab needs Dari and Pashto translations: " + key);
}

// The parent and student lists page independently AFTER their existing filters,
// with five rows at most. Switching filters returns to the first page and
// removing accounts cannot strand the user on a now-empty page.
for (const marker of [
  "const [parentListPage, setParentListPage] = useState(1)",
  "const [studentListPage, setStudentListPage] = useState(1)",
  "paginateFamilyRows(listedParents, parentListPage)",
  "paginateFamilyRows(listedStudents, studentListPage)",
  "parentsPage.items.map((parent) => (",
  "studentsPage.items.map((item) => {",
  "if (parentListPage !== parentsPage.page) setParentListPage(parentsPage.page)",
  "if (studentListPage !== studentsPage.page) setStudentListPage(studentsPage.page)",
  "setParentListPage(1)",
  "setStudentListPage(1)",
  "label={t(\"Parent list pagination\")}",
  "label={t(\"Student list pagination\")}",
  'data-admin-no-loading="true"',
  'aria-current={number === page ? "page" : undefined}',
  "total > FAMILY_LIST_PAGE_SIZE"
]) assert.ok(family.includes(marker), "Family paging regression: " + marker);
assert.ok(!family.includes('listedParents.length > 4 ? "family-list-scroll"') &&
  !family.includes('listedStudents.length > 4 ? "family-list-scroll"') &&
  !family.includes("listedParents.map((parent) => (") &&
  !family.includes("listedStudents.map((item) => {"),
  "Unbounded family lists and the old nested scroll region must be gone");
assert.ok(pagerModel.includes("export const FAMILY_LIST_PAGE_SIZE = 5") &&
  pagerModel.includes("rows.slice(offset, offset + FAMILY_LIST_PAGE_SIZE)") &&
  pagerModel.includes("Math.ceil(total / FAMILY_LIST_PAGE_SIZE)") &&
  pagerModel.includes("Math.min(pages, Math.max(1, normalized))"),
  "Five-item pagination must safely clamp on filtering, deletion and empty lists");
for(const key of [
  "Showing {start}–{end} of {total}",
  "Parent list pagination", "Student list pagination"
]) assert.equal(i18n.split(JSON.stringify(key)+":").length, 3,
  "Family carousel must translate paging announcements into Dari and Pashto: " + key);
for(const marker of [
  ".ml-family-list-pager", ".ml-family-page-active",
  ".ml-family-list-page-controls",
  ".ml-family-list-pager button:focus-visible",
  "@media (max-width: 850px)", "@media (max-width: 490px)"
]) assert.ok(css.includes(marker), "Family carousel CSS missing: " + marker);


assert.equal((family.match(/<FamilyAccountCarousel\b/g) ?? []).length, 2,
  "Parent and student account lists each need a carousel");
assert.ok(family.includes('aria-roledescription={t("Carousel")}') &&
  family.includes('onTouchStart={(event) => {') &&
  family.includes('onTouchEnd={(event) => {') &&
  family.includes('onTouchCancel={() => { touchStart.current = null; }}') &&
  family.includes('Math.abs(dx) >= 60') &&
  family.includes('event.key === "ArrowRight"') &&
  family.includes('event.key === "ArrowLeft"') &&
  family.includes('event.key === "Home"') &&
  family.includes('event.key === "End"') &&
  family.includes('const horizontalStep = locale === "en" ? 1 : -1;') &&
  family.includes('data-direction={movement}') &&
  css.includes("touch-action: pan-y") &&
  css.includes("@keyframes ml-family-carousel-from-right") &&
  css.includes("@keyframes ml-family-carousel-from-left") &&
  i18n.split('"Carousel":').length === 3,
  "Family carousels require RTL-aware gestures, keyboard access, transitions, and translations");

console.log("Admin Families verified: default Add Student, parent form + list, student form + list, bulk import, URL-backed accessible tabs and RTL.");
