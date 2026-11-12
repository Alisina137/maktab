# MaktabLink Final Audit — Phase 5: Academic Structure, Attendance and Learning Workflows

**Baseline:** `537115f74baec35710748f99bbf1d61dc67b8043` (Phase 4 main).  
**Scope:** Academic calendar and assignment consistency, Negaran school-day attendance submission, administrator/staff attendance correction, homework publication and exam grade entry.  
**Data migration:** none. **API payload changes:** none. **Production release:** remains **NO-GO** until documented manual security/device/staging acceptance.

## Code findings and applied safeguards

| Source issue found | Risk | Fix |
| --- | --- | --- |
| Creating or updating Negaran assignments read candidate overlaps then wrote a new row outside a shared transaction lock | Simultaneous admins could appoint overlapping supervisors for the same class or teacher | Wrap create/update in a transaction; lock the relevant academic-year row before reading overlaps and writing the record. Recheck dates and active/mutable year inside the lock; reject stale updates |
| Timetable create/update used read-then-insert/update without serialization | Two overlapping lessons for the same class or teacher could both be saved concurrently | Use the same academic-year row lock around each conflict query and write. Reject stale period revisions and preserve validation of teacher/class/subject assignments |
| Ending a Negaran assignment updated by ID only | A second request could silently replace the original end date | Use a conditional update requiring `end_date IS NULL`; the losing request now returns a conflict |
| Attendance calendar closure and Negaran first submission each checked for the absence of the other's record before writing | Both could commit concurrently, placing attendance marks on a closed school day | Both operations now lock the same academic year row; Negaran submissions re-check year status and the day closure after acquiring it |
| Admin corrections updated a student mark before the daily register, opposite to the teacher's lock order | Potential PostgreSQL deadlock during simultaneous teacher and admin corrections | Administrator and staff-initiated correction approvals now lock academic year → daily attendance → student mark consistently |
| Homework draft creation validated academic-year and assignment only before its insert | An assignment/year could change between preflight and creation | Re-check teacher assignment and `ACTIVE` year inside a year-locked transaction |
| Homework publication used the due date from an earlier read, while a separate draft edit could modify the deadline | A deadline edited to the past could be published and notified | Lock the homework row, recheck deadline, assignment and academic-year status within the publication transaction |
| Exam grade entry checked permission and roster before locking the exam row, but not afterward | A stale grade form could record marks for a student no longer in the assigned class or for a revoked teacher assignment | After locking the exam lifecycle row, revalidate teacher/class/subject assignment and active student roster inside the transaction before writing grades |

## Regression protection

- `pnpm verify:academic:phase5`: source-level invariant checks and focused PGlite test suites for academic assignment conflicts, staff attendance correction logic and teacher learning UI data.
- New PGlite scenario: competing Negaran appointments, overlapping timetable submissions, closed-assignment rejection and timetable update conflicts. This checks final invariants under concurrent calls using the test database.
- Existing API integration regressions exercise school and role isolation, attendance closures, lost-response retries, admin corrections, homework publication, exams, grade readiness, publication and corrections.
- Linux and Windows CI run the focused Phase 5 command alongside the existing full test suites and TypeScript checks.

## Important remaining production risks

1. Real Neon PostgreSQL **multi-connection** concurrency testing is still required: the in-memory PGlite suite does not prove throughput, lock wait/deadlock behavior or all cross-instance races.
2. Direct SQL writes or external integrations can still bypass application-level timetable/Negaran overlap checks; consider PostgreSQL exclusion constraints after a clean data preflight if external writers are introduced.
3. Existing records with inconsistent historical assignments are not backfilled or deleted in this phase.
4. Daily attendance roster changes performed concurrently with enrollment changes still require a separate tenant/year-aware transactional enrollment audit.
5. Manual web and Android flows in Dari/Pashto/English, API permission matrices and staged parent/student visibility tests remain release NO-GO gates.

## Operator check

```powershell
cd C:\projects\maktab
pnpm install --frozen-lockfile
pnpm verify:academic:phase5
pnpm typecheck
pnpm test
```

**No database migration is needed** for these Phase 5 code changes. The Phase 3 migration still requires its separate preflight and controlled staging/production runbook; pulling this branch does not execute it.

For the full readiness matrix, see `docs/RELEASE-READINESS-STEP20.md`.
