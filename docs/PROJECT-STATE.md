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

**Phase 2 — Authentication & School Accounts — implementation pending integrated verification**

### Implemented in source

- user/account schema
- school-scoped username uniqueness
- temporary credentials
- memory-hard password hashing
- opaque access + rotating refresh sessions
- session revocation
- role-matched login
- public school selection API
- school-admin account lifecycle APIs
- account audit logs
- Expo role/school/login/password-change flow
- secure mobile session storage
- school-admin web account-management screen
- Phase 2 integration tests

## Verification status

Pending GitHub CI for the integrated Phase 2 commit.

## Local requirement after verification

Run `pnpm db:migrate` against the real Neon database to apply `0001_phase2_auth_accounts.sql`.

## Next approved phase

**Phase 3 — Academic Structure**, only after Phase 2 is verified and the user requests it.
