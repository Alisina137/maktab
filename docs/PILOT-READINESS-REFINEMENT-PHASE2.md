# Pilot Operations — refinement Phase 2: School Readiness

## Implemented

This refinement preserves the original **9 core readiness checks** and **7 advanced coverage metrics**, and adds a separate operational validation module to **Admin → Pilot Operations → School Readiness**.

Four school-scoped, active-academic-year timetable integrity checks are calculated from real database rows:

1. **Teacher double-booking:** two overlapping valid timetable periods assigned to the same teacher on the same weekday/year, including across different classes.
2. **Class overlap:** two valid periods for one class overlap on the same weekday/year.
3. **Unmatched assignment:** a timetable period does not have the exact same school/year/class/subject/teacher assignment with an ACTIVE TEACHER account.
4. **Invalid period:** a timetable record uses Friday, malformed HH:mm, or an end time not later than its start.

Each metric reports **affected timetable periods** rather than inflated pair counts, its denominator, a completion percentage (or null when inapplicable), and warning/critical severity. Checks are evaluated in SQL using EXISTS and school/year joins; no unbounded client-side aggregation or raw personal-data exports.

A school with **zero active-year timetable periods is NOT considered operationally verified**. Existing automated configuration readiness remains unchanged; timetable checking is a separate signal, not a new automatic pilot or production approval condition.

Two new school-admin-only API endpoints:

- `GET /v1/admin/pilot/readiness/operational` — four counts, current active-year scope and advisory readiness status.
- `GET /v1/admin/pilot/readiness/operational/issues?metric=teacher_overlap&limit=10&offset=0` — capped (max 50) paginated affected timetable records; no arbitrary `schoolId` query parameter.

UI improvements:
- Distinct **Timetable integrity** panel with four progress cards, statuses and contextual explanations.
- Expandable, paginated affected-period lists, direct correction links to Academics > Timetable or Assignments, independently retryable errors.
- Current school-session request cancellation, authenticated requests with no-store caching, accessibility/keyboard behavior and responsive Dari/Pashto RTL and English LTR styles.
- Existing readiness, subscription, and production/no-go behavior left intact.

## Validation

```powershell
pnpm verify:pilot:phase2
pnpm typecheck
pnpm test
pnpm build
```

The `verify:pilot:phase2` script now runs the existing Phase 2 guard and the refinement guard. The existing PGlite advanced-readiness test has additional real-SQL scenarios for overlaps, broken assignments, Friday/time issues, missing timetables and tenant isolation. API tests exercise authorization and pagination validation.

## Manual acceptance needed

1. Create two active-year classes and assign the same teacher to overlapping periods. Verify both affected periods are shown in Teacher double-bookings, and that the issue vanishes after a timetable correction.
2. Create overlapping periods for the same class with different assigned teachers. Confirm Class overlap also detects the problem.
3. Create a historical academic-year overlap and a second-school overlap; neither should appear in the current school's report.
4. Test adjacent periods (08:00–08:45 and 08:45–09:30). They must not be considered overlapping.
5. Check a period whose subject/teacher does not match an active assignment, a suspended teacher, Friday, and malformed/reversed times.
6. Test no active-year periods, a network error, fast role/session switching, pagination, refresh, 320/375px, browser zoom, keyboard, Dari, Pashto and English.
7. Independently verify the exact merged `main` CI run and deployed PostgreSQL behavior. Do not mark Step 20 production GO based on these configuration checks.

## Non-goals

- No new migration, new account role, automatic timetable correction, or privileged platform operation.
- No claim that a clean timetable proves classroom attendance, homework completion, live push, backups or deployment readiness.
- Future optional extensions can include verified attendance responsibility coverage, exam/fee setup checks and additional operational analytics once product requirements define reliable eligibility populations.
