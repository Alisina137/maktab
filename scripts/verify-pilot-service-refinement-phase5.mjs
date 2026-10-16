import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const db = read("packages/database/src/pilot-service-health-store.ts");
const store = read("packages/database/src/pilot-store.ts");
const exports = read("packages/database/src/index.ts");
const routes = read("apps/api/src/pilot/routes.ts");
const ui = read("apps/web/app/admin/pilot-service-health-panel.tsx");
const pilot = read("apps/web/app/admin/pilot-readiness-panel.tsx");
const navigation = read("apps/web/app/admin/pilot-operations-navigation.tsx");
const support = read("apps/web/app/admin/pilot-launch-support-panel.tsx");
const workspace = read("apps/web/app/admin/admin-workspace.tsx");
const styles = read("apps/web/app/globals.css");
const locale = read("apps/web/app/admin/admin-i18n.ts");
const tests = read("apps/api/src/app.test.ts");
const subscription = read("packages/database/src/subscription-health.ts");

assert.ok(db.includes("getPilotServiceHealthReport") && db.includes('timeZone: "Asia/Kabul"'),
  "Service report must be a timestamped school snapshot in Kabul time");
for (const source of ["FROM notifications n", "FROM pilot_support_tickets t",
  "FROM family_import_batches b"]) {
  assert.ok(db.includes(source), "Missing source: " + source);
}
assert.ok(db.includes("n.school_id = ${schoolId}::uuid") &&
  db.includes("t.school_id = ${schoolId}::uuid") &&
  db.includes("b.school_id = ${schoolId}::uuid"), "All aggregates must be school scoped");
assert.ok(db.includes("n.delivery_status = 'PENDING'") &&
  db.includes("n.delivery_status = 'FAILED'") &&
  db.includes("n.created_at < ${staleBefore}::timestamptz") &&
  db.includes("now.getTime() - 60 * 60_000"), "Notification queue stale threshold must be real");
assert.ok(db.includes("t.status NOT IN ('RESOLVED', 'CLOSED')") &&
  db.includes("t.priority = 'CRITICAL'"), "Support risk must exclude finished tickets");
assert.ok(db.includes("b.status = 'FAILED'") &&
  db.includes("new Date(now.getTime() - 7 * 86_400_000)"), "Import failures must use 7 day window");
assert.ok(db.includes('unverified: ["scheduler", "push_delivery", "backups", "uptime_history"]') &&
  !db.includes("password_hash") && !db.includes("access_token"),
  "Never claim scheduler, backup, push delivery or uptime checks");
assert.ok(store.includes("getServiceHealth(schoolId)") &&
  exports.includes('export * from "./pilot-service-health-store.js";'),
  "PilotStore must expose typed service health");
assert.ok(routes.includes('"/v1/admin/pilot/service-health"') &&
  routes.includes("requireSchoolAdmin(request, reply, accounts)") &&
  routes.includes("pilot.getServiceHealth(context.user.schoolId)") &&
  routes.includes("z.object({}).strict().safeParse(request.query)") &&
  routes.includes('reply.header("cache-control", "no-store")'),
  "Service endpoint must be read-only, school-scoped, strict and uncached");
assert.ok(routes.includes("subscription: evaluateSubscriptionHealth(context.subscription)") &&
  subscription.includes("platformReviewNeeded") &&
  subscription.includes("operationalWritesBlocked"),
  "Billing status must reuse read-only platform subscription health");
assert.ok(navigation.includes('section: "service"') &&
  navigation.includes('href: "/admin/pilot/service"') &&
  pilot.includes('<PilotServiceHealthPanel') &&
  pilot.includes('section === "adoption" || section === "service"'),
  "Service tab must render independently of unrelated readiness failures");
assert.ok(ui.includes("new AbortController()") &&
  ui.includes('cache: "no-store"') &&
  ui.includes('Authorization: `Bearer ${accessToken}`') &&
  ui.includes('controller.abort()') &&
  ui.includes("setRevision") &&
  ui.includes("Unable to verify service health"),
  "Service panel must have session-safe fetch, loading, error and retry");
assert.ok(ui.includes("Zero alerts must never be treated as proof") &&
  ui.includes("Queue records do not prove push delivery") &&
  ui.includes("A failed request is not a confirmed outage"),
  "No fabricated green uptime or push health claims");
assert.ok(ui.includes('href="/admin/pilot/launch?support=billing#pilot-support-form"') &&
  ui.includes('href="/admin/pilot/launch?support=technical#pilot-support-form"'),
  "Contextual service help must navigate to existing support workflow");
assert.ok(support.includes('new URLSearchParams(window.location.search).get("support")') &&
  support.includes('if (help === "billing")') &&
  support.includes('setIssueCategory("BILLING")') &&
  support.includes('setIssueCategory("TECHNICAL")') &&
  support.includes('id="pilot-support-form"') &&
  support.includes('event.preventDefault()'),
  "Help links must create editable drafts, never auto-submit");
assert.ok(workspace.includes('"/admin/pilot/service"') &&
  styles.includes(".pilot-service-grid") &&
  styles.includes("@media (max-width: 850px)"), "Service page must be responsive and routed");
assert.ok(tests.includes("Pilot refinement Phase 5 school service checks are isolated and advisory") &&
  tests.includes("second.report.notificationQueue.failed") &&
  tests.includes('url: uri + "?schoolId=" + schoolB'),
  "API integration must enforce tenant and param isolation");
const fa = locale.split("const fa: Record<string, string> = {")[1]?.split("const ps: Record<string, string> = {")[0];
const ps = locale.split("const ps: Record<string, string> = {")[1]?.split("export function adminText(")[0];
for (const label of ["Service health", "Service health & assistance", "Checking service health…",
  "Request billing help", "Notification queue", "Not independently monitored"]) {
  const needle = JSON.stringify(label) + ":";
  assert.ok(fa?.includes(needle) && ps?.includes(needle), "Missing Dari/Pashto translation: " + label);
}
console.log("Pilot Phase 5 service health and assistance read-only, scoping, truthfulness, RTL and UX guards passed.");
