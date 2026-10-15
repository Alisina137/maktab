import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url),"utf8");
const store=read("packages/database/src/admin-learning-reports-store.ts");
const learning=read("packages/database/src/learning-store.ts");
const api=read("apps/api/src/learning/routes.ts");
const csv=read("apps/api/src/learning/reports-csv.ts");
const panel=read("apps/web/app/admin/learning-panel.tsx");
const ui=read("apps/web/app/admin/admin-learning-reports.tsx");
const styles=read("apps/web/app/globals.css");
const i18n=read("apps/web/app/admin/admin-i18n.ts");
const tests=read("apps/api/src/app.test.ts");
const index=read("packages/database/src/index.ts");
for(const marker of [
  "getAdminAcademicReport(schoolId, query)",
  "getAdminLearningAudit(schoolId, query)",
  "eq(academicYears.schoolId, schoolId)",
  "eq(teacherAssignments.academicYearId, query.academicYearId)",
  "gr.status = 'PUBLISHED' and ex.status in ('PUBLISHED','ARCHIVED')",
  "hw.status in ('PUBLISHED','CLOSED') and hs.status = 'SUBMITTED'",
  "ASSIGNED_CLASS_SUBJECTS_ONLY",
  "MATCHED_LIVE_YEAR_ENTITIES",
  "eq(auditLogs.schoolId, schoolId)",
  "eq(auditLogs.action", "grade.corrected",
  "join exams ex on ex.id = es.exam_id",
  "where hw.id = ",
  "and cu.academic_year_id = ",
  "new Date(query.from+\"T00:00:00.000Z\")",
  "new Date(query.to+\"T23:59:59.999Z\")",
  ".limit(query.limit).offset(query.offset)"
]) assert.ok(store.includes(marker),"Missing Phase 7 school/privacy/coverage invariant "+marker);
assert.ok(!store.includes("metadata: auditLogs.metadata"),"Audit must not expose raw metadata");
assert.ok(learning.includes("extends AdminLearningReportsStore"));
assert.ok(learning.includes("...createAdminLearningReportsStore(db)"));
assert.ok(index.includes('export * from "./admin-learning-reports-store.js"'));
for(const marker of [
  '"/v1/admin/learning/reports"',
  '"/v1/admin/learning/audit"',
  '"/v1/admin/learning/reports/export"',
  '"/v1/admin/learning/audit/export"',
  "requireSchoolAdmin(request, reply, accounts)",
  'limit: z.coerce.number().int().min(1).max(50).default(20)',
  "limit: 500, offset: 0",
  "await accounts.writeAudit",
  'reply.header("Cache-Control", "no-store")',
  "reportFilters.parse(request.query)",
  "auditFilters.parse(request.query)"
]) assert.ok(api.includes(marker),"Missing Phase 7 API gate "+marker);
assert.ok(csv.includes("csvCell"));
assert.ok(!csv.includes("previousScore"));
assert.ok(panel.includes("<AdminLearningReports"));
for(const marker of [
  "role=\"tablist\"","role=\"search\"",
  "AbortController","controller.signal.aborted",
  "loadedKey===requestKey","tokenRef.current!==token","yearRef.current!==year",
  "new Blob([result.csv]","result.truncated",
  "Page {current} of {total}",
  "No assigned class-subject records match these filters",
  "Only actions linked to surviving learning records"
]) assert.ok(ui.includes(marker),"Missing Phase 7 client safety "+marker);
for(const marker of [
  ".learning-report-metrics",".learning-report-filters",
  ".learning-report-audit-item","@media (max-width: 540px)"
]) assert.ok(styles.includes(marker),"Missing Phase 7 responsive style "+marker);
for(const key of [
  '"Report section: SUMMARY"','"Report section: AUDIT"',
  '"Audit category: CURRICULUM"','"Export academic report CSV"',
  '"Report figures cover assigned class-subject pairs. Unassigned subjects are excluded; draft grades are never counted as published."',
  '"CSV exports contain at most 500 records, escape spreadsheet formulas and are logged. Narrow filters if an export is truncated."'
]) assert.equal(i18n.split(key).length,3,"Missing exactly one Dari and Pashto translation "+key);
for(const marker of [
  "Admin Learning Phase 7: reports, year-scoped audit and export authority.",
  "beforePublicationReport","publishedAcademicReport","curriculumAudit",
  "exportEvents","crossYearAudit","correctionAudit"
]) assert.ok(tests.includes(marker),"Missing Phase 7 end-to-end regression test "+marker);
console.log("Admin Learning Phase 7 checks pass: report scope, draft privacy, year-bound audit, bounded CSV, RTL and translations.");
