# MaktabLink Architecture

## Phase 1 decisions

MaktabLink starts as a **structured modular monolith in a TypeScript monorepo**.

```text
apps/
├── api       Fastify HTTP API
├── web       Next.js administration/public web foundation
└── mobile    Expo React Native mobile foundation

packages/
├── contracts       validated shared contracts
├── database        PostgreSQL/Drizzle schema and tenant store
├── localization    Dari/Pashto/English messages + direction rules
└── design-tokens   shared semantic visual tokens
```

## Database

PostgreSQL is the system of record. Neon is the preferred hosted PostgreSQL provider, consistent with the project's workflow default for relational systems.

Phase 1 creates only tenant-level entities:

- `schools`
- `school_settings`

No academic entity is introduced in Phase 1.

## Tenant isolation

The school is the tenant boundary.

Every future school-owned entity must contain or derive an immutable `schoolId`. Server authorization must establish tenant context; clients must never be trusted to grant themselves tenant access.

Phase 1 proves the boundary through an integration test that creates two schools, changes School A settings, and verifies School B remains unchanged.

## Platform provisioning bootstrap

Phase 1 needs a way to create a school before user authentication exists. The `/v1/platform/*` provisioning surface is therefore protected by a long bootstrap secret in `PLATFORM_PROVISIONING_KEY`.

This is deliberately temporary infrastructure. Phase 2 and later platform-admin work must replace/contain it behind proper authenticated administration rather than exposing the bootstrap mechanism to normal users.

## Localization

Supported foundation locales:

- `fa-AF` — RTL
- `ps-AF` — RTL
- `en` — LTR

RTL is modeled in the shared localization package rather than added as a later visual patch.

## Design system

`@maktablink/design-tokens` is the semantic source for shared colors, spacing, radii, typography and focus semantics. Web and mobile may render these tokens differently, but should preserve meaning.

## Why no microservices

The current product does not justify distributed-system overhead. Domain separation remains in code and packages while deployment can stay simple.
