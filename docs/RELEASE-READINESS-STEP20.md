# MaktabLink — Step 20 Final Release-Readiness Report

**Date:** 2026-10-14  
**Release channel assessed:** production (unrestricted rollout)  
**Decision:** **NO-GO — live integration and operator acceptance are not complete.**  
**Source candidate:** GitHub `main` after Step 20 security, schema-regression, CI, and public landing fixes.  
**Master regression matrix:** [TEST-20-FULL-REGRESSION.md](TEST-20-FULL-REGRESSION.md).

## 1. Automated regression: what is actually verified

| Evidence | Result | Boundary |
| --- | --- | --- |
| Baseline full CI prior to Step 20 (`5e035a3f5ba0`) | PASS: Ubuntu verification and Windows Node 24 API job | Unit/API/store integration, build |
| Step 20 complete ordered Drizzle migration-chain regression (`8e5f6d10bf18`) | PASS: all journal entries applied in PGlite | PostgreSQL-compatible in-process database, **not hosted Neon** |
| Same Step 20 SQL-chain run | PASS: 54 API tests, 17 database tests, 4 contracts, 4 localization tests, zero failures | API, domain stores and core locale formatting |
| Source-level coverage gate `pnpm verify:release` | Added to local `pnpm verify` and both CI operating systems | Guards against accidentally dropping critical integration cases; **does not execute real devices** |
| Parent RTL/offline verification | Added explicitly to Linux and Windows CI in addition to local `pnpm verify` | Static source invariants and offline reconnect unit tests |
| Post-Step20 school-status/archived-session security regression | Added: previously issued tokens must not keep operating when school is INACTIVE or account is ARCHIVED | Real in-process API integration test; exact release SHA CI must pass before approval |

The latest CI status must be verified on GitHub for the **exact release SHA**. A green earlier commit is not sufficient to assert the final source passes.

## 2. Step 20 changes / issues fixed

1. Corrected public web landing content that still claimed Student/Parent onboarding and attendance were not implemented; preserved responsive grid, keyboard focus and semantic headings.
2. Added a full 20-entry migration journal replay test, including migration `0013_teacher_assignment_slot_unique` omitted from earlier API test fixtures. Checks critical exam-date, fee idempotency and assignment unique constraints.
3. Added an executable release-evidence guard for workflows 20.1–20.18 and required localized/client/CI source markers; prior checks cannot silently vanish without a CI failure.
4. Added the missing parent localization and resilience steps to Ubuntu/Windows CI so the release pipeline matches local verification more closely.
5. **Security:** Confirmed the shared session authenticator already rejects INACTIVE schools and ARCHIVED users for existing access and refresh credentials. Added a regression covering Admin and Parent tokens, reactivation, and archive revocation so this protection cannot regress.
6. Preserved Step 19 Windows/Node24 test execution and the quoted cross-platform TypeScript test globs that were previously masking failures on Ubuntu.

## 3. Remaining blockers

| Severity | Blocker | Required evidence |
| --- | --- | --- |
| Critical | Remote Neon PostgreSQL connectivity/migrations not independently confirmed after user's CONNECT_TIMEOUT | Successful `pnpm db:check`, `pnpm db:migrate`, real `/ready` |
| High | No recorded complete Android Teacher/Parent/Student journey on a real deployed API | Build/device matrix with screenshots/defects, isolation and all key business workflows |
| High | Keyboard/TalkBack, responsive widths, font scaling, Dari/Pashto/English and reduced-motion manual acceptance not yet signed off | Accessibility/locale sign-off on web, Android phone/tablet |
| High | No demonstrated production Push token/delivery/navigation with real EAS/FCM settings | Delivery report on representative Android devices |
| High | No documented encrypted backup/off-host storage and restore into disposable database | Dated encrypted backup and successful non-production restore drill |
| High | External communication/subscription scheduler and monitoring alert routes not yet shown operational | Scheduler/job logs, no duplicate alerts, monitoring alerts and health probes |
| High | Concurrent multi-connection PostgreSQL finance and reminder retry tests not verified against hosted Postgres | Two-session DB transaction and reconciliation evidence |
| High | School administrator/pilot operator has not approved a complete pilot rollout | Final operator acceptance record, known issues, rollback plan |
| Required gate | Green Linux **and** Windows GitHub Actions for the exact final Step20 commit | Successful final workflow jobs, no skipped critical suites |

The complete acceptance script is in [TEST-20-FULL-REGRESSION.md](TEST-20-FULL-REGRESSION.md).

## 4. Known product/verification limitations

- Fee payments represent school-recorded **manual AFN** receipts and reversals; the product does not collect card/bank payments online.
- PGlite and Fastify in-process tests verify business rules, not external database failover, race behavior or WAN availability.
- Expo push plumbing exists; app registration, provider configuration and real device delivery still depend on deployment credentials.
- Database backups require PostgreSQL client tools and a separate encryption secret; the existence of scripts alone does not prove a recovery point.
- Automatic announcements and subscription notices require a configured external scheduler; no scheduler is provisioned automatically.
- Static accessibility and responsive assertions do not constitute WCAG/TalkBack/browser zoom acceptance.
- A CI build does not by itself validate Android store signing, rollout channel, distribution credentials or acceptance on all devices.

## 5. Operator pre-release evidence form

Record actual observations, not assumptions:

| Item | Operator result | Evidence / link |
| --- | --- | --- |
| Final Git SHA and green Linux/Windows jobs | Not recorded | |
| Neon connection and all migrations applied | Not recorded | |
| Pilot school Admin/Teacher/Parent/Student accounts tested | Not recorded | |
| 20.5–20.12 real cross-role end-to-end journeys | Not recorded | |
| 20.14 unauthorized access / cross-school isolation tested live | Not recorded | |
| 20.15–20.16 Dari/Pashto/English, RTL, keyboard, TalkBack | Not recorded | |
| 20.17 offline and reconnection drill | Not recorded | |
| Encrypted backup and non-production restore | Not recorded | |
| Live push and scheduler/alerts | Not recorded | |
| Rollback plan and operator sign-off | Not recorded | |

## 6. Recommendation

**Do not declare production-ready.** The automated coverage can support a **controlled pilot candidate**, but an unrestricted rollout requires the above environmental, accessibility, mobile, push, backup, and operator proofs. Re-run `pnpm verify` after pulling and resolve any failures before recording final sign-off.
