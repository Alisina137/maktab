# Phase 11 — Staging Validation & Controlled Pilot Acceptance

**Status:** STARTED — planning and evidence framework only; live execution NOT YET VERIFIED.  
**Opened:** 2026-11-13.  
**Repository:** `Alisina137/maktab`.  
**Baseline:** Phase 10 audit merged into `main` as `becde287a1a78f06914c0f7114415a6d58e9386a`.  
**Production decision:** **NO-GO**; this follow-on phase does not override the Phase 10 release decision.

## Why there is a Phase 11

The agreed code audit was explicitly **10 phases**, culminating in [the Phase 10 final audit](FINAL-AUDIT-PHASE10.md). Phase 11 is a **new, separately scoped operational acceptance phase**, not an unfinished audit feature. The existing in-process tests and static UI checks cannot prove that a real Neon database, deployed web portal, Android phones, push credentials, scheduled jobs, monitoring or independent school personnel work together. This phase turns Phase 10's twenty `UNVERIFIED` live journeys into an actionable, independently evidenced *controlled pilot* process.

Do **not** mark a scenario PASS from source inspection, GitHub CI, simulated PGlite tests, tool output or a generated report. Do not represent this kickoff as a deployment, a live migration or authorization to launch.

## Scope and tasks

| Task | Workstream / definition of done | Status |
| --- | --- | --- |
| **11.1** | **Staging inventory and safety baseline.** Document a dedicated, isolated Neon staging environment; confirm encrypted backup and database identity before migrations; run existing read-only Phase 3/6 preflights; capture exact candidate SHA, Linux/Windows CI results, endpoints and rollback ownership. | **STARTED — checklist created, external execution pending** |
| **11.2** | **Browser and tenant E2E.** On staged API/web, execute Admin and separate Staff roles, two independent schools, academic lifecycle, family/account permissions, enrollment, attendance, grades, and fees. Attach redacted browser/API evidence. | PENDING |
| **11.3** | **Mobile, localization and accessibility.** On at least one real Android phone, exercise Teacher/Negaran, Parent with siblings and Student, including Dari/Pashto RTL and English LTR, Solar Hijri dates, font scaling, TalkBack, airplane mode and account switching. | PENDING |
| **11.4** | **Integrations and finance resilience.** Verify real push/device receipts, communication and subscription scheduler execution, idempotency, retries, manual AFN payment/reversal/reconciliation, and cross-request concurrency using staging Postgres connections. | PENDING |
| **11.5** | **Disaster recovery and production operations.** Perform encrypted backup authentication and restore **only into a separate, disposable staging database** using Phase 10 safeguards; record RPO/RTO, /ready/private metrics, alerts, load/error scenarios, rollback drill. | PENDING |
| **11.6** | **Defect triage, re-test and independent release review.** Link evidence to the exact deployed SHA, reconcile all 20 Phase 10 journeys and 11 external gates, fix blockers in separate reviewed PRs, repeat changed cases, obtain an independently authorized pilot decision. | PENDING |

Each task can uncover application defects. Those are to be fixed with tested source changes on separate branches/PRs, not silently waived by editing acceptance results.

## Kickoff: Task 11.1

Use a **non-production staging database and isolated test schools only**. Record:

- Commit and build identity (`git rev-parse HEAD`) plus the deployed API/web/mobile build identifiers.
- Staging database identity and proof it is separate from production; **never save connection strings or credentials in Git/evidence**.
- Real `pnpm db:check` and the existing read-only `pnpm db:preflight:phase3` and `pnpm db:preflight:phase6` results, including any incompatibilities. These checks must run against the intended isolated environment.
- Backups, backup verification, rollback approver, and migration change window before any `pnpm db:migrate` on staging.
- Actual exact-SHA GitHub Actions Linux/Windows job results. They cannot be inferred from a report listing configured commands.
- Redacted and time-stamped links for **every** manually executed journey. Start each untested case as `UNVERIFIED`.

Recommended local baseline, with existing development `.env` preserved:

```powershell
cd C:\projects\maktab
git status --short
git rev-parse HEAD
pnpm install --frozen-lockfile
pnpm verify:release:phase10
```

Only after independent confirmation that staging database configuration is correct and backups exist, run the actual staging preflights, then plan ordered migrations. **Do not point these commands at a production database as a rehearsal.** `pnpm verify` is a code quality gate, not a substitute for external evidence.

## Required evidence per journey

Use [Phase 10's live journey matrix](FINAL-AUDIT-PHASE10.md) and existing [release evidence manifest](PHASE7-RELEASE-MANIFEST.example.json) rather than creating an incompatible second acceptance standard. Keep completed manifests **outside Git**; store full screenshots, logs, and credentials only in approved restricted storage, with PII redacted. At minimum capture:

- Journey ID and actor/role, expected and actual result, PASS/FAIL/BLOCKED.
- Exact source SHA **and** actual staged web/API/mobile build identity.
- UTC time and environment name, device OS/browser version and safe school identifier.
- Link to independently reviewable redacted evidence; defect ID and reproducible steps if failed.
- Named operator and independent reviewer; no auto-approval.

A PASS from a different build, development PGlite or CI is not a PASS for the release candidate. Real student or parent personal information must not be pasted into reports or Git issues.

## Exit gate

**Phase 11 is complete only when** all applicable twenty live journeys are independently exercised for the exact pilot build, critical/high defects are resolved and re-tested, staged Neon migrations and separate-database restore are evidenced, live mobile/RTL/offline/push and scheduler/monitoring behavior are proven, the release evidence validator and review process succeed, and an authorized operator explicitly accepts the bounded pilot.

Until then, the release state remains **NO-GO**. A controlled school pilot and unrestricted production rollout are different decisions; Phase 11 does not automatically authorize either.

## Next action

**Task 11.1:** Set up isolated staging and collect read-only preflight/CI/environment evidence without writing to production. This environment-dependent task is **not** complete merely because this roadmap exists.

## Phase 11 implementation delivery — 2026-11-13

The repository now contains the **automatable scaffolding for all Tasks 11.1–11.6**:

- `pnpm verify:pilot:phase11` runs safety and evidence tests in root verification and Linux/Windows GitHub CI.
- `pnpm pilot:phase11 preflight` verifies isolated staging identities before executing existing read-only Neon PostgreSQL connectivity and migration checks. It never migrates or alters a database.
- `pnpm pilot:phase11 probe` checks deployed staging liveness, readiness, metrics privacy, anonymous route access and optional staging administrator cross-role denial via GET-only requests.
- `pnpm pilot:phase11 init / record / defect / report` handles independently reviewed, immutable external evidence revisions for all 20 live journeys and 11 required gates, tracks defects, blocks stale/mismatched SHA evidence, and never grants release approval.
- The complete operator workflow, PowerShell commands, browser/mobile journeys, integration verification and disaster-recovery guardrails appear in [the Phase 11 execution runbook](PHASE11-EXECUTION-RUNBOOK.md).

**Critical distinction:** All six tasks have an implemented **execution and verification workflow**, but their **real-world acceptance is still pending**. No remote staging resources, host database migration, Android device, push receipt, external scheduler or separate staging restore was exercised or invented by this source change. All 20 journeys and 11 gates stay UNVERIFIED until independently performed and recorded. Release remains **NO-GO**.
