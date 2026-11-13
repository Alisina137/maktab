# MaktabLink — Final Audit Phase 10: Integration, End-to-End Matrix and Release Decision

**Audit scope:** All ten final-audit phases, entire application release path and operational recovery.  
**Baseline before this phase:** `e848a3dfbc30a8f47981f4187cec66c0f448531a` (Phase 9 on `main`).  
**Production authorization:** **NO-GO**, regardless of automated CI success.  
**No live deployment, database migration, Android installation, operator signature or production restore was performed as part of this PR.**

## 1. What this phase actually changed

| Finding / coverage gap | Consequence | Implemented correction |
| --- | --- | --- |
| Existing `restore:db` wrote into the same `DATABASE_URL` configured for the running application after a single `CONFIRM_RESTORE=YES` flag | An operator could accidentally erase the real school database by following the old runbook | Restore now **requires an explicitly distinct `RESTORE_DATABASE_URL`, `RESTORE_TARGET=staging`, `CONFIRM_RESTORE_DATABASE=<exact database name>` and `CONFIRM_RESTORE=YES`**. Pooled/direct host aliases for the same source database are rejected; its configured source URL is never the restore destination. |
| The encrypted GCM backup was streamed directly into `pg_restore --clean` before the final authentication tag could be checked | A corrupted archive or wrong decryption key might start destructive SQL before decryption failed | Verify/authenticate the **entire** archive first with a discard stream, then decrypt it a second time into `pg_restore --single-transaction --clean --if-exists --exit-on-error`. This avoids writing a plaintext dump file and provides transactional SQL rollback. A manual staging-project identity check is still essential. |
| Audit phases 1–9 had independent commands/reports, but no **single exact-SHA matrix** tying together every role, operational gate and untested live journey | A green CI workflow or implemented API test could be mistaken for production readiness | Add a fail-closed, machine-readable Phase 10 report with **ten automated command inventories** and **20 independently pending live scenarios**, including staff, two-school privacy, finance, localization, Android offline and deployment operations. |
| No Phase 10 explicit cross-role smoke across the current complete migration chain | A newly unguarded route could escape the final release checkpoint even if earlier feature tests passed | Add a fresh Fastify/PGlite integration scenario: anonymous Admin/Staff/Teacher/Parent/Student/notifications routes return 401, admin token cannot use other-role routes, authenticated admin operations still work, public liveness/readiness responds and private metrics reject unauthenticated clients. |
| CI did not retain a consolidated final-audit artifact per exact commit | Operators had to merge fragmented prior release evidence to know which live checks remained pending | Run `pnpm verify:release:phase10` on **both Linux and Windows**, add it to root `pnpm verify`, and preserve the Phase 10 `NO_GO` report as a GitHub Actions artifact. |

**Boundaries:** The new tests use PostgreSQL-compatible PGlite, Fastify's injected HTTP server and pure Node policy tests. They do **not** exercise real Neon, Playwright browsers, Expo devices or actual payment/push providers. No destructive database operation was executed.

## 2. Consolidated audit history

| Audit phase | Topic | Programmatic gate | Status meaning |
| --- | --- | --- | --- |
| 1 | Project configuration, dependencies and CI | `verify:foundation` | Source / dependency assertions |
| 2 | Authentication, sessions, authorization and 2FA | `verify:security:phase2` | Automated auth integration |
| 3 | Database integrity, migrations and academic-year isolation | `verify:db:phase3` | PGlite migration and concurrency tests; **Neon staging pending** |
| 4 | Admin navigation, UI and responsive accessibility | `verify:admin:phase4` | Code checks; **real browser/TalkBack pending** |
| 5 | Academic structure, attendance and learning | `verify:academic:phase5` | Transactional workflow tests |
| 6 | Accounts, family relationships and roles | `verify:accounts:phase6` | Account lifecycle/tenant tests; **0033 migration pending** |
| 7 | Communication, fees, bank reconciliation and push | `verify:communication:phase7` | Ledger/idempotency and mocked push tests; **real delivery pending** |
| 8 | Dari/Pashto/English, RTL, loading/offline and accessibility | `verify:localization:phase8` | Pure localization and isolation tests; **physical device pending** |
| 9 | API reliability, readiness, monitoring and deployment | `verify:api:phase9` | Runtime/scheduler tests; **live load and monitoring pending** |
| 10 | Release aggregation, all-role smoke and recovery safety | `verify:release:phase10` | Consolidated source/test inventory and safe restore guards; **external acceptance pending** |

The Phase 10 report labels a command **CONFIGURED_NOT_EXECUTED_BY_REPORT** until real GitHub Actions results for the exact SHA are independently inspected. Automated source checks, even when passed, **do not** change any live journey from `UNVERIFIED`.

## 3. End-to-end manual acceptance (20 individual live journeys)

The complete, durable JSON checklist is generated by:

```powershell
cd C:\projects\maktab
node scripts/final-audit-phase10.mjs --output "C:\maktab-evidence\phase10-no-go.json"
```

Create `C:\maktab-evidence` first. The script refuses to overwrite existing evidence; use a new filename for each build. Each of the 20 journeys is still **UNVERIFIED** until it is independently exercised and recorded outside Git.

