# Admin Accounts — UI and Capability Improvement Plan

Started: 2026-10-14. Route: `/admin/accounts`.
Source of truth for currently implemented behavior: the main-branch application and school-scoped API.

## Phase 1 — Layout and styling (implemented)

- **Directory-first:** Accounts opens in the directory view, rather than displaying a large creation form by default.
- **Four interactive account summaries:** total accounts, active accounts, pending activation and suspended accounts; the cards filter the current school's loaded directory and reset competing filters so the selected count is meaningful.
- **Accurate pending count:** `INVITED` accounts or `ACTIVE` accounts still requiring a first-login password change. The pending and active totals may overlap; this is not an exclusive partition.
- **View switch:** choose Account directory or Create account. Desktop retains the directory beside an opened creation form; at tablet/phone widths, the selected view occupies the available space.
- **Directory:** retained school-scoped API, create, reset, suspend/reactivate, current-admin action restrictions, role/status/search filters and temporary credential display. Improved spacing, role-colored avatars, badge layout, focus indicators, searchable controls and mobile scrolling.
- **Accessibility / localization:** view buttons and filter buttons expose their pressed states; search and status filter have explicit accessible names; new interface text is provided in English, Dari and Pashto; layout works in RTL. Native web focus support and motion preferences remain in place.
- **Small UI correctness fix:** replaced invalid dotted parent/student username examples with alphanumeric examples accepted by their existing server contract. Validation rules are not altered.
- **Verification:** `pnpm verify:release` now checks the presence of the directory-first, filtering, RTL translation, focus and responsive implementation. Complete CI and real browser/device visual acceptance are separate gates.

### Manual acceptance for Phase 1

1. Sign in as a school admin and verify Accounts opens on the full directory, including school-only users.
2. On a populated school, select each summary: total, active, pending and suspended; confirm the visible results match counts. In particular, confirm an active user awaiting password setup is counted as pending.
3. Switch between directory and creation: at desktop widths the open form is beside the directory; on narrow screens only the selected view appears. Create a Parent and Student account without altering the family linking rules.
4. Test search, role groups, status filter, clear filters, reset, suspend/reactivate and view recovery in English, Dari and Pashto.
5. Test keyboard navigation, focus visibility, 200% zoom, RTL phone/tablet widths and temporary password visibility.
6. Verify `pnpm verify` and CI Ubuntu/Windows at the final commit.

## Phase 2 — Guided creation and one-time credentials (implemented)

- **Role-aware instructions:** The creation form explains Teacher, Parent, Student, Staff, and Admin pathways. Teacher academic profiles remain managed in Academics; Family linking remains managed in Families; account creation does not bypass those workflows.
- **Inline validation:** Mirrors the existing contracts for 3–64 character usernames, parent/student alphanumeric-only credentials, other role username punctuation, parent full-name length, optional phone length, and local duplicate usernames (case-insensitive). The server is still authoritative for uniqueness and validation.
- **Student choice:** Accounts with an existing login or withdrawn student status are excluded. An admin must explicitly select an eligible student instead of silently defaulting to the first record. Search filters eligible student name/code/class.
- **One-time credential presentation:** Newly created/reset passwords are concealed by default in a dedicated panel with explicit reveal/hide, copy-username, copy-password, and close controls. Passwords live only in transient React state and are discarded when the panel is closed or the page unmounts; no browser storage or logs. Clipboard copying requires a secure context and may retain the copied password beyond the panel's lifetime; the interface warns about this.
- **Error/interaction behavior:** Field errors are rendered with labels and ARIA hints. A new creation request is prevented while a previous temporary-credential panel remains open. Created accounts return to the directory, with the temporary-credential panel focused for accessible handoff. API writes, account role permissions and subscription rules were not changed.
- **Translations:** New help/error/security copy is available in English, Dari, and Pashto.
- **Tests:** `apps/api/src/account-create-rules.test.ts` exercises the exact client validation helper. `pnpm verify:release` checks localized creation and credential guards. Existing API integration tests still protect school account provisioning and tenant isolation.
- **Limitations:** No password delivery provider has been added; operators must communicate credentials securely. Clipboard history cannot be erased reliably by the browser. Reset confirmation dialogs, session revocation on suspension and account detail editing remain Phase 4/3 scope.

### Manual acceptance for Phase 2

