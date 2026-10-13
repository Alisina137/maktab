# Step 18 — Subscription, Pilot Onboarding, Readiness & Operations

Date: 2026-10-13. Scope: school-level service lifecycle and pre-pilot checks.
Automated integration tests do not replace deployed PostgreSQL, browser, Android,
scheduler and backup/restore acceptance.

| ID | Validation | Automated / follow-up status |
| --- | --- | --- |
| 18.1 | Protected platform provisioning key on school onboarding, subscription management and jobs | Fastify auth routing, existing/new API coverage |
| 18.2 | School, default settings, subscription, first admin, and audit created together | Atomic PostgreSQL transaction implemented; API onboarding regression |
| 18.3 | Duplicate school identity cannot create a second school | 409 and count regression |
| 18.4 | Safe initial admin password and password-change gate | Existing onboarding/login regression |
| 18.5 | Subscription plan, billing cycle, prices and dates | Contract validation, effective persisted-date validation |
| 18.6 | Prevent cancelled subscription reactivation | Conflict response and regression |
| 18.7 | TRIAL → ACTIVE/PAST_DUE → GRACE → SUSPENDED and service blocking | Existing Phase 8 lifecycle and authorization regressions; deployed cron check pending |
| 18.8 | Billing/readiness/export remain available to school admin while suspended | Existing Phase 8 API regression |
| 18.9 | Pilot readiness excludes inactive admins, Teachers, withdrawn pupils, closed-year classes and inactive-year assignments | Readiness query tightened; targeted API regression for invited admin |
| 18.10 | Subscription reminders reach active admins, do not duplicate under retry/concurrency | Database conflict-safe insert; existing sequential retry test; real parallel PostgreSQL run pending |
| 18.11 | Export contains school-scoped operational data without credential/session secrets; audit paging and CSV templates | Existing API regressions, manual review of real export pending |
| 18.12 | /ready, /metrics, production backups, restore and job scheduler | Health/API tests; integration deployment and restore rehearsal pending |
| 18.13 | App network/reconnect verification | Updated brittle parent-resilience verifier to inspect real recovery function; no production behavior change |
| 18.14 | Tenant isolation, Android RTL, offline/reconnect and pilot rollout | Existing security coverage; end-to-end device/operator acceptance pending |

## Fixes identified during Step 18

1. **Pilot readiness false positives.** Previously all administrator accounts, all academic years and all teacher assignments were counted, including invited or suspended administrators and old-year assignments. Readiness now reports operationally active users and active academic-year scope.
2. **Partial subscription PATCH invalid date ordering.** Validating only fields provided by one request could accept startsOn after the stored expiry. The store now checks the effective saved dates before mutating and responds with conflict for invalid combinations.
3. **Cancelled school reactivation.** Platform updates could reactivate a cancelled subscription despite the documented terminal status. Such status transitions now return conflict.
4. **Non-atomic pilot creation.** School, initial admin and audit were originally separate writes, risking orphan records. Provisioning now uses a single transaction.
5. **Subscription reminder retry race.** The job previously used a read-before-insert duplicate test. It now uses the database uniqueness constraint with ON CONFLICT DO NOTHING, counts actual inserts and filters recipients to active school administrators.
6. **Outdated verifier comment anchor.** `pnpm verify:parent-resilience` searched for a comment removed during ngrok stability work. It now searches within `retryServiceConnection` for the actual cache-disable-before-reload behavior instead. Reconnect state handling has not been weakened.

## Local acceptance after pulling

```powershell
cd C:\projects\maktab
git pull origin main
pnpm db:migrate
pnpm verify
```

Run the real multi-session platform and Admin cases against a non-production
PostgreSQL database. Provision a new school using platform credentials, change
the first administrator's temporary password, create an active academic year,
a class, Teacher assignment and a linked Parent/Student pair. Verify that the
readiness checklist changes to ready only when the required active resources
exist. Suspend and reactivate a **non-cancelled** subscription; validate that
Parent/Teacher/Student operational access is blocked while school Admin can
still view/export data. Run the subscription job concurrently using an expiry
reminder date; verify one alert per admin/date. Export school data and review
that account/session/password/verification secrets are absent. Perform an
encrypted backup-and-restore rehearsal on a disposable database and inspect
real Push delivery/Android locale and offline behavior.

## Known limitations

- The app does not automatically configure a cron scheduler, metrics collector,
  EAS push credentials or production encrypted-backup storage.
- A manual pilot-readiness checklist cannot independently prove full school
  data quality or real device connectivity.
- CI's PostgreSQL-compatible PGlite tests do not prove all cross-connection
  transaction schedules on an external PostgreSQL server.
