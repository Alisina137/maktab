# Phase 7 — Final cross-role regression and production release acceptance

**Status: IMPLEMENTED CODE / PRODUCTION NO-GO.** Step 20 automated API/store/security regression, real UI accessibility and external deployment acceptance are distinct evidence sources. Passing a GitHub build or recording a Phase 6 pilot launch approval is **not** a production release authorization.

## Implemented in Phase 7

- The school Admin **Pilot Operations → Launch & Support** page now contains a read-only **Step 20 production release readiness** panel. It clearly separates server-derived setup readiness, effective platform pilot approval and independent real-world release acceptance. It lists 20 numbered acceptance steps, initially UNVERIFIED, and always displays production NO-GO until independently confirmed outside the application. Older school-admin cross-tenant fetches cannot overwrite the current session.
- School-admin-only `GET /v1/admin/pilot/release-readiness` returns current-school configuration / evidence / pilot-approval indicators and an explicit `NO_GO` release status with 20 acceptance steps. No arbitrary school ID parameter, no release approval mutation, no passwords or credentials. This endpoint **does not pretend it can observe CI runs or a physical Android device**.
- `scripts/phase7-release-report.mjs` produces an offline, machine-readable independent acceptance report. By default with **no external proof** it returns `NO_GO`, with all 11 external gates NOT_RUN. An optional separately maintained operator manifest records concrete evidence refs/times and a target SHA. The script rejects missing/stale/wrong-SHA/secret-containing entries; a fully filled manifest is only `READY_FOR_INDEPENDENT_RELEASE_REVIEW` and **still has productionDecision=NO_GO**. It cannot itself independently authenticate a submitted reference, the operator, or publish a production GO.
- Expanded PGlite/Fastify security regression verifies no cross-school launch state, no production GO from the pilot, admin-only access and behavior during suspended subscriptions. Added pure-unit release invariant tests, CLI manifest tests and static release guard.
- GitHub Actions now runs the Phase 7 safety guard on Ubuntu and Windows, as well as the complete existing Step 20 API/store suite. Ubuntu CI also attaches a **default NO-GO report** for that exact build SHA as an artifact; review the exact `main` push SHA before considering a deployment candidate. No external tests are simulated.

## Run automated checks

```powershell
cd C:\projects\maktab
pnpm verify:pilot:phase7
pnpm verify
```

CI and local `pnpm verify` validate application logic, not external PostgreSQL, actual Android TalkBack, live EAS/FCM push, scheduler execution or physical operator acceptance.

## Capture human acceptance (outside Git)

1. Review `docs/TEST-20-FULL-REGRESSION.md` for the complete 20.1–20.20 cross-role scenarios. Perform the Admin, Teacher, Parent and Student scenarios on a production-like Android build and browser, include two isolated schools, and retain build/OS/device/date/defect proof in controlled storage.
2. Apply migrations **in order** to a disposable real PostgreSQL staging clone, inspect `/ready`, test backup encryption + off-host copy + non-production restore and demonstrate parallel Postgres transactions.
3. Test Dari, Pashto and English UI with Solar Hijri/RTL, device keyboard/TalkBack, 200% browser zoom, large fonts and tablet layouts. Document real screenshots and defects, not just CSS existence.
4. Verify live foreground/background push and correct notification deep links, scheduled communication/subscription jobs, monitoring/alerts and offline/reconnect behavior on real devices. Prove no cross-school or stale-cache leakage.
5. Record deployment SHA and the **two successful GitHub CI jobs attached to that exact SHA**; verify credentials, rollback steps, incident owner, pilot operator acceptance and any open severity-critical support tickets.
6. Copy `docs/PHASE7-RELEASE-MANIFEST.example.json` to a secure untracked location **outside the Git checkout** (for example `C:\\projects\\maktab-release-evidence\\production.json`). Never store passwords, access tokens, private student details or encrypted backups inside a manifest or the Git repository. Replace every placeholder with a real checked value.
7. On the exact clean candidate commit, run:

```powershell
node scripts/phase7-release-report.mjs --manifest "C:\projects\maktab-release-evidence\production.json" --output "C:\projects\maktab-release-evidence\acceptance-report.json" --strict
```

The `--output` path must not already exist (overwrite is intentionally refused). Without `--strict`, the command emits a NO-GO report without failing a CI build solely because deployment evidence is not yet available.

If the manifest is missing, wrong commit or any of the 11 gates remain incomplete, `--strict` exits 2. If all are recorded, the report says **READY_FOR_INDEPENDENT_RELEASE_REVIEW**, not GO. An independent authorized release owner must examine the referenced artifacts, independently recheck the live environment and issue a separate explicit approval decision. The product **never** signs off production automatically.

## Manual acceptance gates

1. **exact_commit_ci** — operator must record `result`, a safe `reference` of at least eight characters, and an actual UTC `observedAt` time in the past 30 days.
2. **real_postgres_migrations** — operator must record `result`, a safe `reference` of at least eight characters, and an actual UTC `observedAt` time in the past 30 days.
3. **encrypted_backup_restore** — operator must record `result`, a safe `reference` of at least eight characters, and an actual UTC `observedAt` time in the past 30 days.
4. **web_android_role_journeys** — operator must record `result`, a safe `reference` of at least eight characters, and an actual UTC `observedAt` time in the past 30 days.
5. **cross_school_security** — operator must record `result`, a safe `reference` of at least eight characters, and an actual UTC `observedAt` time in the past 30 days.
6. **rtl_accessibility** — operator must record `result`, a safe `reference` of at least eight characters, and an actual UTC `observedAt` time in the past 30 days.
7. **offline_reconnection** — operator must record `result`, a safe `reference` of at least eight characters, and an actual UTC `observedAt` time in the past 30 days.
8. **live_push_scheduler** — operator must record `result`, a safe `reference` of at least eight characters, and an actual UTC `observedAt` time in the past 30 days.
9. **concurrent_payments** — operator must record `result`, a safe `reference` of at least eight characters, and an actual UTC `observedAt` time in the past 30 days.
10. **rollback_incident_runbook** — operator must record `result`, a safe `reference` of at least eight characters, and an actual UTC `observedAt` time in the past 30 days.
11. **operator_signoff** — operator must record `result`, a safe `reference` of at least eight characters, and an actual UTC `observedAt` time in the past 30 days.

The manifest is **only an evidence index** and is not an attestation that the evidence is true. It must not be treated as a permissions or deployment-control mechanism.

## Security boundaries and known limitations

- Operator identity in the manifest is manually entered; the script does not authenticate a human. Review takes place outside the system under organizational release controls.
- Existing Phase 6 platform decision and five manually reviewed evidence categories are pilot approval, not production release proof.
- The API cannot infer whether the exact server build is the same binary tested on real devices. That must be demonstrated independently.
- Until live PostgreSQL migrations, restore, push, schedulers, RTL/a11y and operator sign-off are documented and reviewed, unrestricted production launch remains **NO-GO**.
- No Phase 7 database migration. Phase 6 migration `0021_pilot_launch_support.sql` must already be applied.
