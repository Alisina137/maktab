# Phase 11 — Hands-on Staging & Pilot Acceptance Runbook

**Implemented source tools:** `scripts/phase11-pilot.mjs` (CLI), `scripts/test-phase11-pilot.mjs` (offline tests), `pnpm verify:pilot:phase11` (Ubuntu and Windows CI).  
**External validation:** **NOT EXECUTED** by this repository change. **Production: NO-GO.**  
**Authoritative scenarios:** [Phase 10 twenty-journey matrix](FINAL-AUDIT-PHASE10.md); the existing 11-gate [release manifest](PHASE7-RELEASE-MANIFEST.example.json) is still the production decision standard.

The Phase 11 utility supports all six audit workstreams, but it **cannot** create a hosted Neon instance, obtain staging tokens, operate someone's Android phone, prove a push receipt, measure a real restore or grant release approval. Those events must be performed with independent evidence and on the **exact** candidate SHA. Every workbook entry starts `UNVERIFIED`; a successful source build or mock probe never sets PASS automatically.

## First: run automated *source* checks

```powershell
cd C:\projects\maktab
pnpm install --frozen-lockfile
pnpm verify:pilot:phase11
pnpm verify
```

The standalone Phase 11 gate runs without any database or environment credentials. The full verification suite also exercises the previous ten audits. Neither is real deployment acceptance.

Create a private evidence directory **outside the Git checkout** (the CLI rejects repository-local paths):

```powershell
New-Item -ItemType Directory -Force C:\maktab-evidence
pnpm pilot:phase11 init --deployment "isolated-staging-build-001" --output "C:\maktab-evidence\phase11-001.json"
```

Keep this file and all subsequent revisions outside Git and shared chat logs. Never store names of pupils, passwords, session tokens, full connection strings, or raw private screenshots in the ledger. Record evidence *references* to separately access-controlled locations.

## Task 11.1 — Staging and read-only database preflights

Provision a **separate Neon project/cluster** with synthetic school data; take and verify a protected backup before any schema changes. Configure **temporary shell environment variables**, not `.env` or committed configuration. Replace the example placeholders locally:

```powershell
$env:PHASE11_CONFIRM_STAGING="YES"
$env:STAGING_DATABASE_URL="<staging pooled PostgreSQL URL>"
$env:STAGING_DATABASE_URL_UNPOOLED="<staging direct PostgreSQL URL>"
$env:PRODUCTION_DATABASE_URL="<protected source database URL for comparison>"
$env:CONFIRM_STAGING_DATABASE="<exact staging DB name>"
pnpm pilot:phase11 preflight --output "C:\maktab-evidence\preflight-001.json"
```

The preflight refuses absent typed confirmation, mismatched staging pooled/direct DBs, and a staging database on the same project hostname as the protected source (including Neon `-pooler` alias). It then executes **only** `db:check`, `db:preflight:phase3`, `db:preflight:phase6`. Subprocess output is deliberately suppressed to prevent leaking provider details. The command exits nonzero on failed checks; the JSON output is a summary, **not proof of an observed migration**.

Review the database identity, backup and preflight outcomes before **separately** planning migration `0032`, `0033` and later journal entries on the isolated staging clone. This utility intentionally does not perform migrations or modify a database. Obtain a production change-window and rollback approval separately.

For an isolated staging API, set:

```powershell
$env:STAGING_API_URL="https://<staging-api-host>/"
$env:CONFIRM_STAGING_HOST="<staging-api-host>"
$env:PRODUCTION_API_URL="https://<separate-production-api-host>/"
# Optional: staging-only bearer credentials stored in shell, never in the report.
# $env:PHASE11_ADMIN_TOKEN="<staging-admin-access-token>"
# $env:PHASE11_METRICS_TOKEN="<staging-private-metrics-token>"
pnpm pilot:phase11 probe --output "C:\maktab-evidence\probe-001.json"
```

The probe issues **GET requests only**, follows no redirects, imposes timeouts, checks `/health` and `/ready`, checks private `/metrics` is not public and (optionally) works with the staging metrics token. It denies anonymous access to Admin/Staff/Teacher/Parent/Student endpoints and (when an optional real staging Admin access token is provided) expects role-isolation 403s from other-role endpoints. It saves only paths, statuses and pass/fail decisions; no response body or credentials. A passing probe is **not** a full browser/mobile journey.

## Task 11.2 — Web/browser and two-school authorization

In a real deployed staging browser: provision two distinct synthetic schools; log into the Admin and **separate Staff** web portals; exercise every navigation route, creation/validation and pagination state, year/year archive, grade/class/timetable, staff permissions, student-family linking, attendance correction, exam publication and manual AFN ledger/reversal. Test two browser sessions, keyboard focus, narrow screen widths and sign-out/token expiry. Attempt cross-school and cross-role requests; deny them server-side. Verify generated exports cannot include the other school.

Use the following Phase 10 journey IDs when recording results: `platform_setup`, `admin_dashboard`, `academic_setup`, `family_accounts`, `staff_portal`, `two_school_isolation`, `account_session_recovery`.

## Task 11.3 — Physical Android, three languages and accessibility

Use signed or staging-connected builds on at least one actual Android device with a staging school and synthetic users. Exercise Teacher (including Negaran), Parent with multiple linked children, and Student independently. Validate teacher assignments, schedule, attendance, homework draft/publish/archive, exams draft/results visibility, parent/student records and fee balances; verify other students/classes and schools cannot be accessed. Switch Dari/Pashto RTL ↔ English LTR; check Solar Hijri dates, typography at 200% scale, TalkBack focus order and touch-targets. Test airplane mode, reconnect, account switching and cache isolation. Capture device/OS/build identifiers and **redacted** evidence.