1. For each role, select Create Account and confirm the guidance is appropriate. For Parents, validate names and optional phone; for Students, search and explicitly choose an active student without a login.
2. Enter invalid/duplicate username formats and verify inline, localized messages before submission. Verify legitimate Teacher usernames can contain punctuation but Parent/Student cannot.
3. Create an account and confirm the temporary password is masked, can be revealed/copied, and is cleared on Close and navigation. Retry on a non-HTTPS external deployment to verify clipboard failure guidance.
4. Reset another account password and verify the same one-time credential panel displays. Verify self-reset, self-suspend and archived-account restrictions remain enforced.
5. Check RTL, keyboard focus, screen readers, and responsive layouts on actual browsers. Run `pnpm verify` and check exact-commit Linux/Windows CI.

## Phase 3 — Account details and related records (implemented)

- **View details:** Every account row now opens a responsive side panel (RTL on Dari/Pashto, LTR on English) while retaining the directory's search, role, status, and scroll context. Dialog provides accessible title, Escape/close/backdrop dismissal, initial focus, keyboard focus containment, and focus restoration.
- **Account identity:** Role/status badges, profile name and phone where the relevant school profile exists, username, creation date, last login, and first-login password setup state. Missing fields appear as unavailable instead of inferred.
- **Parent:** Shows only student records linked by `student.parentUserId === selectedParent.id` with class, student code, academic year, and status. Links to the existing Families module.
- **Student:** Joins the student login by `student.userId`; shows the linked student's class, code, year, and the parent named on that student record. Does not infer links from a shared surname or phone. Links to Families.
- **Teacher:** Lazily fetches the existing school-admin-protected Academics overview and displays only the selected teacher's profile, subject/class/year teaching assignments, and Negaran assignments. Shows an explicit loading or failure state. Links to existing Teacher Profiles and Teacher Assignments modules, rather than adding duplicate editing APIs.
- **Admin and staff:** Shows their school role/status and security metadata; the currently signed-in admin can open their existing profile page. Other admins and staff are not given an invented cross-user profile-editing endpoint.
- **Contextual actions:** Existing password reset, suspend and reactivate operations are available inside details while preserving self/archived restrictions and Phase 2 one-time credential acknowledgment. Existing directory buttons continue to work.
- **Scope and privacy:** No database migration or new API route. Family and academic overviews are fetched using existing school-scoped admin endpoints. No passwords, credential hashes, or tokens appear in account details. Teacher academic data is loaded only when opening a Teacher.
- **Verification:** Added pure-data association regression tests to verify parent-child, student-parent and teacher assignment isolation. Source-level release guard covers dialog focus and RTL, existing canonical links, and translation parity.
- **Deferred:** Per-account audit trail and password/suspension confirmation workflow (Phase 4), deep-linked edit forms and richer school-staff profile administration where product APIs do not yet provide them. A passing CI suite is not a substitute for manual keyboard/TalkBack/browser RTL smoke tests.

### Manual acceptance for Phase 3

1. From a filtered account directory, select View details on each role; confirm the drawer displays the correct name, role and status and closes without clearing filters.
2. Inspect a Parent with two children, a Student linked to another parent, and two different Teachers; verify **no** unrelated student/assignment appears in the selected person's drawer.
3. Verify teacher-profile and Negaran information, including historical year, class and subject, and missing-profile/loading/error states.
4. Open the canonical Families, Teacher Profiles/Assignments, and self Admin Profile pages from account details; confirm they are school-scoped and editable only in those modules.
5. Try context actions on active, suspended, archived and current-admin accounts. Password reset must close details before displaying the concealed one-time credential.
6. Test Escape, Tab/Shift+Tab trap, backdrop click, focus restore, 200% zoom, narrow screens, and three-language RTL/LTR. Check `pnpm verify` plus GitHub CI at the exact final SHA.

## Phase 4 — Account security and lifecycle (implemented)

