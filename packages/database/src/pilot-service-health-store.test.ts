import assert from "node:assert/strict";
import test from "node:test";
import type { FoundationDatabase } from "./client.js";
import { getPilotServiceHealthReport } from "./pilot-service-health-store.js";

const schoolId = "10000000-0000-4000-8000-000000000001";
const counts = {
  notifications_pending: 7,
  notifications_stale: 2,
  notifications_failed: 3,
  support_unresolved: 5,
  support_critical: 1,
  imports_failed: 4
};
const database = (record: Record<string,unknown>) =>
  ({execute: async () => ({rows:[record]})}) as unknown as FoundationDatabase;
const now = new Date("2026-10-16T08:00:00.000Z");

test("Pilot improvement Phase 5 service report preserves measured school counters", async () => {
  const result = await getPilotServiceHealthReport(database(counts),schoolId,now);
  assert.equal(result.notificationQueue.pending,7);
  assert.equal(result.notificationQueue.stalePending,2);
  assert.equal(result.notificationQueue.failed,3);
  assert.equal(result.notificationQueue.status,"attention");
  assert.equal(result.support.unresolvedCritical,1);
  assert.equal(result.imports.failedLast7Days,4);
  assert.deepEqual(result.unverified,
    ["scheduler","push_delivery","backups","uptime_history"]);
});
test("Pilot improvement Phase 5 service report rejects missing and invalid aggregates", async () => {
  for (const bad of [
    {...counts,notifications_failed:undefined},
    {...counts,support_critical:""},
    {...counts,notifications_pending:-1},
    {...counts,imports_failed:"nan"},
    {...counts,imports_failed:Number.POSITIVE_INFINITY},
    {...counts,notifications_failed:null},
    {...counts,notifications_stale:8},
    {...counts,support_critical:6}
  ]) await assert.rejects(getPilotServiceHealthReport(database(bad),schoolId,now));
});
test("Pilot improvement Phase 5 service report does not mistake pending messages for verified delivery", async () => {
  const result = await getPilotServiceHealthReport(database({
    ...counts, notifications_pending:9, notifications_stale:0, notifications_failed:0,
    support_unresolved:0, support_critical:0, imports_failed:0
  }),schoolId,now);
  assert.equal(result.notificationQueue.status,"no_backlog");
  assert.ok(result.unverified.includes("push_delivery"));
});
