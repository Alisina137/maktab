import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const css = read("apps/web/app/admin/learning-polish.css");
const panel = read("apps/web/app/admin/learning-panel.tsx");
const exam = read("apps/web/app/admin/admin-learning-exams.tsx");
const reports = read("apps/web/app/admin/admin-learning-reports.tsx");
const teaching = read("apps/web/app/admin/admin-learning-teaching.tsx");
const examRoute = read("apps/web/app/admin/(workspace)/learning/exams/[examId]/page.tsx");

const destinations = [
  ["OVERVIEW", "learning-metric-grid"],
  ["HOMEWORK", "learning-homework-card"],
  ["EXAMS", "learning-exam-directory"],
  ["RESULTS", "learning-results-card"],
  ["TEACHING", "learning-teaching-card"],
  ["REPORTS", "learning-report-audit-item"]
];
const configured = [...panel.matchAll(/\{ id: "([A-Z]+)", title:/g)].map(match => match[1]);
assert.deepEqual(configured, destinations.map(([name]) => name),
  "Learning UI must cover the six configured tabs.");

assert.ok(panel.includes('import "./learning-polish.css";'), "LearningPanel must load its scoped stylesheet.");
assert.ok(panel.includes('aria-selected={activeTab === id}') &&
  panel.includes('onKeyDown={event => {') &&
  panel.includes('aria-controls={`learning-panel-${id.toLowerCase()}`}') &&
  panel.includes('dir={locale === "en" ? "ltr" : "rtl"}'),
  "Learning tab selection, keyboard handling or RTL direction was lost.");
assert.ok(examRoute.includes("<LearningPanel") && examRoute.includes("initialExamId={params.examId}"),
  "Deep-linked examination details must retain the shared Learning layout.");

for (const [name, selector] of destinations) {
  assert.ok(css.includes("." + selector), name + " is missing visual coverage.");
}
for (const selector of [
  ".learning-section .learning-tab-panel",
  ".learning-section .learning-main-tabs > button.is-active",
  ".learning-section .learning-exam-detail-tabs",
  ".learning-section .learning-homework-roster-head",
  ".learning-section .learning-results-score",
  ".learning-section .learning-teaching-detail-controls",
  ".learning-section .learning-report-row-values"
]) assert.ok(css.includes(selector), "Learning visual rule missing: " + selector);

for (const necessary of [
  "grid-template-columns: repeat(3, minmax(0, 1fr))",
  "min-height: 44px",
  "white-space: normal",
  "overflow-wrap: anywhere",
  "@media (max-width: 1100px)",
  "@media (max-width: 850px)",
  "@media (max-width: 620px)",
  "@media (max-width: 410px)",
  "@media (prefers-reduced-motion: reduce)"
]) assert.ok(css.includes(necessary), "Learning responsive/accessibility rule missing: " + necessary);

assert.ok(exam.includes('role="tablist"') && reports.includes('role="tablist"') &&
  teaching.includes('role="tablist"'),
  "Exam, report and teaching nested navigation must be retained.");

let depth = 0;
for (const ch of css) {
  if (ch === "{") depth += 1;
  if (ch === "}") depth -= 1;
  assert.ok(depth >= 0, "Learning stylesheet has an unexpectedly closed CSS block.");
}
assert.equal(depth, 0, "Learning stylesheet has unmatched braces.");
console.log("Learning visual system verified: six tabs, nested exam/report/teaching navigation, typography, spacing, RTL, responsive and reduced motion.");