- **Guarded actions:** Reset password, Suspend, and Reactivate, whether selected in the directory or account details, require an explicit accessible confirmation dialog. The dialog explains session effects and supports Cancel/Escape, keyboard focus management and Dari/Pashto RTL.
- **Suspension reason:** Optional reason up to 500 characters (minimum three if supplied), trimmed and validated server-side. The UI discourages including secrets. A reason is stored only in the account's audit metadata (no new database column or migration).
- **Atomic session invalidation:** Existing access/refresh sessions are revoked in the same transaction as a school administrator's suspension and reactivation. The general account status changer revokes on lifecycle changes as well. Previously signed-in users cannot regain access on reactivation with old tokens.
- **Preserve suspended-account messaging:** The app's existing suspended-user login still returns a restricted, suspended-status session, allowing the school admin contact route but not operational features; a newly created restricted session is revoked when the account is reactivated. A user must log in again after reactivation. Previously issued sessions are invalidated immediately on suspension (HTTP 401 `session_invalid`, not a network outage).
- **Lifecycle conflicts:** Archived accounts cannot be suspended/reactivated; already suspended accounts cannot be suspended twice; only suspended accounts can be reactivated. The current administrator still cannot self-suspend or self-reset. The account's subscription write rules remain unchanged.
- **School-scoped audit:** New `GET /v1/admin/users/:userId/audit?limit=25` (max 50) requires an authenticated school administrator and an existing target user in their own school. It returns a safe projection: action, actor user ID, optional suspension reason, timestamp and event ID. It excludes password hashes and arbitrary audit metadata. Parent creation and student login creation metadata remain mapped to their respective accounts without revealing other accounts' events.
- **Account details:** Shows up to 25 recent events, including localized event names, known administrator identity and optional reason; errors and empty states are explicit. Browser-only rendering never has access to stored password hashes.
- **Testing:** PGlite tests cover session invalidation, cross-school audit filters, reason persistence and reset on reactivation; API tests check reason validation, conflicts, audit visibility, tenant isolation, and old-session rejection. Release evidence now checks the screen, store, API, and translations.
- **Not added:** An automated notification/email for suspension, mandatory second-admin approval, account archival, or any separate staff permission system. Future server-side paging and bulk operations remain Phase 5.

### Manual acceptance for Phase 4

1. From both directory and detail views try Reset password, Suspend, and Reactivate; confirm none executes before the confirmation. Cancel/Escape should not make changes.
2. Suspend a test user with a reason. Verify all previously issued access/refresh tokens fail. Login during suspension should show restricted-account status and still allow the admin-contact route.
3. Reactivate the account. Confirm a suspended-session token also fails and that a **fresh login** is required; the account should return to `INVITED` if a first-login password change remains necessary.
4. Check Account history for timestamps, action, performer, reason and chronology. Verify a second school cannot read or modify the test school's account or audit.
5. Test invalid reasons, repeated actions, current-admin restrictions, archived states, failed requests and cancellation without unintended data changes.
6. Exercise English/Dari/Pashto desktop and mobile UI, 200% zoom, keyboard, screen reader, RTL and current network error handling. Run `pnpm verify` and check Linux/Windows CI at the exact final SHA.

## Phase 5 — Scalable directory and controlled bulk actions (implemented)

- **Server-paged directory:** `GET /v1/admin/users/directory` accepts validated school-scoped `query` (max 120 characters), role-group and status filters, activation-summary filters, sorting by name/username/role/status/created date/last login, sort direction, page and page size (10/20/50). Search escapes SQL LIKE wildcard characters and matches username, role, status, and canonical parent/teacher/student profile data. Only the selected page's users are returned, never password hashes.
- **Exact school totals:** Summary counts for total, active, pending setup, suspended and role group counts come from a separate school-scoped aggregate, not the current page. Pending includes invited accounts plus active accounts that still require a password change. The filtered count and number of pages are provided separately; sorting is deterministic via user ID tie-breaker.
- **Directory UI:** Debounced input, canceled stale network requests, accessible sorting and page controls, refresh/retry, mobile/RTL filter layout and contextual reset/suspend/activate actions. Changing filters, sorting or page clears page selection. New account creation and actions refresh the directory without discarding the applied search/sort.
- **Creation compatibility:** The previous all-school user download is no longer required for the directory. A narrow same-school `GET /v1/admin/users/username-check` provides case-insensitive username availability guidance for the create form; the server remains authoritative in account creation race conditions. Family/student records now load only when they are needed by Student creation or a selected Parent/Student detail. Loading and errors are explicit.
- **Safe bulk operations:** `POST /v1/admin/users/bulk-status` supports suspension and reactivation only (no bulk reset/password distribution). Selection is limited to the visible page. Up to 20 distinct UUIDs may be submitted; the UI disables bulk actions above this limit and disallows mixed incompatible statuses. The server independently rejects self-actions, school administrators, archived or wrong-status accounts, cross-school IDs and duplicates.
- **Atomic write and audit:** The store validates the full batch, checks eligible states again at update time, invalidates existing sessions, and writes one audit entry per account in the same transaction. Any missing, concurrent changed or prohibited member rolls back the entire batch. An optional validated 3–500 character suspension reason is recorded in each affected account's history. Bulk reactivation returns accounts to INVITED or ACTIVE according to password-change requirement and requires a new login.
- **Actor identity:** Account event history can display the school-scoped actor username even when that administrator is not included in the current directory page, without exposing full audit metadata.
- **Backwards compatibility:** `GET /v1/admin/users` remains available for existing other modules; Phase 5 uses the new paginated endpoint in the Accounts screen. No database migrations.
- **Verification:** API/PGlite cases cover bounded queries, literal wildcard search, school scope, cross-school username checks, totals, sorting, pages, bulk rollback, archived/admin restrictions, audit and session invalidation. Release source gates cover these capabilities. Device/browser review remains separate.

