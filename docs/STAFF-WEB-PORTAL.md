# MaktabLink — Standalone School Staff Web Portal

## Two separate web access points

- **Administrator**: `/admin` — credentials must have the `SCHOOL_ADMIN` role.
- **School staff**: `/staff` — credentials must have the `SCHOOL_STAFF` role. After login, staff open `/staff/dashboard`.
- **Android/Expo mobile**: only student, parent and teacher roles. Staff are deliberately **not** part of the mobile role selector.

The web login uses the existing `/v1/auth/login` endpoint with an explicit `expectedRole:"SCHOOL_STAFF"` and a **different browser session-storage key** from the school admin console. A created staff account starts with a temporary password and must change it before opening staff records.

## Creating a school staff account

1. Sign in to `/admin`, then open **Accounts**.
2. Create a new account with role **School Staff** and a unique username.
3. Securely deliver the issued username and **one-time temporary password** to the staff member; do not store or share the credential in screenshots, tickets or chat messages.
4. Staff open `/staff`, choose the school and sign in.
5. On first sign-in, staff set a new strong password; the portal then opens their dashboard.

Staff can sign out, rotate a normal password using the existing authenticated endpoint, and search an intentionally limited school-scoped directory of **students, parents and teachers**. This directory shows username, display name, relevant school code and account status. No private contact numbers, account password hashes, access tokens, account IDs, family relationships or administrative metadata are returned. The lookup requires at least two characters and paginates at ten results. It has no write operations.

## Security and permissions

- The backend checks role, session revocation/expiration, suspension, subscription state, temporary-password status **for every staff endpoint**.
- School boundaries are determined by the verified staff token, **never** supplied by a query or form field.
- The staff web UI does not reuse admin web sessions. Admin routes still require `SCHOOL_ADMIN`, and staff cannot create/suspend/reset users, edit school billing, change fees/grades or approve releases.
- Staff sessions are browser-tab session storage, consistent with the existing admin web pattern. The server remains the authorization authority.
- Administrative rights may only be added as separate explicit backend permissions after agreeing on a staff job scope. Never solve this by changing `requireSchoolAdmin` to permit `SCHOOL_STAFF` globally.

## Verification

```powershell
cd C:\projects\maktab
git pull --ff-only origin main
pnpm verify:staff
pnpm typecheck
pnpm test
pnpm build
```

The automated integration regression covers wrong-role and wrong-school login, forced password change, staff-only access, malformed search filters, other-school data isolation, private-field redaction, blocked admin mutations and revoked/suspended staff access.

**Manual checks:** test Android/mobile absence of Staff role, English/Dari/Pashto RTL, keyboard navigation, small screens, a real staff account's initial password setup, session refresh, suspension, and an administrator account's inability to open staff endpoints.

The initial staff permissions intentionally cover **front-desk account lookup and self-service account security**, not generalized administrative privileges. More staff workflows (attendance support, enrollment, fee collection, reception, library) require an explicit permission matrix and matching school-scoped endpoints before being enabled.


## Phase 1 — Staff positions, profiles and permissions (October 2026)

Staff job responsibilities are now **explicit administrator-assigned permissions**, not inferred from the `SCHOOL_STAFF` role or position. Existing staff and newly-created staff **start with no operational grants** until configured. Staff can still authenticate to review their own school and security settings.

**Administration:** /admin/accounts → Account directory → open a School Staff account → **Staff position & permissions**. Record full name, optional school-unique employee code, position, department and only the appropriate permissions. Saving requires an authenticated school admin; the backend scopes by that school's account and rejects cross-school or non-staff targets. Every change is audited and revokes existing staff sessions, so the staff member must log in again.

| Permission | Phase 1 enforcement | Later workflow |
| --- | --- | --- |
| `DIRECTORY_VIEW` | Allows `GET /v1/staff/directory`, denied without explicit grant | Role-/record-level directory refinements |
| `ENROLLMENT_REQUESTS` | Reserved; does not unlock account creation | Phase 4 registration workflow |
| `ATTENDANCE_REVIEW` | Reserved; does not unlock admin attendance | Phase 5 attendance assistance |
| `FEES_VIEW`, `FEES_COLLECT` | Reserved; does not unlock admin financial APIs | Phase 6, separate payment protection |
| `TASKS_VIEW` | Reserved | Phase 7 tasks |
| `COMMUNICATION_DRAFT` | Reserved; not an announcement publish grant | Phase 7 communication |
| `REPORTS_VIEW` | Reserved | Role-scoped reports |

The staff dashboard shows profile, position and department. If directory access has not been granted, it shows a clear restricted state rather than a query. The administrator retains the only account-creation and permission-editing rights. Positions are organizational labels only, so being named `ACCOUNTANT` **never** grants fee-editing rights by itself.

**Migration:** the new `0028_staff_profiles_permissions.sql` migration is mandatory for this phase. The new table has a compound school+user foreign key, and a school-unique optional employee code. Existing users are not migrated into privileged staff profiles.

```powershell
cd C:\projects\maktab
git pull --ff-only origin main
pnpm db:migrate
pnpm verify:staff
pnpm typecheck
```

Run the migration once per environment **before** starting the updated API. Do not enable unimplemented staff modules just because a future permission is assigned. Run `pnpm verify:staff:phase1` for the Phase 1 scoped API, revoked-session, audit and migration integration tests.


## Phase 2 — Role-aware Home, navigation and workspace layout

After sign-in, all staff see **Home**, a read-only summary of their school, position, department and currently operational tools. Their **Profile & Settings** tab includes account information and password changes. A **Directory** navigation item appears only when the school administrator explicitly assigned `DIRECTORY_VIEW`.

Home explicitly distinguishes **future workflow grants** (registration, attendance, fees, tasks, messaging, reports) from actually implemented operations. No fake pending-task counters or functional links to unimplemented backends are displayed. The navigation remains part of the standalone `/staff/dashboard` website, not the mobile app.

## Phase 3 — Safe search, filters and basic directory details

Staff granted `DIRECTORY_VIEW` can search **students, parents or teachers**, filter by account status (All / Active / Invited / Suspended / Archived), sort by name or username, choose ascending/descending ordering and ten/twenty records per page. Clear filters resets the search. Results are scoped to the authenticated school, and selecting a result reveals a read-only detail card with name, username, school code and status.

**Privacy controls:** staff free-text lookup matches only usernames, display names and applicable student/teacher codes. Unlike the administrator's directory search, staff cannot use a private parent or teacher phone number, role or account status as a hidden searchable field. Status filtering is explicit and authorized; all results and counts remain school scoped. The detail card contains no private contact, family link, grades, payment data or account identifier. The server rejects unsupported filters and disallowed roles, requires an active permitted staff account and returns `Cache-Control: no-store`.

The staff directory does **not yet** offer grade/class filters or academic, attendance or fee tabs. Those need separately authorized, dedicated school-scoped data interfaces and are intentionally excluded here.

### Verify Phases 1–3

```powershell
cd C:\projects\maktab
git pull --ff-only origin main
pnpm verify:staff:phase1
pnpm verify:staff:phase2
pnpm verify:staff:phase3
pnpm typecheck
```

The Phase 3 integration test checks denied access before assignment, forced session revocation after an administrator grants permissions, correct sorting/status filtering, malformed filters, redaction, no cross-school results and disabled hidden-field searching. Test the real website manually in Dari, Pashto and English at desktop and small mobile-browser widths.
