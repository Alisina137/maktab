# MaktabLink

MaktabLink is a mobile-first, multi-tenant school-family platform for private schools in Afghanistan.

This repository follows the approved **MaktabLink Product Specification V1** and **Software Development Workflow V4**.

## Current implementation

Phase 3 adds the school academic-structure layer on top of the verified tenant and authentication foundations.

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

Student/family onboarding remains Phase 4.

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

The admin workspace now contains both account management and Phase 3 academic structure.

## Database

Phase 3 migration:

```text
packages/database/drizzle/0002_phase3_academic_structure.sql
```

It adds:

- `academic_years`
- `grade_levels`
- `class_sections`
- `subjects`
- `teacher_profiles`
- `teacher_assignments`
- `negaran_assignments`
- `timetable_periods`

## Verification

```powershell
pnpm verify
```

See `docs/PROJECT-STATE.md` and `docs/PHASE-03-ACADEMIC-STRUCTURE.md`.
