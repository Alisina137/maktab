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

**Phase 1 — Product Foundation — complete and verified**

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
- tenant isolation integration test
- API tests
- CI workflow

## Verification status

GitHub Actions CI passed for Phase 1 source commit `b55a639b5767309458c6cf799840c7044592f549` on 2026-09-28.

Verified successfully:

- dependency installation
- full TypeScript typecheck
- automated test suite
- tenant-isolation integration test
- API tests
- production build of all workspace projects

The tenant-isolation test creates two schools, changes School A settings, and verifies School B remains unchanged.

## Known issues / external requirements

- A real Neon/PostgreSQL `DATABASE_URL` is required before applying the migration to a persistent development/production database.
- `PLATFORM_PROVISIONING_KEY` must be configured as a strong secret before starting the API.
- No real school user data should be entered until authentication and account controls are implemented in Phase 2.
- The platform provisioning key is Phase 1 bootstrap infrastructure and must not become a normal end-user authentication mechanism.

## Latest source baseline

Phase 1 foundation implementation, verified on commit `b55a639b5767309458c6cf799840c7044592f549`, followed by this project-state documentation update.

## Next approved phase

**Phase 2 — Authentication & School Accounts**

Phase 2 may begin once the user requests it.
