# MaktabLink Final Audit — Phase 2: Authentication, Sessions, Security

**Starting baseline:** `b6e16f223330d41563fdf19c2cdf4faafd4b9575`.
**Scope:** API authentication, session rotation, authenticated password verification, tenant-/role-aware guards and sensitive response cache behavior.
**Release classification:** production **NO-GO** until staged deployment and manual security acceptance. This phase is code hardening, not a penetration-test certificate.

## Verified issues and changes

| Finding | Risk | Fix |
| --- | --- | --- |
| Refresh-session rotation only checked session ID and non-revocation, not the old token hash | Two concurrent requests with one refresh credential could both succeed and invalidate one another's new tokens | One atomic SQL compare-and-swap update requiring the **presented refresh hash**, non-revocation, and unexpired refresh lifetime. Second use returns `401 refresh_invalid` |
| Admin email verification increment used a separate read then write | Simultaneous incorrect codes could lose count increments; a concurrently verified code could be accepted after expiry/ceiling | Atomically increment attempts under a five-attempt ceiling, expiration and unverified/unconsumed checks. Successful proof is also an atomic conditional update, and API rejects a losing claim |
| Beginning a new administrator verification cancelled previous challenges outside the insert transaction | A failed insert could invalidate existing proof unnecessarily | Use one transaction for cancellation and replacement creation. Password changes also invalidate any remaining outstanding proof |
| Archived users returned account status before password validation | Unauthenticated username enumeration via a different 403 response for archived accounts | Check the supplied password first; wrong passwords always receive generic invalid credentials |
| Login throttling was keyed solely by per-IP/school/username | Attackers could spray many usernames with no shared source budget | Add an independent bounded IP+school limiter (180 attempts / five minutes) in addition to the existing per-user limit |
| In-memory limiter map could grow indefinitely | High-volume changing-key traffic could exhaust process memory | Prune expired entries and fail closed when active-key capacity is reached |
| Self-service password/administrator email proof endpoints checked current passwords without throttling | Someone holding a stolen short-lived access token could make unlimited current-password guesses | Shared per-account password-check limiter across change-password and admin verification start (10 checks / five minutes) |
| Sensitive v1 responses did not explicitly prevent HTTP caching | Login/refresh payloads, generated credentials, account details might be cached by an intermediary | Set `Cache-Control: no-store` on non-public `/v1/` APIs; public school discovery remains cacheable |

## Verification added

- `pnpm verify:security:phase2`: fixed-window limiter unit tests plus focused API integration tests.
- Live PGlite/Fastify tests reproduce simultaneous refresh replay, verify the winning rotated token remains valid, and assert the old token cannot refresh.
- Archived-account test asserts incorrect password still receives generic `401`, while correctly authenticated account is unavailable.
- Administrator email verification tests issue concurrent guesses and require the SQL counter not to exceed or lose the five permitted attempts; simultaneous correct proofs yield a single success.
- Password guess tests block the eleventh authenticated current-password attempt with `429` and preserve normal session access.
- Main Linux and Windows CI run the focused suite. The root `pnpm verify` retains all existing account, staff, teacher, parent, student and tenant regressions.

## Design boundaries / remaining risk

- The login and password-check limiters are **per API process**, not shared across replicas. Deploy a shared atomic limiter at a trusted edge/store before horizontal scaling; reverse proxies must preserve a trusted, normalized client IP rather than blindly trusting user-supplied forwarding headers.
- API tests use PGlite; a real two-connection PostgreSQL concurrency and isolation test is a Phase 3 / pre-release acceptance requirement.
- A full independent cross-school authorization audit, browser/XSS review, token storage threat assessment and role matrix on deployed infrastructure remain prerequisites for production sign-off.
- Sessions are invalidated during password changes, resets, and account lifecycle transitions by the existing transactional store. The new atomic refresh behavior extends—not replaces—these safeguards.
- `Cache-Control: no-store` protects HTTP caches; it does **not** change the product's explicitly school/user-scoped offline cache on mobile. Offline storage privacy should be tested in Phase 8.
- Authentication and authorization remain server-authoritative. Never grant permissions based solely on selected UI role or client-stored account metadata.

## Operator commands

```powershell
cd C:\projects\maktab
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm verify:security:phase2
pnpm verify
```

**Release decision:** Keep production **NO-GO** pending documented multi-connection PostgreSQL testing, staged cross-role penetration checks, role isolation, physical device authentication and operator sign-off. See `RELEASE-READINESS-STEP20.md`.
