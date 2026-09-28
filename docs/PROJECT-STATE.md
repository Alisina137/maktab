# MaktabLink Project State

## Product objective

Build a mobile-first, multi-tenant school-family communication platform designed for private schools in Afghanistan.

## Source of truth

- Product: **MaktabLink Product Specification V1**, supplied 2026-09-28.
- Implementation process: **Software Development Workflow V4**.
- Repository: `Alisina137/maktab`.

## Agreed product rules already locked

- School is the paying tenant/customer.
- A parent account belongs to exactly one school.
- One parent account can manage multiple children in that same school.
- Every student links to exactly one parent account.
- Cross-school parent identity merging is not part of the product.
- Negaran is a teacher assignment/capability, not a separate user role.

## Technology stack

- TypeScript monorepo with pnpm
- Next.js web
- React Native + Expo mobile
- Fastify API
- PostgreSQL
- Drizzle ORM
- S3-compatible storage later when files are introduced
- Expo push notifications later when notification delivery is introduced

## Current phase

**Phase 1 — Product Foundation**

### Implemented outcomes

- monorepo structure
- database schema for `schools` and `school_settings`
- school tenant store
- school provisioning API protected by temporary platform bootstrap key
- localization package (Dari/Pashto/English)
- RTL/LTR direction rules
- shared design tokens
- web foundation shell
- mobile foundation shell
- tenant isolation test
- API tests
- CI workflow

## Verification status

- Local dependency installation/build is unavailable in the implementation environment because npm registry access timed out.
- CI is configured to run install, typecheck, test, and build on GitHub.
- Final phase status must be updated after GitHub CI completes.

## Known issues / external requirements

- A real Neon/PostgreSQL `DATABASE_URL` is required before applying the production/development migration.
- `PLATFORM_PROVISIONING_KEY` must be configured as a strong secret before starting the API.
- No real school data should be entered until authentication and account controls are implemented in later phases.

## Latest source baseline

Phase 1 foundation implementation.

## Next approved phase

Phase 2 — Authentication & School Accounts, after Phase 1 verification is complete.
