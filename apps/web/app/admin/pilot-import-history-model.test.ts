import assert from "node:assert/strict";
import test from "node:test";
import { parseImportHistoryPage, importPageInsights } from "./pilot-import-history-model.js";
const uuid = (suffix: string) => "20000000-0000-4000-8000-" + suffix.padStart(12, "0");
const row = (suffix: string, status: string, extras: Record<string, unknown> = {}) => ({
  id: uuid(suffix), entityType: "PARENT", status, rowCount: 3,
  importedCount: status === "COMPLETED" ? 3 : 0,
  rejectedCount: status === "REJECTED" ? 3 : 0,
  createdAt: "2026-10-16T08:00:00.000Z", actorUsername: null,
  reason: "do not expose private error text", fingerprint: "do-not-export",
  ...extras
});
const input = (rows: unknown[], extras: Record<string, unknown> = {}) => ({
  rows, limit: 20, offset: 0, hasMore: false, ...extras
});
test("Phase 3 import insights only count fetched page, not school total", () => {
  const page = parseImportHistoryPage(input([
    row("1", "COMPLETED"), row("2", "REJECTED"), row("3", "FAILED", {entityType:"TEACHER"})
  ]), 0, 20);
  assert.deepEqual(importPageInsights(page), {
    batches: 3, completed: 1, rejected: 1, failed: 1,
    importedRows: 3, rejectedRows: 3, rowStart: 1, rowEnd: 3, morePages: false
  });
  assert.equal(JSON.stringify(page).includes("do not expose private error"), false);
  assert.equal(JSON.stringify(page).includes("fingerprint"), false);
});
test("Phase 3 import insights respect paged offset and more-pages marker", () => {
  const rows = Array.from({length: 20}, (_, i) => row(String(i + 100), "COMPLETED"));
  const page = parseImportHistoryPage(input(rows, {offset: 20, hasMore: true}), 20, 20);
  assert.deepEqual([importPageInsights(page).rowStart, importPageInsights(page).rowEnd], [21,40]);
  assert.equal(importPageInsights(page).morePages, true);
  assert.equal(importPageInsights(parseImportHistoryPage(input([]), 0,20)).rowStart,0);
});
test("Phase 3 import history mismatched paging or fake totals fail closed", () => {
  for (const bad of [
    null, {}, input([row("1","COMPLETED")],{offset:30}),
    input([row("1","COMPLETED")],{limit:100}),
    input([row("1","COMPLETED")],{hasMore:true}),
    input([row("1","COMPLETED"),row("1","COMPLETED")]),
    input([row("1","OTHER")]),input([row("1","COMPLETED",{entityType:"OTHER"})]),
    input([row("1","COMPLETED",{importedCount: 8})]),
    input([row("1","REJECTED",{rejectedCount: 5})]),
    input([row("1","COMPLETED",{createdAt:"not-a-date"})]),
    input([row("1","COMPLETED",{id:"not-uuid"})]),
    input([row("1","COMPLETED",{rowCount:"3"})]),
    input([row("1","FAILED",{actorUsername:42})])
  ]) assert.throws(() => parseImportHistoryPage(bad, 0,20));
});
test("Phase 3 import history never derives a production or onboarding GO status", () => {
  const page = parseImportHistoryPage(input([row("1","COMPLETED")]),0,20);
  const insights = importPageInsights(page);
  assert.equal("ready" in insights,false);
  assert.equal("productionDecision" in insights,false);
});
