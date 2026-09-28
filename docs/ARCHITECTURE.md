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
├── database        PostgreSQL/Drizzle schema and stores
├── localization    Dari/Pashto/English messages + direction rules
└── design-tokens   shared semantic visual tokens
```

## Database

PostgreSQL is the system of record. Neon pooled PostgreSQL is the preferred hosted application connection.

Phase 1 entities: `schools`, `school_settings`.

Phase 2 entities: `users`, `auth_sessions`, `audit_logs`.

Academic entities intentionally begin later.

## Tenant isolation

The school is the tenant boundary. Every operational account belongs to exactly one school. Username uniqueness is enforced by `(schoolId, username)`, so the same username may exist in two schools without crossing tenant boundaries.

School-admin routes derive tenant context from the authenticated administrator session rather than trusting a client-provided `schoolId`.

## Authentication model

There is no public school-account registration.

Temporary and permanent passwords are stored only as memory-hard scrypt hashes with independent salts. Administrators can generate a replacement temporary password but cannot retrieve a permanent password.

Sessions use opaque tokens:

- access token: 15 minutes
- rotating refresh token: 30 days

Only SHA-256 token hashes are stored in PostgreSQL. Suspending or archiving an account revokes existing sessions.

Expo SecureStore encrypts the mobile session payload on device.

Phase 2 account roles are `SCHOOL_ADMIN`, `SCHOOL_STAFF`, `TEACHER`, `PARENT`, and `STUDENT`. Negaran is intentionally not a role; it remains a teacher assignment for Phase 3.

Mobile role selection is UX only. The backend role is authoritative.

## Platform bootstrap

`/v1/platform/*` remains protected by `PLATFORM_PROVISIONING_KEY` for school provisioning and first school-admin creation only.

## Localization

- `fa-AF` — RTL
- `ps-AF` — RTL
- `en` — LTR

## Why no microservices

The current product does not justify distributed-system overhead. Domain separation remains in modules and stores while deployment stays simple.
