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


## Post-implementation refinement — Administrator contact profile and account security actions

- Added migration `0011_admin_contact_profile.sql` to expand `admin_profiles` with public school-contact fields: `jobTitle`, `imageUrl`, `email`, `whatsapp`, `officeLocation`, `officeHours`, and `bio`, while preserving `fullName` and `phone`.
- The admin Profile page now supports editing those fields, previews the public contact card, and keeps private account/session fields separate.
- The project currently has no media-upload/storage service; administrator photos therefore use an HTTPS image URL with an initial/avatar fallback.
- Added authenticated `GET /v1/school/admin-contact` so Parent, Teacher, and Student clients can retrieve school-scoped public administrator contact details without exposing administrator credentials.
- Parent, Teacher, and Student mobile home screens now show the shared administrator contact card with Email, WhatsApp, and Call actions when configured.
- Added authenticated `POST /v1/auth/change-password` for the currently signed-in administrator. The admin directory still blocks self-suspend/self-reset for safety and clearly labels the current administrator row.
- Reset password, Suspend, and Reactivate for other accounts are treated as security operations and remain available even while subscription operational writes are blocked.
- Added regression coverage for richer admin-profile round trips, public contact visibility to a parent account, administrator self-password changes, and reset/suspend actions under a suspended subscription.
- CI verified typecheck, tests, and production build after this refinement.


## Post-implementation refinement — Teacher and class timetable views

- Replaced the flat Academics timetable list with weekly timetable grids.
- Added two admin timetable modes: **Teacher timetables** and **Class timetables**.
- Teacher mode renders one table per teacher; rows are Saturday–Thursday and time columns show each scheduled subject plus class.
- Class mode renders one table per class; rows are Saturday–Thursday and time columns show each scheduled subject plus teacher.
- Friday is excluded from timetable display and from the admin weekday selector for newly created timetable periods. Existing Friday database records are left unchanged and simply hidden from the admin timetable grids.
- Time columns are derived from the actual scheduled period ranges and sorted by start time.
- The day column is sticky and the table scrolls horizontally on narrower screens.
- Persian/Dari and Pashto labels were added for the new timetable controls and empty states.
- CI verified typecheck, tests, and production build after the timetable refinement.


## Post-implementation refinement — Selectable teacher/class timetable

- The Academics timetable now uses a master-detail selector instead of rendering every timetable simultaneously.
- In **Teacher timetables**, the admin sees the teacher list and selecting one teacher shows only that teacher's weekly timetable.
- In **Class timetables**, the admin sees the class list and selecting one class shows only that class's weekly timetable.
- Selector items display the teacher/class name, code, and scheduled-period count, with a clear active state.
- On narrower screens the selector becomes a horizontal scroll list above the timetable.
- Friday remains excluded from both selector views and timetable creation.
- CI verified typecheck, tests, and production build after this refinement.


## Post-implementation fix — Admin Reset/Suspend empty JSON request bug

- Fixed the Accounts page Reset password / Suspend / Reactivate failure caused by the shared web admin client sending `Content-Type: application/json` on POST requests that had no request body.
- Fastify treated those bodyless requests as invalid empty JSON before the account route handler executed; the global error handler then masked that client error as a generic `internal_error`.
- `adminApi` now adds the JSON content type only when a request actually has a body.
- API error handling now preserves HTTP 4xx request errors as `invalid_request` instead of incorrectly converting them to HTTP 500 server failures.
- Added Persian/Dari and Pashto feedback for malformed admin requests.
- Added regression coverage for the empty-JSON request case.
- CI verified typecheck, tests, and production build after the fix.


## Post-implementation fix — Restore Parent and Student account creation in Accounts

