import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const panel = read("apps/web/app/admin/communication-panel.tsx");
const operations = read("apps/web/app/admin/admin-fee-operations.tsx");
const reports = read("apps/web/app/admin/admin-fee-financial-reports.tsx");
const css = read("apps/web/app/admin/communication-polish.css");
const translations = read("apps/web/app/admin/admin-i18n.ts");

assert.ok(panel.includes('import "./communication-polish.css";') &&
  panel.includes('className="communication-section admin-page-enter"') &&
  css.includes(".ml-admin-dashboard-shell .communication-section"),
  "Communication and Fees must share a route-scoped style system.");

for (const [section, marker] of [
  ["OVERVIEW", "communication-panel-overview"],
  ["COMMUNICATION", "communication-panel-communication"],
  ["FEES", "communication-panel-fees"]
]) {
  assert.ok(panel.includes('section === "' + section + '"') &&
    panel.includes('id="' + marker + '"') &&
    panel.includes('aria-labelledby="communication-tab-' + section.toLowerCase() + '"'),
    "Missing main tab route/tabpanel: " + section);
}
assert.ok(panel.includes('role="tablist" aria-label={t("Communication & fees sections")}') &&
  panel.includes('aria-selected={section === key}') &&
  panel.includes('tabIndex={section === key ? 0 : -1}') &&
  panel.includes('const forward = locale === "en" ? "ArrowRight" : "ArrowLeft"'),
  "Main tabs must preserve selected-state, keyboard and RTL navigation.");

assert.ok(panel.includes('className="admin-fee-module-tabs" role="tablist"') &&
  panel.includes('role="tab" id={\`communication-fee-tab-\${key.toLowerCase()}\`}') &&
  panel.includes('aria-selected={feesModule === key}') &&
  panel.includes('tabIndex={feesModule === key ? 0 : -1}') &&
  panel.includes('feeModuleRefs.current[next]?.focus()') &&
  panel.includes('id="communication-fee-panel-invoices"') &&
  panel.includes('id="communication-fee-panel-reports"') &&
  panel.includes('id={\`communication-fee-panel-\${feesModule.toLowerCase()}\`}') &&
  panel.includes('aria-labelledby={\`communication-fee-tab-\${feesModule.toLowerCase()}\`}'),
  "All four fee subtabs need accessible panels and roving keyboard focus.");

assert.ok(panel.includes('setFeesModule("INVOICES"); setFeesPane("LIST"); selectSection("FEES");') &&
  panel.includes('setFeesModule("INVOICES"); selectSection("FEES"); setFeesPane("LIST");') &&
  panel.includes('setFeeReloadKey(value => value + 1);'),
  "Overview invoice shortcuts and fee refresh must target current content.");

assert.ok(panel.includes('className="communication-payment-form" role="group"') &&
  panel.includes('className="communication-payment-field">{t("Amount (AFN)")}') &&
  panel.includes('className="communication-payment-field">{t("Reference (optional)")}') &&
  panel.includes('className="communication-payment-field">{t("Reversal reason")}') &&
  panel.includes('onClick={() => void recordPayment(') &&
  panel.includes('onClick={() => void reversePayment('),
  "Payment amount, reference and reversal inputs must be visibly labeled.");

for (const marker of [
  "communication-overview-grid", "communication-recent-card",
  "communication-form-card", "communication-announcement-row",
  "communication-invoice-filters", "communication-invoice-status",
  "communication-reminder-card", "admin-reminder-editor",
  "communication-payment-form", "communication-payment-history",
  "admin-fee-operations", "admin-fee-ledger-row",
  "admin-financial-reports", "admin-financial-bulk",
  "admin-financial-students", "admin-financial-preview"
]) {
  assert.ok(css.includes("." + marker), "Missing communication/fee styling: " + marker);
}
for (const marker of [
  "grid-template-columns: repeat(3, minmax(0, 1fr))",
  "grid-template-columns: repeat(4, minmax(0, 1fr))",
  "min-height: 44px", "overflow-wrap: anywhere", "white-space: normal",
  "@media (max-width: 1320px)", "@media (max-width: 1100px)",
  "@media (max-width: 850px)", "@media (max-width: 650px)",
  "@media (max-width: 440px)", "@media (prefers-reduced-motion: reduce)"
]) assert.ok(css.includes(marker), "Missing responsive/accessible style: " + marker);

assert.ok(operations.includes("Select a student to review their financial balance.") &&
  operations.includes('className="admin-fee-ledger-rows"') &&
  reports.includes('const reconciliationRows = report?.rows.filter(') &&
  reports.includes("!reconciliationRows.length") &&
  reports.includes("<AdminLoader compact") &&
  reports.includes('className="admin-financial-bulk"'),
  "Balances, reconciliation empty-state and financial reports must remain usable.");

assert.equal(translations.split('"No cash or bank payments to reconcile in this date range.":').length, 3,
  "The new reconciliation empty state needs Dari and Pashto translations.");

let depth = 0;
for (const character of css) {
  if (character === "{") depth++;
  if (character === "}") depth--;
  assert.ok(depth >= 0, "Communication stylesheet has a premature closing brace");
}
assert.equal(depth, 0, "Communication stylesheet has unbalanced braces");
console.log("Communication/Fees UI verified: 3 main tabs, 4 fee tabs, form labels, refresh, reconciliation and responsive layout.");
