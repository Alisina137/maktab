# MaktabLink

MaktabLink is a mobile-first, multi-tenant school-family platform for private schools in Afghanistan.

This repository follows the approved **MaktabLink Product Specification V1** and **Software Development Workflow V4**.

## Current implementation

Phase 2 adds the secure school-issued account system on top of the verified Phase 1 foundation.

Implemented:

- pnpm TypeScript monorepo
- Next.js web app
- Expo Android-first mobile app
- Fastify API
- PostgreSQL + Drizzle
- school tenant isolation
- Dari, Pashto, and English localization
- school selection
- Parent / Teacher / Student role selection
- school-scoped username/password authentication
- temporary-password replacement
- rotating access + refresh sessions
- encrypted mobile session storage
- school-admin account generation
- reset / suspend / reactivate account actions
- audit logs for sensitive account actions

Academic structure is intentionally deferred to Phase 3.

## Setup

```powershell
cd C:\projects\maktab
pnpm install
```

Fill in your real root `.env` values, then run:

```powershell
pnpm db:migrate
pnpm verify
```

## Run locally

```powershell
pnpm dev:api
pnpm dev:web
pnpm dev:mobile
```

Run those in separate terminals.

## First school + first school administrator

Phase 2 keeps platform provisioning protected by `PLATFORM_PROVISIONING_KEY`.

With the API running, create a school:

```powershell
$headers = @{ "x-platform-provisioning-key" = $env:PLATFORM_PROVISIONING_KEY }
$schoolBody = @{ code = "SCHOOL-A"; name = "Example Private School"; slug = "example-private-school"; province = "Kabul"; city = "Kabul"; defaultLanguage = "fa-AF" } | ConvertTo-Json
$school = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/v1/platform/schools" -Headers $headers -ContentType "application/json" -Body $schoolBody
```

Then create the first school-admin account:

```powershell
$adminBody = @{ username = "admin" } | ConvertTo-Json
$admin = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/v1/platform/schools/$($school.school.id)/admin" -Headers $headers -ContentType "application/json" -Body $adminBody
$admin
```

The returned temporary password is shown once. Sign in at `http://localhost:3000/admin`, then replace it with a private password.

## Verification

```powershell
pnpm verify
```

See `docs/PROJECT-STATE.md` for current implementation status.