- Restored **Parent** and **Student** to the Admin → Accounts role selector.
- Parent creation now uses the family parent workflow so the PARENT user and parent profile are created together with one temporary credential.
- Student creation now uses the existing student-account workflow and requires selecting an active student record that does not already have a login, preserving the one-student-record/one-login rule.
- The Accounts form now shows role-specific fields for parent full name/phone and student-record selection.
- When no student without a login exists, the UI explains that the student record must first be created in Families before generating its login.
- Fixed the Families page request helper so bodyless Reset/Suspend/Reactivate POST actions no longer send an empty JSON content type.
- Persian/Dari and Pashto labels were added for the restored workflows and empty states.
- CI verified typecheck, tests, and production build after the fix.


## Step 5 refinement — First-login password guidance and validation

- Updated the shared password policy to require at least 8 characters, at least one letter, at least one number, and at least one special character.
- The first-login mobile password-change screen now shows a live localized checklist for each password rule before submission.
- Checklist items update visually as the user satisfies each rule.
- Submitting an invalid password now shows a specific app popup explaining exactly what needs to be fixed: too short, missing letter, missing number, or missing special character.
- Password/confirmation mismatch continues to use the app-wide popup system with a gentle localized message.
- Editing either password field clears password-specific popup errors so the user can immediately refine the input.
- Backend temporary-password changes and normal authenticated password changes use the same shared password policy.
- Added Dari, Pashto, and English copy for password guidance and validation feedback.
- Added contract and API regression tests, including rejection of a first-login password without a special character.
- CI verified typecheck, tests, and production build after this refinement.


## Step 5 refinement — Admin password visibility controls

- Added a shared admin password input with an eye / eye-off toggle.
- All five admin web password fields now use the shared control: login password, first-login new password, current admin password, new admin password, and confirm new password.
- The visibility toggle is keyboard-accessible, uses localized Show/Hide labels, and never submits the surrounding form.
- Added Persian/Dari and Pashto translations for the visibility controls.
- Corrected the admin web password guidance and HTML minimum length from 10 to 8 characters so it matches the shared password policy: 8+ characters with a letter, number, and special character.
- Confirmed there are no remaining plain `type="password"` fields in the admin login/profile routes.
- CI verified typecheck, tests, and production build after this refinement.


## Step 5 refinement — Restricted suspended-account mode

- Suspension now keeps the user identity and session available instead of immediately revoking all sessions.
- Suspended users can still open/sign in to the mobile app.
- The API now enforces restricted access server-side: normal protected school features return `account_suspended` for suspended users.
- The only authenticated capabilities intentionally kept available to a suspended end user are session/status checks, session refresh/logout, and the school administrator contact endpoint.
- `GET /v1/school/admin-contact` remains available while suspended so the user can reach the administrator by configured email, WhatsApp, or phone.
- The mobile app checks account status every 3 seconds while signed in. An already-open account switches to suspended mode shortly after the admin suspends it, and reactivation restores normal access without creating a new account.
- Any protected request that receives `account_suspended` also switches the app into suspended mode immediately.
- Suspended mode removes Parent/Teacher/Student operational content from the render tree and shows only a suspension card, the administrator contact card, and Logout.
- A localized suspension popup is shown when the transition into suspended mode is detected.
- Push registration and normal role-data loading are disabled while suspended.
- Reactivation keeps the existing session usable and reloads normal role data.
- Added database/API regression coverage proving sessions are preserved, normal role APIs are blocked, administrator contact remains accessible, suspended login is allowed, and reactivation restores normal access.
- CI verified typecheck, tests, and production build after this refinement.


## Step 5 refinement — English typography

- Added language-specific typography tokens for English and RTL languages.
- English web/admin UI now uses a Latin-first font stack: Aptos, Inter, Segoe UI Variable, Roboto, and system fallbacks.
- English headings use a separate display-oriented stack headed by Aptos Display / Segoe UI Variable Display.
- Dari and Pashto continue using the existing Arabic-friendly Segoe/Noto stack.
- The font family switches automatically with the current document language, so changing the admin language to English immediately applies the English typography.
- No external web-font dependency was added, avoiding runtime font-download failures.
- CI verified typecheck, tests, and production build after the typography refinement.


## Step 5 fix — Suspended account incorrectly shown as offline/reconnected