The checklist covers: Platform provisioning; Admin dashboard; Academic setup; Family accounts; Staff portal; Teacher/Negaran attendance; Teacher homework; Exams/results; Multiple-child parent; Student permissions; Announcements/live push; Fees/reconciliation; Session recovery; Two-school isolation; Three languages/RTL/a11y; Offline Android; Real Neon migrations; Authenticated backup/restore; Live operational scheduling/monitoring; Independent operator sign-off.

Independent manual proof must include **exact Git SHA and deployed binary, environment, date/time, test actor, safe test-school IDs, device/OS/browser, screenshots or logs with PII redacted, and a pass/fail verdict**. Do not put school/student records, passwords, session tokens, or the production database URL in a report. An in-process regression is not evidence of a live screen or real push.

## 4. Automated validation on this exact commit

After pulling the merged commit:

```powershell
cd C:\projects\maktab
pnpm install --frozen-lockfile
pnpm verify:release:phase10
pnpm verify
```

Phase 10 itself checks: all ten configured commands in the root `verify` and in **both** CI operating systems; the 20 live scenarios; safe database restore target/authenticated-backup checks; anonymous and cross-role API smoke; and the existing release-evidence NO-GO principle. The full root verification runs tests, TypeScript and build, not Android screenshots or remote Neon validation.

In GitHub Actions, download the **`phase10-final-audit-no-go`** artifact for the intended exact SHA. The artifact remains **NO_GO**, even if the CI workflows are green, because they cannot observe external live evidence.

## 5. Safe Neon migration and restore rehearsal

**Do not use production for first rehearsal.** From a separate restored staging project:

1. Take and verify an encrypted production backup with `pnpm backup:db`; copy it to approved off-host protected storage.
2. Configure staging's **direct** database URI for migrations and staging application test. First run `pnpm db:preflight:phase3`, then `pnpm db:preflight:phase6` against the staging clone and resolve any conflicts with explicit tenant/operator approval. Earlier migrations **0032 and 0033 remain unconfirmed on Neon**.
3. Apply migrations on staging in correct order using `pnpm db:migrate` and verify `/ready`, logins, app flows and cross-school constraints. Do not assume pulling code applies migrations.
4. To exercise the **destructive** backup restore, provision another **disposable database physically isolated from the primary connection** and use the exact-name safety flags from `docs/BACKUP-RESTORE.md`.
5. Verify restored data with non-PII row counts/checksums and role-based smoke tests; record rollback recovery timings and confirm the entire GCM authentication check succeeds **before** any restore SQL.
6. Repeat with independent concurrent PostgreSQL connections, an interrupted scheduler, malformed push callback, expired token, and brief network outage; document observed failures, retries and audit records.

## 6. Exact-SHA evidence / independent release review

The existing operator evidence format is `docs/PHASE7-RELEASE-MANIFEST.example.json` and the established validator `scripts/phase7-release-report.mjs`; Phase 10 uses the **same eleven external acceptance categories**, rather than introducing incompatible second approvals. Keep real evidence manifests **outside Git**.

```powershell
node scripts/final-audit-phase10.mjs --manifest "C:\maktab-evidence\operator-evidence.json" --output "C:\maktab-evidence\phase10-reviewed.json" --strict
```

If the source tree is dirty, the manifest SHA differs, a required gate is not PASS, evidence is too old, or any review reference is missing/unsafe, strict mode returns nonzero. If all gate **entries** are supplied, the result is only `READY_FOR_INDEPENDENT_RELEASE_REVIEW`. The tool **never** issues `GO`; each live journey stays unverified until independently observed. The authorized deployment owner must review the real attachments and decide outside the application.

## 7. Outstanding production blockers — final decision

| Severity | Blocker | Required external proof |
| --- | --- | --- |
| Critical | Phase 3 `0032` and Phase 6 `0033` migrations not demonstrated against real staged Neon with backup/restore | Read-only preflight, separate DB restore, ordered migrations, production plan and verified rollback |
| Critical | Device/browser/real-database E2E acceptance not performed for the **final exact SHA** | Real Admin/Staff/Teacher/Parent/Student journeys, two schools, 3 languages, manual screenshots/defects |
| High | Real Android accessibility/RTL and offline credentials/session switching not independently proven | 200% text, TalkBack, RTL, airplane mode, 401/403, account switching on physical devices |
| High | Real push receipt, external communication/subscription schedulers, liveness/metrics monitoring and alerts not demonstrated | Live provider receipts, scheduled jobs, alerts and restart/failure evidence |
| High | Real multi-connection PostgreSQL concurrency, payment ledger reconciliation and performance SLO not signed off | Load/replay/finance acceptance on staged Neon and non-PII evidence |
| High | Independent operator sign-off, incident ownership, recovery targets, safe migration and rollback plan missing | Named accountable reviewer and recorded release approval for the exact candidate |

**Final assessment: CODE AUDIT PHASES 1–10 COMPLETED WHEN CI PASSES; PRODUCTION = NO-GO.** Phase completion is not evidence of operational readiness or permission to launch. No release approval, hosted migration, phone test or background deployment has been performed by this audit.