Use IDs: `teacher_attendance`, `teacher_homework`, `exam_results`, `parent_multiple_children`, `student_role`, `three_languages`, `offline_device`.

## Task 11.4 — Integrations, reminders and real reconciliation

Use staging-only provider credentials and phones to record actual Expo push token registration, provider acceptance, phone delivery, notification deep links and retries. Independently invoke the protected communication and subscription scheduler endpoints using a staging scheduler identity; verify idempotency (run twice) and failure/retry behavior. Execute manual AFN invoice, partial receipt, reversal and reconciliation on two real PostgreSQL sessions with concurrent requests; prove ledger totals and school scoping. These checks involve deliberate **writes**, so the read-only Phase 11 probe intentionally does *not* invoke them.

Use IDs: `announcements_push`, `fees_reconciliation`. Record actual queue IDs/receipts only in secure restricted evidence (not in repository/logged messages).

## Task 11.5 — Disaster recovery, monitoring, rollback

Review `docs/BACKUP-RESTORE.md` before proceeding. Authenticate the encrypted backup and restore **only into an isolated disposable staging database**, requiring `RESTORE_TARGET=staging`, `RESTORE_DATABASE_URL`, exact `CONFIRM_RESTORE_DATABASE` and `CONFIRM_RESTORE=YES`. `restore:db` refuses production aliases and validates the entire GCM tag before destructive restore SQL. Record independent checksum/count validation, restore duration, RPO/RTO, incident ownership and rollback verification. Observe live `/ready`, protected metrics, alerts, restart/error paths, queue retries and performance under representative synthetic load.

Use IDs: `backup_restore`, `production_operations`.

## Task 11.6 — Evidence, defects and independent review

For **every** actual tested journey or release gate, collect: exact source SHA, deployed API/web/mobile build, actor, independently named reviewer, device/browser/platform, UTC observation time, expected/actual results and a restricted evidence reference. FAIL/BLOCKED observations also require a defect reference.

**Record a real observation** after independent review (example placeholders, not a claimed result):

```powershell
pnpm pilot:phase11 record --attest `
  --input "C:\maktab-evidence\phase11-001.json" `
  --output "C:\maktab-evidence\phase11-002.json" `
  --kind journey --id staff_portal --status PASS `
  --actor "QA Operator" --reviewer "Other Reviewer" `
  --device "Windows Chrome 142" `
  --reference "vault:phase11/staff-portal-proof" `
  --observed-at "<ACTUAL_UTC_TIMESTAMP_IN_ISO8601>"
```

For an external gate, use `--kind gate` and an ID such as `exact_commit_ci`, `real_postgres_migrations` or `operator_signoff` from the 11 Phase 10 gates. For FAIL/BLOCKED, add `--defect "ticket:phase11/issue-123"`.

**Record a real defect** in a *new* immutable revision:

```powershell
pnpm pilot:phase11 defect --attest `
  --input "C:\maktab-evidence\phase11-002.json" `
  --output "C:\maktab-evidence\phase11-003.json" `
  --reference "ticket:phase11/issue-123" --severity HIGH --status OPEN `
  --actor "QA Operator" --reviewer "Other Reviewer" `
  --observed-at "<ACTUAL_UTC_TIMESTAMP_IN_ISO8601>"
```

To mark it RESOLVED, independently retest the fix at the **same candidate SHA**, use a newer output file and add `--status RESOLVED --fix-sha <EXACT_SHA>`. Keep failed/blocked journeys explicitly failed until independently re-executed and recorded PASS. An unresolved HIGH/CRITICAL defect fails review.

**Generate a readiness report** (substitute the latest actual evidence filename):

```powershell
pnpm pilot:phase11 report `
  --input "C:\maktab-evidence\phase11-003.json" `
  --output "C:\maktab-evidence\phase11-review-001.json"
```

The review exits nonzero while any of the 20 journeys or 11 gates are not PASS, evidence is unsafe or stale, the SHA differs, the working tree is dirty, or a HIGH/CRITICAL defect remains open. Even a complete ledger has result **`READY_FOR_INDEPENDENT_PILOT_REVIEW`** and decision **`NO_GO`** until an authorized independent operator assesses the *underlying* evidence and separately approves the bounded school pilot. The tool never produces a `GO` decision.

**Source changes or newly merged fixes invalidate the old exact-SHA ledger**. Start a fresh candidate-specific workbook and rerun affected cases. A bounded pilot decision is separate from unrestricted production authorization.

## Status

| Task | Committed tooling | Real-world execution |
| --- | --- | --- |
| 11.1 | Isolated staging guard + read-only preflights + GET probe | **PENDING** |
| 11.2 | Browser/tenant evidence IDs + anonymous/optional Admin role smoke | **PENDING** |
| 11.3 | Android, locale, accessibility and offline acceptance IDs | **PENDING** |
| 11.4 | Push, scheduler and reconciliation acceptance IDs | **PENDING** |
| 11.5 | Backup/restore and operations acceptance IDs; existing safe restore script | **PENDING** |
| 11.6 | Immutable evidence revisions, defect tracking, exact-SHA independent review | **PENDING** |

**Do not interpret implementation of testing tools as successful staging or device tests. Production remains NO-GO.**
