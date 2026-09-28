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

## Tenant isolation

The school is the tenant boundary.

Every academic table carries `schoolId`, and every academic lookup/mutation is scoped by the authenticated school. Cross-school IDs are rejected by the academic store even when a valid UUID is supplied.

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

## Localization

- `fa-AF` — RTL
- `ps-AF` — RTL
- `en` — LTR

## Why no microservices

The current product does not justify distributed-system overhead. Domain separation remains explicit while deployment stays operationally simple.
