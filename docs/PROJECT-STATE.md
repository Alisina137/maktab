# MaktabLink Project State

## Product objective

Build a mobile-first, multi-tenant school-family communication platform designed for private schools in Afghanistan.

## Source of truth

- Product: **MaktabLink Product Specification V1**, supplied 2026-09-28.
- Implementation process: **Software Development Workflow V4**.
- Repository: `Alisina137/maktab`.

## Locked product rules

- School controls school-user identities.
- Role selection is UX only; backend role is authoritative.
- Initial credentials are temporary.
- Permanent passwords are never retrievable.
- Every operational/account/academic operation is school-scoped.
- Negaran is a teacher assignment, not a role.
- Teachers may teach multiple subjects/classes.
- Timetable teacher/class conflicts are prohibited.
- Academic history is retained.

## Current phase

**Phase 3 — Academic Structure — complete and verified**

### Implemented outcomes

- academic-year state lifecycle
- grade levels
- academic-year class sections
- subjects
- teacher profiles linked to TEACHER users
- teacher-subject-class assignments
- dated Negaran assignments
- retained Negaran history
- timetable periods
- teacher/class timetable conflict detection
- tenant-scoped academic store
- school-admin academic APIs
- teacher academic read API
- school-admin academic management UI
- Phase 3 audit logging
- Phase 3 database/API acceptance tests

## Verification

GitHub Actions CI passed on source commit:

```text
28721df47facdd7dbf28391409f71947aa7cb3f6
```

Verified:

- dependency installation
- TypeScript typecheck
- Phase 1–3 test suites
- academic tenant isolation
- teacher multi-subject/multi-class assignment
- separate Negaran assignment
- one active academic year
- overlapping Negaran rejection
- class timetable conflict rejection
- teacher timetable conflict rejection
- API academic workflow
- Next.js production build
- Expo Android production export

## Local database requirement

After pulling Phase 3, apply the real Neon migration:

```powershell
pnpm db:migrate
```

This applies:

```text
0002_phase3_academic_structure.sql
```

## Phase boundary

Phase 3 does not create students or family relationships and does not implement attendance.

## Next approved phase

**Phase 4 — Student & Family System**, only when requested.
