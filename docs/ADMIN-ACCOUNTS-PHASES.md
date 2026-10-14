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

## Future phases (not implemented in Phases 1–3)
- **Phase 4 — Security:** confirmation dialogs, revoked sessions on suspension, suspension reasons, account audit drill-down and appropriate security handling.
- **Phase 5 — Scale:** server-side search/pagination/sorting, optional safely scoped bulk account operations.
- **Phase 6 — Regression:** expanded end-to-end role, tenant, network, locale, accessibility and responsive verification.

No new database migrations or provisioning API changes were introduced in Phases 1–3.
