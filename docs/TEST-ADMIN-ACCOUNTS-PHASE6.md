# MaktabLink — Admin Accounts Phase 6 regression / release acceptance

Date: 2026-10-14. Scope: `/admin/accounts`, existing school-admin account endpoints and account store.
This guide distinguishes **automated evidence** from **manual acceptance**; passing mocked/PGlite/API tests does not certify the deployed Neon environment or physical browser/device.

## Regression matrix

| ID | Workflow / risk | Automation / evidence | Live or browser acceptance required |
| --- | --- | --- | --- |
| A6.01 | Directory opens by default, Create form is a separate view, counts match whole school | UI release source gate, server paging regression | Inspect desktop/tablet/phone and confirm correct initial focus |
| A6.02 | Teacher, school staff and extra admin accounts | Existing API create/login/role tests, Phase 6 role-denial tests | Complete each first-login password change on test school |
| A6.03 | Parent account/profile and student record/login | Existing family/API integration tests, linked-details selector tests | Create parent with two children; verify correct parent and student links |
| A6.04 | Same username used by different schools | School-scoped username-availability and directory API tests | Exercise in two school dashboards; no data or names from other school |
| A6.05 | Roles: school admin vs teacher/staff/parent/student | Phase 6 API non-admin/temporary-password denial, existing family role tests | Direct URL checks for Parent/Student/Teacher/Staff and suspended admin |
| A6.06 | Paged search/sort/counts, literal `%` and `_` | PGlite directory tests + Phase 5/6 API validation | Use school with >60 accounts; verify page 10/20/50, last-page shrink |
| A6.07 | Rapid search, query races, school switch, error/retry | Pure request-acceptance test and source guards for token/query/abort | Throttle network; change query rapidly, switch school session, disconnect/reconnect |
| A6.08 | Selection limited to the visible page and 20 eligible accounts | Pure selection tests, server all-or-nothing tests | Select 20, attempt 21st; switch filters/page; verify selection cleared |
| A6.09 | Single suspension/reactivation/reset, confirmations, cancelled actions | Existing API / PGlite lifecycle tests and modal guards | Escape/Cancel must not write; verify temporary password is masked |
| A6.10 | Bulk suspension/reactivation + reasons and audit | PGlite atomicity tests, Phase 5/6 API tests | Test valid 2+ batch, mixed states, reactivation and audit actor identities |
| A6.11 | Cross-tenant/bypass/archived/self-admin protection | Role denial, validation, school isolation, archived and conflict tests | Inspect that Admin/archived checkbox and destructive buttons are disabled |
| A6.12 | Old sessions invalidated on suspension and reactivation | Phase 4 integration and store tests | Verify on two separate devices/accounts; no misleading “server offline” banner |
| A6.13 | English/Dari/Pashto text and template placeholders | `pnpm verify:accounts` checks 120+ keys in both locale dictionaries | Review native speaker wording, numerals, long labels, RTL order |
| A6.14 | Accessible dialogs, focus, keyboard, status updates | Source-level ARIA, Escape, focus, disabled states and CSS gates | Keyboard-only: Tab, Shift+Tab, Escape, focus restoration; NVDA/TalkBack |
| A6.15 | Responsive desktop/tablet/mobile at 200% zoom | CSS breakpoints, reduced-motion, focus and RTL source gates | Chrome/Edge/Firefox and actual Android; look for clipping, overflow |
| A6.16 | Migration/build and Windows portability | CI TypeScript, build, all API+DB tests on Ubuntu, API + locale guards on Windows | Live Neon `pnpm db:check`, backup/restore, production-like environment |

## Automated execution

From `C:\projects\maktab` after pulling `main`:

```powershell
pnpm verify:accounts
pnpm verify:release
pnpm --filter @maktablink/api test
pnpm --filter @maktablink/database test
pnpm typecheck
pnpm build
```

The source guard is **not** a browser rendering or accessibility audit. PGlite API tests are not proof of Neon connectivity, real authentication delivery, physical-device behavior, or real-site push notifications.

## Manual acceptance — reproducible procedure

**Environment:** Create two isolated test schools A and B. Use disposable school accounts, never production families or real passwords. Prepare administrator accounts in both schools; create one Teacher, Staff, Parent and Student in school A with their legitimate provisioning workflows. Activate a teacher/student test login, and reserve an unlinked student for creation tests.

1. Sign in as school A admin. Open **Accounts**: verify directory view, counts, English/Dari/Pashto switching and correctly positioned RTL view switches. Change pages, filters, sort and a rapid search while monitoring browser Network requests; older responses must never replace the latest query.
2. Create each eligible role; verify inputs, username rules, duplicate checks (including username on a different page and in school B), and masked one-time credential. Copy in a secure browser context; close and ensure the credential is not retrievable.
3. Open Account details for parent/student/teacher/staff/admin. Confirm only the right child records, academic assignments, role, timestamps and account event actor are shown. Navigate back to directory and check focus/filter continuity.
4. With only a keyboard, open the single-account and bulk confirmations, cycle Tab/Shift+Tab (focus must stay within), press Escape/Cancel (no changes), then submit and verify focus restoration and feedback. Test the same in Dari/Pashto RTL.
5. Select 10–20 permitted accounts on a populated page, verify the 21st is not selectable, and confirm a page change clears selection. The “select current page” checkbox must not silently select an unbounded 50-account page. Suspended, archived and school admin eligibility must be clear.
6. Suspend one account and then a batch with a reason. Validate status, revoked sessions on every device, bounded audit trail, and cross-school isolation; reactivate and verify fresh login. Test disconnected API, delayed responses, refresh and conflict retry (no partial changes).
7. At 320px/375px/768px/1280px widths and 200% zoom check controls, form labels, visible focus, no horizontal overflow, scrolling, long names and locale strings. Repeat with a screen reader (NVDA/TalkBack) and reduced-motion setting.

## Sign-off and remaining release blockers

**Automatable criteria:** The phase is automatically regression-checked when the final GitHub SHA passes the Ubuntu `verify` and Windows `windows-api-regression` jobs. Verify the exact SHA and archive the Actions run.

**Manual criteria:** A school administrator or QA operator must execute the above against real web/mobile browsers with a seeded test school and record observations, screenshots, device/browser matrix, and defect status. At document creation this **has not been executed by this assistant**.

**Production release:** Do not infer unrestricted readiness from this phase. The Step 20 release blockers in `docs/TEST-20-FULL-REGRESSION.md` and `docs/RELEASE-READINESS-STEP20.md` still apply, including live Neon connectivity, real-device workflows and backup/restore verification. Phase 6 introduces no schema migration.
