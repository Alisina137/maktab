#!/usr/bin/env node
// This guard inspects live UI / request call sites, not only policy utilities.
// Physical Android/browser/staging acceptance remains independent and NO-GO.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");

const request = read("apps/mobile/src/api.ts");
for (const required of [
  'canPersistOfflineRead(path, method, hasBearer,',
  'const requestEpoch = getReadCacheEpoch();',
  'requestIdentityCurrent(',
  'ensureIdentity();',
  'ensureNotCancelled();',
  'callerSignal?.addEventListener("abort", relayCallerAbort',
  'signal: controller.signal',
  'callerSignal?.removeEventListener("abort", relayCallerAbort)',
  'cachedReadFallback<T>(path, cacheable, requestScope, requestEpoch)',
  'code: "request_cancelled"',
  'code: "session_changed"'
]) assert.ok(request.includes(required), "Phase 15 API lifecycle protection removed: " + required);
assert.ok(!request.includes("signal: init?.signal ?? controller.signal"),
  "Caller signal must always be relayed to a timeout-controlled request");
const cache = read("apps/mobile/src/read-cache.ts");
for(const required of ["let scopeEpoch = 0", "getReadCacheEpoch()", "invalidateReadCacheRequests()", "if (scope !== nextScope) scopeEpoch += 1"])
  assert.ok(cache.includes(required), "Mobile request epoch guard removed: " + required);
const app=read("apps/mobile/App.tsx");
const logout=app.slice(app.indexOf("  async function logout() {"),
  app.indexOf("\n  async function changeParentAccountPassword(",app.indexOf("  async function logout() {")));
assert.ok(logout.includes("invalidateReadCacheRequests();") &&
  logout.indexOf("invalidateReadCacheRequests();") < logout.indexOf("await deactivatePushForSession("),
  "Logout must invalidate previous GETs before awaiting slow external calls");
const offline = read("apps/mobile/src/offline-request-policy.ts");
for(const required of ["/v1/parent/home", "/v1/student/home", "/v1/teacher/today",
  "offlineReadPathAllowed", "hasBearer && hasScope"])
  assert.ok(offline.includes(required), "Offline approved data policy changed: " + required);

const registration = read("apps/web/app/staff/staff-registration-panel.tsx");
for(const required of [
  'registrationQueuePage(rows,filter,queuePageNumber,5)',
  "queuePage.items.map",
  "setQueuePageNumber(1)",
  'aria-live="polite"',
  "const epoch=++loadEpoch.current;",
  "if(epoch!==loadEpoch.current)return;",
  "if(active&&epoch===loadEpoch.current)",
  "async function manualRefresh()",
  'disabled={busy||queueRefreshing||queuePage.page<=1}',
  'disabled={busy||queueRefreshing||queuePage.page>=queuePage.pages}',
  'hasUnsavedRegistrationChanges(draft,selected)'
])
  assert.ok(registration.includes(required), "Phase 15 registration experience guard missing: " + required);
const i18n = read("apps/web/app/admin/admin-i18n.ts");
for(const key of ["Registration queue pages", "Refreshing…"]) {
  assert.ok(i18n.split('"'+key+'"').length >= 3,
    "Missing Dari/Pashto Staff pagination translation: " + key);
}
console.log("Phase 15 mobile offline request/cancellation and Staff five-item pagination guards passed.");
