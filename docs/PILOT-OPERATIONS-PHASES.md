# Pilot Operations — implementation phases

## Phase 1 — Overview and section navigation (implemented)

- Six route-backed sections: Overview (default), School Readiness, Data Onboarding, Subscription, Audit & Exports, Launch & Support.
- Main Admin Pilot Operations tab remains active across nested routes. Internal tabs are keyboard accessible, highlight the current route and auto-scroll into view on small screens (English/Dari/Pashto RTL).
- Overview uses existing school-scoped API data: six operational counts, server-derived core readiness progress, missing-check links to the owning modules, quick actions, billing health and deliberately *unverified* launch status.
- School Readiness retains all nine existing backend checks with direct links to Accounts, Academics, Families and Subscription when an item is incomplete. An automated setup success is **not** represented as production readiness.
- Data Onboarding links to existing setup workflows and retains school-authenticated CSV template downloads. The Families module remains the single source of truth for validating, previewing and committing imports.
- Subscription remains read-only to school admins; displays plan, status, price, setup fee, billing cycle, Solar Hijri dates and separate PAST_DUE/GRACE attention indicator. Platform-only changes remain restricted.
- Audit & Exports preserves pagination and original authenticated school-scoped JSON export, with a private-data handling reminder.
- Launch & Support is *informational* until durable evidence, approval and ticket workflows exist; no fake approvals or support requests.
- No database migration, new backend API, or permission changes.

### Automated verification

\`pnpm verify:pilot\` checks routes, admin navigation, translated navigation labels, keyboard/RTL/mobile styles, stale-response guard, server readiness usage, auth-protected endpoints and honest launch wording. CI runs this alongside existing checks on Ubuntu and Windows.

### Manual acceptance remaining

1. Open and refresh all six routes as admin. Tab must be highlighted, visible and deep-linkable.
2. Test 320px/375px/768px/desktop and 200% zoom, keyboard focus and RTL in English/Dari/Pashto.
3. Inspect readiness percentages and incomplete-check destinations with a seeded test school.
4. Check Parent/Student/Teacher CSV downloads and the unchanged Families import flow.
5. Verify an ACTIVE, PAST_DUE, GRACE and SUSPENDED subscription. No school-admin billing writes should be exposed.
6. Test audit pagination, export data isolation across two schools and error/retry behavior.
7. Confirm setup-ready never implies launch approved. Complete Step 20 real-device/Neon/backup/operator checks before production rollout.

## Phase 2 — Intelligent readiness (implemented)

- Introduces server-computed advanced coverage from active academic-year classes, students, active teachers and their relationships; the original nine core checks remain backward compatible.
- Seven metrics: classes with an active teacher assignment (critical), classes with an actual matching timetable period (warning), classes with a current Negaran (warning), classes with active students (warning), students with active school-scoped parent accounts and a valid class-year relationship (critical), students with activated login (warning), and teachers who completed first login (warning).
- Critical gaps prevent **automated configuration readiness**. Warning checks are advisory. Missing denominators show *Not applicable*, never 100%. No metric represents live push, backup, scheduler, or operator acceptance.
- Duplicate assignments/timetable periods/supervisor rows cannot inflate coverage: SQL uses EXISTS. All CTEs scope to authenticated school and active years. Current Negaran status uses the Afghanistan-local civil date.
- A school-admin-only `GET /v1/admin/pilot/readiness/advanced` returns categorization, severity, exact eligible counts and percentages. A bounded `GET /v1/admin/pilot/readiness/issues?metric=...&limit=10&offset=0` provides paginated, school-only missing class/student/teacher names. No secrets are exposed; max page size is 50.
- School Readiness now groups seven coverage metrics into Academics, Attendance, and Families/Accounts with severity badges, progress bars, safe missing-record drilldowns and links to existing administrative pages.
- Overview reports advanced critical and warning counts, and does not label setup ready until both original core checks and the critical advanced coverage pass.
- Database PGlite integration covers two school contexts, historical classes, missing teacher and family links, and issue scoping. API tests cover admin authorization and invalid query limits; `pnpm verify:pilot:phase2` ensures API, UI, RTL/locale and contracts remain present on Ubuntu/Windows.
- No new schema or migrations, no subscription permissions changes. The backend reports configuration facts only; production go/no-go from Step 20 remains NO-GO pending operator evidence.

### Phase 2 manual acceptance

1. Seed two schools with multiple classes; verify missing assignment/timetable/Negaran indicators update when records are created, ended or suspended.
2. Include previous-year classes and withdrawn students; verify they cannot inflate current-year coverage. Test teacher first-login completion and student login activation.
3. Suspend a parent account linked to an active-year student; family coverage should turn critical. Reactivate and verify it resolves.
4. Open missing-record pages with 10/20+ cases; validate paging, ordered labels, keyboard focus, Dari/Pashto RTL, zoom and long names. No other-school names should appear.
5. Compare Overview status and readiness categories. Core readiness alone is not enough if a critical teaching/family relation is missing, and neither one can imply platform launch approval.
6. Run `pnpm verify:pilot:phase2`, `pnpm verify` and verify the exact merged main SHA in Linux/Windows CI.


## Phase 3 — Durable onboarding history
Import history, duplicate/conflict reporting, retry safety while reusing existing Families import validation.

## Phase 4 — Audit and export security
Filters, human-readable details, redaction, export limits and event audit.

## Phase 5 — Subscription improvements
Expiry alerting, clearer billing health, read-only school-facing guidance.

## Phase 6 — Launch and support workflows
Real evidence collection, support tickets and platform-only launch approval.

## Phase 7 — Cross-role regression and release acceptance
Android/desktop/RTL/a11y plus production-environment proof, security and operator approval. Existing Step 20 NO-GO blockers remain in effect.
