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
- ARCHIVED years remain inactive/read-only while archived and can now be unarchived back to CLOSED.
- Archiving does not delete data. It changes only the academic-year status; classes, teacher assignments, Negaran history, timetable data, students, and other linked records remain stored in PostgreSQL.
- Admin → Academics now separates archived academic years into a visible archive section with historical record counts.
- Added regression coverage for blocked reactivation when another year is active, successful reactivation after the active year is closed, terminal archiving, and preservation of archived class data.

## Testing Step 6 refinement — Unarchive academic years

- Added an explicit `POST /v1/admin/academics/years/:yearId/unarchive` lifecycle action.
- Academic-year lifecycle is now `DRAFT → ACTIVE ↔ CLOSED ↔ ARCHIVED`.
- Unarchive always moves an ARCHIVED year to CLOSED; it never makes the year ACTIVE automatically.
- The unarchived year immediately returns to the normal Academic Years list, where the admin can choose Reactivate or Archive again.
- Archived-year rows now include an Unarchive button with localized Dari/Persian and Pashto feedback.
- Historical academic data remains unchanged during archive/unarchive transitions.
- Added regression coverage for ARCHIVED → CLOSED, reactivation after unarchive, and archiving the same year again.

## Testing Step 6 refinement — Safe deletion of archived academic years

- Archived academic years now show both Unarchive and Delete actions.
- Permanent deletion is allowed only when the academic year is ARCHIVED.
- Deletion is blocked if the year is referenced by classes, students, student-class history, teacher assignments, Negaran assignments, timetable periods, attendance, homework, or exams.
- The archive UI asks for explicit confirmation before issuing the permanent delete.
- Successful deletion is audit-logged as `academic_year.deleted`.
- Added API regression coverage proving that a year with historical data cannot be deleted, a non-archived year cannot be deleted, and an empty archived year can be permanently removed.

## Testing Step 6 refinement — Shared academic-year context

- Added a shared admin academic-year context for Academics, Families, Attendance, and Learning. Communication/fees remain school-wide because their current records are not consistently keyed to an academic year.
- The active academic year is selected automatically when the workspace loads; admins can switch to draft, closed, or archived years from the route header.
- Admin → Academics now scopes classes, teacher assignments, Negaran history, and timetable to the selected academic year while keeping grade levels, subjects, teacher identities, and academic-year lifecycle management school-wide.
- Closed and archived academic years are presented as historical/read-only context for year-bound academic operations.
- Academic lifecycle mutations refresh the shared year selector so newly created, archived, unarchived, or deleted years stay in sync.

## Testing Step 6 refinement — Year-scoped attendance

- Admin attendance reports now accept an academic-year context and return only attendance from the selected academic year.
- The attendance class filter follows the selected academic year instead of always using the currently active year.
- Historical attendance remains visible but correction controls are read-only unless that academic year is ACTIVE.
- The API independently blocks correction of attendance belonging to a non-ACTIVE academic year.

## Testing Step 6 refinement — Year-scoped student enrollment history

- Family overview now exposes enrollment history from `student_class_history`.
- The Families student list and year-specific student counts follow the shared selected academic year.
- A student who later moves to a newer academic year remains visible when an administrator switches back to the older year.
- Parent accounts and student login identities remain school-wide and are not duplicated per academic year.
- Adding a student enrollment follows the selected DRAFT/ACTIVE year; CLOSED/ARCHIVED year views do not allow new enrollment.

## Testing Step 6 refinement — Year-scoped exams and results

- Learning now follows the shared selected academic year for exam cycles, exam subject setup, and published result history.
- Published grade overview rows carry their academic-year id so historical results can be filtered without changing or duplicating records.
- Exam lifecycle actions and published-grade corrections are disabled in historical CLOSED/ARCHIVED year views.
- New exam creation remains restricted by the backend to the ACTIVE academic year.

## Testing Step 6 refinement — Dedicated Academic CRUD pages

- Admin → Academics is now an academic-module landing page rather than one crowded page containing every Phase 3 form.
- Added dedicated routes for Academic Years, Grade Levels, Subjects, Classes, Teacher Profiles, Teacher Assignments, Negaran Assignments, and Timetable Periods.
- Each route shows exactly one entity form plus the records created for that entity.
- Each list supports real Edit/Delete operations where domain integrity permits them; the actions are backed by audited API routes and protected database-store operations.
- Year-bound pages (Classes, Teacher Assignments, Negaran Assignments, Timetable Periods) follow the shared selected academic-year context. CLOSED/ARCHIVED years remain read-only.
- Academic Years retain Activate, Close, Reactivate, Archive, Unarchive, and safe permanent-delete lifecycle actions. Only DRAFT academic years may have their name/date metadata edited.
- Grade, subject, teacher-profile, class, assignment, Negaran, and timetable deletion is dependency-aware. Records that already support students, attendance, homework, exams, timetable, announcements, or other academic history are rejected rather than cascaded away.
- Negaran deletion is limited to DRAFT years; an active Negaran assignment is ended instead so responsibility history is preserved.
- Timetable keeps the weekly teacher/class browser on its dedicated page.
- Added API regression coverage proving that an unused class can be edited/deleted and a class with an academic dependency cannot be deleted.

### Academic responsive form/list refinement

- Dedicated Academic entity pages now use a two-pane desktop layout: the entity form and its corresponding data list render side by side.
- The form pane and data-list pane are each capped at 500px maximum width.
- At 1024px and below (tablet/mobile), the two panes become mutually exclusive and are controlled by two buttons: Form to create data and List of this form.
- Editing a record from the list automatically switches the tablet/mobile view back to the form pane.
- Additional module content, such as the weekly timetable browser, remains below the form/list responsive area.

## Admin profile image upload and preview fix

- Fixed the administrator contact-card preview so an image that previously failed to load is retried after profile load/save instead of remaining permanently stuck on the fallback initial.
- Admin → Profile now supports choosing a JPG, PNG, or WebP image directly from the local PC in addition to entering a web image URL.
- Local images are resized client-side to a maximum 512px dimension, converted to a compact JPEG, and capped before being persisted in the existing admin profile image field.
- No third-party media service is required; the prepared image data is stored with the administrator profile and therefore survives refresh/login and is available to the existing school admin-contact API.
- The backend profile validator now accepts HTTP(S) image URLs or restricted image data URLs only; unsafe URL schemes are rejected.
- Added image removal, upload progress/feedback, preview failure feedback, Dari/Persian and Pashto copy, and API regression coverage for persisted local-image data plus unsafe-scheme rejection.
- No database migration is required because the existing `admin_profiles.image_url` column is already a text field.

## Testing Step 6 fix — explicit duplicate errors and browser DELETE support

- Fixed browser-based Academic delete actions by adding `DELETE` to the API CORS allow-list. The API routes and database operations already supported DELETE, but browsers blocked the cross-origin request during preflight, which caused Academic Year and unused Grade deletion to show only the generic failure popup.
- Academic Year and Grade duplicate checks now run explicitly before insertion/update and still retain database unique-constraint protection for races.
- PostgreSQL error handling now recognizes stable SQLSTATE codes such as `23505` (unique violation) and `23503` (foreign-key violation), including wrapped driver errors, instead of depending only on English database error text.
- Duplicate year feedback now explicitly says duplicate academic years are not allowed and identifies the existing-name conflict.
- Duplicate grade feedback now explicitly says duplicate grade levels are not allowed and identifies the conflicting code/name.
- Grade deletion blocked by existing classes now returns a domain conflict rather than leaking a database failure.
- Added Dari/Persian and Pashto translations for the new duplicate/delete explanations and prevented generic internal server text from overriding localized admin-friendly feedback.
- Added API regression coverage for DELETE CORS preflight, duplicate academic-year feedback, duplicate-grade feedback, unused-grade deletion, and empty archived-year deletion.

## Testing Step 6 fix — dependency-aware safe deletion

- Reworked Academic deletion into a dependency-aware safety model across academic years, grade levels, classes, subjects, teacher profiles, teacher assignments, Negaran assignments, and timetable periods.
- Unlinked records now delete normally and the delete operation verifies that a row was actually removed.
- Linked records return a controlled `academic_dependency` conflict with explicit dependency categories instead of a low-level database error or generic failure.
- Dependency feedback identifies where the record is in use, such as Classes, Students, Student enrollment history, Teacher assignments, Negaran assignments, Timetable periods, Attendance records, Homework, Exams, Exam subjects, or Announcements.
- Foreign-key races or dependencies missed by a pre-check are converted into the same controlled dependency response, preventing database constraint errors from escaping the Academic route.
- Dari/Persian and Pashto translations were added for dependency-aware delete messages and dependency category names.
- Failed DELETE actions now reconcile the Academic overview and shared academic-year context before returning control to the administrator, preventing stale UI state after a failed or partially completed request.
- Added API regression coverage proving unused Grade and Subject deletion, dependency-aware blocking for used Grade/Subject/Teacher profile, successful cleanup after dependencies are removed, successful empty archived-year deletion, and continued API health after a blocked deletion.
- Academic-year lifecycle safety is unchanged: permanent year deletion still requires the year to be ARCHIVED.

## Admin async-button loading feedback

- Added a workspace-wide loading treatment for administrator action buttons that already disable themselves while an async operation is running.
- The admin shell tracks the exact button that initiated an operation, including form submit buttons, so only the clicked action displays loading feedback even when a shared `busy` state temporarily disables neighboring controls.
- While pending, the action button keeps its original dimensions and accessible label, becomes visibly disabled with a wait cursor, and shows a centered animated spinner with a subtle loading sheen.
- Primary, secondary, and danger actions retain appropriate loader contrast.
- The loading marker clears automatically as soon as the button is re-enabled, when an action fails, when navigation removes the button, or when the admin workspace unmounts.
- Synchronous controls such as Edit buttons and filter/toggle controls are automatically ignored when they do not transition into a disabled async state.
- Form submission triggered from the keyboard receives the same pending-button treatment as pointer/touch clicks.
- Reduced-motion preferences disable the decorative sheen and slow the spinner animation.
- This applies across the authenticated admin workspace without duplicating loading markup in every create, update, delete, lifecycle, account, attendance, learning, communication, fees, and profile form.

## Admin header language selector polish

- Removed the visible **Language** label from the authenticated admin header to reduce visual clutter.
- Kept the language selector accessible with a localized `aria-label`.
- Gave the header language selector its own styling instead of reusing the shared Academic Year context control.
- Increased the selector touch height and horizontal padding, added a small outer margin/gap, and refined border, hover, focus, and subtle elevation states.
- Responsive sizing keeps the control compact beside Profile and Sign out without changing the Academic Year selector.

## Admin navigation and profile-access refinement

- Removed Profile from the main routed admin navigation so the route list focuses only on operational administration sections.
- Removed the standalone Sign out button from the global admin header.
- Replaced the header Profile text link with a compact clickable administrator identity chip containing the saved profile image and the administrator's first name.
- The header avatar falls back to the administrator's initial if no profile image exists or the saved image cannot load.
- The workspace now loads the authenticated administrator profile summary centrally and refreshes it after profile edits, so saved name/image changes are reflected in the header without requiring a new login.
- Clicking the avatar/name chip opens the admin profile page.
- Sign out now lives inside the administrator Profile page, under Account information.
- The shared sign-out flow is exposed through the workspace context so logout still revokes the refresh session, clears the local admin session, and returns to the admin login page.

## Admin header language selector simplification

- Simplified the authenticated admin header language dropdown after the previous styling was visually too heavy.
- Reduced the control height and minimum width slightly.
- Reduced the option text to 12px with normal 400 font weight.
- Removed the decorative shadow and kept only a light border, plain white background, modest padding, and a subtle focus ring.
- The change remains isolated to the header language selector; the Academic Year selector is unchanged.

## MaktabLink app logo

- Adopted the selected second logo direction as the official mobile app logo.
- Removed all text from the logo artwork so the app icon is symbol-only.
- Added the logo to the Expo mobile app as the default app icon.
- Added the same mark as the Android adaptive icon foreground with a white adaptive background.
- App icon changes are native assets and therefore require a new Android/iOS build; they are not delivered to an already-installed app through EAS Update alone.

## Administrator password two-factor verification

- Normal self-service password changes for a signed-in school administrator now require two independent one-time codes: one delivered to the administrator's locked email verification contact and one delivered to the locked phone verification contact.
- The current password is checked before any verification codes are sent.
- Email and SMS codes are separate random six-digit values, expire after 10 minutes, are stored only as HMAC hashes, and allow at most five verification attempts.
- Verification returns a random one-time token. The password-change endpoint consumes that token atomically and rejects missing, expired, reused, or invalid tokens.
- Starting a new verification invalidates older unconsumed challenges for the same administrator.
- Verification-code requests are rate limited.
- The administrator's first successful verification setup locks the current profile email and phone into separate two-factor contact fields so changing the public contact card does not silently redirect password-change verification.
- First-login temporary-password replacement remains unchanged so a newly provisioned administrator can establish a permanent password before setting contact channels.
- Delivery uses configurable email and SMS webhooks. Both channels must be configured and both deliveries must succeed; production fails closed when delivery is unavailable.
- Added regression coverage for current-password verification, dual code delivery, invalid code rejection, required two-factor proof, successful password change, and one-time token reuse rejection.

### Admin profile 2FA UI

- Admin → Profile password change is now a three-step security flow: confirm current password, verify separate email/SMS one-time codes, then choose the new password.
- New-password fields remain hidden until both verification codes succeed.
- The UI displays only masked verification destinations and never receives the generated codes from the API.
- Restart/cancel controls clear local verification state without weakening the backend one-time-token requirement.
- Dari/Persian and Pashto translations were added for verification states, delivery/configuration failures, expiry, rate limits, and invalid-code feedback.

## Admin access-token auto-refresh

- Fixed the admin web session expiring after approximately 15 minutes even though a valid 30-day refresh token still existed.
- The API keeps the short 15-minute access-token lifetime for security.
- The admin web shell now refreshes the session before the access token expires and persists the rotated access/refresh tokens in session storage.
- A stored admin session with a missing or nearly expired access-token timestamp is refreshed before protected admin data is loaded.
- The shell rechecks session freshness every minute and when the browser tab/window becomes active again, covering long-lived tabs and browser sleep/throttling.
- Concurrent refresh attempts are deduplicated so one refresh-token rotation cannot invalidate a second simultaneous refresh request.
- A confirmed invalid/expired refresh token clears the stale local session and returns the administrator to login.
- Temporary network failures do not erase an otherwise valid local session.

### Direct email and SMS providers for administrator 2FA

