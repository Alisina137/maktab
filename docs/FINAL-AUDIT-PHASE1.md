# MaktabLink Final Audit — Phase 1: Project Foundation

**Scope:** configuration, dependency installation reproducibility, CI coverage, generated-file hygiene, and developer documentation.
**Starting baseline:** `e6e3aa7653f7e7c7c9596de47f1ab323f003d7dc` (2026-11-12).
**Release decision:** **NO-GO for unrestricted production** until the independent evidence in `RELEASE-READINESS-STEP20.md` is completed.

## Confirmed repository findings

| Finding | Evidence before Phase 1 | Resolution |
| --- | --- | --- |
| Non-reproducible main CI installation | `.github/workflows/ci.yml` used `pnpm install --no-frozen-lockfile`, unlike the role-specific CI workflows | Install with `--frozen-lockfile` on Linux and Windows, so dependency/lockfile drift fails CI |
| Missing explicit CI token/overlap policy | Main CI had no `permissions` or `concurrency` block | Set `contents: read`, deduplicate overlapping PR workflows without cancelling main-branch runs |
| Dev/CI runtime coverage gap | Linux and Windows main jobs both used Node 22, while the mobile/staff workflows used Node 24 | Keep Linux pinned to Node 22.13.1 and test the main Windows job on Node 24 |
| Academic suggestion tests did not run in normal verification | `verify:admin-grade-codes`, `verify:admin-class-codes` and `verify:admin-teacher-codes` existed but were absent from `pnpm verify` and main CI | Add the three tests to full verification and explicit Linux/Windows CI steps |
| Generated build state was versioned | `apps/web/tsconfig.tsbuildinfo` (151,045 bytes) was tracked; `.gitignore` lacked the pattern | Remove the tracked cache and ignore `*.tsbuildinfo` |
| Public setup/release guidance lagged behind implementation | README described Phase 7 as current, omitted the separate staff portal and API+ngrok auto-sync, and contained an obsolete push-delivery statement | Refresh setup, active roles, migration summary, live device limitations, and the production NO-GO message |

## Changes added

- `pnpm verify:foundation` is a fast, dependency-free consistency guard. It checks exact pnpm pinning against the lockfile, frozen installs across four workflows, main CI runtime/permission expectations, inclusion of identifier tests, ignore rules and README release caveat.
- The root `pnpm verify` now runs the foundation guard and all three academic code suggestion suites before the existing full regression steps.
- Main CI explicitly executes the same foundation and suggestion checks on Ubuntu and Windows, then retains all prior verification/build/test jobs.
- Existing app features, domain data, routes, API contracts and database migrations are intentionally unchanged in this phase.

## How to verify after merging

```powershell
cd C:\projects\maktab
git pull --ff-only origin main
pnpm install --frozen-lockfile
pnpm verify:foundation
pnpm verify:admin-grade-codes
pnpm verify:admin-class-codes
pnpm verify:admin-teacher-codes
pnpm verify
```

Use the exact merge commit's Actions results as evidence. CI can validate syntax, typechecking and in-process regressions but **cannot** validate a real database or physical Android devices.

## Remains for later phases / operator acceptance

- Phase 2: attack-oriented authentication, session, access-control and tenant-isolation review.
- Phase 3: real PostgreSQL migrations, concurrent writes, transaction/constraint auditing and recovery tests.
- Phase 4–8: admin and role-level usability, business workflows, localization, accessibility and recovery.
- Phase 9–10: deployed readiness, performance, observability, real EAS push, scheduled jobs, real encrypted backup/restore and operator sign-off.
- Existing project documentation notes historical attendance-report scaling and incomplete manual device/locale acceptance. These were **not** resolved in Phase 1.

**Verification boundary:** A green GitHub Actions run proves only the executed automation. Do not mark the production release approved until the staging/production, operational and pilot evidence is independently recorded.
