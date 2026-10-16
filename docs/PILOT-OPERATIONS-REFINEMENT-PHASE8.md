# MaktabLink Pilot Operations — Phase 8: Final Regression and Acceptance

## Scope and delivery

Phase 8 adds automated regressions, fail-closed runtime data validation, CI acceptance evidence, and a documented manual verification matrix. The seven feature/refinement phases remain implemented, with the nine existing Pilot Operations routes unchanged. **Phase 8 implementation does not mean production is approved.**

### Concrete safety fix

The Overview's three independent read-only cards previously trusted JSON shapes from the server and could render invalid data or crash on incomplete results. New `pilot-operations-pulse-model.ts` parses and validates the three responses before rendering. The model rejects unknown/duplicate roles, negative or fractional statistics, impossible sign-in denominators, missing service counts, and any production decision other than NO_GO.

When one endpoint is unavailable or responds with malformed data, only its card becomes unknown; the other two remain usable. A real response with zero recorded alerts is displayed as zero observations, **not** proof of uptime or successful push delivery. Sign-in coverage is never represented as DAU/WAU/MAU.

### Automated tests

Run the complete Pilot Operations acceptance suite on the Windows development machine:

```powershell
cd C:\projects\maktab
git pull origin main
pnpm verify:pilot:acceptance
```

This executes the Phase 1–8 Pilot Operations verifiers, Phase 8 executable tests and targeted PGlite API tests, followed by workspace-wide TypeScript, tests and builds.

For focused troubleshooting:

```powershell
pnpm verify:pilot:phase8
pnpm typecheck
pnpm --filter @maktablink/api test
pnpm build
git status
```

The Phase 8 targeted test suite checks:

- School administrators can read their own Pilot Operations overview, adoption, service-health, oversight, audit and launch records.
- Unauthenticated clients receive 401; authenticated parent users receive 403.
- Cross-school data isolation and query-validation protections from Phases 4–6 remain enforced.
- Service and release diagnostics and billing support remain accessible when a school subscription is SUSPENDED, while ordinary operational writes stay restricted.
- Source responses carry `Cache-Control: no-store` for sensitive school reporting.
- Real pending/failed notification, critical ticket and import event statistics remain school-scoped.
- Timeline filtering, pagination, privacy, ordering and Kabul-local day boundaries work correctly.
- Invalid JSON summaries fail closed rather than crashing the UI or displaying misleading healthy states.
- A production GO response is never accepted as a legitimate school-dashboard status.
- A CI job pass is **only an automated test result** and never a manual/production acceptance decision.

**Note:** Source guards are helpful but not equivalent to running TypeScript/PGlite tests against the checked-out commit. This phase requires those local or CI test results; full runtime tests were not performed by the assistant's connected GitHub editing environment.

### CI evidence artifact

GitHub Actions now runs `pnpm verify:pilot:phase8` in addition to all previously configured tests. After the CI run it saves `phase8-pilot-acceptance-no-go`, containing an exact commit SHA, CI job status, and the ten independent manual acceptance gates marked UNVERIFIED. A successful CI run may set `CI_REPORTED_PASS` only when the SHA matches. **Production remains NO_GO regardless.** This artifact is available for operator audit, not a substitute for the existing Step 20 release acceptance report.

Local read-only reporting:

```powershell
node scripts/pilot-phase8-acceptance-report.mjs
```

### Manual acceptance matrix — required before closing Phase 8

| ID | Area | Required human test | Initial status |
| --- | --- | --- | --- |
| 8.1 | Nine-tab navigation | Open every direct URL, switch tabs, preserve focus and mobile selector behavior | UNVERIFIED |
| 8.2 | School admin authorization | Verify logout/expired token denial and parent/teacher/student role denial | UNVERIFIED |
| 8.3 | Tenant isolation | Create distinct Schools A/B with different events, ensure all endpoints remain scoped | UNVERIFIED |
| 8.4 | Setup and onboarding | Test readiness checks, import preview/commit/replay, history, templates, large-file errors | UNVERIFIED |
| 8.5 | Adoption and service | Confirm counts against actual records, refresh, failed/stale queue, incomplete response and offline retry | UNVERIFIED |
| 8.6 | Billing/support | Open, reply and track tickets; suspend subscription; confirm support still works without billing writes | UNVERIFIED |
| 8.7 | Audit and exports | Export real school-scoped records safely; inspect no secrets or other-school data | UNVERIFIED |
| 8.8 | Localization and accessibility | Dari, Pashto, English; Solar Hijri/AM-PM Kabul time; RTL, narrow phones, keyboard, 200% zoom | UNVERIFIED |
| 8.9 | Device and resilience | Actual Android parent/student/teacher workflows, offline/reconnect/session expiration | UNVERIFIED |
| 8.10 | Independent deployment safety | Real PostgreSQL migration, encrypted restore, external notifications/scheduler, exact-deploy SHA and operator signoff | UNVERIFIED |

### Acceptance criteria

Phase 8 automated regression is complete **only after** the Phase 8 verifier, project typecheck, workspace tests, and build pass at the selected commit, with errors fixed and rerun. Manual acceptance is complete only when each matrix item is evidenced on the intended devices/services and approved by the responsible human operator.

The app must not mark a school production-ready solely because any dashboard is green. The independent Step 20 acceptance decision remains NO_GO by default.

### Suggested troubleshooting

If `git pull origin main` encounters a local merge or uncommitted-file conflict, protect local edits before merging rather than discarding them. If a command fails, capture the **first complete error** from `pnpm verify:pilot:phase8` or `pnpm typecheck`, not the abbreviated progress display. Do not claim an implementation pass based only on source inspection.
