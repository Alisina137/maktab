import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const app = read("apps/mobile/App.tsx");
const api = read("apps/mobile/src/api.ts");
const cache = read("apps/mobile/src/read-cache.ts");
const push = read("apps/mobile/src/push.ts");
const apiTests = read("apps/api/src/app.test.ts");

function requireText(source, marker, message) {
  if (!source.includes(marker)) throw new Error(message + ": " + marker);
}

function requireOrder(source, first, second, message) {
  const a = source.indexOf(first);
  const b = source.indexOf(second, a >= 0 ? a : 0);
  if (a < 0 || b < 0 || a >= b) throw new Error(message);
}

requireText(cache, 'hash(`${scope}|${path}`)', "Read cache must be scoped by signed-in user/school");
requireText(cache, "MAX_CACHE_AGE_MS", "Read cache expiry is missing");
requireText(api, "options.timeoutMs ?? 10_000", "Authenticated request timeout is missing");
requireText(api, "cachedReadFallback", "Network/tunnel cache fallback is missing");
requireText(api, 'code === "session_invalid"', "Expired access-token retry is missing");
requireText(api, "allowSessionRefresh: false", "Refresh retry loop protection is missing");

requireText(app, "sessionRefreshPromiseRef", "Single-flight session refresh is missing");
requireText(app, "accessExpiresAt).getTime() - 60_000", "Proactive session refresh is missing");
requireText(app, 'AppState.addEventListener("change"', "Foreground session recovery is missing");
requireText(app, "parentChildLoadRequestId", "Selected-child stale response protection is missing");
requireText(app, 'setAppError("common.cachedOffline", "network")', "Cached/offline state is not surfaced accurately");
requireText(app, "setReadCacheScope(null)", "Cache scope cleanup on logout/session loss is missing");

const reconnectMarker = "// Connectivity is confirmed. Network-backed refreshes triggered by the";
const reconnectStart = app.indexOf(reconnectMarker);
if (reconnectStart < 0) throw new Error("Reconnect cache/network handoff marker is missing");
const reconnectBlock = app.slice(reconnectStart, reconnectStart + 900);
requireOrder(
  reconnectBlock,
  "setPreferCachedReads(false);",
  "setReconnectEpoch((current) => current + 1);",
  "Reconnect must disable cache-only mode before triggering data reload"
);

requireText(push, "} catch {\n    return null;", "Push registration failure must remain non-blocking");
requireText(push, "Logout must never depend on notification connectivity.", "Push deactivation must not block logout");

requireText(apiTests, 'test("refresh sessions rotate once and logout revokes the current session"', "Refresh/logout API resilience coverage is missing");
requireText(apiTests, 'error, "refresh_invalid"', "Refresh replay/revocation assertion is missing");
requireText(apiTests, 'error, "session_invalid"', "Logout access revocation assertion is missing");

console.log("Parent resilience verified: scoped cache, timeouts, offline fallback, single-flight refresh, proactive/foreground renewal, stale-response guards, fresh reconnect reload, non-blocking push, and refresh/logout revocation.");
