# Admin Attendance Phase 7 — End-to-End Acceptance

**Scope:** Admin Panel → Attendance (Overview, Daily Registers, Students, Follow-ups, Reports, Audit Trail), plus teacher and parent attendance propagation.

**Machine-tested:** GitHub Linux + Windows gates exercise TypeScript build, automated six-tab route role matrix, isolated-school denial, real submitted marks, correction/notification consistency, follow-up lifecycle, audits, report/CSV semantics, date validation and automated localization invariants. The quick targeted command is `pnpm verify:admin-attendance:phase7`, and the full release command remains `pnpm verify`.

**Release decision: NO_GO until independent manual acceptance is signed.** Green CI and simulated PGlite API flows do not prove physical devices, browser rendering, actual staging data migration, Internet outage behavior, production scale or user acceptance. Do not substitute this document or the script-generated artifact for operator evidence.

## Manual checklist (each item requires a named reviewer, timestamp, build SHA, device and evidence)

| ID | Required independent review | Status |
| --- | --- | --- |
| ADMIN | All six tabs render, keep selected focus and mounted navigation while requesting data; keyboard/Home/End and retry, empty/error/loading states work. | NOT_VERIFIED |
| PARENT | Parent can view only linked child attendance and eligible alerts; denied all admin attendance endpoints. | NOT_VERIFIED |
| TEACHER | Assigned Negaran submits actual day marks; same payload retry is idempotent; stale and historical sheets reject edits. | NOT_VERIFIED |
| CROSS_SCHOOL | School B never sees School A class marks, audit notes, follow-up case details, student exports or child data. | NOT_VERIFIED |
| REGRESSION | Simulate slow/offline requests and switch academic year / account mid-request; no stale rows, no wiped active tabs. | NOT_VERIFIED |
| RTL | Dari, Pashto and English on six tabs: logical layout, readable date popovers, focus and screen-reader announcements. | NOT_VERIFIED |
| MOBILE | Android and iOS, compact tablet and desktop: 44px targets, horizontal overflow, popovers, reports, filters and long names. | NOT_VERIFIED |
| EXPORT | Download and open days/classes/students CSV in Excel; verify counts, BOM, column escaping, injection neutralization and tenant scope. | NOT_VERIFIED |
| MIGRATION | Take database backup and apply schema through `0027_admin_attendance_followups.sql` on staging; prove recovery, preserved marks. | NOT_VERIFIED |
| PERFORMANCE | Exercise substantial real-volume register history: the legacy date-range report still returns unbounded rows; capacity approval required. | NOT_VERIFIED |
| DATE | Confirm the calendar Today button uses the school's Kabul-local date near midnight, even if device clock/zone differs. | NOT_VERIFIED |
| RELEASE | Review green CI from the *exact* deployed commit; sign acceptance and agree rollout/monitoring/rollback steps. | NOT_VERIFIED |

## Automated end-to-end matrix

- **7.1** Enrollment/year/class/Negaran setup → teacher submitted register.
- **7.2** Duplicate retry and historical lock protection.
- **7.3** Submitted-only Overview and per-day class monitoring, school closure safety.
- **7.4** Student directory, classroom register and month history.
- **7.5** Follow-up creation from real absent/late mark only, assignment, manual contact history and resolved status.
- **7.6** Admin correction reason/version, parent alert cancellation, teacher stale conflict and audit consistency.
- **7.7** Report aggregates, class/day/student selection, Excused exclusion, empty-period null rate, CSV data integrity.
- **7.8** Cross-role test of 14 admin reads: anonymous 401, parent/teacher 403.
- **7.9** Separate administrator at another school cannot read School A students, notes, history, or export rows.
- **7.10** Corrected status propagates to six data sources; follow-up retains its initial status as an audit fact.
- **7.11** Static UI invariants: focus, abortable requests, non-destructive refresh and consistent school-local Today.
- **7.12** CI and manual sign-off evidence retained separately. Script never marks manual gates as complete.

### To run and record

```powershell
cd C:\projects\maktab
git pull --ff-only origin main
pnpm db:migrate
pnpm verify:admin-attendance:phase7
pnpm verify
node scripts/admin-attendance-phase7-acceptance.mjs --output attendance-phase7-manual-no-go.json
```

`pnpm db:migrate` is needed **only if migrations up to 0027 were not applied**. Back up before migration. Phase 7 introduces no new SQL migration. Run these after the Phase 7 code lands on `main`; never claim live execution merely from passing CI.

### Known limitations / deployment decision

Historical roster-based expected attendance and large unbounded multi-day legacy register reports are not authoritative historical snapshots nor yet capacity-approved. Contact activity is manually logged, **not automatically transmitted**. Full device/browser acceptance, subscription-suspension end-to-end tests, Internet outage soak tests, school locale clock-edge validation and real staging backup/restore are outstanding manual gates. Until documented, **NO_GO for production release**, even when automated acceptance passes.
