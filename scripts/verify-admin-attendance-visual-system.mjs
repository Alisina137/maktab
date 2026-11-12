import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const css = read("apps/web/app/admin/attendance-polish.css");
const panel = read("apps/web/app/admin/attendance-panel.tsx");
const model = read("apps/web/app/admin/attendance-workspace-model.ts");

const expected = [
  ["OVERVIEW", "attendance-overview-grid"],
  ["REGISTERS", "attendance-report-row"],
  ["STUDENTS", "attendance-students-layout"],
  ["FOLLOWUPS", "attendance-followup-body"],
  ["REPORTS", "attendance-analytics-scroll"],
  ["AUDIT", "attendance-audit-card"],
  ["STAFF_REQUESTS", "staff-attendance-detail"]
];
const actual = [...model.matchAll(/\\{\\s*id:\\s*"([A-Z_]+)"\\s*,\\s*label:/g)].map((match) => match[1]);
assert.deepEqual(actual, expected.map(([name]) => name),
  "Visual system must cover all seven configured Attendance tabs.");

assert.ok(panel.includes('import "./attendance-polish.css";'),
  "Attendance page must import its scoped visual system.");
assert.ok(panel.includes('aria-selected={activeTab === id}') &&
  panel.includes('onKeyDown={event => onTabKeyDown(event, id)}'),
  "Visual changes must retain existing tab state and keyboard behavior.");

for (const [name, selector] of expected) {
  assert.ok(css.includes("." + selector), name + " page has no visual styling.");
}
for (const selector of [
  ".attendance-section > [role=\"tabpanel\"]",
  ".attendance-workspace-tabs > button[aria-selected=\"true\"]",
  ".attendance-filter",
  ".attendance-monitor-metrics",
  ".attendance-calendar-day small",
  ".attendance-followup-detail",
  ".attendance-analytics-scroll table",
  ".attendance-audit-detail",
  ".staff-reg-queue"
]) assert.ok(css.includes(selector), "Missing Attendance visual rule " + selector);

for (const required of [
  "grid-template-columns: repeat(4, minmax(0, 1fr))",
  "min-height: 44px",
  "white-space: normal",
  "overflow-wrap: anywhere",
  "@media (max-width: 1200px)",
  "@media (max-width: 860px)",
  "@media (max-width: 620px)",
  "@media (max-width: 390px)",
  '[dir="rtl"]',
  "@media (prefers-reduced-motion: reduce)"
]) assert.ok(css.includes(required), "Missing Attendance accessibility/responsive rule: " + required);

let depth = 0;
for (const char of css) {
  if (char === "{") depth += 1;
  if (char === "}") depth -= 1;
  assert.ok(depth >= 0, "Attendance stylesheet closes a block before it opens.");
}
assert.equal(depth, 0, "Attendance stylesheet has unmatched braces.");
console.log("Attendance visual system verified: seven tabs, typography, spacing, RTL, mobile and reduced motion.");
