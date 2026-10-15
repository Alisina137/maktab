import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(new URL("../" + file, import.meta.url), "utf8");
const store = read("packages/database/src/learning-store.ts");
const routes = read("apps/api/src/learning/routes.ts");
const panel = read("apps/web/app/admin/learning-panel.tsx");
const results = read("apps/web/app/admin/admin-learning-results.tsx");
const styles = read("apps/web/app/globals.css");
const i18n = read("apps/web/app/admin/admin-i18n.ts");
const tests = read("apps/api/src/app.test.ts");

for (const marker of [
  "listAdminPublishedGrades(schoolId, query)",
  "getAdminGradeCorrections(schoolId, gradeId, limit, offset)",
  'eq(gradeRecords.schoolId, schoolId)',
  'eq(gradeRecords.status, "PUBLISHED")',
  'eq(exams.academicYearId, query.academicYearId)',
  'eq(auditLogs.action, "grade.corrected")',
  'eq(auditLogs.entityId, gradeId)',
  ".limit(query.limit).offset(query.offset)",
  "count()",
  'row.examStatus === "PUBLISHED" && yearStatus === "ACTIVE"',
  'year?.status !== "ACTIVE"',
  'previous.updatedAt.toISOString() !== input.expectedUpdatedAt'
]) assert.ok(store.includes(marker), "Missing server-side results safeguard: " + marker);
for (const marker of [
  '"/v1/admin/learning/published-results"',
  '"/v1/admin/grades/:gradeId/corrections"',
  "requireSchoolAdmin(request, reply, accounts)",
  "academicYearId: z.string().uuid()",
  "limit: z.coerce.number().int().min(1).max(50).default(20)",
  "getAdminGradeCorrections(context.user.schoolId"
]) assert.ok(routes.includes(marker), "Missing scoped results API: " + marker);
assert.ok(panel.includes("AdminLearningResults"));
assert.ok(panel.includes("/v1/admin/learning?includePublishedGrades=false"));
for (const marker of [
  "setPage(null); // avoid displaying grades for the wrong year/account or filter",
  "const controller = new AbortController()",
  "if (!controller.signal.aborted",
  "new URLSearchParams",
  "page.rows.map(row =>",
  "expandedId === row.grade.id",
  'role="search"',
  "expectedUpdatedAt: row.grade.updatedAt",
  "window.confirm",
  "<CorrectionHistory",
  'role="alert"',
  'aria-expanded={expanded}',
  'disabled={offset + PAGE_SIZE >= page.total}'
]) assert.ok(results.includes(marker), "Missing client safeguard: " + marker);
for (const label of [
  '"Correction history"', '"No matching published grades."',
  '"Read-only published result"', '"Confirm this published grade correction? The change and reason will be audited."'
]) assert.equal(i18n.split(label).length, 3, "Translate Phase4 label in Dari and Pashto: " + label);
assert.ok(styles.includes(".learning-results-filters"));
assert.ok(styles.includes("@media (max-width: 540px)"));
for (const marker of [
  "Admin Learning Phase 4: draft grades never enter the published directory.",
  "Admin Learning Phase 4: tenant-safe published directory",
  "correctionEvents.events[0]?.previousScore",
  "archivedDirectory"
]) assert.ok(tests.includes(marker), "Missing API regression coverage: " + marker);
console.log("Admin Learning Phase 4: tenant-scoped published results, audited corrections, paging, RTL and translation checks passed.");
