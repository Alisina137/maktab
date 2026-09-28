# MaktabLink

MaktabLink is a mobile-first, multi-tenant school-family platform for private schools in Afghanistan.

This repository follows the approved **MaktabLink Product Specification V1** and **Software Development Workflow V5 — GitHub-First Delivery**.

## Current implementation

Phase 4 adds the student-and-family onboarding layer on top of the verified tenant, authentication, and academic foundations.

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

The admin workspace contains account management, Phase 3 academic structure, and Phase 4 student/family onboarding.

## Database

Phase 3 migration:

```text
packages/database/drizzle/0002_phase3_academic_structure.sql
```

Phase 4 migration:

```text
packages/database/drizzle/0003_phase4_student_family.sql
```

Phase 4 adds:

- `parent_profiles`
- `students`
- `student_class_history`
- `student_status`

The `students.parent_user_id` column is singular by design; there is no parent/student many-to-many join table.

## Verification

```powershell
pnpm verify
```

See `docs/PROJECT-STATE.md`, `docs/PHASE-03-ACADEMIC-STRUCTURE.md`, and `docs/PHASE-04-STUDENT-FAMILY.md`.
