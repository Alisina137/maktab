# Test 15 — Exams, grades and published results

Date: 2026-10-13. Scope: all steps 15.1–15.12. Product authority: MaktabLink Product Specification V1. Related API regression: `apps/api/src/app.test.ts` test **draft grades are hidden until admin publishes the complete exam, and unrelated teachers cannot grade**.

## Automated acceptance matrix

| Item | Scope | Verification |
| --- | --- | --- |
| 15.1 | Create exam only for school admin and ACTIVE academic year; duplicate name and blank name rejected. | API 201 / role 403 / invalid 400 / conflict 409, audit. |
| 15.2 | Exam subject requires the same school's exam, class, subject and existing teacher assignment; only that teacher can read/write marks. | Subject setup rejects unassigned class, other teacher denied and parent roster denied. |
| 15.3 | Required real subject-specific exam date inside the academic year, max score integer in [1,10000], no duplicate class/subject for exam. | Strict API Zod/date-range checks, Admin Solar Hijri picker and migration 0018. |
| 15.4 | Grade entry roster contains only ACTIVE students for specified year/class, with current mark and missing-mark UI. | GET returns one expected student and canEdit flag. |
| 15.5 | Mark 0..configured maximum inclusive; missing/invalid/negative/fractional/duplicate/wrong-class marks rejected. | API rejection, database unchanged; READY rejects incomplete subjects. |
| 15.6 | DRAFT and RESULTS_READY marks never appear in parent/student feeds. | Parent/Student GET results empty before publication. |
| 15.7 | Admin progression DRAFT→SCHEDULED→IN_PROGRESS→RESULTS_READY→PUBLISHED→ARCHIVED; no illegal/repeat transition. | Progression guards, serializable-by-row-lock writes, atomic publication of grades, durable notifications, audit. |
| 15.8 | Only linked parent sees published results for selected student. | Class and child identity scoping; published totals derived from visible grades. |
| 15.9 | Logged-in student sees only their own published results. | Auth derives linked student ID, same scores and totals as parent. |
| 15.10 | School-admin correction only after PUBLISHED, with reason, max validation and optimistic concurrency revision. | 403 role rejection, 404 cross-tenant, 409 stale, 400 invalid/no-change; atomic audit. |
| 15.11 | Totals recompute from each subject's maximum, including corrections. | Two subjects: initial **128/150**, corrected **131/150** on Parent and Student; no hardcoded max of 100. |
| 15.12 | Audit create/subject setup/draft saved/lifecycle/published/correction exactly once; other teacher/parent/tenant denied. | Audit assertions, one publication fan-out per authorized parent/student, no duplicate publication, archived history preserved. |

## Data migration

`packages/database/drizzle/0018_exam_subject_dates.sql` adds nullable `exam_subjects.exam_date` and an index. **New** subject setup requires a valid date within the exam's academic year. Existing historical records are not assigned made-up dates; they remain nullable and readable. Scheduling an exam with an old undated subject requires administrative data reconciliation before progression.

Run after pull:

```powershell
cd C:\projects\maktab
pnpm --filter @maktablink/database db:migrate
```

Dates are transmitted internally as ISO Gregorian `YYYY-MM-DD`, with Solar Hijri dates in the Admin date picker and localized display in Teacher/Student/Parent apps. A subject-level date is used because Mathematics and Zoology can take place on different days of the exam cycle.

## Rules and consistency

- School-admin controls exam configuration and publication. Teachers can only enter grades for a strictly matching active assignment while the exam is IN_PROGRESS. Results Ready and Published are read-only to Teachers.
- Grade writes acquire an exam-row lock and grade-completeness validation acquires the same lock, so a concurrent save cannot bypass publication readiness.
- Result publication commits the exam, grades, scoped inbox records and its audit as a single transaction. Push transport is asynchronous and cannot undo published data.
- A correction locks the grade, validates its maximum and current published state, requires a reason, rejects no-op and stale revisions, updates the mark and records previous/current values together.
- Archived exams retain published grades and remain visible as historical published results; archived correction is intentionally read-only until a formal reopening policy is specified.
- An audit log records creation, subject assignment, draft mark changes, status progression, final publication and corrected published marks. Bulk grade saves do not create an audit for identical no-op resubmissions.

## Remaining Android / operator acceptance

Android device verification remains necessary for the school admin web exam-date picker in Dari, Pashto and English, class/subject selection, grade-input keyboard and long rosters, publish notification arrival and routing, parent child switching, Student result aggregation and correction refresh, archived result history, and reconnect/offline operation. GitHub CI tests are not a substitute for these hands-on checks.

**Automation CI status and latest SHA:** `docs/PROJECT-STATE.md`. Record device acceptance only after these checks have actually been performed.
