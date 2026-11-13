# MaktabLink Final Audit — Phase 9: API Reliability, Monitoring, Performance & Deployment

**Baseline:** `2a8162e7b4881f5a7ba3a7f78c65a7fa18f39b68` (Phase 8 merged).  
**Scope:** Fastify liveness/readiness/metrics, operational configuration, background homework publisher, PostgreSQL connection lifecycle, API exception logs and shutdown.

**Production release:** **NO-GO** until staged Neon migration/restore, real end-to-end browser/device acceptance and Phase 10 sign-off.  
**New database migrations:** none. **API contract changes:** monitoring endpoint now requires an independent credential; `/health` and `/ready` remain unauthenticated.

## Actual findings and applied fixes

| Existing source issue | Operational risk | Code change |
| --- | --- | --- |
| `/metrics` was public and emitted process uptime, DB readiness and HTTP error/traffic counts | Internet clients could read internal telemetry and repeatedly trigger database probes | Metrics now require an independent bearer token. If `API_METRICS_TOKEN` is unset, the endpoint is disabled with HTTP 404; wrong/missing bearer returns 401 with no metric data. Never reuse the provisioning or 2FA secret. |
| `/ready` and `/metrics` each called `schoolStore.healthCheck()` directly | Repeated health scraping created duplicate queries and a slow/disconnected Neon endpoint could hang probe responses | Single-flight database probe with a 1.5s result cache and 3.5s response deadline. Fail closed to 503 readiness when DB status is unknown. `/health` remains a lightweight liveness endpoint. These deadlines bound the HTTP response; they do **not** cancel a database query still waiting inside the driver. |
| The PostgreSQL client pool had no explicit connect deadline or maximum connection lifetime | New connection attempts could stall, and long-lived clients could remain bound to unhealthy endpoints | Add `connect_timeout: 10` seconds and a 30-minute maximum connection lifetime. Keep `max:10`, `prepare:false`, `idle_timeout:20`. |
| `setInterval` invoked scheduled homework publication every 60 seconds without an in-process overlap guard | A slow iteration could overlap the following poll and increase database load; shutdown could race the worker | Introduce an instance-local non-overlapping task wrapper, with safe error callback, finite 5s shutdown-drain grace period and one-flight termination. Cross-instance safety remains anchored in the existing transactional update/notification deduplication. |
| Due-homework scanning fetched every eligible draft without a limit, then fetched its assignment in a separate query | Large backlogs could cause unbounded memory work and many repeated assignment queries | Fetch at most 100 scheduled drafts in deterministic schedule order and join eligible active academic-year assignments in the selection; recheck year and teacher assignment **inside the transaction** before the atomic publication/notification fan-out. |
| Shutdown handlers called `app.close()` and `database.close()` without a guard | Repeated signals and active scheduled jobs could race or produce duplicate closes | Idempotent shutdown promise, stop polling first, drain the running task where possible, close HTTP and PostgreSQL resources even if the first close fails, and return nonzero process exit status on failure. |
| `server.ts` allowed the same provisioning secret to protect 2FA proof in production, production HTTP origins and plain-TCP PostgreSQL URLs | Credential coupling and invalid production transport security could go unnoticed | Fail closed on invalid ports, origins or database URLs. In production require HTTPS `WEB_ORIGIN`, TLS-enabled `DATABASE_URL` and a **distinct 32+-character** `PASSWORD_2FA_SECRET`. Development may keep local `http://localhost:3000` and existing secret fallback. |
| Fastify's 5xx handler logged the raw error object | Database or service errors can contain connection URLs, passwords or school-specific data | Continue logging method, route pattern, status and request ID but include only the error class, never the raw exception message/stack. |

## Automated verification

- `pnpm verify:api:phase9` checks source wiring and runs pure tests for bounded/single-flight readiness, fail-closed timeouts, dedicated metrics access, job overlap/drain/retry, production runtime validation and dev compatibility.
- A focused PGlite API regression covers `/health`, database readiness, unauthorized metrics access, wrong token and valid bearer metrics with no-store headers.
- The full suite still covers scheduled homework publication and idempotent notification fan-out. Source-level guards enforce the 100-row bound and year-lock checks.
- Linux and Windows CI run `verify:api:phase9` and the existing complete typecheck/tests/build.

```powershell
cd C:\projects\maktab
pnpm install --frozen-lockfile
pnpm verify:api:phase9
pnpm typecheck
pnpm test
```

## Deployment configuration checklist

1. Apply the **already-pending** Phase 3 (`0032`) and Phase 6 (`0033`) migrations on a restored staging Neon database after their separate read-only preflights; neither migration is applied by this PR.
2. Set `NODE_ENV=production`, explicit `WEB_ORIGIN=https://...` (origin only, no path), pooled `DATABASE_URL` with `sslmode=require` or stronger, `PLATFORM_PROVISIONING_KEY` (at least 24 characters), and a **separate** `PASSWORD_2FA_SECRET` (at least 32).
3. To scrape Prometheus metrics, configure a **third independent** `API_METRICS_TOKEN` (at least 32 characters) and use `Authorization: Bearer <token>`. Never log it or expose it through the browser. Without this token, `/metrics` is intentionally disabled.
4. Configure startup/load-balancer probes: `GET /health` establishes process liveness; `GET /ready` establishes last-known bounded database reachability. An HTTP 200 liveness probe is **not** proof the database is ready.
5. Verify alerts for readiness 503, elevated `maktablink_http_errors_total`, backlog and scheduler failures; metric counters are process-local and reset on deploy. There is not yet a persistent multi-instance alerting/uptime system.
6. Schedule a controlled `SIGTERM` during a background publication on staging; verify there is no duplicate publication/audit row and recovery resumes after restart.
7. Perform a **verified encrypted backup + restore rehearsal** and test outage/recovery with multiple separate Neon connections. CI/PGlite cannot establish a production SLO or the effect of a multi-region outage.

## Limits and future work

- A health response timeout does **not** interrupt a PostgreSQL statement; the driver connection deadline is longer than the probe deadline. Runtime saturation and circuit breaking under severe outages still require real Neon load testing.
- The fixed batch size limits each scheduler iteration but a permanently failing item among the earliest 100 drafts can delay later items. Persistent per-item failure telemetry, dead-letter handling, and administrative retry controls should be evaluated before large multi-school rollout.
- `LoginRateLimiter` remains per-process. Multi-instance deployment still requires edge or shared-data-store rate limiting; this audit does **not** claim distributed brute-force protection.
- Metrics authentication is a safety gate, not a complete monitoring deployment. External Prometheus/Grafana alert rules, durable scheduler failure telemetry, push-device delivery evidence, backup restoration and final acceptance remain operational work.
- Phase 10 must perform independent end-to-end testing and integrate release evidence before changing the production NO-GO decision.

**No production DB, hosted service, email, notification or external payment was modified by this code audit.**
