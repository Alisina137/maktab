# Step 19 — Local Environment & Deployment Readiness

Date: 2026-10-14. Scope: safe release verification and repair of interrupted local checkout/migration workflow.

| ID | Check | Status / follow-up |
| --- | --- | --- |
| 19.1 | GitHub main changes are present in the working tree before verification | User-side checkout blocked by HTTPS connection reset; retry required |
| 19.2 | Parent resilience verifier still enforces cache disable before reconnect reload | Fixed in Step 18 (commit 087b08d4); the user's old script remains until pull succeeds |
| 19.3 | `DATABASE_URL` existence and URL scheme validation | Added non-destructive `pnpm db:check` |
| 19.4 | PostgreSQL connection, default schema and Drizzle migration journal check | `pnpm db:check`; actual local execution pending |
| 19.5 | Database diagnostic must never print password or connection URL | Offline fake-secret regression in `scripts/test-db-check.mjs` |
| 19.6 | Check the latest SQL migrations, particularly `0018_exam_subject_dates` and `0019_fee_payment_idempotency` | Source inspected; local application pending |
| 19.7 | `pnpm verify`: localization, parent resilience, ngrok/dev API, typecheck, tests and production build | GitHub CI runs component checks; user local smoke pending checkout |
| 19.8 | Network interruptions must not cause subsequent migration/build commands to continue as if pull succeeded | Documented PowerShell fail-fast pull-and-verify sequence |
| 19.9 | Verify /ready, /metrics, and school subscription/tenant authorization on a deployed environment | Manual acceptance pending |
| 19.10 | PostgreSQL backup and non-production restore, real Android/push testing | Manual acceptance pending |

## Symptoms reported

- `git pull origin main` failed with `Recv failure: Connection was reset`. GitHub's server cannot be updated from a user-local git pull on the assistant side; this is an HTTPS transport failure. It does **not** establish a code merge error.
- Running `pnpm verify` anyway used the old `verify-parent-resilience.mjs`, which still expects a comment marker removed by the reconnect refactor. The corrected script is already on GitHub main and passed CI.
- `pnpm db:migrate` stopped at the Drizzle `applying migrations` spinner without a useful database error message. This output does **not** identify whether the actual failure was network, TLS, authentication or SQL drift. Do not edit migration history or run `db:push` to guess at a fix.

## Safe PowerShell recovery on Windows

Run from the MaktabLink directory. A failure stops later commands; this is
important because PowerShell happily runs the next command even after a
separate git process fails.

```powershell
cd C:\projects\maktab
git status --short
git -c http.version=HTTP/1.1 pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Git pull failed; stop before migration or verify." }
pnpm db:check
if ($LASTEXITCODE -ne 0) { throw "Database preflight failed; check connectivity / credentials." }
pnpm db:migrate
if ($LASTEXITCODE -ne 0) { throw "Database migration failed; stop and investigate the original error." }
pnpm verify
if ($LASTEXITCODE -ne 0) { throw "Verification failed." }
```

If pull continues returning `Connection was reset`, test `git -c
http.version=HTTP/1.1 ls-remote origin HEAD`, check the VPN/proxy/firewall or
switch networks. Do **not** disable TLS verification, delete local changes or
run `git reset --hard` to repair a transport reset.

If `db:check` fails, its concise diagnostic should distinguish common DNS,
connection, timeout and authentication error codes without exposing secrets.
If the preflight passes but migration fails, retain the full migration error
log and inspect the actual failed SQL and Drizzle migration journal against
the local database before making any schema modification.

## 2026-10-14 follow-up — Git succeeded, Neon connection timed out

The user's `git pull --ff-only` successfully fast-forwarded to `93cb603`:
the resilience verifier update is present locally. The next command,
`pnpm db:check`, returned `CONNECT_TIMEOUT` against the configured
`-pooler` Neon endpoint on port 5432. The fail-fast guard correctly stopped
before migration and verification. **This is a connection-startup failure,
not proof of migration SQL corruption or invalid credentials.**

