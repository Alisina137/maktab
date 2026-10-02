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
