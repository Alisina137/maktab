# Phase 12 — Controlled Pilot Observability and Incident Response

**Status:** Task 12.1 source implementation in progress; real-world staging/Android/operator tests remain unverified.  
**Started:** 2026-11-13  
**Release posture:** **NO-GO** until independent acceptance of the exact deployed build.

Phase 11 created evidence-gated staging acceptance workflows; it has **not** established that a deployed school pilot is ready. Phase 12 follows it by introducing safe, bounded canary checks and a structured response to incidents. It does **not** replace the 20 live journeys or 11 independent release gates of Phases 10–11.

## Proposed workstreams

| Step | Outcome | State |
| --- | --- | --- |
| **12.1** | Explicitly isolated staging API canary: repeated read-only health/readiness, private metrics, anonymous role endpoints and optional Admin-role denial; detect failures and leaks; generate external immutable diagnostics without credentials. | **SOURCE IMPLEMENTED — live observation pending** |
| **12.2** | Bounded monitoring history and incident severity thresholds with operator acknowledgement, alert integrations and recovery validation. | PLANNED |
| **12.3** | Synthetic multi-school post-deploy smoke in a disposable staging school with safe cleanup, authentication and tenant authorization. | PLANNED |
| **12.4** | Staging integration observation: scheduled jobs, push receipts, fee ledger totals, and offline device rollout checklist. | PLANNED |
| **12.5** | Operator-facing read-only pilot rollout evidence overview, with safe redaction and no automatic approval. | PLANNED |
| **12.6** | Exact-SHA pilot decision package, known-issue rollback and independent change review. | PLANNED |

## 12.1 — What is implemented

`scripts/phase12-canary.mjs` reuses the Phase 11 **GET-only** `probeStagingApi`. It observes a bounded sequence of 2–12 probe rounds and enforces a short total sampling window. It checks staged API `/health`, `/ready`, private `/metrics`, anonymous Admin/Staff/Teacher/Parent/Student endpoint denial, and optional staging Admin role denial when credentials were provided to the Phase 11 probe. It never performs account creation, payment writes, subscription changes, migration, backup restoration or notification delivery.

Each sampled result records **time, endpoint path, HTTP status, check type and pass/fail**, but never a token, database URL, response body, school identifier or student record. The process refuses to write the file into the Git checkout and will not overwrite an existing evidence report.

A readiness outage, network failure, unauthenticated metrics disclosure or unauthorized API 200 response triggers `HALT_AND_INVESTIGATE`. Even a clean canary returns only `STAGING_OBSERVATION_PASS`, with `productionDecision: NO_GO`. This is an **operational signal**, not independent acceptance or deployment approval.

Run local source tests after pulling:

```powershell
cd C:\projects\maktab
pnpm verify:pilot:phase12
```

To actually run against an operator-controlled, **independently isolated** HTTPS staging API, configure the same temporary shell variables documented in `docs/PHASE11-EXECUTION-RUNBOOK.md`:

```powershell
$env:PHASE11_CONFIRM_STAGING="YES"
$env:STAGING_API_URL="https://<staging-api-host>/"
$env:CONFIRM_STAGING_HOST="<staging-api-host>"
$env:PRODUCTION_API_URL="https://<separate-production-api-host>/"
# Optionally configure staging-only PHASE11_ADMIN_TOKEN and PHASE11_METRICS_TOKEN.
New-Item -ItemType Directory -Force C:\maktab-evidence
pnpm pilot:phase12 --deployment staging-build-001 --count 3 --interval-ms 1500 --output "C:\maktab-evidence\phase12-canary-001.json"
```

Use **different filenames for every run** to preserve the evidence chain. No real staging run has been claimed by this source change.

## Phase 12 exit criteria

A Phase 12 task is not "operationally complete" until it has recorded, independently reviewed real-world evidence at the intended exact SHA. Any `HALT_AND_INVESTIGATE` requires issue triage and a new run after recovery. Continue to enforce Phase 11's independent manual Android/Neon/push/backup/restore/role acceptance and signed rollout authorization. **Source-level test success does not authorize a pilot or production rollout.**
