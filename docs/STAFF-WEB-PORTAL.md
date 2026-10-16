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
