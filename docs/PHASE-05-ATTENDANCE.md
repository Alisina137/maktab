# Phase 5 — Attendance & Daily Teacher Workflow

## Outcome

Phase 5 lets a school run daily class attendance digitally through the Afghan Negaran workflow and makes that state visible to the linked parent.

## Delivered scope

- Teacher Today
- active Negaran supervised-class access
- daily class attendance
- explicit per-student states
- duplicate submission protection
- parent attendance visibility
- in-app absence/late alerts
- attendance reports
- audited school-admin corrections

Period attendance remains optional and is not implemented in this MVP phase.

## Teacher Today

Authenticated TEACHER users can call:

```text
GET /v1/teacher/today
```

The backend derives the school-local date from the school's configured timezone.

The response contains:

- today's chronological timetable for the teacher
- active Negaran assignment(s) covering that date
- supervised class name/code
- attendance PENDING/SUBMITTED state

The mobile Teacher Home uses this data directly rather than allowing the teacher to browse unrelated classes.

## Negaran daily attendance

Teacher attendance routes:

```text
GET  /v1/teacher/negaran/:classId/attendance
POST /v1/teacher/negaran/attendance
```

Before returning or accepting a sheet, the backend verifies:

- authenticated user is a TEACHER
- teacher has a teacher profile in the same school
- teacher has an active Negaran assignment for that class/date
- class and Negaran assignment belong to the same academic year
- future dates are not used for attendance submission

### Explicit marking

The safer MVP behavior from the product specification is enforced.

The teacher must mark every active student exactly once as:

```text
PRESENT
ABSENT
LATE
EXCUSED
```

The API rejects:

- missing student states
- duplicate student IDs
- students outside the supervised class
- classes with no active students
- cross-school references

### Duplicate submission behavior

The database enforces one daily sheet per school/class/date.

If the client retries the exact same attendance payload, the API returns the existing state with:

```text
changed = false
```

and does not create duplicate student attendance or parent alerts.

A changed same-day Negaran submission updates the existing sheet and marks it CORRECTED rather than creating a second sheet.

## Attendance lock boundary

The product specification requires a teacher lock time but does not define a numeric configuration value.

Phase 5 therefore uses a school-local end-of-day MVP boundary:

- Negaran may submit/correct only today's daily attendance
- previous-day sheets are read-only to the teacher
- school admin may make later corrections
- admin corrections are audited

The date comes from `school_settings.timezone`, not the device clock.

A configurable clock-time cutoff can replace this boundary in a future settings phase without changing the attendance cardinality.

## Parent visibility

A PARENT can call:

```text
GET /v1/parent/children/:studentId/attendance
```

The relationship check requires that the requested student belong to the authenticated parent in the authenticated school.

The response includes the server-derived school-local `today` value plus recent attendance rows.

The mobile Parent Home shows:

- today's attendance
- recent attendance history
- Present/Absent/Late/Excused badges
- Not recorded state when no mark exists for today

Parents cannot edit attendance.

## Attendance alerts

When daily attendance is submitted/changed to ABSENT or LATE, the system creates or updates one in-app parent alert.

Parent alert routes:

```text
GET  /v1/parent/notifications
POST /v1/parent/notifications/:notificationId/read
```

Each notification stores:

- recipient
- type
- message
- deep link
- deduplication key
- metadata
- delivery status
- read timestamp

The attendance deduplication key is stable per attendance sheet/student.

If an unread absent/late mark is corrected to Present/Excused, its pending notification is cancelled.

Phase 5 implements the in-app alert/notification queue. Push delivery itself remains Phase 7.

## Admin attendance workspace

School administrators can query:

```text
GET /v1/admin/attendance/report
```

Filters:

- from date
- to date
- optional class

The report includes:

- Present total
- Absent total
- Late total
- Excused total
- submitted class count
- pending active-class count for a single-day view
- individual student attendance rows

Admin correction:

```text
PATCH /v1/admin/attendance/:attendanceId/students/:studentId
```

The admin may change status/note. Every successful correction writes an audit entry containing:

- student ID
- previous status
- new status
- note

The parent view and in-app alert state are synchronized to the correction.

## Database migration

```text
packages/database/drizzle/0005_phase5_attendance.sql
```

It adds:

- `daily_attendances`
- `student_attendances`
- `notifications`
- `attendance_status`
- `attendance_record_status`
- `notification_delivery_status`

Apply after pulling:

```powershell
pnpm db:migrate
```

The migration is additive. Source rollback does not automatically remove Phase 5 attendance/history/notification data.

## Verification coverage

Automated Phase 5 coverage verifies:

- Negaran can access the supervised class
- unrelated teacher cannot access another class attendance
- explicit daily attendance submission
- duplicate retry is idempotent
- duplicate retry does not create a second alert
- absent attendance is visible to the linked parent
- absent attendance creates an in-app parent alert
- school-local date is returned to the parent client
- school admin can correct the mark
- parent sees the corrected state
- existing Phase 1–4 regression suites
- TypeScript typecheck
- Next.js production build
- Expo Android production export

The implementation CI commit and local migration status are recorded in `docs/PROJECT-STATE.md`.