Repository improvements in this follow-up:
- Extended the initial diagnostic startup timeout from 10 to 30 seconds to
  tolerate transient Neon compute cold starts.
- Classified `CONNECT_TIMEOUT` explicitly with network/host/5432 guidance.
- `pnpm db:check` checks both the application URL and
  `DATABASE_URL_UNPOOLED` when supplied, without printing credentials.
- Drizzle migrations prefer the separately configured Neon direct URL;
  the app may continue using a pooled runtime URL.
- Updated `.env.example` to document the two-URL setup.

### Next user-local checks (Windows PowerShell)

```powershell
# This is a hostname only, never paste the database password.
Test-NetConnection -ComputerName 'ep-winter-night-b4fm2d0b-pooler.c-6.us-east-2.aws.neon.tech' -Port 5432 -InformationLevel Detailed
Resolve-DnsName 'ep-winter-night-b4fm2d0b-pooler.c-6.us-east-2.aws.neon.tech'
```

If DNS or TCP/5432 fails, check firewall/VPN, router or ISP port blocking,
and repeat on another network/mobile hotspot. If TCP works but the Postgres
startup still times out, check Neon Console endpoint status and try its SQL
editor (e.g. `SELECT 1`). For direct migrations, use the **Direct** URI
copied from Neon Console's connection panel with connection pooling disabled
and set `DATABASE_URL_UNPOOLED` in the private root `.env`.

Never share the raw connection URL, password, or `.env` in chat. Do not use
`db:push`, `reset --hard`, or disable TLS as a timeout workaround.

## 2026-10-14 follow-up — Local `pnpm verify` exposed three API test failures

The user's latest Windows `pnpm verify` output passed localization, cache/reconnect
verification, development tunnel tests, all typechecks, and the database unit
tests, but stopped in `apps/api` with **51 passing / 3 failing** tests:

- School teacher/Negaran/timetable integration fixture: HTTP **400** instead of **201**.
- Duplicate exam/grade workflow: HTTP **500** instead of expected **409**.
- Duplicate pilot onboarding: HTTP **500** instead of expected **409**.

### Root causes reproduced

A dedicated GitHub Actions **Windows / Node 24** test job reproduced the
failure and revealed the first problem's HTTP response: the test attempted to
create a parent with username `parent.classroster`, but the application's
intentional alphanumeric-only username policy correctly rejects periods. The
test fixture now uses `parentclassroster`; the user-facing policy was **not**
weakened.

The two 500s stemmed from PostgreSQL unique-constraint violations hidden
inside nested Drizzle query errors. The exception translator previously tested
only the outer error text, overlooking the driver's `23505` code. A shared
cause-chain-aware helper now correctly recognizes nested unique violations.
It is covered by regression tests that distinguish duplicates from unrelated
database/network errors. In a subsequent Windows CI run, the exam and pilot
duplicate tests passed.

### CI discovery bug uncovered

Linux shell expansion of the unquoted `src/**/*.test.ts` pattern selected
only nested test files when they existed, silently omitting the root
`apps/api/src/app.test.ts` integration suite. This allowed green Linux CI
while Windows executed the whole suite and exposed real failures. Test
commands now **quote the glob** so tsx performs platform-consistent discovery
for API, database, contracts and localization projects. CI additionally
includes a real Windows / Node 24 API test job.

### User-local follow-up

```powershell
cd C:\projects\maktab
git -c http.version=HTTP/1.1 pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "Pull failed" }
pnpm verify
```

This test suite uses an embedded local PGlite database and does **not** require
the remote Neon PostgreSQL server to be connected. The earlier external
`CONNECT_TIMEOUT` remains a separate connectivity issue: only run
`pnpm db:migrate` after `pnpm db:check` succeeds. No destructive database
operations are needed to address the API test failures.