### Manual acceptance for Phase 5

1. Create 60+ school users across all roles. In Accounts, confirm summaries/role counts match the whole school while 10, 20, and 50 row pagination returns only that many records. Sorting, previous/next, status and role filters should preserve the correct server total.
2. Search a username and full name, phone, teacher/student code, role, or status; ensure wildcards such as `%` and `_` search literally rather than showing every user. Rapidly changing searches should not reveal stale results.
3. Create a user whose username is already on another page; verify duplicate detection before submitting and final backend validation. The same username in another school should not block creation.
4. Open details and inspect linked family and teacher records, history and the actor name when the actor is on another directory page. Confirm a failed family fetch is not misreported as no children.
5. Select accounts on the same page (never other pages). Confirm eligible Parent/Teacher/Student/Staff, 20-account cap, mixed-status rejection and self/admin/archived exclusion. Try a batch with a cross-school ID directly via API; verify rollback and no partial changes.
6. Cancel the bulk confirmation, then suspend a test batch with a reason. Check each audit entry, current sessions being invalidated, individual summaries and reactivation to the correct account status.
7. Test keyboard and screen reader interaction, small screens/200% zoom, English/Dari/Pashto/RTL, offline/retry and legitimate last-page shrink after lifecycle updates. Confirm GitHub Ubuntu/Windows CI green at the exact final commit.

## Phase 6 — Regression and acceptance hardening (automated implementation complete)

- **Tenant and network safety:** The Accounts page now tags directory responses to the active session token and intended query; aborts and rejected stale responses cannot overwrite newer searches. The previous school's directory, sensitive account details, pending confirmations and credentials are not shown while a new session loads. Linked family data is similarly bound to the current session and only loaded when needed.
- **Selection safety:** Current-page-only eligibility is defined in one tested helper and enforced by the UI. The maximum 20-account batch is enforced during checkbox selection as well as by server validation. A page with more than 20 eligible accounts no longer offers a misleading select-all action; operators select up to 20 individual accounts instead.
- **Cross-role and school integration:** Expanded PGlite/Fastify tests cover admin/teacher privilege boundaries, temporary-password restrictions, foreign-school visibility/write attempts, malformed paging/filter/sort inputs, invalid batch payloads, atomic rollback and literal wildcard search.
- **Localization and UI source quality:** Added `pnpm verify:accounts`: checks 120+ account UI labels and message templates against **both** Dari and Pashto dictionaries and requires placeholder parity. It also checks keyboard/ARIA semantics, RTL/mobile breakpoints, reduced-motion CSS and the network/selection contracts. CI now runs these gates on Ubuntu and Windows.
- **Manual acceptance is separate:** See `docs/TEST-ADMIN-ACCOUNTS-PHASE6.md` for a 16-area acceptance matrix, real-browser/Android/200%-zoom/keyboard/screen-reader procedures and operational sign-off. No real device or live Neon test has been performed by this implementation task; unresolved Step 20 release blockers still govern production readiness.
- **Compatibility:** Existing school-scoped provisioning APIs and account roles remain unchanged. No database schema migration is required.

### Phase 6 acceptance gate

1. Pass final-commit GitHub Actions `verify` (Ubuntu) and `windows-api-regression`; retain the exact commit/CI run as evidence.
2. Run `pnpm verify:accounts` and `pnpm verify` locally after pulling.
3. Follow every manual scenario in `docs/TEST-ADMIN-ACCOUNTS-PHASE6.md`, record browser/device and cross-school findings, and do not claim release sign-off without those observations.
4. Resolve the existing Step 20 Neon, backup/restore, real-device and operational release blockers before unrestricted deployment.

## Future phases

Phase 1–6 work is implemented in the repository. Follow-on product scope or production sign-off should be tracked as separate work rather than treated as implicitly completed.

No database schema migrations were introduced in Accounts Phases 1–6. Accounts provisioning APIs are preserved; later phases added read-only directory/audit and bounded account lifecycle endpoints.
