# MaktabLink Architecture

## Architecture style

MaktabLink uses a **structured modular monolith in a TypeScript monorepo**.

```text
apps/
├── api       Fastify HTTP API
├── web       Next.js school/platform web surface
└── mobile    Expo React Native mobile app

packages/
├── contracts       validated shared contracts
├── database        PostgreSQL/Drizzle schema and domain stores
├── localization    Dari/Pashto/English messages + direction rules
└── design-tokens   shared semantic visual tokens
```

## Database

PostgreSQL is the system of record. Neon pooled PostgreSQL is the preferred hosted application connection.

### Phase 1

- `schools`
- `school_settings`

### Phase 2

- `users`
- `auth_sessions`
- `audit_logs`

### Phase 3

- `academic_years`
- `grade_levels`
- `class_sections`
- `subjects`
- `teacher_profiles`
- `teacher_assignments`
- `negaran_assignments`
- `timetable_periods`

### Phase 4

- `parent_profiles`
- `students`
- `student_class_history`

### Phase 5

- `daily_attendances`
- `student_attendances`
- `notifications`

### Phase 6

- optional singular `students.user_id` login linkage
- `homeworks`
- `exams`
- `exam_subjects`
- `grade_records`

### Phase 7

- `communication_settings`
- `announcements`
- `fee_invoices`
- `fee_payments`
- `devices`
- `notification_push_deliveries`

## Tenant isolation

The school is the tenant boundary.

Every operational table carries or derives a school tenant boundary. Academic and family lookups/mutations are scoped by the authenticated school. Cross-school parent, class, year, and student identifiers are rejected even when a valid UUID is supplied.

## Authentication model

There is no public school-account registration.

Temporary and permanent passwords are stored only as salted, memory-hard scrypt hashes. Opaque access/refresh tokens are stored only as hashes.

School-admin routes derive tenant context from the authenticated administrator session rather than trusting a client-provided school ID.

## Phase 3 academic model

### Academic year

```text
DRAFT → ACTIVE → CLOSED → ARCHIVED
```

Only one academic year may be ACTIVE per school.

Closed/archived years do not accept new academic structure.

### Teacher model

A teacher profile extends one existing `TEACHER` user account.

```text
Teacher
  → many TeacherAssignments
  → many NegaranAssignments
  → many TimetablePeriods
```

A teacher assignment explicitly binds:

```text
Academic Year + Teacher + Subject + Class
```

### Negaran

Negaran remains an assignment, not a role.

Assignments are dated so history is retained. A class cannot have overlapping primary Negaran assignments.

### Timetable

Each period maps:

```text
Academic Year + Weekday + Time
→ Class + Subject + Teacher
```

The API requires a matching teacher assignment before a period can be created.

Overlapping timetable periods are rejected for:

- the same class
- the same teacher

## Phase 4 family model

A parent profile extends one existing school-scoped `PARENT` user identity.

```text
School
  → many Parent users
  → many Students

Parent user
  → many Students

Student
  → exactly one parentUserId
```

There is intentionally no Parent ↔ Student many-to-many table. The database stores one non-null `students.parent_user_id`, and family-store queries always include the authenticated `schoolId`.

Student class placement is current-state data on `students`. The additive `student_class_history` table retains prior class/year placement when an administrator moves a student, so transfers do not erase academic history.

### Parent mobile boundary

`GET /v1/parent/home` derives the parent identity from the authenticated session. It does not accept a parent or student ID from the client and returns only students whose `parentUserId` is that authenticated parent.

Child switching is local mobile UI state over that already-scoped response.

### Bulk import

The Phase 4 import pipeline is deliberately staged:

```text
CSV/XLSX upload
→ parse preview
→ explicit column mapping
→ domain validation
→ row error preview
→ explicit confirm
→ transactional import
→ temporary credentials where accounts are created
```

Invalid rows are never silently committed. Parent/teacher imports generate school-issued temporary credentials; student imports create student records linked to an existing same-school parent.

## Phase 5 attendance model

Daily attendance is class-level and school-scoped:

```text
DailyAttendance
  → school
  → academic year
  → class
  → date
  → submitted/updated actor

DailyAttendance
  → many StudentAttendance rows
```

The database enforces one daily attendance sheet per:

```text
school + class + date
```

and one mark per:

```text
attendance sheet + student
```

Each active student in the supervised class must receive exactly one explicit state before a Negaran submission is accepted:

- PRESENT
- ABSENT
- LATE
- EXCUSED

### Negaran authorization and locking

The teacher API derives teacher/school identity from the authenticated session. Access to a class attendance sheet additionally requires an active Negaran assignment that covers the requested date.

The product specification requires a lock boundary but does not define a numeric lock time. The Phase 5 MVP therefore uses the school-local calendar day as the boundary:

- active Negaran may submit/correct today's attendance
- future attendance is rejected
- after the school-local date changes, the Negaran sheet becomes read-only
- school admin may make a later correction
- admin correction is written to the audit log

School-local date is computed server-side from `school_settings.timezone`; parent and teacher flows do not trust the phone clock for the meaning of “today.”

### Attendance alerts

ABSENT/LATE marks create an in-app notification for the linked parent with:

- type
- timestamp
- deep link
- deduplication key
- delivery status
- read/unread state

The deduplication key is tied to attendance sheet + student, so a duplicate attendance retry does not create another alert.

