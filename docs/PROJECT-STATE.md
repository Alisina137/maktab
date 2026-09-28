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
- Every operational/account/academic/family/attendance operation is school-scoped.
- A parent account belongs to one school and may own multiple students in that school.
- Every student has one singular parent account relationship.
- Parent sees only linked children.
- Negaran is a teacher assignment, not a role.
- Daily attendance is primarily the active Negaran's responsibility.
- Every active student must receive an explicit daily attendance state before submission.
- Duplicate daily attendance requests must not create duplicate sheets/alerts.
- School admins may correct attendance and corrections are audited.
- Period attendance remains optional and independent from daily attendance.
- Academic/student/attendance history is retained.
- Cross-school access is prohibited.

## Current phase

**Phase 5 — Attendance & Daily Teacher Workflow — complete and CI verified**

### Implemented outcomes

- `daily_attendances` class/date attendance sheets
- `student_attendances` explicit student marks
- PRESENT / ABSENT / LATE / EXCUSED states
- one daily attendance sheet per school/class/date
- one student mark per attendance sheet/student
- school-local date calculation from school timezone
- Teacher Today chronological timetable
- active Negaran supervised-class card
- pending/submitted attendance indicator
- same-school/date/class authorization checks
- explicit mark-every-student validation
- duplicate retry/idempotency protection
- same-day Negaran correction
- school-local day attendance lock for teacher edits
- admin post-lock correction
- audited admin attendance correction
- parent recent attendance history
- parent today's attendance state
- server-provided school-local `today`
- in-app absent/late parent alerts
- notification deduplication and read/unread state
- cancellation of unread alert after Present/Excused correction
- admin date/class attendance reports
- Present/Absent/Late/Excused summaries
- single-day submitted/pending class counts
- Dari/Pashto/English mobile attendance UI

## Verification

GitHub Actions CI passed on the complete Phase 5 implementation commit:

```text
03a38f9771b771adb70eb286b1102bc45b9b0008
```

Verified by CI:

- dependency installation
- monorepo TypeScript typecheck
- Phase 1–5 database/API tests
- Negaran attendance submission
- non-Negaran class-access rejection
- duplicate attendance retry idempotency
- parent attendance visibility
- absent parent alert creation
- admin correction and parent corrected visibility
- school-local today value
- all existing tenant/auth/academic/family regressions
- Next.js production build
- Expo Android production export

The Phase 5 Neon migration has **not yet been verified locally** in this conversation.

## Local database requirement

After pulling Phase 5, run:

```powershell
pnpm db:migrate
```

This applies:

```text
0005_phase5_attendance.sql
```

It is additive. A source rollback does not automatically undo attendance or notification records.

## Phase 5 boundary

Implemented now:

- daily Negaran attendance
- Teacher Today
- parent attendance visibility
- in-app absent/late alerts
- admin reports/corrections

Not included in this phase:

- optional period attendance
- push transport/delivery
- homework
- exams/results
- announcements/fees

Push notifications remain Phase 7. Period attendance remains optional according to the product specification.

## Next phase

**Phase 6 — Homework, Exams & Results**, when explicitly requested.

Phase 6 includes homework, examination structure, marks, draft/publication state, and parent/student visibility.
