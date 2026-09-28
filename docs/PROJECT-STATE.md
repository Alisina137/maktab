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
- Initial credentials are temporary.
- Permanent passwords are never retrievable.
- Every operational/account/academic/family operation is school-scoped.
- A parent account belongs to one school and may own multiple students in that school.
- Every student has one singular parent account relationship; there is no parent/student many-to-many table.
- Parent identities never merge across schools.
- Parent sees only linked children.
- Negaran is a teacher assignment, not a role.
- Teachers may teach multiple subjects/classes.
- Timetable teacher/class conflicts are prohibited.
- Academic and student class history is retained.
- Bulk imports validate before commit; invalid rows are not silently imported.

## Current phase

**Phase 4 — Student & Family System — complete and CI verified**

### Implemented outcomes

- `parent_profiles` for school-scoped PARENT users
- compatibility backfill for PARENT accounts created before Phase 4
- `students` with singular non-null `parentUserId`
- one parent → many same-school students
- duplicate student-code rejection within a school
- cross-school parent/class/year link rejection
- `student_class_history` for retained class/year placement
- school-admin parent creation with one-time temporary credential
- school-admin student creation linked to an existing parent
- parent reset/suspend/reactivate controls
- family/student admin overview
- CSV/TSV and XLSX import preview
- explicit import column mapping
- parent/student/teacher row validation and error preview
- explicit import confirmation
- generated temporary credentials for imported parent/teacher accounts
- parent mobile home
- default-child selection and sibling switching
- authenticated parent-home API that returns only linked children
- Dari/Pashto/English parent-home localization
- Phase 4 audit records for sensitive mutations/import completion

## Verification

GitHub Actions CI passed on the complete implementation commit:

```text
0a95f79f20699c8c334a8bef7096298946606fa6
```

Verified by CI:

- dependency installation
- TypeScript typecheck across the monorepo
- Phase 1–4 database/API test suites
- one parent owning three students
- parent login showing all three linked children
- singular parent ownership
- cross-school parent link rejection
- duplicate student-code rejection
- bulk-import duplicate validation without mutation
- CSV parsing
- XLSX worksheet parsing
- existing academic/auth/tenant regressions
- Next.js production build
- Expo Android production export

The earlier Phase 3 migration and Windows `pnpm verify` were confirmed by the user. The Phase 4 Neon migration remains a local deployment step after pulling the final source.

## Local database requirement

After pulling Phase 4, apply:

```powershell
pnpm db:migrate
```

This applies the Phase 4 migrations not already recorded in the database, including:

```text
0003_phase4_student_family.sql
0004_phase4_parent_profile_backfill.sql
```

Migration `0004` creates missing parent profiles for legacy PARENT users. Their existing username is used as the initial profile display name so the administrator can later replace it with the real parent name in the family workflow.

The migration is additive. A source rollback does not automatically undo the database migration or remove Phase 4 data.

## Phase boundary

Phase 4 does not implement attendance, homework, exams, marks, announcements, fees, or push notifications. Teacher Today and Negaran daily attendance remain Phase 5.

## Next phase

**Phase 5 — Attendance**, when explicitly requested.

Phase 5 includes Teacher Today, Negaran supervised class, daily attendance, parent attendance visibility/alerts, and attendance reporting according to the Product Specification.
