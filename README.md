# MaktabLink

MaktabLink is a mobile-first, multi-tenant school-family platform for private schools in Afghanistan.

This repository follows the approved **MaktabLink Product Specification V1** and **Software Development Workflow V5 — GitHub-First Delivery**.

## Current implementation

Phase 5 adds the daily attendance and teacher workflow layer on top of the verified tenant, authentication, academic, and family foundations.

Implemented:

- TypeScript monorepo with pnpm
- Next.js school-admin web app
- Expo Android-first mobile app
- Fastify API
- PostgreSQL + Drizzle
- strict school tenant isolation
- Dari, Pashto, and English localization
- school-issued accounts and secure authentication
- academic years with DRAFT → ACTIVE → CLOSED → ARCHIVED lifecycle
- grade levels
- class sections tied to an academic year
- subject catalog
- teacher profiles extending existing TEACHER accounts
- teacher → subject → class assignments
- dated Negaran assignments with retained history
- one active primary Negaran per class/date range
- timetable periods tied to valid teacher assignments
- teacher and class timetable conflict rejection
- teacher academic read API
- school-admin academic management UI
- audit logs for Phase 3 administrative mutations
- parent profiles extending school-scoped PARENT accounts
- students linked through one singular parentUserId
- one parent account supporting multiple children in the same school
- duplicate student-code rejection per school
- retained student class history when class/year changes
- school-admin family onboarding and one-time parent credentials
- validated CSV/XLSX import for parents, students, and teachers
- import column mapping and error preview before commit
- credential generation for imported parent/teacher accounts
- parent mobile home with linked-child switching
- tenant-scoped parent home API
- school-local Teacher Today agenda
- active Negaran supervised-class cards
- explicit daily attendance for every active student
- Present / Absent / Late / Excused attendance states
- one attendance sheet per school/class/date with duplicate-request protection
- same-day Negaran correction and post-day admin correction boundary
- parent attendance history scoped to linked children
- idempotent in-app absence/late alerts
- parent alert read/unread state
- admin attendance reports with class/date filters
- submitted/pending class counts for single-day oversight
- audited school-admin attendance corrections

## Setup

```powershell
cd C:\projects\maktab
pnpm install
pnpm db:migrate
pnpm verify
```

## Run locally

Use separate terminals:

```powershell
pnpm dev:api
pnpm dev:web
pnpm dev:mobile
```

For normal LAN development, the mobile app derives the API host from Expo and uses port 4000.

For Expo tunnel development, Metro and the API need separate public endpoints. Set `EXPO_PUBLIC_API_URL` to the public HTTPS URL that forwards to the local API before starting Expo:

```powershell
$env:EXPO_PUBLIC_API_URL="https://YOUR-API-TUNNEL.example"
pnpm --filter @maktablink/mobile exec expo start --tunnel --clear
```

The mobile client prefers `EXPO_PUBLIC_API_URL` when provided and otherwise falls back to LAN host detection. Mobile API requests time out after 10 seconds instead of leaving loading states indefinitely.

School administration:

```text
http://localhost:3000/admin
```

The admin workspace contains account management, academic structure, student/family onboarding, and Phase 5 attendance oversight/corrections.

## Database

Phase 3 migration:

```text
packages/database/drizzle/0002_phase3_academic_structure.sql
```

Phase 4 migrations:

```text
packages/database/drizzle/0003_phase4_student_family.sql
packages/database/drizzle/0004_phase4_parent_profile_backfill.sql
```

Phase 5 migration:

```text
packages/database/drizzle/0005_phase5_attendance.sql
```

Phase 4 adds:

- `parent_profiles`
- `students`
- `student_class_history`
- `student_status`

The `students.parent_user_id` column is singular by design; there is no parent/student many-to-many join table.

Phase 5 adds:

- `daily_attendances`
- `student_attendances`
- `notifications`
- attendance/record/delivery status enums

Attendance notifications are currently in-app queue records. Push delivery remains a later notification phase.

## Verification

```powershell
pnpm verify
```

See `docs/PROJECT-STATE.md`, `docs/PHASE-03-ACADEMIC-STRUCTURE.md`, `docs/PHASE-04-STUDENT-FAMILY.md`, and `docs/PHASE-05-ATTENDANCE.md`.
