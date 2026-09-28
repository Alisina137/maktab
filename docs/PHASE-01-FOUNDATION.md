# Phase 1 — Product Foundation

## Outcome

Establish the multi-tenant foundation and shared design system required by the approved Product Specification V1.

## Delivered scope

- pnpm monorepo
- Next.js web foundation
- Expo Android-first mobile foundation
- Fastify base API
- PostgreSQL + Drizzle foundation schema
- school tenant + school settings
- protected platform school provisioning API
- shared validated contracts
- Dari/Pashto/English localization and RTL direction model
- shared design tokens
- database tenant-isolation integration test
- API provisioning/auth-bootstrap tests
- CI verification workflow

## Acceptance criterion

**Two schools can exist with completely isolated data.**

Verification is represented by `packages/database/src/store.test.ts`, which creates two separate schools in an ephemeral PostgreSQL-compatible PGlite database, changes settings only for School A, and asserts that School B remains unchanged.

## Explicitly excluded

Academic functionality, including:

- students
- parents
- teachers
- authentication accounts
- classes
- subjects
- timetables
- attendance
- homework
- examinations
- grades
- fees

These belong to later approved phases.

## External requirement

A real `DATABASE_URL` is required to run the migration against Neon/PostgreSQL. No production credential is stored in the repository.