- The API now supports direct Resend transactional email delivery and direct Twilio SMS delivery for administrator password-change verification.
- Existing custom email/SMS webhook delivery remains supported and takes precedence per channel when configured.
- Email can use either `PASSWORD_2FA_EMAIL_WEBHOOK_URL` or `RESEND_API_KEY` + `PASSWORD_2FA_EMAIL_FROM`.
- SMS can use either `PASSWORD_2FA_SMS_WEBHOOK_URL` or `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + (`TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`).
- Both channels must be configured; the password-change verification continues to fail closed if either channel is missing.
- Provider credentials are read only by the API process and are never sent to the web/mobile clients.
- Added API unit coverage for missing-channel configuration, Resend + Twilio configuration, and mixed direct/webhook configuration.

## Administrator password verification — email-only mode

- Administrator self-service password changes now require the current password plus one email verification code.
- SMS/phone verification is intentionally deferred and is no longer required to start, verify, or complete a password change.
- An administrator only needs a saved email address; a phone number is optional.
- The first email used for password verification remains locked in `two_factor_email` so changing the public contact card does not silently redirect security codes.
- Existing SMS database columns and Twilio delivery support are preserved for a future second factor, but SMS codes are not delivered or validated in the active flow.
- The existing verification table remains compatible, so this change requires no new database migration.
- Resend or the email webhook alone is sufficient to configure password-verification delivery.
- The Profile security UI is now: current password → email code → new password.
- Regression coverage proves password change is blocked without verification, email-only verification succeeds without a phone number, no SMS is sent, wrong email codes are rejected, and verification tokens remain one-time use.

## Testing Step 6 completion polish — responsive labels, loading buttons, admin visual refinement

- User completed the remaining Academic Structure manual checks with no additional functional defects reported.
- Tablet/mobile Academic CRUD pane switches now use entity-specific labels instead of generic form/list wording, for example **Create class** and **List of classes**.
- The same entity-specific responsive labels are applied to Academic Years, Grade Levels, Subjects, Classes, Teacher Profiles, Teacher Assignments, Negaran Assignments, and Timetable Periods, with Dari/Persian and Pashto translations.
- Admin async buttons retain their action text while busy and show a compact inline spinner until the operation finishes; the previous blank-looking loading button state is removed.
- Applied a restrained Admin visual polish: clearer panel elevation, stronger input focus treatment, subtle button hover feedback, improved Academic rows, and a cleaner segmented mobile/tablet pane switch.
- Test 6 functional behavior remains unchanged; this pass is UI/feedback polish on top of the already verified academic lifecycle and validation rules.

## Testing Step 6 cleanup — redundant Academic refresh control

- Removed the manual Refresh button from the dedicated Academic form/list pages.
- Academic data still refreshes automatically on initial load and after successful create, edit, delete, and academic-year lifecycle mutations.
- Shared academic-year context refresh behavior remains unchanged.

## Testing Step 7 hardening — teacher assignment, Negaran, and timetable UX

- Teacher assignment creation now filters occupied class+subject combinations: once a subject has a teacher in a class for the selected year, that subject is no longer available for another teacher in that class.
- Negaran creation now lists only classes and teachers without an active Negaran assignment; overlapping teacher/class responsibility is also rejected by the backend.
- Fixed the Solar Hijri calendar being clipped beneath Academic cards by restoring visible overflow for Academic form/list containers.
- Added Dari/Persian and Pashto translations for Teacher Setup conflict, validation, and timetable feedback so error/success flows follow the selected Admin language.
- Timetable creation now uses a duration selector with 30, 35, 40, 45, 50, 55, and 60 minute options. The Admin selects a start time, the end time is calculated automatically, and a start→end preview is shown before submission.
- The manual timetable end-time input was removed from the Admin form; the calculated end time continues to use the existing API contract.

## Testing Step 7 follow-up — assignment-aware timetable creation

- Timetable creation now derives selectable classes, subjects, and teachers from existing Teacher Assignments in the selected academic year.
- Selecting a class shows only subjects actually assigned in that class; selecting a subject shows only the teacher assigned to that exact class+subject slot.
- This prevents the Admin UI from constructing a filled but invalid Class + Subject + Teacher combination that the API would reject.
- Class duration is positioned immediately after the Teacher selector, while end time remains calculated automatically from start time + duration.

## Testing Step 7 timetable refinement — teacher-first creation, persistent form, filters, and premium feedback

- Timetable creation now shows all teacher profiles first. After a teacher is selected, the Class and Subject selectors are constrained to that teacher's assignments for the selected academic year, preserving assignment validity without hiding other teachers from the Teacher selector.
- After a successful timetable creation, Teacher, Class, Subject, Duration, and Weekday remain selected; only Start Time is cleared so the administrator can enter the next period quickly.
- The timetable list panel is capped at 600px height and scrolls internally when more periods are present.
- Added combinable timetable-list filters for Teacher, Class, Subject, Weekday, and Time. Each selector only contains values that exist in the current timetable list, with a single Clear filters action.
- Upgraded global async-button feedback with a blue luminous sweep, blue glow, inline spinner, and reduced-motion fallback while retaining the button label during processing.

### Timetable list height adjustment
- Increased the timetable list panel maximum height from 600px to 1000px while preserving internal scrolling for longer lists.

## Testing Step 7 timetable refinement — live current lesson highlight

- Teacher and Class timetable views now use the browser/computer local weekday and time to identify the currently active lesson.
- A timetable cell is considered active when today's local weekday matches the period weekday and the current local time is greater than or equal to the period start and earlier than its end.
- The active period receives a blue highlighted cell, a localized "Now" badge, and a subtle pulse effect.
- The local clock refreshes every 30 seconds while the timetable is open, so the highlight moves automatically as periods begin and end.
- This behavior is presentation-only and does not modify stored timetable data.

## Testing Step 7 timetable refinement — submit loading lifecycle

- Fixed the timetable Create/Save button remaining in its premium loading state after a request completed.
- Timetable submission now owns an explicit local pending state that starts immediately before the async create/update request and is cleared in a finally block when that request completes.
- The timetable submit button opts out of the generic Admin click-based loading marker and uses the request-bound pending state instead.
- After successful creation, Start Time may remain cleared (and the button therefore disabled for validation) without incorrectly displaying the blue loading sweep.

## Testing Step 8 — parent/student onboarding refinement

- Added safe parent deletion: only parent accounts with no linked students may be deleted; linked parents are rejected by the API with a clear dependency message.
- Parent and student account usernames are now restricted to English letters and digits for new family-account creation. Spaces and special characters are rejected server-side and by the Admin form.
- Duplicate family usernames now produce a localized popup asking the administrator to choose another username.
- Parent/student username placeholders now use human-style examples such as `Ahmad` and `Haidar23`.
- Add Student now suggests the lowest available `S-xxxx` code, filling gaps before incrementing beyond the highest code. At least four numeric digits are used.
- Add Student parent selection now shows usernames only and includes a username search field for large parent lists.
- Added API coverage for invalid family usernames, duplicate usernames, deletion of an unlinked parent, and rejection of deletion when a student is linked.

## Testing Step 8 follow-up — student credential creation lifecycle

- Fixed student credential creation showing success and error feedback at the same time when the credential POST succeeded but the follow-up Families refresh failed.
- A successful student-account response now updates the linked student optimistically in both the current student list and enrollment view before performing a silent refresh.
- Follow-up refresh failures after successful credential creation no longer overwrite the successful result or hide the one-time temporary password with an unrelated load error.
- The Create student credential button now owns an explicit request-bound pending state and opts out of the generic Admin click loader.
- Its premium loading treatment starts when account creation begins and is always cleared in the request finally block, even though the form becomes disabled afterward because the selected student is cleared.

## Testing Step 8 follow-up — student list actions and family layout

- Removed the manual Families Refresh button; family data already refreshes after successful mutations and on initial load.
- Family creation cards now align to the start of the grid so Create Parent, Add Student, and Create Student Login keep their natural content height instead of stretching to the tallest card.
- Student rows now expose linked account state and username when a STUDENT login exists.
- Students with logins receive Reset password and Suspend/Reactivate actions using the existing school-admin account controls; students without logins do not show meaningless account actions.
- Student rows now include Delete. Deletion removes the student and its optional login account only when no attendance, grade, or fee data is linked; otherwise the API returns a localized dependency error.
- Student class-history records are removed through the existing student-history cascade when a dependency-free student is deleted.
- Added API regression coverage for student suspend, reactivate, reset-password, safe deletion, and the resulting ability to delete the formerly linked parent.

### Step 8 family list action sizing
- Reduced only the Parent/Student list action buttons to a more compact 34px height with tighter horizontal padding and smaller text so Reset password, Suspend/Reactivate, and Delete fit the row more cleanly without affecting action buttons elsewhere in the admin UI.

## Testing Step 8 follow-up — full Families page reliability audit

- Audited the complete Families admin workflow from browser form state through API contracts, family-store validation, database writes, feedback, refresh behavior, and loading state.
- Fixed async React form handlers that reused `event.currentTarget` after an `await`. Parent creation, Add Student, and Student Login now capture the form element synchronously before any async work, preventing a successful request from being followed by a client-side reset exception.
- Successful family mutations now refresh silently where appropriate so a secondary overview refresh failure cannot overwrite a successful create/reset/delete result with unrelated error feedback.
- Add Student no longer depends on the follow-up refresh to compute the next `S-xxxx` suggestion. It uses the successful create response plus known codes, and duplicate-code recovery advances safely even if refresh fails.
- Add Student now clears stale temporary credentials from prior account operations before creating a student.
- Parent and student-login selections automatically clear if refreshed data makes the selected account unavailable.
- Family API response parsing now reports a clear unreadable-service response instead of exposing a raw JSON parse exception.
- PostgreSQL unique detection now recognizes SQLSTATE `23505`, and a race-time foreign-key failure (`23503`) during student creation is converted to a normal family conflict instead of an unexpected 500.
- Added localized messages for duplicate student codes, unavailable parents, missing classes, closed/archived years, and stale parent/year/class references.
- Added regression coverage proving a duplicate `S-0001` submission returns `409`, does not become a server error, and does not create a second student.

## Testing Step 8 follow-up — printable Parent/Student account credentials

- Parent account creation now opens a dedicated credential preview containing username, full name, phone number, and the one-time temporary password.
- Student login creation now accepts an optional phone number, stores it on the student record, and uses the same credential preview fields.
- After successful Parent or Student account creation, the browser print dialog opens automatically so the administrator can choose Save as PDF or print a paper copy. Cancelling that dialog does not dismiss the credential preview.
- The preview includes explicit Print and Close actions. Print reopens the browser print/save-PDF dialog.
- Close opens a confirmation asking whether the account information has been saved; the preview is dismissed only after confirming Yes.
- The print stylesheet isolates the credential preview so saved PDFs contain the account information rather than the surrounding Admin workspace.
- Added migration `0014_student_phone.sql` for the nullable Student phone field and updated database/API test harnesses to apply it.

## Testing Step 8 follow-up — unified Families feedback popups

- Replaced the Families/Parent page inline success and error banners with a persistent modal popup pattern.
- Student deletion, parent deletion, create actions, suspend/reactivate, password reset, imports, and other Families operations now surface success/error feedback through the same popup with an explicit OK action.
- Initial Families load failures use the popup too and retain a Retry action.
- The feedback hook now supports an opt-in persistent mode; other Admin pages keep their existing timed feedback behavior.
- Bulk-import row-level validation details remain visible inline for diagnosis, while validation pass/fail also triggers the unified popup summary.

## Testing Step 8 follow-up — direct PDF credential export and preview repair

- Fixed the Parent/Student credential preview layout conflict caused by the legacy generic `.credential-card div` rule applying a two-column grid to every nested preview element.
- Username, full name, phone number, and temporary password now render in stable dedicated cards; phone and temporary password use full-width rows and LTR values no longer wrap vertically.
- Parent/Student account actions now use equal 100px buttons labeled Export as PDF and Close.
- Replaced the browser print/save dialog with an actual generated PDF download. Account creation automatically exports a `.pdf` file, and Export as PDF generates the file again on demand.
- The PDF is generated client-side from a Unicode-capable canvas so Dari/Pashto/English account information can be captured visually without adding a new PDF dependency.
- The exported PDF contains the same four credential fields as the preview and uses a safe filename based on account type and username.

## Testing Step 8 follow-up — non-blocking Families feedback

- Converted general Families success/error feedback from full-screen modal overlays into compact fixed toast cards.
- Toast hosts use pointer-events only on the message card, so the rest of the Families page remains fully interactive while success/error feedback is visible.
- Duplicate-username errors now use the same non-blocking toast pattern.
- Success/error toasts retain explicit OK dismissal; initial load errors also retain Retry.
- Only decision-required confirmations, such as closing unsaved one-time credential information, remain modal.

## Testing Step 8 follow-up — Families action loading lifecycle

- Fixed Families action buttons remaining in the premium loading state after the mutation itself had already succeeded and success feedback was visible.
- Successful Parent/Student mutations now end their request-bound busy state immediately after the authoritative create/update/delete response.
- Secondary Families refreshes run silently in the background and no longer keep Create Parent, Add Student, Create Student Login, parent/student account actions, delete actions, or import commit buttons loading.
- Data-dependent duplicate student-code recovery still awaits its refresh because the refreshed codes are required to calculate the next suggestion.

### Step 8 family toast alignment
- Moved non-blocking Families success/error toasts from the form-side corner to the same top-center placement used by Academic/Admin feedback.
- Desktop placement now uses top 24px, centered at 50% viewport width, with the same 620px maximum width convention; mobile uses the same centered behavior with tighter margins.

### Step 8 family toast viewport anchoring
- Families success/error toasts now render through a React portal directly under `document.body`.
- This prevents the transformed `.admin-page-enter` animation container from becoming the containing block for `position: fixed`.
- Toasts are therefore truly fixed to the viewport top-center and remain there regardless of page scroll position.

### Step 8 credential close confirmation viewport anchoring
- Moved the one-time credential Close confirmation dialog into a React portal under `document.body`.
- Its existing fixed full-viewport backdrop now centers the dialog in the user's current viewport rather than relative to the transformed Families page container.
- Clicking Close therefore shows the confirmation immediately in the visible center even when the administrator has scrolled far down the page.

### Step 8 family list fixed-height scrolling
- Parent and Student lists remain natural-height through four filtered records.
- When a filtered list contains more than four records, the list switches to a fixed 450px height with vertical scrolling.
- Removed the previous row-measurement/ResizeObserver logic; the fixed-height rule is simpler and deterministic.
- Scrolling remains scoped only to these two Families lists and uses the existing compact scrollbar styling.

### Step 8 timetable-style Parent/Student list filters
- Reused the Academic Timetable filter interaction pattern for both Families lists: filtered/total count, dropdown filter panel, and Clear filters action.
- Parent list filters now include account status and child-count group (none, one, multiple).
- Student list filters now include class, parent, student status, and login/account status, including students without a login.
- Empty filtered results show filter-specific messages instead of the base empty-state copy.
- The existing four-visible-row scroll cap now measures and scrolls the filtered result set rather than the unfiltered list.
- Filter labels and empty states are localized for Dari and Pashto.

### Step 8 family username filters
- Added case-insensitive partial username search to the Parent list filters.
- Added case-insensitive partial username search to the Student list filters.
- Removed the Student login-status filter and its derived option/state logic.
- Student rows without a login remain visible when username search is empty and are excluded only when a username query is entered.
- Username search inputs reuse the Academic Timetable filter styling, Clear filters behavior, filtered/total counts, and the existing 450px scroll rule for filtered results over four items.

### Step 8 Families workflow layout
- Reorganized the Families page without changing Parent/Student business logic.
- Add Student is now the first form and spans the full available width.
- Add Student uses a two-column field grid for its six inputs: three field positions per column, with the submit action spanning the form.
- Parent Account and Student Account forms now sit side by side below Add Student.
- The Parent list is directly below Parent Account in the same column; the Student list is directly below Student Account in the other column.
- Existing filters, filtered/total counts, list actions, 450px scrolling for more than four filtered rows, credential previews, and mutation behavior are preserved.
- On small screens the Add Student field grid and Parent/Student columns collapse to a single column for usability.

### Step 8 equal Parent/Student account form heights
- Parent Account and Student Account now share the same desktop/tablet grid row height, so both cards always match the taller form without a hard-coded pixel height.
- The equal-height behavior uses a shared CSS subgrid row, preserving localization-safe sizing when labels/descriptions wrap.
- Parent and Student lists remain directly below their matching account forms.
- On mobile, where the two account columns stack, the shared-row rule is reset and each form returns to natural height.

### Step 9 Parent bulk-import credential preview
- Parent bulk import now reuses the same rich one-time account preview used by manual Parent/Student account creation instead of the legacy raw credential block.
- Imported parent previews include username, full name, phone, temporary password, Export as PDF, and the existing protected Close confirmation.
- Multiple imported parents are presented as a queue with a visible position such as 1 / 2; confirming Close advances to the next imported parent.
- Each imported parent PDF is automatically exported when that preview becomes active, matching the manual Parent account flow.
- Full name and phone are reconstructed from the already-validated normalized import rows and paired to returned credentials by username.
- Teacher/reset credential flows keep the legacy credential block because they do not currently use the Parent/Student rich profile preview contract.

### Step 9 Bulk Import UI polish
- Refined the Bulk Import panel styling without changing upload, mapping, validation, or commit behavior.
- Replaced the browser-default file input presentation with a full-width clickable import-file card.
- The file picker now shows a dedicated upload icon, Choose import file label, supported CSV/TSV/XLSX formats, selected filename, and a Browse action.
- Added hover, keyboard-focus, disabled, and theme-aware states to the import picker.
- Mapping controls now sit in a subtle grouped surface so the upload, mapping, validation, and confirmation stages are visually easier to scan.
- Added Dari and Pashto localization for the new file-picker copy.



### Step 9.5 Family form and bulk-import styling refinement
- Normalized the Add Student form controls so text inputs and selects share the same 48px height, border radius, surface color, typography, padding, hover state, and keyboard-focus treatment.
- Kept the existing two-column six-field Add Student layout and all parent/year/class selection behavior unchanged.
- Refined the Bulk Import controls into a clearer grouped surface and strengthened the custom file-picker card.
- The import file picker now has a larger upload/status icon, clearer hover/focus treatment, a more prominent Browse action, and a distinct selected-file state with a check mark once a file is chosen.
- Import parsing, column mapping, validation, confirmation, credential preview, and account creation behavior remain unchanged.


### Step 9.7 Bulk-import credential parity — Step 9 complete
- Parent, Teacher, and Student bulk imports now follow the same credential lifecycle: validate mapped data, generate a one-time temporary password, create the school-issued login account, require password change on first login, and return credentials only after a successful transactional import.
- Student bulk import now requires a username and supports an optional phone number in addition to student code, full name, parent username, academic year, and class.
- Student username validation uses the same school-controlled username rules as manual Student account creation and rejects usernames that already exist in the school or are duplicated inside the import file.
- Student account creation and student-record creation occur in the same database transaction, so a failed batch cannot leave an orphan Student account or a Student record without its intended imported login.
- Parent, Teacher, and Student bulk imports now all use the same rich queued account-credential preview instead of mixing rich previews with the legacy raw credential block.
- Every imported account preview shows account type, username, full name, phone (or Not provided), and temporary password; each preview supports Export as PDF, automatic PDF export, protected Close confirmation, and batch position such as 1 / 3.
- Teacher credential previews now have localized Dari and Pashto account-type labels.
- Added API regression coverage proving that imported Parent, Teacher, and Student credentials are generated, can authenticate with the correct role, and that imported Student accounts are linked to their Student record. Duplicate Student import usernames are also explicitly rejected.
- With CSV/XLSX parsing, mapping, validation, duplicate/error handling, preview, confirmation, transactional import, and credential generation now covered consistently across all three entity types, Testing Step 9 is complete.


### Post-Step-9 verification regression fixes
- Fixed Family-store database constraint detection to unwrap nested driver errors, so duplicate parent usernames return the intended 409 family conflict instead of an internal 500.
- Restored subscription enforcement on `GET /v1/auth/me`: suspended/cancelled school subscriptions now block Parent/Teacher/Student sessions with `school_service_unavailable`, while school administrators remain able to reach permitted administrative/billing flows.
- Updated stale academic API regression assertions to match the current dependency-aware delete contract, including dependency lists for academic years and classes.
- Updated the teacher-assignment regression expectation to account for the intentionally created second teacher profile while still verifying that the duplicate class+subject assignment is rejected.
- Updated the legacy administrator-password regression test to enforce the current email-verification requirement instead of expecting the superseded direct password-change behavior.
- The Step 9 bulk credential regression itself was already passing in the reported run; these fixes address the six unrelated API failures that prevented `pnpm verify` from completing.


### Testing Step 10.1 — Parent authentication and entry
- Re-audited the Parent first-login journey against Product Specification V1: role selection → active school selection → school-issued credentials → backend role validation → mandatory temporary-password replacement → Parent Home.
- Existing API coverage already verifies school-scoped credentials, wrong-school rejection, role mismatch, account suspension, parent-only feature enforcement, and reactivation.
- Expanded the Parent authentication regression to cover an incorrect password, `mustChangePassword` visibility through `/v1/auth/me`, Parent Home being blocked until the temporary password is replaced, successful Parent Home entry afterward, and refresh-token rotation preserving the Parent role and completed-password state.
- Expanded subscription-suspension coverage so a Parent cannot start a new login while the school's subscription is suspended, while the public administrator contact endpoint remains available for recovery/contact purposes.
- Fixed the mobile background session-status check: when an active Parent session encounters `school_service_unavailable` because the school subscription was suspended, the app now clears operational Parent/Teacher data, removes the stored authenticated session, disables cached authenticated reads, returns to the selected-school login screen, and shows the service-unavailable message instead of leaving stale home data visible.
- Applied the same service-suspension transition to manual network-recovery checks and stored-session restoration, preventing a recovered network connection from dismissing the error and exposing stale cached Parent data while the subscription is still unavailable.
- Suspended individual Parent accounts keep the dedicated suspended-account screen and school administrator contact card; this remains intentionally distinct from school subscription suspension.
- Step 10.1 is ready for local `pnpm verify` plus manual Android/Expo validation before proceeding to Step 10.2.


### Testing Step 10.2 — Parent dashboard
- Added an "At a glance" Parent dashboard for the selected child while preserving the existing detailed attendance, homework/results, announcements, fees and notification sections below it.
- Dashboard cards now summarize today's attendance, today's timetable, upcoming published homework, latest published result, outstanding fee balance, and the latest announcement relevant to the selected child.
- Added a parent-safe timetable endpoint at `GET /v1/parent/children/:studentId/timetable`. It first verifies the requested student belongs to the authenticated Parent account, then returns the child's class timetable with subject and teacher names.
- Added an AcademicStore class-timetable read model. Timetable reads intentionally do not reuse mutable-year validation, so historical/closed-year read behavior is not accidentally blocked by admin write rules.
- Added API regression coverage proving a Parent can read the timetable of a linked child and receives the expected weekday, time, subject and teacher.
- The dashboard reuses learner and communication data already fetched by the detailed Parent panels instead of issuing duplicate homework/results/announcements/fee requests. Only the timetable requires a new dashboard-specific read, preserving the low-bandwidth direction of the mobile app.
- Each dashboard source tracks readiness separately, so an empty not-yet-loaded array is rendered as Loading rather than being misreported as "no classes", "no fees" or "no announcements".
- Child-specific dashboard state is cleared immediately when the selected child changes, preventing the previous child's attendance, homework, results, fees or announcements from flashing while the new child data loads.
- Product Specification V1 lists "next exam" as a Parent Home primary card, but the current approved MVP data model has no exam date field and the specification places richer exam scheduling in V1.1. The dashboard therefore shows an explicit exam-scheduling-unavailable state rather than inventing a date or mislabeling exam creation order as the "next exam."
- Step 10.2 is ready for local `pnpm verify` and Android/Expo visual validation before moving to Step 10.3.


### Step 10.2 test-data support and Accounts list height
- Added a repeatable development command, `pnpm demo:parent-dashboard`, that targets an existing active Parent + Student in the active academic year and creates realistic demo records for Parent-dashboard validation.
- The demo seed creates/refreshes: today's attendance, previous-day attendance, one published homework item, one published exam result, one issued fee with AFN 2500 outstanding, one class announcement, and a timetable period for today when the class does not already have one.
- The seed reuses the selected student's real school, class, academic year, administrator, teacher profile, subject and teacher assignment where possible; if the class has no assignment but the school has a teacher profile, it creates the minimum missing assignment. It stops with a clear error instead of inventing a teacher when no teacher profile exists.
- Optional environment selectors `DEMO_SCHOOL_CODE`, `DEMO_PARENT_USERNAME`, and `DEMO_STUDENT_CODE` can target a specific existing family; otherwise the first eligible active Parent + Student is used.
- The seed is designed to be rerun safely: the same demo attendance, homework, exam/result, fee and announcement records are updated instead of duplicated.
- Fixed the dedicated Admin Accounts directory list at exactly 500px height with internal vertical scrolling, hidden horizontal overflow, stable scrollbar space and contained overscroll.


### Testing Step 10.3 — Parent child switching
- Implemented device persistence for the Parent's last selected child using Expo SecureStore. The preference is scoped by both school ID and Parent user ID, so different Parent accounts and different schools cannot overwrite each other's remembered child.
- Parent Home now restores the remembered child when that child is still linked and active. If the remembered/current child is no longer available, the app safely falls back to the first active linked child and refreshes the stored preference.
- Parent Home now returns only ACTIVE students. Withdrawn students no longer remain selectable in the current Parent Home child switcher.
- The child selector is shown only when the Parent has more than one active linked child. A single-child Parent goes directly to that child's information without unnecessary switcher controls; the existing no-child state continues to instruct the Parent to contact school administration.
- Switching children now invalidates in-flight child-specific requests. Attendance, timetable, learning, fees and communication responses from the previous child are ignored if they arrive after a newer child selection.
- Learner and communication panels now use request-generation guards so stale async responses and stale errors cannot surface after rapid child switching or component replacement.
- Detailed Parent announcements are now child-aware: school-wide and Parent-role announcements remain visible, while CLASS announcements are filtered to the selected child's class.
- Child switch controls expose selected accessibility state, and the selected child is updated immediately before persistence so rapid repeated switching remains deterministic.
- Preference-storage failures are treated as non-blocking convenience failures; Parent Home and manual switching continue to work even if device preference storage is temporarily unavailable.
- Parent Home now resolves the current/remembered child before publishing the refreshed Home payload to the UI, eliminating a brief first-child fallback flash during refresh/restore.
- Added API regression coverage proving an authenticated Parent cannot read the timetable of a student linked to another Parent account.
- Step 10.3 is ready for local `pnpm verify` and manual multi-child Android/Expo validation.


### Testing Step 10.4 — Parent visibility and permissions
- Re-audited Parent permissions against Product Specification V1: Parents may view their own active children's attendance, timetable, published homework/results, announcements, and fee balances; Parent is a read-only family role for these domains and cannot perform Teacher/Admin mutations.
- Tightened relationship authorization consistently across Parent child reads. Attendance, learning/results, fees, and timetable now expose only students that are both linked to the authenticated Parent and ACTIVE. Withdrawn children are removed from Parent Home and direct requests using an old withdrawn student ID return not found.
- Expanded the multi-child API regression to verify a Parent cannot read another Parent's child through timetable, attendance, learning, or fee endpoints.
- Added explicit RBAC regression checks proving a Parent token is rejected from Teacher Today, Teacher Learning, Teacher homework creation, Negaran attendance submission, Student Home, Admin family data, Admin communication data, announcement creation, fee creation, and Admin attendance correction.
- Existing Phase 6 regressions continue to enforce that draft homework/grades remain invisible to Parent/Student until publication, while existing Phase 7 regressions enforce class-scoped announcement isolation and child-scoped fee visibility.
- Existing school-scoped authentication and tenant predicates remain the cross-school boundary: a Parent session is bound to one school and all Parent child queries include the authenticated school ID in addition to relationship checks.
- Parent mobile UI remains read-only for attendance, learning/results, and fees; Teacher/Admin action controls are not rendered in Parent mode.
- Step 10.4 is ready for local `pnpm verify` and a short manual Parent-role permission smoke test before proceeding to Step 10.5.


### Admin student withdrawal control
- Added an explicit student enrollment action in the Admin Student list for `ACTIVE ↔ WITHDRAWN`.
- `Withdraw` updates the student record to `WITHDRAWN` without deleting historical attendance, grades, fees, enrollment history, or other school records.
- Withdrawn students can be restored with `Reactivate enrollment`.
- Student account suspension/reactivation remains a separate account-security action and is now labeled separately from enrollment status to avoid confusion.
- Added Dari and Pashto labels for the new enrollment controls and confirmation message.


### Testing Step 10.5 — Parent navigation
- Implemented the Product Specification V1 Parent bottom navigation: Home, Homework, Announcements, More.
- The Parent bottom bar is rendered only for authenticated, non-suspended Parent sessions; Teacher, Student, login, password-change, and suspended-account screens do not receive Parent navigation.
- Home keeps the child selector, Parent/account context, dashboard summary, recent attendance, and Parent notifications.
- Homework contains only the selected child's published homework.
- Announcements contains school/role announcements plus only CLASS announcements for the selected child's class.
- More contains the selected child's published results, fee balances and payment/reversal history, school administrator contact information, and logout.
- Child selection remains owned by Home as required by the specification. Switching tabs preserves the selected child; switching children refreshes all child-specific data and the same data is reused by every Parent tab.
- Parent learning, announcement, and fee data now load once per selected child at the App level rather than being re-requested when moving between navigation tabs. Existing request-generation guards continue to prevent stale child responses from replacing the currently selected child's data.
- Bottom navigation labels are localized in English, Dari, and Pashto and mirror their visual order for RTL locales.
- Each tab exposes accessibility tab semantics and selected state.
- Parent navigation resets to Home when the authenticated Parent account changes, preventing the previous account's tab state from leaking into a new login.
- Step 10.5 automated verification is green: GitHub CI passed on commit `f2cf9858c4105293289c5cde19e00b23d8a46823`. Remaining validation is the Android/Expo Parent navigation smoke test before moving to Step 10.6.


### Mobile session continuity fix
- Root cause: API access sessions expire after 15 minutes while refresh sessions remain valid for 30 days. The mobile app previously refreshed only during cold-start restore, so a Parent/Teacher/Student who kept the app open eventually continued sending the expired access token and saw the session-expired popup until logout/restart.
- Added a centralized authenticated-request recovery path in the mobile API client. When an authenticated request receives `401 session_invalid`, the app performs one refresh-token rotation and retries the original request once with the new access token.
- Refresh is single-flight: simultaneous Parent/Teacher/Student requests share one refresh promise so parallel requests cannot rotate the same refresh token against each other.
- Mobile sessions also refresh proactively one minute before access-token expiry.
- Android/iOS app foregrounding now checks the access expiry and refreshes immediately when the app returns from background with an expired/nearly-expired access token.
- Rotated access/refresh tokens are written back to SecureStore and live refs before dependent requests continue.
- Account-status polling reads the latest rotated session before updating user status so it cannot overwrite fresh tokens with the expired token captured at the start of a poll.
- Retried requests preserve the refreshed Authorization header using the Headers API.
- Logout reads the latest rotated refresh token rather than a stale token captured before push-device cleanup.
- Invalid/expired 30-day refresh sessions still move the user safely to login with the normal session-expired message; network failures do not destroy the stored session.
- The change applies to Parent, Teacher, and Student mobile experiences, not only Parent navigation.


### Mobile language header selector
- Replaced the three always-visible language pills in the mobile header with a compact language select/dropdown.
- Dari (`fa-AF`) remains the default mobile language.
- The header layout is intentionally anchored independently of content direction: MaktabLink logo/name stays at the top-left and the language selector stays at the top-right in Dari, Pashto, and English.
- The selector shows Dari, Pashto, and English, marks the active language, closes after selection, and closes when the main page starts scrolling.
- The dropdown uses elevated/z-indexed styling so it stays above the main mobile content.


### Testing Step 10.6 — Parent styling and UI polish
- Refined the Parent mobile experience around the product principles of mobile-first, RTL-first, low-density, action-oriented family visibility without adding decorative charts or changing Parent business logic.
- Parent Home now uses a compact family hero instead of separate title/account cards, reducing vertical repetition while keeping Parent, school, and username context visible.
- Multi-child selection now uses larger touch targets, child initials, an explicit selected-state checkmark, and RTL-aware wrapping.
- The selected-child profile is more compact: identity/class context appears together and student code, class code, and academic year use a three-cell metadata grid instead of three full-width rows.
- Parent dashboard cards now use lightweight skeleton/loading treatments instead of displaying “Loading…” as a large primary value. Attendance/result/fee states receive restrained semantic icon treatments while preserving the same data.
- Dashboard cards, Parent section cards, Homework, Announcements, Results, and Fees now share a more consistent radius, border, spacing, shadow, and icon treatment.
- Recent Attendance and Notifications now have icon-backed section headers plus clearer empty states.
- Homework, Announcements, and More now use a shared page-heading pattern with selected-child context directly under the tab title.
- Homework heading direction now mirrors correctly in RTL.
- Homework/announcement/fee/result rows now use inset content cards rather than long divider-only lists for stronger mobile scanning.
- Announcement dates now use compact date pills.
- Parent bottom navigation has refined active-state icon treatment, spacing, shadow, and touch sizing while preserving Home / Homework / Announcements / More and RTL ordering.
- Loading states in Parent tab content now use contained loading cards/rows rather than isolated spinners.
- No Parent permissions, API contracts, data loading semantics, or child-switching behavior were changed during this styling pass.
- Step 10.6 requires local Expo visual validation on a small Android device in Dari, Pashto, and English before moving to Step 10.7.


### Testing Step 10.7 — Parent RTL and localization validation
- Audited the Parent mobile experience against Product Specification V1 requirements for Dari, Pashto, English, true RTL support, AFN currency, and Solar Hijri date display.
- Dari remains the first-run/default mobile language. An explicit user selection of Pashto or English is now persisted in Expo SecureStore and restored on later app launches.
- Added shared locale display helpers for localized digits, numbers, AFN amounts, dates, clock times, and time ranges.
- Parent-facing Dari/Pashto dates now display in the Persian/Solar Hijri calendar while API/storage values remain unchanged ISO/Gregorian values. English display remains Gregorian.
- Parent dashboard schedule times, extra-period counts, result scores, homework due dates, announcement dates, and fee amounts now follow the selected locale.
- Parent Homework, Announcements, Results, Fees, Recent Attendance, notification date metadata, and payment history now use localized display dates/numbers.
- Fee invoice statuses and payment/reversal kinds no longer leak raw English database enum values into Dari/Pashto UI; localized labels were added for all fee states.
- Parent bottom navigation now keeps the logical Home/Homework/Announcements/More array unchanged and applies RTL at the container level, rather than manually reversing the data array.
- Student/class codes remain LTR identifiers inside RTL layouts to avoid character-order corruption. Usernames are bidi-isolated when displayed beside RTL school text.
- Academic-year numeric text follows the selected locale's digits.
- Added localization unit tests proving Dari/Pashto Solar Hijri conversion and localized numbers/time/AFN output.
- Added `scripts/verify-parent-localization.mjs` and root `pnpm verify:parent-localization`. The normal `pnpm verify` now runs this guard before typecheck/test/build, protecting Parent RTL/date/currency/status invariants from regression.
- Automated CI has passed typecheck and tests for the completed 10.7 implementation; Android build verification is tracked by the latest workflow before final manual Expo review.


### Testing Step 10.8 — Parent network, session, and resilience
- Validated the Parent mobile experience against Product Specification V1 failure requirements for network interruption, duplicate/racing requests, expired sessions, low-bandwidth read caching, and failed push isolation.
- Fixed reconnect freshness: once API health and account status are confirmed, cache-only mode is disabled before the reconnect epoch triggers Parent reloads. This prevents a recovered connection from immediately reusing stale cached Home/attendance/timetable/homework/fees/announcement data.
- Read-cache fallback now surfaces the dedicated cached/offline message rather than presenting cached data as a generic API outage.
- Hardened tunnel/proxy failure behavior: read-only API requests may safely fall back to the account-scoped cache when a tunnel/gateway returns malformed non-JSON content. Authentication, writes, subscription suspension, and other authoritative server errors remain uncached.
- Parent cache keys remain scoped by school + signed-in user + request path, with bounded cache age. Logout/session loss clears the active cache scope so another account cannot read the previous account's cached paths.
- Parent child-specific requests retain request-generation guards so responses for a previously selected child cannot overwrite the current child's data after rapid sibling switching or reconnect.
- Mobile access sessions use single-flight refresh-token rotation. Requests receiving `session_invalid` retry once with the rotated access token; proactive refresh runs before access expiry and app foregrounding refreshes an expired/nearly-expired session.
- Added API regression coverage proving refresh-token rotation is one-use: replaying the old refresh token returns `refresh_invalid`, logout revokes the current refresh session, and the associated access token becomes `session_invalid`.
- Push registration/deactivation failures remain non-blocking; Parent login/home/logout do not depend on push-provider connectivity.
- Added `scripts/verify-parent-resilience.mjs` and root `pnpm verify:parent-resilience`. Normal `pnpm verify` now checks Parent localization + resilience invariants before typecheck/tests/build.
- Manual acceptance still requires an Expo device outage/reconnect smoke test: warm cache online, disconnect API/network, confirm cached Parent reads remain visible with an offline notice, restore connectivity, confirm fresh server data replaces cache automatically, background/resume across access-token expiry, and confirm logout/login is not required.


### Testing Step 11 — Student mobile experience
Student testing follows the Product Specification Student information architecture and recommended bottom navigation.

Planned verification slices:
- 11.1 — Student authentication and entry/security
- 11.2 — Student Home academic summary
- 11.3 — Student timetable
- 11.4 — Student homework
- 11.5 — Student exams and published results
- 11.6 — Student announcements and notifications
- 11.7 — Student navigation, styling, RTL, and localization
- 11.8 — Student permissions, withdrawn/suspended behavior, session, offline, and resilience regression

#### 11.1 — Student authentication and entry/security
- The shared mobile authentication flow already supports Student role selection, school selection, school-issued credentials, forced temporary-password replacement, secure session restore/refresh, suspension handling, and role-safe rendering.
- Added explicit API regression coverage for Student entry: wrong-role login is rejected; temporary credentials cannot access academic features until the password is changed; the resulting session remains STUDENT; Student access cannot open Parent or Teacher routes.
- Student academic lookup now requires an ACTIVE student enrollment in addition to the school-scoped Student account.
- A withdrawn enrollment remains separate from account suspension/history, but Student academic entry now returns the localized-compatible `account_unavailable` condition instead of exposing academic data or a generic request failure.
- Account suspension independently blocks Student academic access with `account_suspended`.
- The Student entry test creates the school-issued Parent/Student relationship and Student account through public admin APIs only; no direct database manipulation is used.
- Automated typecheck/tests passed for the completed 11.1 changes; final workflow build verification is tracked before device acceptance.


#### 11.1 follow-up — live withdrawal detection
- Fixed a live Student withdrawal UX gap found during manual testing.
- Root cause: the mobile 3-second account-status poll checked only the user account status. Student withdrawal changes enrollment status in the students table, so an already-open Student session remained visually active until an academic request reloaded.
- Added a lightweight `GET /v1/student/status` route backed by an ACTIVE-enrollment lookup.
- Mobile Student status sync now checks that route alongside account status. A withdrawn enrollment immediately enters the localized `auth.accountUnavailable` state without logout/restart.
- Withdrawn Student academic panels are hidden and replaced with a localized unavailable/contact-school screen, administrator contact, and logout.
- Reactivating the Student enrollment clears the unavailable state automatically and refreshes Student data.
- Added English/Dari/Pashto title text for the unavailable Student state.
- Extended the Student entry regression test to verify ACTIVE status, withdrawn `account_unavailable`, and successful reactivation.


#### 11.2 — Student Home academic summary
- Replaced the previous Student Home full-detail dump with a purpose-built academic summary, matching Product Specification V1 where `/student/home` is the Student academic-summary page and Timetable/Homework/Results/Announcements remain separate Student destinations.
- Added active Student timetable context in the academic store and `GET /v1/student/timetable`. The response contains the active student, class, academic year, and class timetable periods and returns `account_unavailable` when the Student enrollment is no longer active.
- Added a dedicated mobile `StudentDashboard` component.
- Student Home now shows:
  - Student identity and protected Student code;
  - current class;
  - academic year;
  - today's timetable snapshot with teacher and localized time range;
  - next/upcoming published homework;
  - latest published result;
  - latest visible school/role/class announcement;
  - unread notification count.
- Student Home loads timetable, learning, announcements, and notifications once at App level and keeps separate readiness state for the summary cards. This provides reusable state for later Student detail/navigation slices without duplicate initial fetches.
- Student Home request generation is guarded so reconnect/session changes cannot paint stale Student data from an older request.
- Full Homework, Results, Timetable, and Announcement lists are intentionally not rendered on Home; they remain planned for 11.3–11.6.
- Added English/Dari/Pashto Student Home summary labels and kept code identifiers LTR while academic-year digits and dates follow the selected locale.
- Extended API regression coverage so the Student timetable/context route is available for an ACTIVE Student and returns `account_unavailable` after withdrawal.


#### 11.3 — Student timetable
- Fixed the missing Student timetable UI discovered during manual 11.2 review.
- Student Home keeps the compact "Today's schedule" summary, but now also exposes a clear "View timetable" action.
- Added a dedicated Student timetable screen using the existing `GET /v1/student/timetable` payload.
- The Student timetable is rendered as a mobile agenda, not a desktop grid, matching the product specification.
- The weekly agenda covers Saturday through Thursday and intentionally omits Friday.
- Each day shows localized day name, number of periods, subject, teacher, and localized start/end time.
- The current Afghanistan weekday is visually highlighted.
- Empty days show a localized no-classes state. If the class has no timetable at all, a dedicated localized empty state is shown.
- Student/class/academic-year context is shown at the top of the timetable screen.
- Student code remains LTR-safe, while academic-year digits and timetable times follow the selected locale.
- Opening the timetable reuses the already-loaded Student timetable state; Student data loading is no longer tied to the Home screen itself, so navigating Home → Timetable does not trigger a duplicate initial fetch or blank the timetable.
- Withdrawal/suspension/session status checks remain active while the Student timetable screen is open; a withdrawn or suspended Student is returned to the protected unavailable state.
- The complete timetable UI integration passed typecheck, tests, and build in GitHub CI.


#### 11.3 refinement — Student timetable readability
- Student timetable period rows now show only the class start time (for example 09:45) instead of a start→end range, matching the requested quick-scan mobile behavior.
- The current Afghanistan weekday is now visibly emphasized with a 2px brand border, tinted card background, subtle elevation, stronger count pill, and a localized Today/امروز/نن badge rather than relying only on calendar-icon color.
- Day grouping remains Saturday through Thursday, with Friday omitted.

#### 11.4 — Student homework
- Added a dedicated Student Homework screen reachable from Student Home through a clear View homework action.
- The screen reuses the Student learning payload already loaded at App level, avoiding a duplicate initial request when Home → Homework is opened.
- Student Homework remains read-only and uses the existing server visibility contract: draft homework is hidden; published/closed homework is available to the linked active Student.
- Assignments are grouped into Upcoming and Past sections. Upcoming contains published assignments whose due date has not passed; closed or expired assignments appear under Past.
- Each homework card shows title, subject, class, localized due date, and teacher instructions.
- Optional HTTP(S) homework attachments expose an Open attachment action using the device link handler. Attachment-open failure is non-blocking.
- Homework counts, dates, labels, direction, and empty states are localized for English, Dari, and Pashto.
- Student withdrawal/suspension/session protections remain active on the Homework screen and return the Student to the protected unavailable state when necessary.
- Existing API regression coverage already proves Student draft homework is hidden and becomes visible only after the assigned teacher publishes it.
- The combined timetable refinement + Student Homework implementation passed typecheck, tests, and build in GitHub CI.


#### 11.5 — Student exams and published results
- Added a dedicated Student Results screen reachable from Student Home through a View results action.
- The screen reuses the Student learning payload already loaded at App level, so Home → Results does not trigger a duplicate initial request.
- Result visibility follows Product Specification V1 rules exactly: draft grades and exams that have not been published remain invisible; only grades whose grade status and exam status are both PUBLISHED are rendered.
- Published results are grouped by exam. Each exam card shows exam name/type, publication date when available, aggregate score/max for the visible subjects, and individual subject results.
- Each subject row shows subject, class, localized score/max, and the teacher remark when one exists.
- No pass/fail judgment or ranking is inferred because the current product model does not define a universal passing threshold.
- The current Exam model does not contain an exam schedule/date field, so Student 11.5 does not invent an upcoming exam date/calendar. The page represents published exam/result records from the data the product actually stores.
- Empty, loading, date, number, score, and remark states are localized for English, Dari, and Pashto and preserve RTL behavior.
- Withdrawal, suspension, session refresh, reconnect, and stale-response protections remain active on the Results screen.
- Existing API regression coverage already proves draft/RESULTS_READY data is hidden from Students and becomes visible only after Admin publishes the exam.
- Extended that regression to prove a correction to an already-published grade is also reflected in the Student view, including the corrected score and remark while remaining PUBLISHED.


### Development workflow — combined API + ngrok
- Ported the proven Futsal development launcher pattern into MaktabLink.
- Root `pnpm dev:api` now runs `scripts/dev-api.mjs` instead of starting only `@maktablink/api`.
- The launcher starts the local MaktabLink API on `API_PORT` (default 4000), waits for `/health`, verifies database readiness through `/ready`, and only then starts `ngrok http <port>`.
- API and ngrok share one terminal. `Ctrl+C` terminates both processes.
- On Windows, pnpm/ngrok are launched through the shell to avoid the Node spawn issue previously encountered in the Futsal workflow.
- The launcher discovers the HTTPS ngrok endpoint through the local ngrok inspector, verifies that `<public-url>/health` is actually serving `maktablink-api`, and only then synchronizes the ignored `apps/mobile/.env.local` file with `EXPO_PUBLIC_API_URL=<public-url>`.
- Existing local Expo settings in `.env.local` are preserved, duplicate API URL entries are removed, and only HTTPS tunnel origins are accepted.
- If the API cannot start, the database is not ready, ngrok is unavailable, or the public health check fails, an invalid public URL is not written to Expo configuration.
- Set `MAKTABLINK_SYNC_MOBILE_API_URL=false` only when automatic Expo URL synchronization is intentionally disabled.
- Added `pnpm verify:dev-api` with syntax, environment-sync, and process-supervision regression coverage and included it in root `pnpm verify`.
- Normal mobile development now requires two terminals only: Terminal 1 `pnpm dev:api` (API + API ngrok) and Terminal 2 Expo/Metro (for example `pnpm --filter @maktablink/mobile exec expo start --tunnel --clear --go`).

#### 11.6 — Student announcements and notifications
- Added a dedicated Student School updates page reached via the Home actions **View announcements** and **View notifications**.
- Segmented tabs expose accessible selected state, an unread badge, localized dates, loading and empty states, and full announcements/notification lists in English, Dari, and Pashto.
- Class-scoped announcements are checked against the authenticated active Student class in the UI in addition to backend school/role/class authorization.
- A personal notification supports explicit **Mark as read** and an unread-only filter. Mark-read updates Student and Parent state from the server response without applying a stale cross-account response.
- The Student content reuses the existing app-level announcement/notification loading; opening a tab does not duplicate initial API requests.
- Fixed mobile API JSON headers: requests with no body no longer claim JSON. This prevents Fastify from rejecting notification mark-read POST and other bodyless actions before their handlers execute.
- Extended the API regression for class-scoped Student announcement delivery and ownership-scoped notification mark-read (including denying a second Student).
- Device smoke testing and CI verification remain separate acceptance gates, especially offline/reconnect and real push delivery.

#### 11.7 — Student navigation, styling, RTL, and localization
- Implemented Product Specification V1's four main Student bottom tabs: **Home, Homework, Results, More**. Timetable, Announcements, and Notifications remain accessible as dedicated Student detail screens from Home and More, rather than creating extra bottom tabs.
- The main Student tab bar has translated Dari/Pashto/English labels, accessible tablist/selected states, RTL-aware ordering, compact icon-and-label targets, and the same inset active-tab treatment as Parent navigation.
- Student More now groups the Timetable, Announcements, and Notifications routes with school administrator contact and Logout. These account/support actions are no longer repeated under the Student Home summary.
- Homework and Results are primary Student navigation destinations and no longer show redundant back buttons. Nested Timetable/Updates retain a back action that returns to the originating Home or More section.
- Selecting a main Student tab clears stale action feedback and scrolls the content to the top with reduced-motion support.
- The Student navigation bar never appears on Teacher/Parent screens, login, password change, withdrawn/suspended views, or nested detail routes.

#### 11.8 — Student permissions, enrollment, session, offline, and resilience
- Audited Student read/write boundaries. Existing Student Home, timetable, learning, and published-results routes remain school-scoped and active-enrollment constrained; draft homework/results remain hidden.
- Found and fixed a withdrawn-enrollment authorization gap in communication APIs: the server now rejects Student announcement, notification, fee, notification-read, and push-device requests when the linked Student enrollment is not ACTIVE, returning `account_unavailable` without destroying the account/session. The student status and school administrator contact endpoints remain accessible for recovery.
- School-wide and Student-role announcement recipient expansion now excludes withdrawn Student enrollments even if the underlying user account is still ACTIVE. Pending push delivery is cancelled for withdrawn or suspended recipient identities, preventing queued messages from leaking after access is revoked.
- Student Home now fetches timetable, learning, announcements, and notifications independently using `Promise.allSettled`. A temporary failure in one read no longer leaves unrelated Student dashboard sections loading forever; an authorization denial still overrides cached/partial data.
- A Student `account_unavailable` response immediately activates the restricted withdrawn UI instead of waiting for the next periodic status poll.
- The shared mobile single-flight token refresh, reconnect freshness, 7-day account-scoped cached GET fallback, non-replayed writes, and non-blocking push registration remain in place.
- Expanded API regressions to deny withdrawn Student communication endpoints, confirm reactivation restores read access, restrict announcement notifications to active Students, and prevent cross-account notification acknowledgment.
- At code delivery, Android acceptance checks had not yet been verified. The user subsequently reported completing Android device acceptance on 2026-10-13; see Step 11 closure below for the milestone status.
- This is a source-code plus CI test slice, not certification of a live production deployment.


#### Testing Step 11 — Completion and Android acceptance (2026-10-13)

**Status: COMPLETE — implementation, automated verification, and user-reported Android acceptance.**

- Student experience test slices 11.1–11.8 have been implemented and verified by the automated test/build pipeline.
- The final code CI workflow for commit `ee22b7cdd067312a322ffbcfdd5beecc05541bc7` passed TypeScript typechecking, automated tests, and production builds: https://github.com/Alisina137/maktab/actions/runs/38342497716.
- On 2026-10-13 the user confirmed completing the Android device acceptance testing for Step 11. Record this as a **user-reported manual acceptance**, not as independently captured device logs or an automated device-test result.
- As a result, **Step 11 is closed**. No additional Step 11 implementation remains planned; any newly discovered bugs or enhancements will be handled as follow-up work.
- This Step 11 acceptance does not replace the separate real-production readiness gates, such as production deployment, server scheduler operations, backup/restore rehearsal, or external observability integrations.


## Testing Step 12 — Teacher mobile experience (implementation and automated verification)

### 12.1 — Teacher identity and school context
- Shared login continues to enforce school-issued credentials, expected role, mandatory password change, tenant-bound session and suspension restrictions. Teacher workspace displays the authenticated teacher's profile/name and selected school. Backend teacher endpoints re-authorize the role and scope all data by the session's school/user, rather than trusting client role or school selectors.

### 12.2 — Today page
- Replaced the overloaded all-in-one Teacher Home with a compact Today summary showing the server's school-local date, localized day/date, only the authenticated teacher's classes and subjects in time order, and active Negaran attendance links.
- Displaying only the class start time keeps the schedule easy to scan. Backend Today already filters to the ACTIVE academic year and current school-local weekday; the mobile display sorts by start time as a defensive invariant.
- A periodic refresh every 60 seconds keeps the date and live assignments accurate across midnight or administrator changes without requiring a logout.

### 12.3–12.4 — Full schedule and teaching assignments
- Expanded the existing authorized `GET /v1/teacher/academics` response with `schedule` and `assignmentDetails`, joined with same-school class/subject records and ACTIVE academic-year scope. The existing raw fields remain available to preserve clients.
- Mobile weekly schedule groups Saturday–Thursday, orders periods by start time, highlights the server-reported current weekday and shows a clear empty state for unscheduled days. Friday is omitted consistently with the Student timetable.
- Classes shows distinct teaching assignments (class code, class name and subject), separate from supervision privileges. Selecting a teaching assignment opens the Teacher Workflows tab.

### 12.5–12.6 — Active Negaran vs regular Teacher
- Today and Classes offer attendance only for classes returned as active supervised Negaran assignments. The backend validates the exact school, teacher, class and assignment dates before showing or accepting attendance.
- Teacher workflows continue to permit homework/draft grade actions solely against their own teaching assignments. Publishing class announcements requires active Negaran supervision and presents no announcement-composer controls when no classes are supervised.
- Negaran is an assignment, not a separate login role. No Teacher gains attendance or announcement permissions solely by teaching a subject.

### 12.7 — Navigation and workflows
- Added four persistent bottom tabs: Today, Schedule, Classes, Workflows. Tabs have icon + translated label, clear active state, accessible selected-tab semantics, direction-aware layout, and scroll reset on change.
- Workflows contains teaching homework/draft-grade operations, active Negaran class announcements, school administrator contact and Logout. Opening Negaran attendance shows its dedicated screen; returning preserves the selected Teacher tab.

### 12.8–12.9 — Recovery, RTL and UI
- Teacher Today and Academic assignment/schedule requests load independently and use request-generation guards to prevent outdated or cross-account responses. Temporary failure in one resource no longer blocks the other; permanent auth/suspension denial is authoritative. Failed resource views offer Retry.
- Today's summary and full timetable use app localization helpers for dates, numbers and class starting times. School context and schedule have loading/empty cards, responsive rows, RTL-aware layout and accessible navigation.
- Teacher learning panel now invalidates stale request responses and provides a Retry state. Homework due dates, exam max scores and announcement dates display using localized formatting rather than raw ISO slices or untranslated status identifiers.
- Existing token refresh, scoped offline read cache, connection-recovery mechanism and non-blocking push registration continue to apply to Teacher routes.

### Acceptance status
- **Code changes and automated regression tests:** GitHub Actions CI verifies the monorepo typecheck, API/database tests and production builds. Additional regressions cover non-Negaran announcement denial and empty normal-Teacher Today; homework statuses are now localized.
- **Real Android Teacher smoke tests:** not independently run in this conversation. Validate authentic Teacher/Negaran accounts, Today date/order, weekly navigation, RTL/large text, attendance permissions, network loss/reconnect and token refresh before marking the entire Step 12 manual acceptance complete.
- No new database migration is necessary.

### Step 12 Android screenshot follow-up (2026-10-13)
- The user's Android screenshots show the legacy combined Teacher page, with Today, attendance, homework, grades, and announcements on one long screen and no bottom tabs. The current source on `main` renders four Teacher bottom tabs (Today, Schedule, Classes, Workflows); device must pull/restart Expo Go with the new bundle to verify them. Do not mark device acceptance complete based on these legacy screenshots.
- The Teacher homework creation/edit form now opens a touch-friendly localized **calendar modal** instead of requiring teachers to type `YYYY-MM-DD`. The calendar supports month navigation, Saturday-first weeks, RTL alignment, selection state, and an accessible dismiss action. Due time remains separately editable as `HH:mm`; the existing ISO date/time submission and authorization rules are unchanged.
- The app intentionally informs the user when airplane mode disconnects the API; cached reads and recovery remain available. Repeated network errors now preserve a previously minimized network error banner instead of force-expanding it for every failed request.
- Android retest requested: update/restart the Expo bundle, confirm bottom tabs, pick a homework date and save/edit a draft, then test airplane-mode/offline and recovery. Latest CI and on-device acceptance remain separate gates.


### Teacher Workspace Expansion — Phase 1 (2026-10-13)

Implemented Phase 1 of the expanded Teacher mobile workspace, following Step 12:
- Today has a compact workload overview, actual assigned-period count, teaching-assignment count, pending Negaran attendance, next upcoming school-local lesson, draft homework count, currently open exam-subject mark-entry count and unread notifications. Counts derive exclusively from authenticated Teacher Today/learning/communication endpoints, not global school data.
- Today includes deep actions to Classes, Schedule, Homework, Marks, unread notifications, and active Negaran attendance; options are shown conditionally for available teaching/mark-entry/supervision assignments. Recent announcements are pulled only from the authenticated teacher's authorized audience.
- Teacher header includes an unread notification badge and a dedicated notification center with announcements, explicit notification read acknowledgments, localized dates, loading/empty/retry states, and access-token guarded updates.
- Workflows now has accessible localized Homework / Marks / Announcements tabs. Homework and Marks show only the matching panel; Announcements preserves Negaran-only class composition while allowing the regular Teacher to read school announcements. Account support and logout remain available.
- Shared bottom navigation continues to use Today / Schedule / Classes / Workflows, with RTL focus states and selected labels. Teachers' timetable starting times now use 12-hour AM/PM formatting.
- Auth-scoped hub reads load independently and invalidate stale requests when credentials/reconnect epochs change. Summary refreshes when returning from Workflows. No new database migration, no extra teacher permissions, and no persistent offline writes are introduced.
- Added pure regression checks for teacher pending tasks, school-local next class and AM/PM formatting. Android device acceptance remains pending: verify new dashboard, Workflow tab switching, read notification, RTL, no unauthorized composer, and offline recovery.


### Development tunnel startup fix — 2026-10-13
- User reported `pnpm dev:api` confirming local API /health and DB /ready, followed by ngrok HTTPS URL whose **one-shot public /health probe failed**, leaving Expo on a stale previous API URL.
- Startup now checks the public tunnel with `ngrok-skip-browser-warning: true` (consistent with the mobile API client) and retries initial propagation failures for up to 30 seconds before deciding whether to update the ignored Expo API URL.
- If public verification still fails, startup logs the final HTTP/transport reason and a copyable PowerShell `curl.exe` diagnostic command. It deliberately does not claim the public endpoint is healthy or overwrite the Expo URL on failure. API and ngrok keep running for investigation.
- Added offline deterministic tests for ngrok HTML warning/502/network failures, header injection, retry and timeout; they run in CI with the dev launcher checks.
- Follow-up Android acceptance: restart `pnpm dev:api` **first**, check a successful public API health before starting `pnpm dev:mobile`, scan a fresh Expo QR code and check live Teacher navigation and reconnect.


### Teacher Workspace Expansion — Phase 2 (2026-10-13)

**Implementation submitted for CI; Android device acceptance remains to be verified.**

- Teacher **Classes** now opens a dedicated, assignment-scoped class detail rather than sending users to the generic Workflows tab. The detail supports Back to Classes, Overview, Students, Homework, Grades, and a conditional **Supervision** tab for active Negaran on the school-local date.
- The new `GET /v1/teacher/classes/:assignmentId` API checks authenticated TEACHER + changed-password completion and enforces exact school + teacher + current ACTIVE academic-year teaching assignment **before** returning any class data. Unassigned/other-teacher/other-school/stale assignment requests return 404; normal non-teacher access returns 403.
- Class detail includes class/subject/year, active student roster with name and student code **only** (no parent/phone/fee or other sensitive fields), sorted own-subject weekly periods, school-local date and active Negaran capability flag. Withdrawn students are excluded.
- Student items expand to limited read-only details and a link to the authorized subject grade workflow; official exam publication permissions remain with School Admin.
- Class Homework and Grades use explicit assignment/class/subject/year filters; the create-homework assignment stays fixed in class context, while existing backend authorization continues to protect writes.
- A Teacher who teaches in the same class but is **not Negaran** cannot see its Supervision tab or submit class attendance/announcements. Active Negaran gets attendance and class-scoped announcement actions, reusing protected server endpoints.
- Added regression coverage for assigned roster and periods, same-class subject isolation, normal Teacher-vs-Negaran differences, malformed IDs, withdrawn student exclusion, and unauthorized role access.
- No new database migrations/dependencies. Real-device retest: select Class, inspect Students, create draft homework for correct class, inspect Grades, check supervision for normal Teacher vs Negaran, back navigation, RTL, and offline/reconnect.


### Teacher Workspace Expansion — Phase 3 (started 2026-10-13)

**Phase 3.1 — Homework & Exam Gradebook usability (implemented; awaiting CI/device verification).**
- Homework now supports title/instruction search, separate All/Draft/Published/Closed/Archived status filters, visible result totals, and reusable templates. A teacher can copy any previously created homework into a **new draft** without editing or republishing the original; the destination class/subject must be one of their currently authorized teaching assignments, and a new due date must be explicitly selected. Existing API assignment authorization remains the source of truth.
- HTTPS attachment links are validated client-side, previewed as tappable links on Teacher homework cards, and preserved when reusing templates. File bytes are **not** uploaded by the app: true native file selection, authenticated object-storage uploads and antivirus/size policies require a separately scoped backend storage phase. UI is explicit about this limitation instead of presenting broken upload controls.
- Homework due-date creation/editing consistently uses **Asia/Kabul UTC+04:30** instead of the mobile device's timezone, with strict invalid-calendar-date rejection and automated regression tests. Server retains ISO instants.
- Grades have student name/code search, a missing-marks filter, recorded/missing counts and a visual completion bar. Student grade rows show the recorded state and score maximum.
- Marks save is now **changed-only**: unchanged existing draft marks are never resent, preventing unnecessary writes. Empty/no-change save attempts show feedback instead of issuing an invalid API request; invalid, decimal, negative, over-maximum and inadvertent clear-of-saved-marks are blocked on the device, with existing server validation still authoritative. Official result publication remains School Admin-only.
- Automated tests cover Afghanistan-local homework date round trips, invalid date/time, template-derived filtering, grade counts, changed-only saves and score validation. No database schema/migration or dependency additions.

**Phase 3 not yet fully closed:** Scheduling automatic publication needs a durable server scheduler and idempotent publication jobs; native PDF/image/worksheet uploads need school-scoped object storage and secure download access. Student homework submissions and continuous assessment are separate broader features with their own data/permission models. Do not describe these as implemented. Android acceptance: check new homework filters, template copy to another own class, calendar due date, attachment link, grade search/missing filter, non-overwrite of marks, RTL, and offline/reconnection before closing Phase 3.


### Mobile ngrok flapping and transient connection popup fix — 2026-10-13
- The API and ngrok forward port remain **4000**. The `127.0.0.1:4040` used by `scripts/dev-api.mjs` is ngrok's local monitoring/inspector endpoint, **not** the API port or forwarding destination. Launcher now prints that distinction explicitly.
- Mobile connection notifications were oscillating because any isolated timeout immediately created a prominent disconnected popup, while a **single** successful health check immediately dismissed it and showed a recovery popup. This is especially noisy over free ngrok/Expo tunnels.
- Network errors now enter a 6.5-second quiet grace period, then verify actual API health before showing a persistent connection alert. A recovered transient triggers a background screen refresh without displaying disconnected/reconnected popups. A true outage retains the existing offline/cache functionality.
- Automatic recovery now requires **two** healthy probe cycles (including the authenticated account check where applicable), 4.5 seconds apart. Short outages recover without a second full-screen success popup; manual recovery and outages lasting 30+ seconds may still show recovery confirmation. Authorization/suspension guards remain authoritative.
- UI smoke testing is still needed on the Android phone. This improves message stability but cannot prevent real network/tunnel downtime; if the public ngrok health URL actually fails repeatedly, check Windows network and ngrok agent.

- Reduced redundant authenticated account-status polling from every 3 seconds to every 15 seconds while Expo Go is active, plus an immediate verification when the app enters the foreground. Pausing background polls lowers unnecessary requests and ngrok load without removing suspension checks.


### Teacher Workspace Phase 3 — Remaining workflows implemented (2026-10-13)

**Code implementation:** Teacher Homework, Student Submissions, continuous assessments and automatic homework publication are now connected end to end. **Device acceptance is not independently complete**; this is not a production-release sign-off.

- Added migration `0015_teacher_learning_workflows`: school-scoped learning file bytes and metadata, teacher homework attachments and scheduled publication date, student homework submissions/feedback, and continuous-assessment records/scores. **Run database migrations before starting the updated API.** The migration does not alter official exam marks.
- Added authenticated, school-scoped PDF/JPEG/PNG/WebP file selection, upload and share/download through a verified file MIME signature, strict 1 MB limit and user/assignment/enrollment access checks. This pilot implementation stores bounded base64 objects in PostgreSQL, not publicly served URLs. **For production scale, replace this storage layer with school-scoped object storage, malware scanning and documented retention/quota policy before raising file limits.** Never treat file URLs as public.
- A teacher can attach or remove an uploaded file from their **draft** homework and select an optional future publication instant before its due date. A persisted scheduler in the API checks each minute and atomically publishes due drafts after server restart; invalid/inactive assignments and expired deadlines are skipped. Recipients receive deduplicated class notifications. The server process must be running for publication; missed windows are retried while the deadline remains in the future.
- Students with **active enrollment** can submit text and/or an uploaded file to *published, unexpired homework for their own class and academic year*. Duplicate submissions are rejected, and only submissions returned for revision can be re-submitted before the deadline. Teachers can review their own assignment's submissions, provide required feedback, and mark Reviewed or Revision Requested. Existing status checks remain server-authoritative; only the student or permitted teacher sees private submission content.
- Teachers can create authorized class/subject-scoped **continuous assessments** (Quiz, Classwork, Homework, Participation, Monthly), enter bounded integer student scores and inspect saved scores. These records remain separate from official exam grades; a teacher cannot publish or change official results through the new assessment endpoints. Student roster checks prevent grading other classes or withdrawn students.
- Teacher Homework and Grades workflow screens now expose these actions, while Student Homework has a dedicated submission form with status and feedback. English, Dari, and Pashto labels are provided. Expo SDK 57 native document/file/sharing dependencies are added for Android Expo Go.
- Automated integration coverage extends the existing family/teacher/student learning test with file MIME/permission checks, scheduled publication validation and idempotence, submission → feedback → revision → review, continuous assessment marks and teacher/student role isolation.

**Acceptance gates:** GitHub CI Typecheck/Test/Build must pass; Android Teacher and Student acceptance still requires testing native file selection, upload/download, publish on schedule, draft and submitted states, teacher review, continuous marks, RTL, and reconnect behavior. Device-only functions cannot be independently accepted by GitHub CI. No broader homework-delivery SLA is guaranteed while the development server is offline.

#### Phase 3 hardening and acceptance notes (2026-10-13)
- Scheduled publication and class-notification fan-out now occur in the same PostgreSQL transaction. If fan-out fails, the draft stays scheduled so publication can be retried, rather than leaving a published homework without notifications.
- Teacher editing validates that the due deadline remains after a selected publication time; manual publication clears obsolete schedule metadata. The mobile draft composer retains the created homework ID across intermittent attachment/scheduling failures to avoid creating duplicate drafts when saving again.
- Parent accounts linked to an actively enrolled student can securely view uploaded homework files published to the student's current class and academic year; unrelated admins, students and parents cannot access them.
- PostgreSQL file uploads are capped at 1 MiB per PDF/image, 10 uploads/24 hours for students and 40 uploads/24 hours for teachers. This bounds pilot storage consumption and is **not** a replacement for object storage plus malware scanning for larger-scale deployment.
- Teacher assessment gradebook has an explicit assigned class/subject selector. Archived homework remains available for reviewing historical submissions. The API closes scheduled publication and its 60-second timer correctly during shutdown.
- Device manual acceptance and production-object-storage hardening remain separate from CI completion.


### Teacher Workspace Expansion — Phase 4: Negaran attendance and history (2026-10-13)

**Implementation submitted for automated and Android verification; not yet device-accepted.**

- Added **Mark unmarked present** for today's editable Negaran attendance. Fills only students without a mark and preserves intentionally selected Absent, Late and Excused statuses. Existing server-side completeness, idempotency, permission and school-local-day checks remain authoritative.
- Attendance daily view now shows live Present/Absent/Late/Excused counters and a native confirmation alert displaying all totals before submission. No marks are sent until the user confirms. Past attendance remains non-editable and corrections remain School Admin-only.
- Added Negaran **History** tab to the attendance screen (reachable from Teacher Today, even when Negaran has no subject teaching assignment), and monthly history panel within assigned class Supervision. Calendar begins Saturday, localizes labels/numerals and highlights submitted days. Selecting a recorded day opens its read-only historical sheet. Month controls do not request future dates.
- Added authenticated `GET /v1/teacher/negaran/:classId/history?from=YYYY-MM-DD&to=YYYY-MM-DD` with strictly validated calendar dates, chronological bounds, at most 42 days, and a school-local non-future maximum. Teacher must be the **active Negaran today** for the class and current ACTIVE academic year; returned records are further bounded by that same assignment's start/end dates and school/year/class. Ordinary teachers and non-Teacher accounts have no access.
- The endpoint aggregates historical submitted/corrected attendance rows by day, returns per-status totals, submitted days, and an attendance percentage **(Present + Late) / all marks**. It does not expose individual student private information in history summaries. A date without submitted attendance is not misrepresented as absent.
- Android checks needed: Negaran Today → Attendance → mark all unmarked, adjust a student to absent, review totals/confirmation, submit/reload, History monthly summaries, tap past date/read-only, navigate months and Dari/Pashto RTL; normal Teacher, wrong-class and suspended-account denial; no date/role regression under airplane-mode caching/reconnect.
- Phase 4 requires **no new migration or dependency**; verified by automated CI and targeted authorization/history/bulk-mark tests once workflow completes.

- Historical read-only sheets now reconstruct the roster from the actual saved attendance marks, not today\'s current enrollment. Withdrawn/transferred students remain visible on the historical day they were marked. Added a dedicated regression for this alongside the API history summary check.
- Confirmation dialog explicitly displays the selected class and attendance date before the status breakdown, reducing accidental submission to the wrong class/day.


### Teacher Workspace Expansion — Phase 5: Lesson Planning, Curriculum Tracking and Reports (2026-10-13)

**Implementation in progress; Android acceptance pending.**

- Added school/admin-defined curriculum units scoped to the active academic year + class + subject, with unique order per class/subject. A Teacher cannot create or redefine the school's official curriculum. Teaching-unit progress is recorded against the authorized teacher assignment, separated from official marks and exams.
- Teachers now have a Teaching section on each authorized class detail, organized into Lesson Plans, Curriculum and Teaching Reports. Lesson plans record date, topic, learning objective, materials and notes; save/edit status Planned / Completed / Postponed. Optional links to school-created units ensure teachers cannot attach lessons to another class's curriculum.
- Subject-level curriculum can be marked Not Started / In Progress / Completed. Teacher-facing reports aggregate completed, postponed, planned lessons, unit progress, published/draft homework and continuous-assessment counts. Lessons, homework and assessments in reports use the requested date interval; unit-progress snapshot is explicitly current, not historical.
- New tenant-scoped API and database authorization checks require exact school, teacher, active year, class and subject assignment. Users cannot access colleagues' lessons/units/reports by guessing identifiers; write validation includes calendar-valid ISO dates, input limits, and class-aligned optional unit references.
- New migration `0016_teacher_teaching_plans.sql` creates the three tables and indexes. Requires `pnpm --filter @maktablink/database db:migrate` on the deployed development database before testing.
- Regression coverage validates school-only curriculum creation, duplicate position conflicts, cross-teacher denial, lesson creation and status updates, invalid dates, curriculum progress, and report aggregates. Real Android acceptance for Teacher class detail and admin browser curriculum requires manual verification before marking the phase closed.
- School Admin → Academics → Curriculum now has an authorized browser module to choose a class and subject in the selected active academic year, create official ordered chapters, and review chapters. The mobile Teacher curriculum tab deliberately cannot add official curriculum chapters.
- The lesson/academic reports backend and Android Teacher Teaching panel are wired through the class detail page. Status transitions and notes remain editable only by the assigned Teacher; reports are generated on demand for a selected date interval and do not publish official examination grades.

- School Admin curriculum controls now support editing title/order and deleting **unused** units. Deletion is blocked when a unit has a linked Teacher lesson plan or progress record; teacher authorship and audit events are preserved. Added API authorization and conflict regressions. Admin curriculum labels have Dari and Pashto translations.
- Teaching-period homework reporting uses school-local Asia/Kabul dates and the **actual publication timestamp** for Published/Closed homework, avoiding incorrect report assignment to the month in which the draft was created; draft counts use creation time. School curriculum progress figures remain the current per-assignment snapshot, which is stated in the UI.


### Teacher Workspace Expansion — Phase 6: Communication, Notifications, Productivity, and Resilient Drafts (2026-10-13)

**Implementation submitted to GitHub CI; Android acceptance outstanding.**

- Teacher notification inbox supports **Unread only** / **All notifications** views and a bulk **Mark all read** command. The server endpoint is authenticated Teacher-only and updates only the active user's notifications within their school; cancelled notifications and other users are unaffected.
- Teacher inbox refreshes when opened, from manual Retry, and when the app returns to the foreground. The last successfully retrieved inbox and Today learning summaries remain visible through isolated failed ngrok requests, reducing offline/online flicker. No high-frequency background polling was added.
- Teacher **Workflows → My personal tasks** and a Today quick action now provide private task tracking: create/edit/delete, optional due date picker, LOW/NORMAL/HIGH priority, OPEN/DONE progress, search and filters, retry/refresh. Server CRUD strictly limits access by school and authenticated teacher identity; no student, parent, admin, or other Teacher can see or mutate another Teacher's private task. The system caps persistent tasks at 300 per teacher.
- Unsaved **new-task form drafts** are stored securely on the Android device through Expo SecureStore under a school- and user-scoped key, restored after relaunch, and cleared after successful submission. Offline draft retention does **not** queue or imply server mutations; saving/editing/deleting requires a valid online session. Regular server GET cache fallback continues with the existing 7-day lifetime / 6000-character bound.
- This phase deliberately reuses existing School Admin contact and the Negaran-only class announcements permission model; no unrestricted teacher-to-parent messaging is introduced.
- Migration **0017_teacher_productivity.sql** creates teacher_tasks plus owner/status/due indexes, priority/status constraints, school/user foreign keys; run `pnpm --filter @maktablink/database db:migrate` before starting Phase 6.
- Automated API regression tests: tasks are private per teacher, teacher permissions apply, invalid due dates rejected, status reopen/update/delete persist, non-owner mutation denied, Teacher-only bulk notification acknowledgement.
- Android test: sign in Teacher, Workflows → My personal tasks, create/edit/complete/reopen/delete and search/filter; open Inbox and mark unread individually/all; use airplane mode while typing **new-task draft** and relaunch Expo Go, verify local draft restored and writes still require internet; verify app foreground inbox refresh and English/Dari/Pashto LTR/RTL; verify different Teacher sees no private tasks.


### Testing Step 13 — Attendance integrity and correction hardening (2026-10-13)

**Test 13 started:** Negaran supervised-class access, all four statuses, same-day corrections, Admin overrides, Parent state/alerts, idempotency/concurrency and tenant isolation. CI/API checks are not a substitute for Android acceptance.

- Active Negaran validation now also requires an ACTIVE academic year; stale year assignments cannot submit or open attendance.
- Attendance submits use transactional class/day row locking and conflict-safe first inserts. Exactly repeated submissions remain idempotent; actual stale edits with an optional `expectedUpdatedAt` revision return HTTP 409 instead of silently overwriting a correction.
- Android sends the revision and, on an attendance conflict, reloads the latest authoritative sheet and draft marks with a localized Dari/Pashto/English conflict notice rather than retrying the stale write.
- Omitted teacher notes preserve existing notes (including an Admin correction reason). Unchanged rows are not rewritten.
- Attendance-mark mutations and absence/late alert updates are atomic in the same PostgreSQL transaction. Read alerts are cancelled when a record is corrected to Present/Excused; switching back to Absent/Late reopens the deduplicated alert unread. Cancelled alerts cannot be marked read through the endpoint.
- Negaran initial submission/same-day corrections and Admin corrections now commit their audit events in the **same transaction** as marks/alerts. A failed audit insert cannot silently leave a changed attendance record, and no-op retries generate no new audit event. Added integration assertions for one audit per actual edit, correct actor, same-day correction, read alert cancellation/reopening, conflict rejection, and Admin note preservation.
- No new migration is required. Pending: CI confirmation and actual Android checks for two devices/sessions, school-local date boundary, airplane-mode retry, RTL, roster edge cases, and real push delivery.
- Calendar-valid date checks now cover Teacher sheets/submission, Parent history and Admin reports (as well as existing Negaran history), preventing malformed dates such as February 30 from reaching PostgreSQL as server errors. The attendance integration test now walks **all four states**: Absent, Present, Excused and Late.


### Testing Step 14 — Homework (2026-10-13)

**Implementation fixes and automated regression coverage added; Android pilot acceptance remains outstanding.** Detailed matrix: `docs/TEST-14-HOMEWORK.md`.

- Tested Teacher-only active assignment-derived class/subject/year creation, missing/invalid title/content, invalid/past deadline and HTTPS-only attachment links; unrelated Teachers and Parents cannot create/edit/publish.
- DRAFT content/attachment remains invisible to Parent/Student; draft edits are guarded by an SQL DRAFT condition, preventing an already-published item from being overwritten by a stale editor.
- Manual publication now changes lifecycle state, inserts academic-year/class-scoped deduplicated parent/student notifications, and writes an audit record **in one PostgreSQL transaction**. Repeated publish/close/archive requests cannot bypass the strict state machine and return a conflict.
- Scheduled publication now also creates its audit in the same transaction and verifies the recipients' academic year. This does not claim guaranteed timed delivery when the development API is offline.
- Published and closed homework cannot be edited (including file changes); close prevents new Student submissions while preserving Parent/Student read-only access.
- Archived homework disappears from Parent/Student academic feeds **per Product Specification V1**, but remains in Teacher history with historical submissions. Archived submission review is read-only. A Teacher can view archived submission history after the academic year is closed.
- Parent Homework displays published/closed status and supports an HTTPS link or authenticated attached-file open action with error feedback.
- Teacher actions now require localized confirmation before Publish/Close/Archive, and a concurrent status conflict refreshes canonical data rather than encouraging a duplicate mutation.
- Expanded API tests cover all 14.1–14.12 categories including sibling/class isolation, unauthorised roles, notification fan-out and acknowledgement, status transitions, historical read access and archive privacy.
- Run `pnpm verify` locally after pulling to repeat automated verification. Real Teacher/Parent/Student Android workflows, attachment opening, notification navigation, TalkBack/RTL and flaky-tunnel/airplane-mode manual checks still require device testing.


### Testing Step 15 — Exams, grades and results (2026-10-13)

**Implementation hardening and automated regression coverage delivered; Android/operator acceptance still pending.** See `docs/TEST-15-EXAMS-RESULTS.md` for itemized 15.1–15.12 checks.

- Added `0018_exam_subject_dates.sql`: optional historical but **required for new** class/subject exam schedule dates, strictly validated against real calendar days and the ACTIVE academic-year boundaries. Admin uses the existing Solar Hijri date picker, and Teacher/Parent/Student see localized subject exam dates.
- Exam creation is active-year and admin-only; subject creation requires teacher assignment matching school/year/class/subject. Exam subject configuration now acquires an exam row lock, preventing adding new subjects after progress to IN_PROGRESS; creation and subject-added audits commit in the same transactions as records.
- Teachers see only matching active class/year rosters. Grades are checked for integer score 0..configured max, duplicate students, cross-class student IDs, missing marks, and exam IN_PROGRESS. Draft saves lock the exam status in the transaction to serialize against RESULTS_READY. Identical draft saves avoid duplicate change audits.
- RESULTS_READY requires all active students to have valid DRAFT grades for every configured subject. Publishing revalidates roster completeness and atomically commits the exam, published grade rows, deduplicated class/year-scoped Parent/Student notification inbox entries, and audit. Concurrent re-publication / invalid lifecycle transitions are rejected.
- Parent and linked Student see only published marks, never draft or RESULTS_READY grades. Archived published exams remain accessible as historical results, while Teacher published/archived grade sheets are read-only.
- School Admin published-grade correction locks the affected row, validates range, reason, optional optimistic revision, rejects no-op/stale corrections, and atomically persists new score/remark plus previous/new audit values. Cross-tenant and non-admin edits remain denied.
- Added Parent per-exam total summaries derived from current published grade rows, matching the Student result view; two-subject regression covers 88/100 + 40/50 = 128/150, then correction to 91/100 updates both to 131/150.
- Expanded PGlite/Fastify integration test cases include exam setup validation, permission/school isolation, roster, missing-grade rejection, publication privacy, results after archive, correction reason/audit integrity, and notification idempotency.
- **Device acceptance still outstanding**: real Android Teacher/Parent/Student flows, browser calendar, RTL, live push, offline/reconnect, school year transitions. Run the migration before API startup.

- Follow-up compatibility hardening: older exam subject rows with NULL date can be repaired through the Admin **Update exam date** Solar Hijri form, backed by `PATCH /v1/admin/exam-subjects/:examSubjectId/date`. The endpoint is Admin-only and school/year scoped; it locks the exam, accepts dates only while DRAFT/SCHEDULED, validates actual year boundaries and audits previous/new dates atomically. Added API coverage for legacy date repair, invalid date, unauthorized Teacher and after-start rejection.


### Testing Step 17 — Fees & Payments (2026-10-13)

**Implementation and automated tests delivered; browser/device/production PostgreSQL acceptance remains outstanding.** See `docs/TEST-17-FEES-PAYMENTS.md`.

- Admin invoice issue/cancel, payment and reversal operations use PostgreSQL invoice row locks, so payments cannot silently overpay during simultaneous writes; financial records and actor audit entries commit in a **single transaction**.
- Creation and issue reject withdrawn pupils; DRAFTs remain private from learners, and all paths are school-scoped. Existing Parent/Student fees require the actively linked student.
- New migration `0019_fee_payment_idempotency.sql` adds an optional per-school/invoice UUID payment retry key. The browser reuses the key across a lost response while fields are unchanged. Repeat POST is a no-op; mismatched payload with same key returns 409.
- Completed/cancelled invoices cancel prior queued fee reminders, and inbox/push routing revalidates outstanding balance and current active parent-student ownership. Scheduler skips withdrawn students.
- Expanded store and API regression tests cover validations, read scopes, transitions, overpayments, idempotent retries, reason-required reversal, audit counts, and reminder idempotency. The bank/cash entries remain school-recorded manual transactions; no online payment processing.
- A cancelled pre-due reminder's original deduplication key is not reissued after a later payment reversal; overdue reminders use a separate key. Consider a versioned campaign if repeated pre-due notification cycles are required.
- Apply `pnpm db:migrate` then `pnpm verify`. Manual double-Admin PostgreSQL concurrency, date-boundary, finance-office reconciliation, real push, RTL and Android acceptance still required.


### Testing Step 18 — Subscriptions, Pilot Onboarding and Release Readiness (2026-10-13)

**Automated regression coverage expanded; deployment and physical-device acceptance remain outstanding.** Matrix: `docs/TEST-18-SUBSCRIPTIONS-PILOT.md`.

- Pilot onboarding now creates school, settings, subscription, first admin and audit in **one database transaction**. A failed insert cannot strand a partially onboarded school; duplicate schools still return a conflict.
- Subscription updates now validate the merged persisted date timeline when only one field is supplied. CANCELLED subscriptions cannot be reactivated by patch.
- Pilot readiness now counts active administrator/Teacher/Parent accounts, active enrollments, active-year classes and active-year Teacher assignments. INVITED/SUSPENDED/ARCHIVED accounts and historical classes no longer falsely satisfy the checklist.
- Subscription reminders now require an active admin recipient and use database conflict handling instead of a race-prone select-then-insert. Scheduler transition counts reflect successful conditional status changes.
- `verify-parent-resilience.mjs` no longer asserts a stale comment marker after the ngrok reconnect refactor; it inspects the actual cache/network handoff inside `retryServiceConnection`.
- Added Step 18 API regressions for platform provisioning key, invalid onboarding, duplicate school protection, subscription date changes, cancelled reactivation and active-admin readiness count.
- **Pending:** latest GitHub CI, browser/Android pilot flow, production PostgreSQL concurrent cron test, EAS push receipts, external metrics, encrypted backup/restore drill, and real school operator acceptance.


### Testing Step 19 — Local Deployment and Database Diagnostics (2026-10-14)

**Started; source and CI checks only until local Git and database connectivity recover.** See `docs/TEST-19-ENVIRONMENT-DEPLOYMENT.md`.

- User's `git pull origin main` failed with GitHub HTTPS connection reset. Consequently the original local `verify-parent-resilience.mjs` is still in place, and its stale comment-marker assertion fails. The corrected reconnect-verifier code was already merged in Step 18 and passed GitHub CI.
- The user's migration command exited during Drizzle's applying-migrations spinner without exposing a SQL/PostgreSQL reason. Root cause **not established** from the available output; no schema reset, shadow migration, or destructive workaround performed.
- Added a safe `pnpm db:check` command that validates the configured PostgreSQL URL, attempts a read-only connection, reports the current database/schema and migration-journal count, and classifies common connection errors **without printing secrets**.
- Added an offline regression ensuring an invalid `DATABASE_URL` fails and the supplied secret remains absent from logs. The test runs in the regular verification chain and syntax checks in CI.
- Documented a fail-fast PowerShell sequence so Git fetch failures cannot silently lead to migrations and verification against an out-of-date working tree.
- Remaining local acceptance: successful pull, live `db:check`, migration, full `pnpm verify`, Android/web functionality and non-production backup/restore practice.

- **2026-10-14 Step 19 user-local follow-up:** GitHub pull successfully fast-forwarded to Step 19 head, but `pnpm db:check` reported Neon `CONNECT_TIMEOUT` from the pooled endpoint. The fail-fast PowerShell guard properly skipped migration/verify. No migration defect or credential fault is yet established.
- **Step 19 connectivity hardening:** Increased database preflight connection startup allowance to 30 seconds, added a specific CONNECT_TIMEOUT diagnostic, and added an optional `DATABASE_URL_UNPOOLED` that Drizzle migration prefers. Neon direct connection is recommended for schema migration, while the application keeps its pooled runtime URL. The diagnostic checks both URLs (when supplied) without printing secrets. User still needs to confirm local TCP/5432 and Neon dashboard status and to supply the true direct URI from the provider; hosted connectivity cannot be repaired from GitHub.

- **2026-10-14 Windows regression testing:** User-local `pnpm verify` ran API tests and reported 3 failures despite green Ubuntu CI. Reproduced with a new GitHub Actions Windows / Node 24 job. Fixed the test's invalid dotted parent username without weakening the application's alphanumeric username policy. Hardened Drizzle nested PostgreSQL unique-constraint error handling to return 409 instead of 500 for duplicate exam and school onboarding, with dedicated helper regression tests.
- **Critical CI coverage gap corrected:** Unquoted `src/**/*.test.ts` was expanded by Ubuntu Bash to only nested test files, skipping root `apps/api/src/app.test.ts`; Windows executed the full test suite. Quoted TypeScript test globs across workspace packages; added Windows / Node 24 API regression job. See `docs/TEST-19-ENVIRONMENT-DEPLOYMENT.md`. Exact full suite validation pending latest CI results and local user rerun.


### Testing Step 20 — Full regression and release readiness (2026-10-14)

**Source-level implementation and automated regression expanded; production release decision: NO-GO until required live acceptance passes.** See `docs/TEST-20-FULL-REGRESSION.md` (20.1–20.20 matrix) and `docs/RELEASE-READINESS-STEP20.md`.

- Confirmed successful pre-Step20 full Linux + Windows/Node24 CI after Step19; verified previously failed provisioning/academic/exam tests remained green (54 API, 16 database tests at pre-Step20 baseline).
- Fixed the public landing page's outdated Phase 3 text asserting Parent/Student onboarding and attendance were not implemented. Updated current capability descriptions with semantic page headings.
- Added `packages/database/src/migration-chain.test.ts` to replay **every** migration in the versioned Drizzle journal (20 at creation), including the previously omitted assignment unique-index migration, and inspect fee idempotency/exam subject date/assignment constraints. PGlite CI run at `8e5f6d10` passed (54 API / 17 database tests). **This is not proof of hosted Neon migration success**.
- Added executable `pnpm verify:release` evidence index and integrated into local `pnpm verify` and both CI operating systems. CI now explicitly runs parent localization and offline/reconnection checks rather than omitting them in Linux build jobs.
- Confirmed the existing session authenticator already refuses access and refresh tokens for INACTIVE schools and ARCHIVED accounts (HTTP 401 invalid session); added a real API regression covering Active→Inactive→Active and archival, retaining the existing authorization contract. No security bypass was established.
- Hardened `AccountStore.createUser` duplicate username handling with nested PostgreSQL `23505` cause detection, matching the Step 19 exam/school store fixes. Added API coverage of 409 same-school duplicate Teacher accounts and same username permitted in another school.
- Retained full cross-role, fee reversals/retry, exam publication, homework privacy, notification audience, attended Negaran and subscription lifecycle integration tests. Tests now use the same quoted glob discovery on Ubuntu and Windows.
- **Unverified / release blockers:** user's external Neon `CONNECT_TIMEOUT` unresolved at last report; real DB migrations, Android/web keyboard/TalkBack/RTL/responsive smoke, real push, external schedulers, monitoring, encrypted off-host backup/restore, concurrency and operator sign-off. Automated passing must not be interpreted as production acceptance.


### Admin pilot onboarding presentation refresh (2026-10-14)

- Updated the Admin `/admin/pilot` Pilot operations **Onboarding checklist** visual treatment without changing provisioning rules, API requests, authorization, exports or checklist pass/fail logic.
- Added a compact, accessible native progress meter derived from the returned readiness checks, with a completed/total label and visible passed/pending states.
- Introduced light, readable onboarding status cards and subtle subscription/summary hierarchy; cards collapse to one column for narrow screens with phone-specific layout protection.
- Localized the new progress labels in Dari and Pashto, retaining English and RTL layout; preserved reduced-motion support.
- The release static regression gate now checks source markers for localized, accessible progress and responsive cards.
- Latest GitHub CI and actual browser screenshots/visual acceptance are required before claiming device-level confirmation.


### Admin Accounts — Phase 1: Directory-first layout and styling (2026-10-14)

- Implemented `/admin/accounts` directory-first screen with four selectable account summary cards (total, active, pending setup, suspended), filter synchronization and current-school directory counts.
- Added Account directory / Create account view selector: wide desktops show the selected creation form beside the directory; tablet/phone view shows one selected panel at a time. The directory is selected by default.
- Refined the role-colored account identities, status badges, input labels, keyboard focus and scroll/overflow handling in English, Dari and Pashto with RTL support.
- Corrected parent/student account username placeholders to match the already-enforced alphanumeric-only family username contract; no backend validation or permissions were changed.
- Added a source-level `pnpm verify:release` guard and `docs/ADMIN-ACCOUNTS-PHASES.md` acceptance guide. Follow-on details, credential safety, lifecycle and pagination work remain for Phases 2–6.
- CI checks and browser visual acceptance are tracked separately; this styling phase adds no database migrations.


### Admin Accounts — Phase 2: Guided provisioning and one-time credentials (2026-10-14)

- Added inline role-specific username, parent-name/phone, existing-school duplicate, and student eligibility validation aligned with the current API contracts. The API retains final authority and unchanged access restrictions.
- Added clear parent, student, teacher, staff and admin form guidance. Student selection now explicitly requires an eligible active/unlinked student; students can be searched by name, code and class.
- Replaced raw temporary password text with an ephemeral, concealed-by-default credential panel. Admin can reveal/hide, copy username/password, or close and discard; the panel receives keyboard focus upon creation and is not backed by local/session storage. The browser clipboard may retain copies; the UI includes a warning and an unavailable-clipboard fallback.
- Extended English/Dari/Pashto translations; added executable client-rule regressions in the API's cross-platform test suite and release source gates.
- Retained school-scoped provisioning endpoints and existing reset/suspend/reactivate security rules; no migrations. See `docs/ADMIN-ACCOUNTS-PHASES.md`.
- Actual browser, clipboard, and screen-reader visual acceptance remain user/operator checks; confirm exact-commit CI separately.


### Admin Accounts — Phase 3: Account details and related records (2026-10-14)

- Added `View details` on each Accounts directory entry, opening a modal side drawer with keyboard focus containment, Escape/backdrop dismissal, focus restoration, and RTL-aware desktop/mobile layout while retaining directory search, filters and selection.
- Read-only account metadata now includes username, role, status, creation date, last login and password-setup state, with a clear missing-value presentation.
- Parent and student details join only the specifically linked family records returned by the existing school-scoped Families overview. Teacher details lazily fetch the existing admin Academic overview and filter teaching and Negaran assignments to that teacher.
- Offered contextual reset/suspend/reactivate controls subject to existing current-admin and archived restrictions, and links into canonical Families / Teacher Profiles / Teacher Assignments / own Admin Profile pages. No new cross-role edit endpoint or duplicated family/teacher editing logic.
- Added pure association tests in `apps/api/src/account-details-data.test.ts`, localized UI copy in English/Dari/Pashto, and release source-gate assertions for details, focus and safe relationships.
- No migrations. Manual cross-role/browser RTL and accessibility acceptance remains outstanding. See `docs/ADMIN-ACCOUNTS-PHASES.md`.


### Admin Accounts — Phase 4: Account lifecycle security and audit trail (2026-10-14)

- Added accessible reset/suspend/reactivate confirmation dialogs to the directory and account-details actions, including optional validated suspension reason (3–500 characters if supplied), Dari/Pashto strings and responsive styling.
- For school-admin suspension and reactivation, access and refresh tokens are revoked atomically along with account status transitions in the database. Generic status setter also invalidates sessions for account lifecycle changes; old sessions do not become valid again after reactivation. Suspended users may sign in to a *restricted* session for admin-contact access, but must reauthenticate after reactivation.
- Added `GET /v1/admin/users/:userId/audit` with authenticated school-admin authorization, same-school target validation, bounded result set and safe selected fields (no raw metadata/password data). Audit includes user and linked family/student account events, action, actor, timestamp and optional suspension reason.
- Added lifecycle conflict responses for duplicate suspensions, non-suspended reactivation, archival limits, with existing self-action restrictions preserved.
- Account details drawer now shows the user's account-specific activity history, actor label and reason, with explicit loading, failure and empty states.
- PGlite and API regressions cover token invalidation, login after reactivation, audit reason and school isolation; release evidence source assertions and translations added.
- No database migration is required; browser/device/manual acceptance is not established by passing CI. Full checklist in `docs/ADMIN-ACCOUNTS-PHASES.md`.


### Admin Accounts — Phase 5: Paged directory, sorting and safe bulk management (2026-10-14)

- Added a new admin-only `/v1/admin/users/directory` for school-scoped server-side filtering, escaped case-insensitive search, role/status/pending filtering, deterministic sorting, bounded 10/20/50 pagination and all-school summary counters. The legacy `/v1/admin/users` response is retained for other modules.
- Refined the Accounts screen with debounced/cancelable queries, sort controls, pagination, retry/refresh, accurate total counts and visible-page-only selection, with Dari/Pashto/English support and responsive RTL styles.
- Added a school-only case-insensitive username availability route to preserve new-user validation after moving off the full-school directory fetch. Family records are loaded only when a selected account or Student creation requires them.
- Added atomic admin-only `/v1/admin/users/bulk-status` for suspend/reactivate of up to 20 non-admin, non-self, non-archived, eligible accounts. Cross-school IDs, invalid/mixed states and duplicate IDs abort the entire batch; auth tokens are revoked and per-user audits written within the database transaction.
- Added explicit multi-account confirmation with optional audited suspension reason, selection caps, and clearer account-audit actor usernames when the actor is on another directory page.
- Added PGlite and API integration regressions for tenant isolation, filters/paging/sort, wildcard search, username checking, lifecycle/audit and all-or-nothing batch behavior, plus release source guards.
- No migrations; browser/device/manual school-scale acceptance is still required. See `docs/ADMIN-ACCOUNTS-PHASES.md`.


### Admin Accounts — Phase 6: Regression and network/tenant safety (2026-10-14)

- Hardened admin Accounts against stale network search responses and account leaks when switching session/school: accepted directory responses are bound to the active access token and current user search intent; old-school data is gated before UI rendering; family data is bound to the same active session; account dialogs, credentials and selection are cleared upon session changes.
- Centralized and unit-tested visible-page selection eligibility, maximum 20 selected accounts and cancellation of aborted/foreign-session response updates. The page-select checkbox is disabled when >20 eligible rows are visible; individual selection remains possible up to the cap.
- Expanded API integration tests for non-admin and first-login users, school-isolated directory and audit reads, invalid paging/sorting/batch parameters, literal wildcard search, foreign-school bulk rollback and role authorization.
- Added `pnpm verify:accounts` source/regression gate covering both Dari/Pashto translations, template placeholder parity, UI accessible role/selection/dialog behaviors, RTL/mobile/reduced-motion CSS and client/session safety invariants, executed in Ubuntu and Windows CI.
- Full acceptance checklist: `docs/TEST-ADMIN-ACCOUNTS-PHASE6.md`. Automated test success does **not** establish actual browser/Android/screen-reader/200%-zoom behavior or live Neon/production readiness. Existing Step 20 release NO-GO remains until operator sign-off.
- No migrations or destructive changes to existing school account records.


## Pilot Operations Phase 1 — navigation and Overview (2026-10-14)

The Pilot Operations workspace now has Overview, School Readiness, Data Onboarding, Subscription, Audit & Exports, and Launch & Support routes. Overview uses existing school-scoped readiness counts/checks, shows pending configuration with navigation to owning modules, and distinguishes automated setup readiness from the unverified production launch gate. Readiness, subscription, existing CSV templates, safe JSON export and audit pagination remain available on dedicated routes. Billing is read-only for school administrators. English/Dari/Pashto navigation and responsive/RTL styles are included, with \`pnpm verify:pilot\` in Linux/Windows CI. No schema migration or new backend API was required. Real-device/browser and deployment acceptance remain pending under Step 20. See \`docs/PILOT-OPERATIONS-PHASES.md\`.

## Pilot Operations Phase 2 — intelligent readiness (2026-10-14)

The existing `/v1/admin/pilot/readiness` remains backward compatible. An advanced read-only school-admin endpoint computes seven active-year configuration coverage metrics and critical/warning status entirely from school-scoped PostgreSQL queries using EXISTS and aggregate counts. A second validated, page-limited endpoint returns only the authenticated school's missing records for the selected metric. Teacher coverage, timetable matching, currently effective Negaran, family-account accessibility, student activation, and login completion are reported without treating empty populations as 100%. Overview does not mark enhanced configuration ready if critical coverage fails. UI displays grouped severity, progress, missing-record drilldowns and links to existing owner modules. No migration or subscription write privilege changes. Production launch approval is deliberately not inferred; Step 20 NO-GO remains until live evidence. Tests and source-level regression guard: `pnpm verify:pilot:phase2`.

## Pilot Operations Phase 3 — guided data onboarding and history (2026-10-14)

Introduced `0020_pilot_import_history.sql` and a transactional import-batch ledger scoped by school and unique idempotency key. The existing Families CSV/XLSX mapping-validation-commit route now records completed operations atomically with parent/student/teacher account creation, optionally accepts a stable UUID retry key, preserves legacy callers, blocks different payload reuse, and never stores or replays temporary credentials. History tracks successful imports, rejected validation and failed commit outcomes by counts, school and actor, not uploaded rows. Pilot Operations Data Onboarding displays guided step status from the existing readiness service plus filtered paginated history. Automated PGlite/API cases and static gates are in `pnpm verify:pilot:phase3`. Run `pnpm db:migrate` against a backed-up DB before deploying the new API; Step 20 live acceptance remains NO-GO.

## Pilot Operations Phase 4 — safe audit and exports (2026-10-14)

Audit & Exports supports school-admin-only action/category/actor/date search and paging, resolved actor/affected-account labels, human-readable audit details with metadata allowlisting, confirmed core JSON export and formula-safe filtered CSV event export. The raw audit metadata surface in the legacy /v1/admin/audit and core export is narrowed to explicitly safe scalar fields. Core school reporting exports redact contact/payment references and stop at 1,500 rows per collection / 5 MiB; oversize results fail explicitly with 413, without truncation. File issuance is audited before response and blocked on audit logging failure. No database migration. Existing production Step 20 release evidence remains outstanding.

## Pilot Operations Phase 5 — subscription health and alerts (2026-10-14)

Implemented `GET /v1/admin/pilot/subscription/health` using the authenticated school subscription; added a Kabul-civil-date evaluator covering TRIAL/ACTIVE/PAST_DUE/GRACE/SUSPENDED/CANCELLED, date countdowns, status-reconciliation flags, urgency levels and next existing notification threshold. School Overview and Subscription pages show compact/full health and read-only support guidance with retry/stale-response protection, English/Dari/Pashto text, Solar Hijri date display, responsive RTL CSS. The existing idempotent 30/14/7/1-day reminder scheduler now uses Kabul date and deep-links to `/admin/pilot/subscription`. No billing/payment/renewal/support writes, new migration or claim of notification delivery or go-live approval. Automated guards `pnpm verify:pilot:phase5` and database/API regressions; Step 20 manual gates remain.

## Pilot Operations Phase 6 — launch evidence, ticketing and platform-only sign-off (2026-10-14)

Added school-scoped launch evidence and support ticket persistence, append-only support responses, explicit privileged platform review and recorded launch decisions/history via `0021_pilot_launch_support.sql`. All school evidence starts SUBMITTED and can only become VERIFIED by the platform; operator approval requires all five categories VERIFIED, no critical unresolved ticket, and current configuration readiness. New submissions/critical tickets invalidate previously granted approval transactionally, all changes audited. School UI provides evidence and support workflows only, without platform approval controls. All full deployment/go-live Step 20 tests, actual backup/restore and device evidence still require independent operator signoff; product launch records do not waive release gates. Apply migration before deploying. Tests: `pnpm verify:pilot:phase6` plus cross-school/authorization PGlite API regressions.
The Phase 6 API distinguishes historic platform approval from current effective approval: effectiveApproved requires ongoing configuration readiness, verified evidence and no unresolved critical tickets, preventing stale approval labels if the school later loses readiness.

## Pilot Operations Phase 7 — cross-role regression and release acceptance (2026-10-14)

Added school-scoped read-only `/v1/admin/pilot/release-readiness` and a real Launch & Support Step 20 view: twenty human acceptance items UNVERIFIED, platform pilot approval separate, and production NO-GO even with all automated checks green. Backend model/unit+tenant API regression, responsive RTL/Dari/Pashto + keyboard labels and stale-session fetch guards. Added offline SHA-bound operator manifest evaluator `scripts/phase7-release-report.mjs`, with eleven external gates, strict/missing/stale/credential sanitization tests; even complete operator-submitted references can only reach READY_FOR_INDEPENDENT_RELEASE_REVIEW (not GO). CI Ubuntu/Windows gates and NO-GO artifact per run. `docs/PHASE7-RELEASE-ACCEPTANCE.md` records mandatory live external acceptance. No new DB migration. Step 20 remains NO-GO until independent evidence and operator signoff.

## Parent Experience Phase 1 — navigation and parent data-isolation foundation (2026-10-14)

Reorganized Parent bottom tabs Home/Academics/Attendance/Inbox/More with contextual child switcher across every tab and nested Academics Homework/Results/Timetable and Inbox Announcements/Notifications. Preserved existing parent API/auth, attendance/home summaries, published homework/grades, announcements, fees and contact/logout. Added actual timetable list, separated Results from More financial content, fee notification target distinct from results, account-scoped and child-scoped stale-response protection, invalidation on logout, and independent communication/fee loading. Localized new UI labels into English/Dari/Pashto, retained RTL and Solar Hijri. Added Phase 1 static safety guard and CI. No database migration. Parent Phase 2–7 improvements and live-device/Step 20 release acceptance remain outstanding.

## Parent Experience Phase 2 — actionable Home dashboard and data-isolated retry (2026-10-14)

Implemented interactive Parent Home destination cards (Attendance, Academics Homework/Results/Timetable, Inbox and More fees), genuine prioritized attendance/homework/fee/unread alerts, Kabul civil-day due calculations, no dummy examination schedule card, compact Home identity and 3-item inbox preview. Independent per-resource pending/success/error status + retry and refresh, latest-generation request guard for parallel same-child refresh, stale-token/child invalidation and error-state-based unknown values. Added 3-language strings, typed model unit tests, static guards and CI. No new migration. Real Android/TalkBack/Step 20 proof still pending; production NO-GO.


## Parent Experience — Phase 3: Attendance calendar and recorded-only statistics (2026-10-14)

- The Parent Attendance tab displays a Saturday-first calendar, with Gregorian months for English and Solar Hijri months for Dari/Pashto.
- Dates show actual parent-authorized records only; future dates are disabled and days without school records are explicitly *not recorded*.
- Month navigation fetches the requested month using the existing school-scoped / parent-child-authorized attendance API (`from` / `to`); Home keeps its 30-day default read. Child/account switching and component cleanup prevent stale responses.
- Month summary counts Present, Absent, Late, Excused, and recorded days. Attendance percentage = (Present + Late) / (Present + Late + Absent); excused, unrecorded, and future dates are excluded, and a zero denominator displays an unavailable rate.
- Day details reveal date, actual mark, class, and school note; the month also has a chronological, selectable marked-day history with note previews. Parents cannot edit marks.
- API and schema unchanged apart from optional range arguments in the mobile API client; **no database migration**.
- Automated verification: `pnpm verify:parent:phase3`, integrated into `pnpm verify`. Device/TalkBack/offline/multi-child acceptance must still be run; production Step 20 remains NO-GO until evidenced.
- Phase 4 next: deeper Academics homework/result/timetable organization, filtering and details. Other remaining parent phases: Inbox (5), Account/Finance (6), and device/regression acceptance (7).


## Parent Experience — Phase 4: Parent Academics (2026-10-14)

- Parent Academics now provides three enhanced child-scoped views: Homework, Published Results and Timetable.
- Homework: subject/search and due/status filters, expandable instructions and attachment controls; excludes drafts/archived, and does not claim submission completion without a submission source.
- Results: released/archived exam grouping, exam/subject filters, expandable subject scores, exam dates and teacher notes; totals reflect only the currently shown published marks.
- Timetable: actual weekly day selector (Saturday-first), Whole Week/subject filters, class periods in scheduled time order, real teacher names. No invented future exam timetable.
- The existing backend `GET /v1/parent/children/:studentId/learning` and timetable endpoints remain authoritative for parent-child, school and publication access. Phase 4 does not add new API, mutations or database migrations.
- Existing child/role/session request-generation guards remain. The UI also gates resources by selected-child identity, resets child-specific filter state on component remount and offers targeted retry when learning or timetable fails independently; each Academics subtab also has manual refresh for newly published or corrected data.
- New copy in English, Dari, Pashto. New tests `scripts/test-parent-academics-model.test.ts` and guard `pnpm verify:parent:phase4` (CI Linux + Windows, monorepo `pnpm verify`).
- Android multi-child, accessibility, offline/retry, date boundary, and published-versus-draft visibility must be accepted by a human before production Step 20 can be GO.
- Next Parent work: Phase 5 Inbox search/filter/pagination/deep links, Phase 6 Account/Finance and Phase 7 device/full regression acceptance.


## Parent Experience — Phase 5: Account-scoped Inbox and exact destinations (2026-10-14)

- Parent Inbox now has independently recoverable Announcements and Notifications subtabs with search, audience/topic/read-state filters, and 20-at-a-time client-side display pagination. Back-end endpoints still provide authorized complete lists; network payload size is not yet paginated.
- Announcements are restricted in the UI to the currently selected linked child's class, school-wide or parent-role audience; published/archived filtering is still enforced server-side. Notifications are account-wide and can refer to a different linked child.
- Read/unread totals are derived from the authenticated server's readAt markers. Opening alerts uses existing mark-read APIs; Mark All Read is serialized with visible failure feedback and no assumed success on failure.
- Known deep links focus an existing announcement, published homework, published exam, attendance date, or authorized linked child's fees. The app validates UUIDs and dates, and never treats notification IDs/metadata as permission grants or opens arbitrary external URLs.
- Parent Home's session guard handles push links delivered before child-list readiness. Explicit navigation, child switching, account changes, and logout clear queued/focused content; no cross-child details can be displayed by a stale response.
- Existing communication routes, database schema and cross-role notification APIs remain unchanged. Added `scripts/test-parent-inbox-model.test.ts` and `pnpm verify:parent:phase5` to CI.
- Human acceptance still required: multi-child school/class audience isolation, old/archived target behavior, >40-item paging, untrusted URLs, Android deep-link cold start, offline read failure, RTL and TalkBack. Step 20 remains **NO-GO**.
- Next Parent phases: Phase 6 Parent account/profile/finance preferences; Phase 7 device/full regression and production release evidence.


## Parent Experience — Phase 6: More account, fees and preferences (2026-10-14)

- Parent More now exposes four subtabs: Fees (default), Profile, School and Preferences, with explicit notification/dashboard routing back to Fees.
- Fees are child-scoped using the existing school/parent-authorized endpoint. Added an issued/paid/outstanding summary excluding cancelled/draft rows, invoice state filters, expandable payment/reversal ledger, independent loading/failed/retry and refresh. This is **read-only school ledger information**, not a payment gateway.
- Profile shows official parent full name/username/phone and linked children/class/year; school-manages verified identity, profile edits and family links.
- School shows authenticated school details and existing administrator contact actions.
- Preferences reuses saved English/Dari/Pashto device language choice and adds current/new password change via the existing audited authenticated `POST /v1/auth/change-password`. Client validates strength/confirmation, server verifies password, and the successful returned session replaces the current parent's session and secure storage. Admin-only password 2FA remains unchanged.
- All new text localized to English/Dari/Pashto with RTL support, positive error/empty/validation status and logout confirmation.
- Phase 6 tests: `scripts/test-parent-more-model.test.ts` and `pnpm verify:parent:phase6` in Linux/Windows CI and monorepo verify.
- No database migrations. Real Android finance, cross-child isolation, password rotation, offline/retry, RTL and accessibility verification remains pending. Production Step 20 is **NO-GO**.
- Next: Parent Phase 7 full end-to-end and device/regression acceptance, while keeping pilot release and exact-build evidence constraints.


## Parent Experience — Phase 7 automated acceptance and Android runbook (2026-10-14)

- Parent Phases 1–6 workflows are now covered by individual model/source checks and new Phase 7 integrated real Fastify/PGlite API tests across two parent accounts: forbidden foreign timetable/attendance/learning/fees, authorized own invoice history, published-only invoice visibility, and password change with old-token rejection.
- Fixed a same-account session race: mobile password-change and refresh results check exact access/refresh tokens, user, tenant and school; old refresh cannot replace or revoke the new credentials, and logout blocks late installation.
- The More subnavigation scrolls at small widths with auto-focus for its four tabs and preserves existing two/three-tab navigation and localized RTL.
- Automated evidence checks added in `pnpm verify:parent:phase7`, CI (Linux/Windows) and a conservative Android manual readiness report `scripts/parent-phase7-acceptance.mjs`. The source of truth for 16 manual scenario gates is `docs/PARENT-PHASE7-ANDROID-ACCEPTANCE.md`.
- Actual Android devices, TalkBack, unreliable public tunnel, real multi-school credentials, push cold-start, backup/restore, payment concurrency and independent Step 20 operator sign-off **have not been executed or verified by automation**. Parent Phase 7 device status is **NOT_RUN**, and production status remains **NO-GO**, regardless of passing CI. No migrations.


## Admin Communication & Fees — Phase 1 (2026-10-14)

- Admin `/admin/communication` reorganized into **Overview / Communication / Fees** subtabs. Overview is default; the two creation/management workflows retain their working endpoints and are not lost in a long mixed page.
- Issued-only school financial KPIs exclude cancelled and draft invoices and show issued billed, net paid, collectible outstanding, overdue balance, unique students owing, and defined collection rate; nothing here claims online payment capture or bank reconciliation.
- Desktop provides <=600px creation and list panels side by side; tablet and mobile select List or Create with single-pane layout. RTL and navigation focus are retained.
- Communication, Families and Academics requests now load/retry independently with access-token identity and request-generation stale-response guards; unrelated failure does not blank school communication/fee listings. Admin fetches reuse standardized API error handling. HTML form references remain stable across async requests.
- Added pure model tests, static verification and English/Dari/Pashto labels in `pnpm verify:admin-communication:phase1`, plus Linux/Windows CI.
- Remaining seven-phase roadmap is `docs/ADMIN-COMMUNICATION-FEES-PHASES.md`; next Phase 2 is Announcement list, recipient preview, scheduling, status filters and search.
- Real browser, RTL, slow-session/manual school-ledger comparison and Step 20 pilot/production acceptance evidence are still pending. **Production NO-GO**. No migration required.


## Admin Communication & Fees — Phase 2 (2026-10-14)

- Announcement list under Communication now has title/body search, All/Published/Scheduled/Archived and school/class/role filters, a real class-name display, expandable complete records, status badges, 20-at-a-time client display paging, a proper zero-match state, and archive confirmation.
- Added `POST /v1/admin/announcements/recipients/preview` accessible only to the authorized School Admin. It runs the **same store recipient resolver** as actual publication and returns only a school-tenant-scoped aggregate count and the school's stored timezone; role-class intersections, suspended/withdrawn status and deduplication remain server-authoritative. No notification or announcement is created by preview.
- Explicit immediate vs scheduled publication; scheduled civil time is converted in the school's IANA timezone, rejecting invalid/nonexistent times instead of relying on the web browser's timezone. Existing immutable published lifecycle and audited scheduled editing remain.
- Existing overview endpoint still retrieves full authorized announcement records; UI paging is display-only (not server network pagination). Persistent DRAFT workflow, delivery/read analytics and full backend pagination remain out of scope and are not presented as implemented.
- English/Dari/Pashto RTL, preview states, timezone labels, confirmation, localized counts and source/integration/unit regressions included in `pnpm verify:admin-communication:phase2` and CI.
- Real browser/device testing, manual preview/recipient comparison, DST/school-zone edge cases and independent Step 20 review remain **NOT RUN / NO-GO**. No schema migration.
- Phase 3 next: invoices, status filters, draft editing, safe numbering and invoice detail workflows.

## Admin Communication & Fees — Phase 3 (2026-10-14)

- Fees directory now uses `GET /v1/admin/fees/invoices` with server-side authorized pagination (20/page), name/code/description/invoice-number search, status/academic-year/class/student filtering and independent loading/error/retry. Expanded invoice details preserve the existing payment/reversal ledger.
- New migration `0022_fee_invoice_numbers.sql` backfills immutable per-school sequential invoice numbers and establishes a transactional school-local allocator with unique school-number index. Run `pnpm db:migrate` on the target PostgreSQL database **before deploying the new API**.
- Only `DRAFT` invoices can change student, amount, description or due date: audited `PATCH /v1/admin/fees/invoices/:invoiceId` with row locks, expected updatedAt token, school identity checks and active student rule. Issues and cancellations now have confirmations.
- Existing financial balances, tenant boundaries and parent/student invoice visibility are preserved. The full overview endpoint still aggregates authorized invoices on read; targeted server-side summary work is deferred.
- Unit/integration tests and guard script added to `pnpm verify:admin-communication:phase3` and Linux/Windows CI. Exact deployed PostgreSQL migration, RTL small-screen browser checks, external payments and production Step 20 operator signoff remain **NOT RUN / NO-GO**. Phase 4 next: payment method selection, per-student balances and printable receipts.


## Admin Communication & Fees — Phase 4 (2026-10-15)

- Fees workspace now has **Invoices / Payment history / Student balances** subtabs. The invoice creation/list, payment and immutable reversal endpoints remain available.
- Payment form now offers fixed Cash / Bank transfer / Mobile money / Other choices, positive whole-AFN validation against displayed outstanding, and an explicit student/invoice/amount/payment-method confirmation before POST. Server-side row locking, amount constraints, audit history and lost-response idempotency remain authoritative.
- New admin-only `GET /v1/admin/fees/payments` lists 20 immutable ledger transactions/page with school-local date, kind, method, student and recorder-username filters. Receipt lookup is admin-only at `GET /v1/admin/fees/payments/:paymentId/receipt`; original receipts are marked void if reversed and show **current outstanding**; PDF output is through browser Print / Save as PDF, not server signing.
- New school-scoped `GET /v1/admin/fees/students/:studentId/balance` computes billed, paid, outstanding, overdue and invoices directly from issued invoice/append-only payment data, excluding draft and cancelled invoices. A student with no issued invoices has a zero balance.
- Tests exercise payments, reversals, payment filtering, receipt status, cross-school isolation, parent-role rejection and student ledger invariants, with `pnpm verify:admin-communication:phase4` source/localization guards in CI. **No Phase 4 schema migration**; Phase 3 migration `0022_fee_invoice_numbers.sql` is still a required prerequisite.
- Manual receipt-print preview, all-language RTL, school timezone, concurrency/live-postgres and Step 20 production acceptance **NOT RUN / NO-GO**. Phase 5 next: notification delivery and reminders.


## Admin Communication & Fees — Phase 5 (2026-10-15)

- Admin Communication includes a disclosure-based school-only notification monitor with queue/provider-acceptance vs recipient-read separation, a latest-20 notification health directory and retry of FAILED messages only (audited, scheduled requeue rather than direct push). It does not call provider acceptance "delivered".
- School-specific scheduler materialization last attempt, success and failure status are persisted in communication settings, surfaced with school-timezone timestamps and a stale/never-run warning. Real cron invocation remains an external deployment prerequisite.
- The fee reminder editor now selects 1–6 unique whole-day offsets from 1–90, with localized chips. Backend keeps school-civil-date and de-duplication semantics. Worker suppresses overdue/stale due push and rejects inactive/withdrawn recipient, settled/cancelled invoice or archived announcement; historical in-app reminders stay available while otherwise valid.
- Migration **0023_notification_scheduler_health.sql** (after **0022_fee_invoice_numbers.sql**) is required before deploying the new API. Automated store/API/source guards cover tenant and role isolation, retries, scheduler status, and localized UI in `pnpm verify:admin-communication:phase5` and Linux/Windows CI.
- **Not proved:** actual Expo push handoff/device receipt, cron setup, concurrency-safe distributed job locking, device/browser RTL acceptance, exact production PostgreSQL migration/backups and Step 20 operator evidence. Production remains **NO-GO**. Phase 6 next: finance reports and reconciliation.


## Admin Communication & Fees — Phase 6 (2026-10-15)

- Fees → Reports & reconciliation now shows school-scoped issued-only balances, school-day aging and date-filtered gross/reversal/net collections. Period filters affect transactions only; current outstanding is deliberately today’s position.
- Server-authoritative audited CSV exports escape formulas and fail when a school exceeds the safe 5000-record bound rather than silently truncating. Manual CASH/BANK_TRANSFER reconciliation is stored separately from immutable payments with audit, invoice locking and reversed-payment restrictions.
- Audited 1–100 row bulk invoice preview detects existing and within-request duplicates plus unavailable students; this creates no invoices. Parent/student API scopes are unchanged.
- Migration required: `0024_fee_payment_reconciliation.sql` after `0023_notification_scheduler_health.sql`. Admin UI is localized and responsive; Phase 6 store tests, CSV safety tests and CI guard are added.
- External bank evidence, pilot school ledger reconciliation, live PostgreSQL migration, browsers/devices and independent Step 20 release signoff **NOT RUN**. Production remains **NO-GO**; Phase 7 integrated verification next.

## Admin Communication & Fees — Phase 7 (2026-10-15)

- Added invoice-row transaction locks around fee reminder materialization to prevent stale overdue writes from racing paid/cancelled invoices. The locked transaction checks the student and current immutable payment ledger before changing status or enqueueing notifications.
- Added background notification push claim with an expiring lease, bounded Expo HTTP attempts and safe conditional release; a concurrent worker/admin retry cannot claim a live notification, and mixed-device provider acceptance keeps remaining failures retryable. New schema migration `0025_notification_push_lease.sql` applies after `0024_fee_payment_reconciliation.sql`.
- Extended notification-worker regressions, `pnpm verify:admin-communication:phase7`, Linux/Windows CI and a dedicated 15-gate real-world operator acceptance matrix.
- Actual live PostgreSQL concurrency, migrations/backups, production scheduler, EAS/Android receipt, browser RTL/TalkBack, independent financial comparison and exact-commit Step 20 signoff remain **NOT RUN — PRODUCTION NO-GO**. This phase does not authorize a production launch.
- Linux CI also attaches an exact-build Communication/Fees Phase 7 `NO_GO` report listing all 15 unverified manual checks; operator signoff is still outside the application. Run `node scripts/phase7-communication-report.mjs --output <new-file.json>` for an equivalent local artifact.

## Admin Communication & Fees — responsive Fees layout refinement (2026-10-15)

- Corrected the reminder editor layout regression introduced when Phase 5 replaced the original two-field reminder form with multiple controls. The pre-existing `grid-template-columns: 1fr auto` squeezed labels and buttons into a tiny second RTL column on desktop.
- Fees → Invoices now shows **separate, equal-width** Create Invoice and Fee Reminder cards within the existing <=600px desktop form column. The reminder form uses one intrinsic-width-safe column, readable selected-day chips and a full-width Save action. The add-day field/button share a row only when space allows, stack on narrow viewports, and Enter in the input adds a day rather than inadvertently saving settings.
- The invoice directory now has visually distinguishable status pills, compact Amount/Paid/Outstanding previews when collapsed, softer card spacing and a defined filter panel. Paid/overdue styling never changes backend status or financial reporting. Translations reuse the existing English/Dari/Pashto labels and preserve RTL focus/navigation.
- No API, database, permissions or payment ledger changes. Added `pnpm verify:admin-fees:layout` to Linux and Windows CI; exact-width browser, 200% zoom and Dari/Pashto accessibility acceptance remain manual and cannot be inferred from source-level verification.

## Admin typography and locale-specific fonts (2026-10-15)

- Page titles and large section headings are now **70%** of their former sizes, while supporting subtitles are **80%**. This targets the school hero, route heading, dashboard/academic section headings (including Communication & Fees), and explicitly matches mobile breakpoints. It does not shrink navigation controls, data fields, ordinary list text or buttons.
- The Admin uses distinct self-hosted `next/font/google` typography: **Inter** for English, **Vazirmatn** for Dari/Persian (`fa-AF`) and Pashto (`ps-AF`). Each font is loaded under a dedicated CSS variable at the root and applied only inside the selected-language Admin workspace. `lang` and `dir` follow the Admin language selector, so family switching does not require a reload and improves assistive technology pronunciation hints.
- Normal non-admin screens keep their existing design tokens and font families. Avoid external per-page CDN font requests at runtime; fonts are self-hosted by Next.js after build. A CSS fallback remains in case custom fonts cannot load.
- Linux/Windows CI includes `pnpm verify:admin-headings` for CSS-scale, responsive overrides, localized font variables and scope; actual visual RTL/browser/Android and 200% zoom acceptance is still manual and must not be claimed from source guards.

## Admin route and tab loading copy (2026-10-15)

- Replaced user-facing implementation-phase loading messages ("Loading Phase 3/4/6/7...") with the current Admin section name: Accounts, Pilot operations, Communication & fees, Learning, Attendance, Families, Academics and Administrator profile.
- Communication & Fees chooses **Loading overview data…**, **Loading communication data…** or **Loading fees data…** according to its selected subtab; initial session loading selects the outer navigation route, including Academics child routes.
- Added equivalent Dari and Pashto strings and removed obsolete phase-number loading translation keys. This is copy-only: no changes to data fetching, caching, permissions, backend, database or spinner behavior.
- `pnpm verify:admin-loading` checks all section loaders and both localization dictionaries in Linux and Windows CI. Manual browser/RTL and route-transition visual acceptance remain to be checked.

## Admin Learning — Phase 1 navigation, overview & loading safety (2026-10-15)

- The former single long Exams/Grades administration page now has six accessible sections: **Overview, Homework, Exams, Gradebook & Results, Teaching Progress, Reports & Audit**. Overview is active by default; the selected tab is visibly scrolled into view and Home/End/arrow keyboard navigation honors RTL. Exams contains Setup and Lifecycle views; the existing exam CRUD, state transitions, published-grade corrections and audited backend behavior are preserved.
- Added authenticated `GET /v1/admin/learning/dashboard?academicYearId=<UUID>` (school admin only). The learning store validates the requested year belongs to the signed-in school, calculates active/publish-ready/published exam counts, published/closed homework, active submissions pending teacher review, classes missing expected active-roster marks, continuous assessments, assigned curriculum chapter completions and up to eight actionable exceptions. All records are year/school scoped; draft work is not counted as published. If there is no curriculum assignment denominator, the UI displays a dash rather than a false 0% completion.
- Phase 1 Homework/Teaching/Reports sections are **read-only foundation screens**, not claimed to provide the future schoolwide registers, per-student reports, or exports. Where possible they show actual scoped counts and a link to the authoritative Academics → Curriculum editor, rather than inventing an administrative write API.
- Removed the internal “Phase 6” heading from the Learning screen. Implemented AbortController, monotonic generation and active-session checks for all Learning resource fetches, reload on academic-year change, and a distinct terminal Error/Retry state. No old-school/year data remains displayed on account switch; no infinite loading spinner after a failed request.
- Added responsive compact dashboard cards, RTL scrollable tabs, keyboard/focus treatment, English/Dari/Pashto strings and `pnpm verify:admin-learning:phase1` checks in Linux/Windows CI.
- Limitations: per-exam detail pages, missing-mark drilldowns, homework review filters, lesson-plan dashboards, paging and academic exports are reserved for subsequent phases. The existing admin Learning read loads all exam records; Phase 7 should paginate at the database/API boundary. Physical browser RTL, assistive tech, real account switching and production DB load remain **manual acceptance pending**.

## Admin Learning — Phase 2 examination management (2026-10-15)

- Added an academic-year-filtered exam directory with name/type search, lifecycle status filter, 10-card paging, visible status/subject/class counts, and first/last Solar Hijri dates. Exam creation uses a separate contextual card, not three unrelated forms on the landing screen.
- Exams open at a direct URL `/admin/learning/exams/<examId>` with dedicated Overview, Schedule, Subjects and Lifecycle tabs. The shared Admin route heading and academic-year picker remain visible on nested routes. The detail fetch is authenticated, school-scoped, abortable, and selects the exam's academic year if necessary. Browser navigation uses the route; users can return to the directory without changing other Learning tabs.
- Added protected `GET /v1/admin/exams/:examId/detail` returning a verified school-owned exam and its joined class/subject setup. The API produces advisory **same-day class+subject warnings**, not false assertions of time clashes: exam start/end times, rooms and invigilators are not yet represented in the data model.
- Existing backend validates active-year create/subject setup and status transitions; the new detail UI reuses those endpoints. Teachers and other schools cannot access the detail endpoint. Subject add is limited to the assigned class/subject pairs not already configured; date changes remain restricted to DRAFT/SCHEDULED; publish/archive prompt for confirmation and backend audit behavior remains intact.
- Added Dari/Pashto navigation and feedback copy, responsive RTL styling, explicit empty/error states, role/tenant/date-advisory API regression and a `pnpm verify:admin-learning:phase2` gate on Ubuntu and Windows. No database migration.
- Deferred: actual timed scheduling, room/invigilator conflict rules, full exam readiness breakdown and mark-entry drilldowns (Phase 3). Physical browser, keyboard/screen reader and production tenant acceptance remain separate release gates.

## Admin Learning — Phase 3 marks, readiness and result publication (2026-10-15)

- Added school-admin-only `GET /v1/admin/exams/:examId/readiness` with strict UUID and school isolation. The store counts configured and dated subjects, active students in this exam's academic year, expected grade records, valid/missing/invalid grades per class/subject, unique eligible parent/student account IDs, and active-year/status eligibility. Each readiness item has an explicit machine-readable pass/fail state and affected count. The current policy requires an actual score; absent/excused classifications have not yet been introduced and **no zero is invented**.
- Exam detail navigation now includes **Marks Progress** and **Exam Readiness**; marks progress offers an incomplete-subject filter and read-only counts. Teachers retain authority for draft mark entry. Readiness is an informative snapshot, not a substitute for transactional server validation.
- Result publication now refreshes eligibility immediately before opening a localized confirmation with exam name, mark count, subject count and **estimated maximum** notification account count. All transitions remain validated by the existing server-side transaction and grade lock. Ineligible status actions are disabled; publish/archive are confirmed explicitly. The server refuses repeat publication and preserves published result privacy until commit.
- Added English/Dari/Pashto strings, compact RTL/mobile status cards, scoped API integration assertions for unauthorized roles and other schools, partial-grade readiness, completed-grade readiness and duplicate publish denial. Linux/Windows CI runs `pnpm verify:admin-learning:phase3` and the previous phase guards now target the relocated publish confirmation logic.
- **Outstanding acceptance:** verify on real PostgreSQL under concurrent mark submission and publish; ensure intended counts under withdrawn/re-enrolled student cases, real user devices, screen readers and keyboard RTL at 200% zoom. Phase 4 will add published-grade filtering, detailed corrections and audit navigation. No database migration is required.


## Admin Learning workspace — Phase 4: Published results & correction audit (2026-10-15)

Implemented on `feature/admin-learning-phase4-results` (merge to `main` after verification):

- Gradebook & Results now has an accessible, responsive published-grade directory with student/exam search, exam/class/subject filters and 20-item server-side pagination.
- `GET /v1/admin/learning/published-results` requires an authenticated school administrator and academic year UUID; SQL joins strictly enforce school boundaries, exclude draft grades, sort results predictably and cap page size to 50. Archived published results remain visible but read-only.
- `GET /v1/admin/grades/:gradeId/corrections` returns a bounded, school-scoped, chronological correction-history view for a published grade; history includes reason, old/new score/remark and actor username (no credentials).
- Admins can review an individual result then explicitly start a correction, provide a reason, and confirm before writing. The existing optimistic revision check, transactional row locking and immutable audit trail are retained; historical academic years now reject server-side corrections.
- Fast learning overview requests omit the formerly unbounded published-grade payload via `?includePublishedGrades=false`; the legacy endpoint default stays backward compatible.
- Loading/retry, account/year/filter switching, and stale-fetch aborts protect student result data. Controls and copy are translated into Dari, Pashto, and English.
- Integration coverage checks unpublished-grade exclusion, pagination, filtering, role/tenant isolation, invalid filter rejection, audit provenance, optimistic revisions, and archived read-only state.
- No new database migration is required.

Verification: `pnpm verify:admin-learning:phase4`, `pnpm typecheck`, `pnpm test`, `pnpm build`; GitHub Actions CI should also pass before merging. Physical browser and RTL/keyboard acceptance still require a manual smoke test.

Next: Phase 5 — Homework directory, assigned-teacher submission monitoring and administrator follow-up.


## Admin Learning Phase 5 — Homework Monitoring (2026-10-15)

The Learning → Homework placeholder is replaced by an operational, read-only schoolwide workspace:

- Academic-year-scoped school administrator homework directory, searched by title and filtered by draft/published/closed/archived status, class, subject and actionable attention states. Stable server pagination (20/page; API max 50); teacher name, due date, publishing state, and recipient review counts are visible.
- Per-homework active-roster counts for submitted, awaiting teacher review, reviewed, revision requested, and no submission. "Past due" means published homework past its deadline **with missing submissions**; draft homework has no expected submissions.
- Drill-down to per-student current submission status and teacher feedback. The student list is independently paginated and filterable. Answers, uploaded files, private credentials and parent details are excluded from the admin monitoring payload.
- Teacher ownership is unchanged: school administrators can monitor but **cannot** create homework, publish it, review submissions or change the teacher's feedback through Phase 5 endpoints.
- Strong tenant isolation via school ID on homework, teacher, subject, class and submission joins, with role checks at API entry; authorized student rosters require matching school, class and academic year and active enrollment. Individual homework from another school returns 404.
- **Important definition:** coverage percentages/counts represent students **currently actively enrolled** in the homework's academic year and class. Historical class membership snapshots are not available in this schema; the UI explicitly warns against interpreting this as historic enrollment reconstruction.
- Year/token/filter switches invalidate client results, abort stale fetches and provide retry and accessible detail controls. Dari, Pashto, English and responsive desktop/mobile layouts supported.
- New endpoints: `GET /v1/admin/learning/homework` and `GET /v1/admin/learning/homework/:homeworkId/roster`, both read-only and limited.
- Regression tests cover role/tenant rejection, drafts, status and attention filters, submission/revision/review transitions, archive visibility and safe roster access.
- No new migration; Phase 5 verification: `pnpm verify:admin-learning:phase5`, `pnpm typecheck`, `pnpm test`, `pnpm build`; CI on Linux and Windows.

Next planned admin Learning enhancement: Phase 6 — Teaching Progress dashboard and curriculum follow-ups.


## Admin Learning Phase 6 — Teaching Progress (2026-10-15)

Learning → Teaching progress now provides an administrator-wide read-only operational view, replacing the previous placeholder:

- Role-protected `GET /v1/admin/teaching/progress` aggregates curriculum coverage across **assigned** teacher/class/subject/year combinations. Includes the teacher's name, configured chapters, completed/in-progress/not-started counts, lesson plans by PLANNED/COMPLETED/POSTPONED status, and date of the latest completed lesson.
- Search by teacher, class or subject; filters for exact class/subject and focus cases: missing curriculum, chapters not started, incomplete curriculum, postponed lesson plans, and no lesson plans. Combined summary counts and stable server-side pagination (20/page, API max 50).
- Read-only, independently paginated assignment drilldowns `GET /v1/admin/teaching/progress/:assignmentId/units` and `GET /v1/admin/teaching/progress/:assignmentId/lessons` with status filters and chapter/lesson sub-tabs. Endpoints expose progress, titles/dates and statuses, not teacher private tasks or unrelated school data.
- **Scope:** Every API requires school administrator authentication and school/year scoping; individual assignment lookups fail with 404 outside that school/year, including requests for other schools' records. Academic years may remain historically readable; teacher-only progress write routes remain unchanged. Unrecorded chapter progress is NOT_STARTED; unconfigured curriculum is not treated as 0% completion.
- **Limitations:** No official chapter deadlines or pacing targets are stored, so attention states indicate missing configuration, incomplete recording, or postponed lesson plans, **not verified lateness**. Comparisons are descriptive rather than teacher performance rankings.
- RTL responsive layouts, Dari/Pashto translations, accessible loading/errors/navigation, explicit refresh and AbortController guards on credential/year/filter/detail changes. Curriculum changes remain in the Academics → Curriculum page.
- Verification: `pnpm verify:admin-learning:phase6` and repository TypeScript, API and production builds in Linux/Windows CI; integration tests for tenant isolation, invalid query parameters, lesson states, curriculum completion, and missing chapter progress. No schema migration.

Next planned phase: Phase 7 — Academic reports, audit search and safe exports.


## Admin Learning Phase 7 — Academic Reports & Audit (2026-10-15)

The Learning → Reports & audit placeholder has been replaced with a school-scoped, administrator-only workspace:

- **Academic summary:** `GET /v1/admin/learning/reports` returns an academic-year-scoped directory of assigned class/subject/teacher combinations. Includes configured and published examination subjects, **published-only** grade count, published/closed/archived homework, outstanding homework reviews, curriculum chapters configured/completed and completed lesson plans; summary numbers are computed across all matching results, not just the paged 20-row view. Search and class/subject filters, bounded server pagination (API max 50).
- **Audit:** `GET /v1/admin/learning/audit` filters safe educational events by academic year, category (exams, grades, homework, curriculum) and optional UTC Gregorian date range (validated, chronological and <=366 days if both dates supplied). Rows contain only event identifier, timestamp, action, entity type and administrator/teacher username; *never* grade marks, student names, metadata, passwords or contact information. School/year is derived by joining the audited entity to existing school/year records (not trusting free-form audit metadata). Stable paged ordering by time and event ID.
- **Exports:** `GET /v1/admin/learning/reports/export`, `GET /v1/admin/learning/audit/export` return UTF-8 BOM CSV with spreadsheet-formula escaping and only approved columns. Hard cap **500 rows per export**, report total/truncated indicators so a partial export cannot silently appear complete. Both actions are audited and flagged no-store. Filter/export endpoints are permission-checked server-side. User-facing downloads require a click in the admin panel.
- **Interpretation:** Academic report summaries cover **assigned class–subject pairs only**. Unassigned subjects do not appear and draft grades do not count as published. Homework publication counts include published, closed and archived. Audit displays events only when their original underlying entity still exists and maps to the requested year; therefore deleted chapter events may not appear. Non-academic system actions and export audit markers are deliberately excluded from this year-specific educational activity feed. Date filters are UTC days; visible timestamps are formatted for Kabul.
- UI includes keyboard-accessible two sub-tabs, filters, per-assignment metrics, event cards, empty/loading/errors, retry, pagination, export status and truncation warning. Layout works in desktop/tablet/mobile RTL; translated Dari and Pashto labels. Safe AbortController/request scope logic prevents stale year, role or credential details from replacing current data.
- No database migration. Tests: new `scripts/verify-admin-learning-phase7.mjs`, CSV formula injection/unit tests and integrated API regression for tenant isolation, denied roles, bad date ranges, drafts hidden, summary counts, curriculum logs, academic export and audit export.

Next: After all Learning admin phases, complete cross-tab polish, live browser checks with realistic data and a school administrator acceptance pass.


## Admin Attendance Phase 1 — Foundation & Navigation (2026-10-15)

After completing all seven admin Learning phases, the fifth Admin navigation tab (/admin/attendance) starts its seven-step upgrade plan.

- **Six user-facing sections:** Overview, Daily registers, Students, Follow-ups, Reports, Audit trail. Fully accessible roving-tabindex tabs with Left/Right/Home/End keyboard support, explicit tab/panel semantics, responsive swipeable horizontal tab navigation and RTL-safe layouts. No implementation phase label on the user-facing Attendance page.
- **Real, bounded-to-existing-data preview:** Overview reuses existing school/year report totals and separates real submitted marks from future attendance expectations. Students groups only the returned, selected-period attendance records, not the full enrollment directory. Follow-ups previews actual ABSENT/LATE marks (first 30 only, with transparent label) and does not invent case-management records. Reports displays the currently selected range's raw totals; trends and CSV export are **not** available in Phase 1. Audit links to the existing school audit route; a scoped dedicated attendance audit viewer remains future work.
- **School date correctness:** Initial report deliberately omits client date filters so the existing protected API derives from/to using `attendance.getSchoolToday` and the school's configured timezone. The frontend then initializes selected date filters to that server-derived day; no device local clock is used.
- **Request integrity:** Initial academics+report fetch and subsequent filters use AbortController, monotonic request generation, and token/year scope guards. Last-applied filters are distinct from currently edited draft filters. UI uses loading/empty/error/retry states and clears stale information when academic year or credentials change. Corrections continue to use the existing protected audited backend and are disabled on non-active academic years; current correction reason policy remains optional until the dedicated correction/audit phase.
- **Report semantics:** Attendance percentage excludes EXCUSED marks and unrecorded days and counts PRESENT and LATE as attended. The raw current single-day `pendingClasses` count is labelled *provisional*: it does not yet consider weekends, holidays, closures, or teacher Negaran assignment coverage. A complete school calendar and expected-submission directory are reserved for Phase 2.
- **Backward compatibility:** Retains `GET /v1/admin/attendance/report` and `PATCH /v1/admin/attendance/:attendanceId/students/:studentId` unchanged; preserves teacher, student, parent routes. No schema changes or migration. The existing attendance report still returns full requested result sets; server pagination is planned for later phases and admins should use a narrow date range meantime.
- **Verification:** `pnpm verify:admin-attendance:phase1` runs static guards, tab/attendance-rate model tests, and the existing Negaran attendance integration test, extended with an explicit school-local default date and role gate. GitHub CI verifies on Linux and Windows. Full repository verify/typecheck/API regression/build still run in standard CI.

**Next:** Phase 2 — Overview and Daily Monitoring: eligible teaching-day calendar, teacher Negaran coverage, class-level submission status and safe paginated summary/report APIs.


## Admin Attendance Phase 2 — Daily Monitoring & Calendar (2026-10-15)

- **Daily class monitoring:** New school-admin-only `GET /v1/admin/attendance/monitor?academicYearId=<uuid>&date=YYYY-MM-DD[&classId=<uuid>]` returns one bounded *day* of class-level information: timetable weekday, class roster count, current eligible Negaran, submitted register state and per-class submitted student mark totals, with school/year/academic-class filtering and no student-identifying details.
- **Accurate expected-submission denominator:** Only within-year, non-future, non-closure dates with a scheduled timetable period, active students and exactly one **active-account Negaran** count as expected. Distinct states include SUBMITTED, PENDING, CLOSED, NOT_SCHEDULED, FUTURE, OUTSIDE_YEAR, NO_STUDENTS, NO_NEGARAN, MULTIPLE_NEGARAN. Submitted sheets always remain visible, but unscheduled/closed days do not inflate completion percentages. Problematic setup classes are *not* labelled as teacher non-submission. A null completion rate is displayed for zero expected registers. This is weekly-timetable/closure-aware, not a historically versioned school-calendar snapshot; changes to current timetable/rosters/Negaran configuration may reclassify past dates.
- **Declared school closures:** Persisted new `attendance_closures` table keyed uniquely by school, academic year and date; administrators can list/add/remove school holidays and non-teaching days through audited, school-scoped endpoints. Closures must fall within a DRAFT/ACTIVE academic year and cannot be created over days with existing attendance. Duplicate submissions receive 409. Closed/archived years are read-only. Creating/removing closures generates `attendance.calendar_closed`/`attendance.calendar_reopened` audit events. Negaran submission is rejected on closed days and teacher sheets are locked; Teacher Today identifies those supervised days as CLOSED.
- **Admin UI:** Overview displays one-day expected/submitted/pending/setup metrics, completion progress bar and attention list. Daily Registers provides status-filterable, searchable class monitoring, teacher attribution, submitted counts, closure calendar manager and the existing individual mark-and-correction editor below. Monitoring explicitly requests a single day; for multi-day filters, period registers/reports still work but the daily monitor displays a single-day prompt rather than inventing multi-day completion data. Separate guarded fetch lifecycle and loading/error/retry; responsive mobile, tablet, desktop and RTL in English, Dari and Pashto.
- **Backward compatibility:** Existing `GET /v1/admin/attendance/report`, corrections, academic year selectors, parent alert synchronization and Negaran submissions remain. Legacy `pendingClasses` in the raw report response has not changed and is no longer shown as the authoritative pending count; use `/monitor` instead. No completed attendance marks are reclassified as student absences.
- **Migration required:** `packages/database/drizzle/0026_admin_attendance_calendar.sql` registered in Drizzle journal. After pulling Phase 2, run `pnpm db:migrate` before starting the upgraded server. Migration is additive and should be backed up before deployment.
- **Verification:** `pnpm verify:admin-attendance:phase2` includes model logic, calendar and authorization integration, static school/academic scope and RTL invariants, Linux/Windows CI. Existing PGlite API fixture applies migration 0026.
- **Known gaps:** This does not yet provide a formally versioned holiday/school calendar covering historic years, recurring closure rules, configurable teacher submission deadlines, student-level calendar views, or server-side pagination of the legacy multi-day report. Class room setup/historical roster changes can affect retrospective monitoring; do not use the live expected count as a legally authoritative historical snapshot.

**Next:** Phase 3 — Daily Registers & Student History.
