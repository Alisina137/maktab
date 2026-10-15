# Admin Communication & Fees — Phase 7 acceptance matrix

**Code candidate:** the exact commit of the Phase 7 pull request / merged `main` commit.
**PRODUCTION NO-GO** until independent operator evidence is reviewed. This document is a test plan, not a claim that real devices, external services, or production databases were tested.

## Automated gates (repeat on the exact candidate SHA)

Run `pnpm verify:admin-communication:phase7` and `pnpm verify` from a clean checkout.
Verify successful Linux and Windows CI jobs on the **same** commit.
PGlite exercises PostgreSQL-compatible logic but does not demonstrate actual cloud database connectivity, true multi-connection concurrency, migration rollback, or backup restore.

Automated invariants:
- Cross-school/role denial for notification monitor, exports, reconciliation and notification retry.
- Issued invoice totals exclude draft/cancelled, payments stay append-only, reversals do not rewrite original entries, idempotency retries preserve one payment.
- Fee scheduler locks an invoice before checking the current ledger and student status. A concurrent payment is serialized against overdue marking.
- Background push worker claims a notification with a conditional 30-minute expiring lease, releases it on normal completion, and only retries failed devices. Already accepted device rows are never deliberately resent.
- Admin retry declines an in-flight lease. Queue status `SENT` means **provider accepted**; `readAt` indicates in-app read and does not prove the device received or displayed a push.
- Announcement audience is validated again before push, and fee alerts are checked for active enrollment, open balance and current due category.

## Operator execution matrix

Keep evidence outside source control, identified by exact build SHA, school IDs that do not identify real students, UTC timestamps, operator role, device/OS, redacted screenshots and issue ticket references.

| Gate | Required manual execution | Evidence | Status |
| --- | --- | --- | --- |
| C7-01 | Clean exact-SHA Linux and Windows CI; verify branch and migration journal | CI run links | NOT_RUN |
| C7-02 | Back up staging database, apply 0022–0025 in order on real PostgreSQL, verify index/columns and rollback rehearsal | database change ticket | NOT_RUN |
| C7-03 | Perform encrypted backup, off-host transfer and isolated restore, then validate row counts | restore ticket | NOT_RUN |
| C7-04 | Two schools: compare report, payments, receipt, reconciliation, notification monitor and export; force foreign IDs | redacted HTTP traces | NOT_RUN |
| C7-05 | Parent/Student/Teacher must not reach Admin fee reports or retry mutation | forbidden API evidence | NOT_RUN |
| C7-06 | Concurrent partial/final payment, reversal, admin retry and invoice scheduler using multiple real PostgreSQL connections | transaction test log | NOT_RUN |
| C7-07 | Existing and in-batch invoice duplicates; preview never creates drafts; denied foreign students | test case log | NOT_RUN |
| C7-08 | Verify school timezone near civil-midnight and alternate IANA timezone including DST transition where applicable | timezone matrix | NOT_RUN |
| C7-09 | Publish, schedule, archive and retarget class/role announcements while job runs; verify recipient isolation | redacted inbox screenshots | NOT_RUN |
| C7-10 | Cron overlap and process kill: expired lease can recover; no concurrent handoff within live claim | scheduler log | NOT_RUN |
| C7-11 | Send Android real push in foreground/background/cold start, investigate ambiguous Expo acknowledgments and deep links | device recording | NOT_RUN |
| C7-12 | Complete Fees and Communication web at 320px/375px/tablet/desktop in Dari, Pashto and English; RTL tab scroll/keyboard, 200% zoom, screen reader | screenshot/assistive-tech checklist | NOT_RUN |
| C7-13 | Check CSV against spreadsheet formula injections and escaped quotes; run accountants' gross/reversal/net and aging comparison | signed accounting workpaper | NOT_RUN |
| C7-14 | Network loss, session swap, suspended/withdrawn user, cancelled/paid invoice; no data leak or stale push | redacted trace | NOT_RUN |
| C7-15 | Confirm deployed scheduler credentials, alerting, rollback, incident contacts, sign-off and exact-build release acceptance | operations signoff | NOT_RUN |

## Release decision

The existing independent `scripts/phase7-release-report.mjs` must be run with the separately maintained Step 20 evidence manifest, as explained in `docs/PHASE7-RELEASE-ACCEPTANCE.md`.
Even a complete manifest means READY_FOR_INDEPENDENT_RELEASE_REVIEW and **does not grant production GO**.
For any gate above still NOT_RUN, FAILED or unverified, the phase-specific verdict stays PRODUCTION NO-GO.

### Known residual risk

A push provider might accept a message and then time out before the API can store the acknowledgment; no client can safely guarantee exactly-once provider acceptance without provider reconciliation and idempotency support. A worker crash leaves a bounded lease that can be picked up after 30 minutes; it does not prove the previous provider handoff was absent. A live lease prevents ordinary simultaneous workers from sending twice, but this is not an end-to-end exactly-once guarantee.

## Machine-readable unverified matrix

Run `node scripts/phase7-communication-report.mjs --output <new-file.json>` to create a non-overwriting exact-SHA report of all 15 gates as NOT_RUN and PRODUCTION NO-GO. CI attaches this report as an artifact on each push. The JSON deliberately cannot issue production GO and must not replace independent evidence review.