Changing an unread ABSENT/LATE mark to PRESENT/EXCUSED cancels its pending in-app alert.

Attendance persistence is separate from future push delivery. Phase 5 creates the in-app alert/queue record; push transport remains Phase 7.

### Reporting

School admins can filter attendance by date range and active class. The report returns individual student marks plus Present/Absent/Late/Excused totals.

For a single-day report, it also compares active classes against submitted attendance sheets to surface submitted/pending class counts.

## Phase 6 learning model

### Student identity

Existing student records remain valid without a mobile login. When the school issues a STUDENT credential, the family workflow creates the user and stores one unique optional `students.user_id`.

```text
STUDENT user
  → exactly one linked Student record

Student record
  → zero or one STUDENT user
```

The student academic endpoint derives the user ID from the authenticated session and does not accept a student ID from the client. A student can therefore resolve only their own linked student record.

### Homework authorization

Homework is anchored to an existing `teacher_assignments` row.

```text
Active TeacherAssignment
  → Teacher + Academic Year + Class + Subject
  → Homework
```

Creation and publication require that the authenticated teacher owns that assignment and that its academic year is ACTIVE. A teacher cannot create homework for an unrelated class/subject.

Homework lifecycle:

```text
DRAFT → PUBLISHED → CLOSED → ARCHIVED
```

Only DRAFT homework is editable. Published/closed homework is visible to the class's linked parents and student accounts. Draft homework is never returned by learner-facing endpoints.

### Exam and marks model

```text
Exam
  → Academic Year
  → many ExamSubjects

ExamSubject
  → Exam + Class + Subject + maxScore

GradeRecord
  → ExamSubject + Student + score + remark
```

An ExamSubject can be configured only when the selected class/subject already has a teacher assignment in that academic year.

Exam lifecycle:

```text
DRAFT
→ SCHEDULED
→ IN_PROGRESS
→ RESULTS_READY
→ PUBLISHED
→ ARCHIVED
```

Teachers may enter/update DRAFT marks only while the exam is IN_PROGRESS and only where their active teacher assignment exactly matches the exam year/class/subject.

The store validates:

- student belongs to the exam class/year
- each student appears at most once in a save request
- score does not exceed the ExamSubject maximum
- unrelated teachers cannot open or write the grade sheet

Moving an exam to RESULTS_READY requires a mark for every active student in every configured ExamSubject.

### Publication boundary

Draft grades are filtered out of both parent and student APIs.

Publishing an exam is a database transaction that:

1. changes all exam grade records to PUBLISHED
2. sets their common publication timestamp
3. changes the Exam to PUBLISHED

Only after that transaction do learner-facing APIs expose the results.

Published grades do not have a delete route. A later correction must use the school-admin correction workflow, which requires a reason and writes the previous/new values to the audit log.

### Phase 6 notifications

Homework/result publication inserts deduplicated recipient records in the shared `notifications` table for linked parent/student users.

The Phase 6 parent mobile stream can display these notification records. Student academic visibility is provided directly through Student Home. Push transport/delivery remains Phase 7.

## Phase 7 communication and fees

### Announcement audience model

Every announcement stores one explicit audience scope:

```text
SCHOOL
CLASS + classId
ROLE + audienceRole
```

Learner-facing announcement queries always begin with the authenticated school and then apply the audience rule.

CLASS visibility is derived from current tenant relationships:

- active students in the class
- their linked parent account
- linked student account when one exists
- teachers assigned to the class
- Negaran teacher assigned to the class

A Negaran-created announcement is accepted only for the teacher's currently supervised class.

### Fee model

```text
FeeInvoice
  → Student
  → amount in whole AFN
  → due date
  → lifecycle status

FeeInvoice
  → many FeePayment ledger rows
```

Invoice lifecycle:

```text
DRAFT
→ ISSUED
→ PARTIALLY_PAID
→ PAID

ISSUED/PARTIALLY_PAID
→ OVERDUE

eligible unpaid invoice
→ CANCELLED
```

The payment ledger is immutable through the API. A mistake creates a separate REVERSAL row referencing the original PAYMENT. Net paid/outstanding values are derived from PAYMENT minus REVERSAL rows.

Parents can read issued/non-draft invoices only for linked children. A linked STUDENT account can read only that student's fees.

Online collection/payment-provider integration is intentionally outside the MVP.

### Reminder automation

School communication settings store configurable fee reminder days independently from earlier school-settings migrations.

The protected communication job:

```text
POST /v1/platform/jobs/communication/run
```

performs:

1. due scheduled-announcement materialization
2. fee due/overdue reminder materialization
3. pending/failed push-delivery attempts

Notification deduplication keys make scheduled materialization safe to retry.

### Push-delivery boundary

The shared `notifications` table remains the durable in-app event/recipient record.

`devices` stores a school/user-bound Expo push token.

`notification_push_deliveries` stores each notification/device delivery attempt independently with status, attempt count, provider message ID, and last error.

The Expo provider adapter may fail without changing or rolling back the underlying announcement, attendance, homework, published result, or fee record.

Mobile push registration is also best-effort. The app remains fully usable when notification permission, EAS configuration, Expo service, or connectivity is unavailable.

## Localization

- `fa-AF` — RTL
- `ps-AF` — RTL
- `en` — LTR

## Why no microservices

The current product does not justify distributed-system overhead. Domain separation remains explicit while deployment stays operationally simple.
