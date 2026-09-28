# MaktabLink Project State

## Product objective

Build a mobile-first, multi-tenant school-family communication platform designed for private schools in Afghanistan.

## Source of truth

- Product: **MaktabLink Product Specification V1**, supplied 2026-09-28.
- Implementation process: **Software Development Workflow V4**.
- Repository: `Alisina137/maktab`.

## Locked product rules

- School controls school-user identities.
- Mobile users choose role, then school, then use school-issued credentials.
- Role selection is UX only; backend role is authoritative.
- Initial credentials are temporary.
- Permanent passwords are never retrievable.
- Parent accounts remain school-scoped.
- Negaran is a teacher assignment, not a separate role.

## Current phase

**Phase 2 — Authentication & School Accounts — complete and verified**

### Implemented outcomes

- school-scoped user/account schema
- `(schoolId, username)` uniqueness
- user status lifecycle: INVITED / ACTIVE / SUSPENDED / ARCHIVED
- generated temporary credentials
- memory-hard salted password hashing
- forced private-password replacement on first login
- opaque short-lived access tokens
- rotating refresh tokens
- only token hashes persisted to PostgreSQL
- active-session revocation on suspension/archive/reset
- role-matched school login
- public active-school search for onboarding
- school-admin account creation and lifecycle APIs
- platform bootstrap for first school administrator
- sensitive account action audit logs
- login rate limiting
- Expo role → school → credentials → password-change flow
- Expo SecureStore session persistence
- school-admin web login and account-management UI
- Phase 2 integration/acceptance tests

## Phase 2 acceptance verification

GitHub Actions CI passed on source commit `53d4ab6f68e23a5c1a35b0639f996911d119b2a2` on 2026-09-28.

Verified successfully:

- dependency installation
- full TypeScript typecheck
- contract/localization/database/API test suites
- production Next.js build
- production Expo Android export
- same username can exist independently in different schools
- duplicate username inside one school is rejected
- parent credentials issued by School A cannot authenticate against School B
- selected mobile role must match the backend account role
- first login requires replacement of the temporary password
- suspended accounts lose active sessions

## Local database requirement

The real Neon database still needs the Phase 2 migration after pulling this source:

```powershell
pnpm db:migrate
```

This applies `0001_phase2_auth_accounts.sql`.

## Phase boundary

Phase 3 academic structure is intentionally not implemented yet. There are no academic years, grades/classes, subjects, teacher-subject-class assignments, Negaran assignments, or timetables in Phase 2.

## Next approved phase

**Phase 3 — Academic Structure**, only after the user requests it.
