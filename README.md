# MaktabLink

MaktabLink is a mobile-first, multi-tenant school-family platform for private schools in Afghanistan.

This repository follows the approved **MaktabLink Product Specification V1** and **Software Development Workflow V4**.

## Phase 1 status

Phase 1 establishes the product foundation only:

- pnpm TypeScript monorepo
- Next.js web shell
- Expo Android-first mobile shell
- Fastify API
- PostgreSQL + Drizzle schema
- school tenant provisioning
- tenant-isolation primitives and tests
- Dari, Pashto, and English localization foundation
- shared design tokens

Academic features are intentionally excluded until later phases.

## Requirements

- Node.js 22.13+
- pnpm 12.5+
- PostgreSQL (Neon is recommended for hosted development/production)

## Setup

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env
```

Set a real `DATABASE_URL` and a strong `PLATFORM_PROVISIONING_KEY` in `.env`.

Run the migration:

```powershell
pnpm db:migrate
```

Run services in separate terminals:

```powershell
pnpm dev:api
pnpm dev:web
pnpm dev:mobile
```

## Provision a school

Phase 1 uses a temporary bootstrap key for platform-only school provisioning. Proper platform-admin authentication belongs to a later phase.

```powershell
$headers = @{ "x-platform-provisioning-key" = $env:PLATFORM_PROVISIONING_KEY }
$body = @{
  code = "SCHOOL-A"
  name = "Example Private School"
  slug = "example-private-school"
  province = "Kabul"
  city = "Kabul"
  defaultLanguage = "fa-AF"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:4000/v1/platform/schools" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
```

## Verification

```powershell
pnpm verify
```

See `docs/PROJECT-STATE.md` for current implementation status.
