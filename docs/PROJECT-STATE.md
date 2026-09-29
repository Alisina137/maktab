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


## Post-implementation refinement — Admin workspace routing, localization, and profile

- Testing Step 3 remains active; this change is a refinement, not a new product phase.
- The school admin web app now uses separate authenticated routes instead of one all-in-one page:
  - `/admin/accounts`
  - `/admin/pilot`
  - `/admin/communication`
  - `/admin/learning`
  - `/admin/attendance`
  - `/admin/families`
  - `/admin/academics`
  - `/admin/profile`
- `/admin` is the login / first-password-change entry only.
- The admin session is kept in browser `sessionStorage` for route-to-route continuity; locale preference alone is stored in `localStorage`.
- Admin locale supports Persian/Dari (`fa-AF`), Pashto (`ps-AF`), and English; Persian/Dari is the default when no preference exists.
- Existing operational panels are connected to the shared admin locale context and RTL/LTR direction.
- Administrator profiles now support school-scoped `fullName` and optional `phone` through migration `0010_admin_profiles.sql` and `GET/PATCH /v1/admin/profile`.
- Admin sign-out sends the refresh token to `/v1/auth/logout` so the server session is revoked before local browser session state is cleared.
- Login hero typography and feature-card readability were refined.
- CI verified typecheck, tests, and build after the routed workspace changes.


## Post-implementation refinement — Typography and transient feedback

- Shared web/admin typography now uses a softer multilingual system stack led by Segoe UI Variable, with Noto Sans Arabic/Noto Sans/Tahoma/Arial fallbacks for Persian/Dari, Pashto, and English.
- RTL headings no longer inherit Latin-style negative letter spacing.
- Admin top feedback auto-dismisses success messages after 5 seconds and ordinary errors after 8 seconds; both remain manually dismissible.
- Legacy inline success/error feedback in Academics, Families, Attendance, Learning, Communication/Fees, and Pilot Operations now follows the same transient behavior.
- Ongoing mobile connectivity warnings intentionally remain visible until connectivity returns because they represent a current state rather than a completed action.
- CI verified typecheck, tests, and production build after these refinements.


## Post-implementation refinement — Admin motion and loading UX

- Added a shared branded admin loader and skeleton system for authenticated admin data-loading states.
- Loading UX now covers routed workspace startup plus Accounts, Profile, Academics, Families, Attendance, Learning, Communication/Fees, and Pilot Operations.
- Added subtle page, heading, card, row, navigation, login, hover, and press animations across the admin panel.
- RTL row motion mirrors LTR direction correctly.
- All animations honor `prefers-reduced-motion` and collapse to effectively no motion when the user requests reduced motion.
- CI verified typecheck, tests, and production build after the animation/loading refinement.


## Post-implementation refinement — Admin localization and Solar Hijri calendar

- Admin Persian/Dari and Pashto coverage was completed across routed pages, including secondary helper copy, dynamic account/action feedback, statuses, attendance rows, family/import workflows, exam lifecycle text, communication/fee details, pilot readiness, and shared API/session errors.
- The admin UI no longer uses native Gregorian `date` or `datetime-local` controls.
- Added a shared premium Solar Hijri (Jalali) date picker for academic-year dates, Negaran dates, attendance filters, announcement scheduling, and fee due dates.
- Date selection/display uses the Persian calendar in the UI while API/database payloads remain canonical Gregorian ISO dates, preserving current backend contracts and date validation.
- Existing stored Gregorian dates are formatted back to Solar Hijri for relevant admin displays such as academic years, attendance, invoices, subscription dates, audit timestamps, and family last-login metadata.
- The Solar Hijri picker supports Persian/Dari, Pashto, and English labels, RTL/LTR layout, month navigation, optional time selection, today/clear actions, responsive styling, and reduced-motion preferences.
- CI verified typecheck, tests, and production build after the localization/calendar refinement.
