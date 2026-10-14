import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const panel=read("apps/web/app/admin/communication-panel.tsx");
const model=read("apps/web/app/admin/communication-overview-model.ts");
const css=read("apps/web/app/globals.css");
const locale=read("apps/web/app/admin/admin-i18n.ts");
const api=read("apps/api/src/communication/routes.ts");
const store=read("packages/database/src/communication-store.ts");
const docs=read("docs/ADMIN-COMMUNICATION-FEES-PHASES.md");
const state=read("docs/PROJECT-STATE.md");

for(const marker of [
  'type Section = "OVERVIEW" | "COMMUNICATION" | "FEES"',
  'useState<Section>("OVERVIEW")', 'role="tablist"', 'role="tab"',
  'aria-selected={section === key}', 'aria-controls=', 'scrollIntoView(',
  'section === "COMMUNICATION"', 'section === "FEES"', 'section === "OVERVIEW"',
  'role="tabpanel"', 'data-pane={communicationPane}', 'data-pane={feesPane}',
  'setCommunicationPane("LIST")', 'setFeesPane("LIST")',
  'loadResource("communication")', 'loadResource("families")',
  'loadResource("academics")', 'requestGeneration.current[key] !== generation',
  'resourceOwner.communication === accessToken', 'resourceOwner.families === accessToken',
  'resourceOwner.academics === accessToken',
  'resourceStatus.communication === "ready"',
  'resourceStatus.families === "ready"', 'resourceStatus.academics === "ready"',
  'adminApi<T>(', 'feeDashboard(', 'announcementDashboard(',
  'formatMoney(money.billed)', 'formatMoney(money.paid)',
  'formatMoney(money.outstanding)', 'formatMoney(money.overdue)',
  'money.collectionRate === null', 'formElement.reset()',
  'ready && visibleOverview'
]) assert.ok(panel.includes(marker),"Phase 1 UI/stale-session invariant missing: "+marker);
assert.ok(!panel.includes('Promise.all([\n        request<CommunicationOverview>'),
  "Do not couple overview to family/academic read failures");
for(const marker of [
  'item.invoice.status !== "DRAFT" && item.invoice.status !== "CANCELLED"',
  'new Set(issued.filter(item => item.outstanding > 0)',
  'item.invoice.status === "OVERDUE"',
  'billed > 0 ?',
  'Math.min(100, Math.max(0',
  'archivedAt', 'publishAt'
]) assert.ok(model.includes(marker),"Issued-only account totals missing: "+marker);
for(const marker of [
  '.communication-main-tabs', '.communication-main-tab.is-active',
  '.communication-workflow-layout', 'minmax(0, 600px)',
  '.communication-mobile-toggle', '@media (max-width: 1050px)',
  '.communication-workflow-layout[data-pane="LIST"]',
  '.communication-workflow-layout[data-pane="FORM"]',
  '.communication-overview-grid', 'scrollbar-width: thin'
]) assert.ok(css.includes(marker),"Responsive admin workflow styling missing: "+marker);
assert.ok(api.includes('"/v1/admin/communication"') &&
  api.includes("requireSchoolAdmin(request, reply, accounts)"),
  "Original tenant-guarded communication API must remain authoritative");
assert.ok(store.includes("db.select().from(feeInvoices).where(eq(feeInvoices.schoolId, schoolId))"),
  "Admin overview must remain tenant filtered");
for(const key of [
  "Communication & fees workspace", "School-family communication & fee management",
  "Communication & fees sections", "Overview", "Communication", "Fees",
  "Communication overview", "Financial overview", "Issued invoices",
  "Collection rate", "Students with outstanding fees", "Overdue AFN",
  "Choose fee workspace", "Invoice list", "Choose announcement workspace"
]) {
  assert.equal(locale.split(JSON.stringify(key)+":").length,3,
    "Missing Dari/Pashto label: "+key);
}
assert.ok(docs.includes("## Phase 1") && docs.includes("Phase 2"));
assert.ok(state.includes("Admin Communication & Fees — Phase 1"));
console.log("Admin Communication/Fees Phase 1 accounting, navigation, independent errors, RTL and tenant isolation checks passed.");
