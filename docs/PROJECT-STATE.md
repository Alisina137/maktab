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
- Every operational/account/academic/family/attendance/learning operation is school-scoped.
- A parent account belongs to one school and may own multiple students in that school.
- Every student has one singular parent relationship.
- A STUDENT login, when issued, links to exactly one student record.
- Parent sees only linked children.
- Student sees only their own linked student record.
- Negaran is a teacher assignment, not a role.
- Teachers may create homework and marks only from valid assigned class/subject authority.
- Homework drafts are not learner-visible.
- Grade drafts are not parent/student-visible.
- Exam results become learner-visible only through school-controlled publication.
- Published grade records are corrected through an audited correction workflow rather than deleted.
- Daily attendance remains primarily the active Negaran's responsibility.
- Cross-school access is prohibited.

## Current phase

**Phase 6 — Homework, Exams & Results — complete and CI verified**

### Implemented outcomes

- Phase 6 migration `0006_phase6_learning.sql`
- singular optional `students.userId` student-account linkage
- school-issued student credential workflow
- generic unlinked STUDENT account creation blocked
- homework records bound to active teacher assignments
- DRAFT/PUBLISHED/CLOSED/ARCHIVED homework lifecycle
- teacher draft homework creation/editing
- class-specific homework publication
- parent/student published-homework visibility
- exams associated with academic year
- exam subject/class/max-score setup
- DRAFT/SCHEDULED/IN_PROGRESS/RESULTS_READY/PUBLISHED/ARCHIVED exam lifecycle
- teacher grade sheets restricted by exact assignment
- score/max-score validation
- student/class/year validation
- draft grade storage
- results-ready completeness check
- atomic grade/exam publication
- parent published-results visibility
- student published-results visibility
- homework/result notification queue records
- published grade corrections with required reason + audit metadata
- Phase 6 school-admin exam/result workspace
- Phase 6 Teacher mobile homework/marks UI
- Phase 6 Parent mobile homework/results UI
- Phase 6 Student mobile academic home
- Dari/Pashto/English Phase 6 mobile translations

## Verification

GitHub Actions CI passed on the complete Phase 6 implementation commit:

```text
5f955b8905ef5a5ab4ddce539aba4ef7c6623f97
```

Verified by CI:

- dependency installation
- monorepo TypeScript typecheck
- Phase 1–6 database/API tests
- draft homework hidden from parent/student
- published homework visible to parent/student
- unrelated-teacher grade-sheet rejection
- max-score validation
- draft marks hidden from parent
- draft marks hidden from linked student
- RESULTS_READY still hidden from learners
- publication reveals published result to parent/student
- result notification queue behavior
- published-grade administrator correction
- all existing tenant/auth/academic/family/attendance regressions
- Next.js production build
- Expo Android production export

## Local database status

Phase 5 and earlier migrations were locally verified against the configured Neon database.

Phase 6 is **not yet locally migrated/verified** in this conversation.

Pending local migration:

```text
0006_phase6_learning.sql
```

After pulling Phase 6:

```powershell
pnpm db:migrate
pnpm verify
```

Only after those commands pass should Phase 6 be marked locally verified.

## Phase 6 boundary

Implemented now:

- homework
- exam structure/lifecycle
- draft marks
- result publication
- parent/student academic visibility
- school-issued student login linkage
- notification queue records for homework/results
- audited published-grade corrections

Not included in this phase:

- dedicated S3 attachment upload UI; homework accepts an optional attachment URL
- rich exam scheduling dates
- push transport/delivery
- announcements
- fees

Push transport and broader communication/fees remain Phase 7.

## Next phase

**Phase 7 — Communication & Fees**, when explicitly requested.

Phase 7 includes scoped announcements, basic fees, push delivery, and reminder jobs according to the Product Specification.
