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

## Localization

- `fa-AF` — RTL
- `ps-AF` — RTL
- `en` — LTR

## Why no microservices

The current product does not justify distributed-system overhead. Domain separation remains explicit while deployment stays operationally simple.
