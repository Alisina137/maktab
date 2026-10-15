import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const ui = read("apps/web/app/admin/communication-panel.tsx");
const css = read("apps/web/app/globals.css");

const fees = ui.split('{section === "FEES" ? (')[1]?.split('function Summary(')[0];
assert.ok(fees, "Fees workspace must still be available.");
for (const marker of [
  'className="communication-tab-panel communication-fees-page"',
  'communication-invoice-create-card',
  'className="admin-panel communication-reminder-card"',
  '<header className="communication-reminder-heading">',
  'className="communication-reminder-form" onSubmit={saveReminderSettings}',
  'className="admin-reminder-editor"',
  'className="admin-reminder-actions"',
  'htmlFor="communication-fee-reminder-day"',
  'onClick={addReminderDay}',
  'if (event.key === "Enter")',
  'type="submit">{t("Save reminder days")}',
  'className="communication-invoice-status" data-status={item.invoice.status}',
  'className="communication-invoice-snapshot"',
  '{formatMoney(item.invoice.amount)}',
  '{formatMoney(item.paid)}',
  '{formatMoney(item.outstanding)}'
]) assert.ok(fees.includes(marker), "Missing Fees UI invariant: " + marker);

// The old two-column form broke when Phase 5 added extra fields, resulting
// in a narrow RTL second column and buttons/labels wrapping letter-by-letter.
const reminderCss = css.match(/\.communication-reminder-form\s*\{([^}]*)\}/)?.[1] ?? "";
assert.match(reminderCss, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
assert.doesNotMatch(reminderCss, /1fr\s+auto/);
for (const marker of [
  '.communication-fees-page .admin-reminder-editor',
  '.communication-fees-page .admin-reminder-editor > .admin-secondary',
  '.communication-fees-page .admin-reminder-actions > .admin-primary',
  '.communication-fees-page .communication-invoice-status[data-status="OVERDUE"]',
  '.communication-fees-page .communication-invoice-status[data-status="PAID"]',
  '.communication-fees-page .communication-invoice-snapshot',
  '@media (max-width: 620px)',
  'grid-template-columns: minmax(0, 1fr);',
  '.communication-fees-page .communication-invoice-filters'
]) assert.ok(css.includes(marker), "Missing responsive Fees design invariant: " + marker);

assert.ok(fees.indexOf('</article>\n\n        <article className="admin-panel communication-reminder-card">') > 0,
  "Invoice editor and reminders must be independent accessible cards.");
assert.ok(fees.indexOf('communication-reminder-card') < fees.indexOf('communication-workflow-list'),
  "Reminder card must remain in the form column.");

console.log("Admin Fees design refresh: one-column reminder foundation, responsive RTL editor, isolated cards and invoice previews passed.");