- Fixed a race where the mobile network-recovery loop could dismiss a newly detected suspension and replace it with the "connection restored" popup.
- `GET /v1/auth/me` is now always fetched live and is never satisfied from the read cache, so account status cannot remain stale as `ACTIVE`.
- Network recovery now verifies the authenticated user's current account status before showing any recovered-connection feedback.
- If the account is still `SUSPENDED`, recovery keeps the app in restricted suspended mode and preserves the suspension popup instead of showing "reconnected".
- A network recovery request that started before a newer non-network error is no longer allowed to dismiss that newer popup.
- Cached-read fallback notifications cannot overwrite the suspension message once suspended mode is active.
- A protected request that returns `account_suspended` now immediately persists the suspended state locally, disables cached-read preference, enters restricted home mode, and stops further generic error handling for that response.
- CI verified typecheck, tests, and production build after the fix.

## Testing Step 6 refinement — Academic lifecycle request handling

- Testing Step 6 (Academic structure) is now active.
- Fixed the Admin → Academics request helper so bodyless academic-year lifecycle actions do not send `Content-Type: application/json` without a body.
- This prevents Fastify from rejecting **Activate**, **Close**, or **Archive** before the academic lifecycle route handler runs.
- JSON content type is still added automatically for academic mutations that actually send a request body.
- Existing lifecycle rules remain unchanged: `DRAFT → ACTIVE → CLOSED → ARCHIVED`, only one ACTIVE year per school, and closed/archived years remain immutable for new year-bound academic structure.

## Testing Step 6 hardening — Academic request, validation, and popup feedback

- Re-audited Admin → Academics before restarting manual Testing Step 6.
- Academics now uses the shared `adminApi` transport rather than a separate request implementation.
- Bodyless academic-year lifecycle actions no longer declare JSON unless they actually send a body.
- Academic create/lifecycle actions now use the shared global admin toast popup with action-specific titles and success messages.
- Failed academic submissions keep their entered form values; forms reset only after a confirmed successful mutation.
- Shared admin API handling now surfaces the first structured validation issue instead of replacing it with a generic request failure.
- Academic Zod validation responses now include a specific top-level message while retaining the full issues array.
- Known empty-JSON parser failures now return actionable feedback rather than only the generic invalid-request text.
- Added Dari/Persian and Pashto translations for key academic lifecycle, duplicate, immutable-year, and validation errors.
- Added API regression coverage for invalid academic-year dates, one-active-year enforcement, valid class creation, and closed-year immutability.
- Manual Testing Step 6 should restart from the beginning after pulling this change.

## Testing Step 6 fix — Localized academic codes

- Removed the accidental ASCII-only restriction from Step 6 academic grade, class, and subject codes.
- Academic codes now accept Dari/Pashto/English letters, Western or localized digits, spaces, dots, underscores, and hyphens.
- Examples such as `7A`, `۷الف`, `پایه ۷`, and `صنف-۷-الف` are valid.
- Account usernames and non-academic operational identifiers keep their existing stricter validators; this change is intentionally scoped to academic structure.
- Invalid academic-code punctuation now returns a human-readable localized validation message instead of exposing a raw regular expression.
- Added contract and API regression coverage for localized academic codes.

## Testing Step 6 refinement — Reversible close and visible academic archive

- Academic-year lifecycle is now `DRAFT → ACTIVE ↔ CLOSED → ARCHIVED`.
- Multiple DRAFT years are allowed.
- Only one ACTIVE academic year is allowed per school.
- A CLOSED year now has two admin choices: Reactivate or Archive.
- Reactivation uses the existing one-active-year guard, so it is rejected while another academic year is ACTIVE.
- ARCHIVED remains terminal/read-only.
- Archiving does not delete data. It changes only the academic-year status; classes, teacher assignments, Negaran history, timetable data, students, and other linked records remain stored in PostgreSQL.
- Admin → Academics now separates archived academic years into a visible archive section with historical record counts.
- Added regression coverage for blocked reactivation when another year is active, successful reactivation after the active year is closed, terminal archiving, and preservation of archived class data.

