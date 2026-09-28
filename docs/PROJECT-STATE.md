# MaktabLink Project State

## Product objective

Build a mobile-first, multi-tenant school-family communication platform designed for private schools in Afghanistan.

## Source of truth

- Product: **MaktabLink Product Specification V1**, supplied 2026-09-28.
- Implementation process: **Software Development Workflow V5 — GitHub-First Delivery**.
- Repository: `Alisina137/maktab`.

## Locked product rules

- School controls school-user identities.
- Role selection is UX only; backend role is authoritative.
- Every school-owned operational query/mutation remains tenant-scoped.
- Parent sees only linked children; student sees only their own linked record.
- Negaran remains an assignment rather than a role.
- Draft academic results remain hidden until publication.
- Announcements always have explicit audience scope.
- Fee payments are immutable ledger records; corrections use separate reversals.
- Scheduled notifications/reminders must be idempotent.
- Push failure must never undo the underlying school action.
- Subscription entitlements apply to the school rather than individual users.
- SUSPENDED/CANCELLED schools retain data; operational writes are disabled.
- Cross-school access is prohibited.

## Current phase

**Phase 8 — Pilot Release Readiness — complete and CI verified**

### Implemented outcomes

- migration `0008_phase8_pilot_readiness.sql`
- explicit school subscription records and lifecycle
- TRIAL / ACTIVE / PAST_DUE / GRACE / SUSPENDED / CANCELLED states
- configurable plan code, billing cycle, AFN price, setup fee and lifecycle dates
- existing-school subscription backfill
- default PILOT subscription for newly provisioned schools
- central operational-write blocking for suspended/cancelled schools
- clear service-unavailable behavior for Parent/Teacher/Student when school service is suspended
- school-admin billing/export/readiness access retained during suspension
- protected pilot onboarding route without direct database manipulation
- initial school + settings + subscription + admin + temporary credential creation
- pilot readiness checklist API
- downloadable Parent/Student/Teacher CSV import templates
- school-scoped safe JSON export excluding password/session secrets
- paginated school audit review
- Phase 8 pilot-readiness admin workspace
- low-bandwidth authenticated GET caching on mobile
- seven-day bounded cached-read fallback for transport failures
- authorization/subscription failures never replaced by cached data
- no offline replay of writes
- improved mobile/web accessibility semantics and minimum touch targets
- reduced-motion support
- live error/success announcements
- production `/health`, `/ready`, and `/metrics` endpoints
- low-cardinality Prometheus metrics
- structured production request/error logging
- protected platform health summary
- idempotent subscription expiry reminders
- encrypted PostgreSQL backup tooling using AES-256-GCM
- streamed restore tooling with explicit restore confirmation
- admin guide
- pilot runbook
- pilot test matrix
- backup/restore runbook
- production operations runbook

## Verification

GitHub Actions CI passed on the final Phase 8 repository head:

```text
04be061b3ad3d4943998ece37a03c2b226f234f9
```

Verified by CI across the Phase 8 implementation history and final head:

- dependency installation
- monorepo TypeScript typecheck
- Phase 1–8 database/API tests
- pilot onboarding without direct database manipulation
- school subscription suspension behavior
- school-admin retained readiness/export access during suspension
- subscription lifecycle/reminder behavior
- idempotent subscription reminders
- Phase 7 reminder/push regressions
- tenant/auth/academic/family/attendance/learning/communication regressions
- readiness/observability code
- Next.js production build
- Expo Android production export
- Phase 8 documentation/runbooks

## Local database status

Phase 8 has **not yet been locally migrated/verified** in this conversation.

Pending migrations on a local environment that has not yet applied Phase 7:

```text
0007_phase7_communication_fees.sql
0008_phase8_pilot_readiness.sql
```

After pulling:

```powershell
pnpm install
pnpm db:migrate
pnpm verify
```

Drizzle applies only migrations that are not already recorded.

## Pilot onboarding

Protected platform endpoint:

```text
POST /v1/platform/pilot/onboard
```

It provisions the pilot school, school settings, subscription, initial school admin, temporary credential, and audit event without direct SQL/database editing.

School-admin readiness endpoints:

```text
GET /v1/admin/pilot/readiness
GET /v1/admin/pilot/export
GET /v1/admin/pilot/import-template/:entityType
GET /v1/admin/audit
GET /v1/admin/subscription
```

## Subscription behavior

Suggested product lifecycle is implemented:

```text
TRIAL
→ ACTIVE
→ PAST_DUE
→ GRACE
→ SUSPENDED
→ CANCELLED
```

Reactivation is supported from non-cancelled service states according to platform controls.

During SUSPENDED/CANCELLED service:

- school operational writes are centrally blocked
- Parent/Teacher/Student service access returns a clear unavailable state
- school admin retains subscription/readiness/audit/export access
- school data remains stored

## Observability

Available API surfaces:

```text
GET /health
GET /ready
GET /metrics
GET /v1/platform/health/summary
```

`/ready` verifies database connectivity. `/metrics` exposes low-cardinality Prometheus text metrics without tenant/student identifiers.

External metrics scraping, alerting, error tracking, and log aggregation are deployment integrations and are not claimed as configured.

## Backups

Repository tooling:

```powershell
pnpm backup:db
pnpm restore:db -- backups/<backup>.mlbk
```

Required backup secret:

```text
BACKUP_ENCRYPTION_KEY
```

Backup creation also requires PostgreSQL client tooling (`pg_dump`) on PATH. Restore requires `pg_restore` and:

```text
CONFIRM_RESTORE=YES
```

The scripts stream encrypted data and do not intentionally write plaintext database dumps to disk.

A real production backup/restore has not yet been performed in this conversation.

## Scheduled jobs

Phase 7 communication/reminder job:

```text
POST /v1/platform/jobs/communication/run
```

Phase 8 subscription job:

```text
POST /v1/platform/jobs/subscriptions/run
```

Both require the platform provisioning credential and must be invoked by a deployment scheduler/cron.

## Manual pilot checks still required

CI cannot prove these real-world deployment checks:

- real Android push delivery with EAS credentials
- production cron/scheduler invocation
- real encrypted backup + restore rehearsal
- external monitoring/log aggregation connection
- screen-reader and large-text device smoke testing
- final real-school pilot onboarding/training

These steps are documented in:

- `docs/PILOT-RUNBOOK.md`
- `docs/PILOT-TEST-MATRIX.md`
- `docs/BACKUP-RESTORE.md`
- `docs/PRODUCTION-OPERATIONS.md`
- `docs/ADMIN-GUIDE.md`

## Roadmap status

All eight implementation phases are now represented in the repository.

Phase 8 is the final planned implementation phase from Product Specification V1. The remaining work is deployment and real pilot validation rather than a Phase 9 product implementation.
