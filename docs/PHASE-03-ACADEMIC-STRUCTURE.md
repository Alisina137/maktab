# Phase 3 — Academic Structure

## Outcome

A school can model actual academic operations.

## Delivered scope

- academic years
- grades
- classes
- subjects
- teachers
- teacher assignments
- Negaran assignments
- timetable

## Business rules implemented

- A teacher may teach multiple subjects.
- A teacher may teach multiple classes.
- A class may have several subject teachers.
- Each timetable period maps one class to one subject and teacher.
- Teacher timetable conflicts are rejected.
- Class timetable conflicts are rejected.
- Negaran is a teacher assignment, not a user role.
- A teacher may be Negaran while also teaching that or other classes.
- A class may have at most one primary Negaran for any overlapping date range.
- Historical Negaran assignments are retained.
- Academic structure remains tied to an academic year.
- Closing/archiving an academic year preserves its historical data.
- Cross-school academic references are rejected.

## Academic-year lifecycle

```text
DRAFT
→ ACTIVE
↔ CLOSED
→ ARCHIVED
```

Multiple DRAFT years are allowed. Only one year may be ACTIVE per school.

A CLOSED year may either be reactivated (when no other year is ACTIVE) or archived. ARCHIVED is terminal/read-only. Archiving changes lifecycle state only; linked historical records remain stored and accessible.

## Admin workflow

The school-admin web workspace supports:

1. create academic year
2. activate/close/reactivate/archive academic year
3. create grade levels
4. create subjects
5. create class sections
6. attach teacher profiles to TEACHER accounts
7. assign teachers to subject/class combinations
8. assign Negaran
9. end an active Negaran assignment while retaining history
10. create timetable periods
11. review assignments, Negaran history, and timetable

## Teacher API

Authenticated teachers can read their own:

- teacher assignments
- Negaran assignments
- timetable periods

The teacher cannot request another school's or another teacher's academic view through this endpoint.

## Acceptance

The Phase 3 acceptance requirement is covered by automated tests:

> A teacher may teach several subjects/classes and separately supervise one class.

Additional tests verify:

- one active academic year per school
- cross-school subject assignment rejection
- teacher timetable conflicts
- class timetable conflicts
- overlapping Negaran rejection

## Explicitly excluded

Phase 4 remains outside this phase:

- students
- parent profiles
- student ↔ parent linkage
- sibling switching
- bulk student/family import

Attendance remains Phase 5.
