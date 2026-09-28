# Phase 8 — Pilot Release Readiness

## Outcome

Phase 8 hardens MaktabLink for a real school pilot without adding a new product module.

The implementation focuses on the readiness scope defined in the Product Specification:

- imports/onboarding
- audit review
- accessibility
- error states
- low-bandwidth read behavior
- backups
- production observability
- subscription controls
- administrator documentation

## Subscription controls

Every school now has one explicit subscription record.

States:

```text
TRIAL
→ ACTIVE
→ PAST_DUE
→ GRACE
→ SUSPENDED
→ CANCELLED
```

Existing schools are backfilled as ACTIVE so the Phase 8 migration does not unexpectedly disable an existing development or pilot school.

Newly provisioned schools receive a PILOT trial subscription by default.

Platform routes can update:

- plan code
- status
- monthly/annual billing cycle
- configurable AFN price
- independent setup fee
- start/expiry/grace dates
- support notes

When a subscription is SUSPENDED or CANCELLED:

- Parent/Teacher/Student authentication and authenticated access returns a clear service-unavailable response.
- School admins can still sign in and read subscription, audit, readiness, and export data.
- School-admin operational writes are blocked centrally.
- Stored school data is retained.

## Pilot onboarding without direct database manipulation

The protected platform route:

```text
POST /v1/platform/pilot/onboard
```

creates, in one product workflow:

- school
- school settings
- school subscription
- initial school administrator
- temporary administrator credential
- audit event

No SQL or direct database editing is required.

School admins also have:

```text
GET /v1/admin/pilot/readiness
GET /v1/admin/pilot/export
GET /v1/admin/pilot/import-template/:entityType
GET /v1/admin/audit
GET /v1/admin/subscription
```

The readiness response checks the core setup required before a pilot begins: active school/subscription, administrator, one active academic year, classes, subjects, teacher profiles/assignments, and family/student data.

## Import hardening

The existing validated CSV/XLSX import remains the write path.

Phase 8 adds downloadable CSV templates for:

- PARENT
- STUDENT
- TEACHER

Templates use the exact headers expected by the existing upload → map → validate → preview → confirm workflow.

Invalid rows still do not mutate school data.

## Audit review and export

School admins can review paginated audit history from the web readiness workspace.

The school export is school-scoped JSON and intentionally excludes:

- password hashes
- authentication session tokens/hashes
- platform provisioning secrets

It includes the operational school records needed for support/export review.

## Mobile low-bandwidth behavior

Authenticated GET responses that are small enough for safe local retention are cached in Expo SecureStore under a school+user-scoped key.

On a network transport failure:

- cached reads may be shown if not older than seven days
- the UI announces that cached information is being displayed
- HTTP authorization/subscription failures are never replaced by cached data
- writes are never queued or silently replayed by this cache

This is deliberately read caching, not a general offline-write system.

Attendance drafts already remain in component state if a submission fails, so a network failure does not automatically erase the teacher's selected marks.

## Accessibility hardening

Implemented pilot improvements include:

- visible web keyboard focus
- minimum 44px web/mobile action targets where controlled here
- explicit mobile accessibility roles/labels for primary onboarding and attendance actions
- live-region error/success announcements
- reduced-motion support in mobile onboarding/child transitions
- CSS reduced-motion behavior on web
- text labels in addition to semantic colors
- existing RTL-aware Dari/Pashto layout
- default React Native font scaling remains enabled

Manual screen-reader, large-text, contrast, and device-specific RTL smoke checks are still part of the pilot runbook.

## Production observability

API surfaces:

```text
GET /health
GET /ready
GET /metrics
GET /v1/platform/health/summary
```

- `/health` is process liveness.
- `/ready` verifies database connectivity and returns 503 if unavailable.
- `/metrics` exposes low-cardinality Prometheus text counters/gauges without tenant/student identifiers.
- platform health summary is protected by the provisioning credential.

When production logging is enabled, request completion/error logs contain:

- request ID
- method
- parameterized route
- status
- duration
- structured error payload for server failures

Enable structured API logging with production mode or:

```text
API_STRUCTURED_LOGS=true
```

External log aggregation, error tracking, alerting, and metrics scraping are deployment integrations; the repository does not claim that an external service is configured.

## Scheduled jobs

Phase 7 communication/reminder job:

```text
POST /v1/platform/jobs/communication/run
```

Phase 8 subscription lifecycle/reminder job:

```text
POST /v1/platform/jobs/subscriptions/run
```

Both are protected by the platform provisioning credential.

Subscription expiry notifications use stable deduplication keys for the 30/14/7/1-day reminders. Repeated job execution does not create duplicate reminders.

A deployment scheduler must invoke these endpoints. The API does not pretend that an external cron service is already configured.

## Encrypted database backups

Repository tooling:

```powershell
pnpm backup:db
pnpm restore:db -- backups/<backup>.mlbk
```

Backups stream from `pg_dump` through AES-256-GCM encryption. Plain database dumps are not intentionally written to disk by these scripts.

Restore requires:

```text
CONFIRM_RESTORE=YES
```

and streams decryption directly to `pg_restore`.

See `docs/BACKUP-RESTORE.md`.

## Migration

```text
packages/database/drizzle/0008_phase8_pilot_readiness.sql
```

It adds the subscription state model and backfills existing schools as ACTIVE.

## Verification boundary

CI verifies source-level/type/test/build behavior, including pilot onboarding and suspension rules.

CI does not prove:

- a real production backup was created/restored
- an external monitoring service is connected
- a production scheduler is configured
- manual screen-reader/device accessibility checks were performed

Those are deployment/pilot operations documented in the runbooks.
