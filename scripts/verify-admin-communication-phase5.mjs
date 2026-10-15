import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const store=read("packages/database/src/communication-store.ts");
const routes=read("apps/api/src/communication/routes.ts");
const ui=read("apps/web/app/admin/communication-panel.tsx");
const monitor=read("apps/web/app/admin/admin-notification-monitor.tsx");
const schema=read("packages/database/src/schema.ts");
const sql=read("packages/database/drizzle/0023_notification_scheduler_health.sql");
const locale=read("apps/web/app/admin/admin-i18n.ts");
const tests=read("packages/database/src/communication-store.test.ts");
const apiTests=read("apps/api/src/app.test.ts");
const roadmap=read("docs/ADMIN-COMMUNICATION-FEES-PHASES.md");
const state=read("docs/PROJECT-STATE.md");
const journal=JSON.parse(read("packages/database/drizzle/meta/_journal.json"));
for (const needle of ["getAdminNotificationDelivery(schoolId)", "retryAdminNotification(schoolId, notificationId)",
  "eq(notifications.schoolId, schoolId)", "eq(notificationPushDeliveries.schoolId, schoolId)",
  "feeAlertIsCurrentForPush", "announcementRecipients(announcement)",
  'eq(notifications.deliveryStatus, "FAILED")', 'deliveryStatus: "PENDING"',
  "schedulerLastSuccessAt: now", "schedulerLastAttemptAt: now"]) assert.ok(store.includes(needle), needle);
for (const needle of ['"/v1/admin/notifications/delivery"', '"/v1/admin/notifications/:notificationId/retry"',
  "requireSchoolAdmin(request, reply, accounts)", 'action: "notification.retry_requested"'])
  assert.ok(routes.includes(needle), needle);
assert.ok(sql.includes('scheduler_last_success_at') && schema.includes("schedulerLastSuccessAt"));
assert.ok(journal.entries.some(entry => entry.tag === "0023_notification_scheduler_health"), "Phase 5 scheduler migration must remain present even after later phases");
for (const needle of ["AdminNotificationMonitor", "reminderDays", "Number.isSafeInteger(candidate)",
  "reminderDays.length >= 6", "Save reminder days", "Remove {days}-day reminder"])
  assert.ok(ui.includes(needle), needle);
for (const needle of ["providerAcceptedDevices", "failedDevices", "lastSuccessAt",
  "lastAttemptAt", "generation.current", "tokenRef.current", "window.confirm",
  "Retry failed notification", "Provider accepted does not prove device delivery"])
  assert.ok(monitor.includes(needle), needle);
for(const key of ["Notification delivery monitor", "Queued in-app", "Provider accepted", "Failed push",
  "Recipient read", "Recipient unread", "Last successful materialization",
  "Retry failed notification", "Configured reminder days", "Add reminder day",
  "Parents receive one reminder per selected day while the invoice remains unpaid and the student is active."])
  assert.equal(locale.split(JSON.stringify(key)+":").length,3, "Missing Dari/Pashto translation: "+key);
assert.ok(tests.includes("deliveryOverview.counts.failed") && tests.includes("retryAdminNotification(schoolId"));
assert.ok(apiTests.includes("adminDelivery") && apiTests.includes("scheduler heartbeat must be persisted"));
assert.ok(roadmap.includes("## Phase 5 — Notification delivery and fee reminders (implemented)"));
assert.ok(state.includes("Admin Communication & Fees — Phase 5"));
console.log("Admin Communication & Fees Phase 5 tenant delivery monitor, scheduler and reminder invariants passed.");
