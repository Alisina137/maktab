# MaktabLink Phase 12 — Connected Release-Candidate Acceptance

**Status:** Source implementation for all six Phase 12 steps; external staging / real-device verification **NOT VERIFIED**.  
**Production release:** **NO-GO**.  
**Preconditions:** Phase 11's 20 live journeys and 11 external gates, safe Neon migrations, physical Android/browser acceptance and independently reviewed operator evidence.

## Source regression commands

```powershell
cd C:\projects\maktab
pnpm install --frozen-lockfile
pnpm verify:phase12:step1
pnpm verify:phase12:step2
pnpm verify:phase12:step3
pnpm verify:phase12:step4
pnpm verify:phase12:step5
pnpm verify:phase12:step6
```

All six commands are included in root `pnpm verify` and in **both** Ubuntu and Windows GitHub Actions. Step 12.3 executes the connected Negaran → Admin correction → Parent → homework publish journey plus the previously exhaustive draft-grade/exam publication regression. Step 12.4 executes the connected announcements/fee/immutable-reversal family workflow, plus existing class isolation and ledger checks. Step 12.5 checks Staff web and Teacher mobile component/source states; the actual code now includes accessible branded loading spinners, retry controls, RTL direction handling and reduced-motion CSS. A source static check is **not** a physical-device accessibility pass.

## Staging-only Step 12.6

Use an **independently provisioned and identified** nonproduction staging API, isolated synthetic schools and approved test credentials. The operator must complete the real web, Android, fee, push, scheduler, backup and restore tests documented in `docs/PHASE11-EXECUTION-RUNBOOK.md` and maintain an external ledger in `C:\maktab-evidence`. The candidate script does **not** fabricate these observations.

The code runs only GET-only security/readiness probes, validates the exact source/deployment SHA, checks operator-supplied API/web/mobile build identifiers and evaluates a local Phase 11 evidence ledger. It never deploys, updates accounts, posts announcements, processes payments or touches the database.

### Secure preparation (example placeholders; do not paste secrets into chat or Git)

```powershell
cd C:\projects\maktab
$env:PHASE11_CONFIRM_STAGING="YES"
$env:STAGING_API_URL="https://<staging-api-host>/"
$env:CONFIRM_STAGING_HOST="<staging-api-host>"
$env:PRODUCTION_API_URL="https://<different-production-api-host>/"
$env:PHASE12_DEPLOYED_SHA=(git rev-parse HEAD)
$env:PHASE12_API_BUILD="<actual-staging-api-build>"
$env:PHASE12_WEB_BUILD="<actual-staging-web-build>"
$env:PHASE12_MOBILE_BUILD="<actual-staging-android-build>"
# Optional staging-only access tokens stay in environment, never evidence:
# $env:PHASE11_ADMIN_TOKEN="<real-staging-admin-token>"
# $env:PHASE11_METRICS_TOKEN="<real-staging-metrics-token>"
New-Item -ItemType Directory -Force C:\maktab-evidence
pnpm pilot:phase12 --input "C:\maktab-evidence\phase11-verified.json" `
  --output "C:\maktab-evidence\phase12-candidate-001.json"
```

The input must be a **real externally recorded** ledger generated and updated with `pnpm pilot:phase11 init/record/defect`, not an example manifest or automatically filled PASS values. The script rejects any report path inside the repository, never overwrites files, redacts private endpoint bodies/credentials and fails with exit code 2 on incomplete readiness. An operator's claimed deployed SHA is **not proof** the server actually runs that commit; verify the deployed API/web/mobile artifact SHA via independent deployment records and exact-SHA CI.

## Operator decision boundaries

`INCOMPLETE` means release is blocked. `READY_FOR_INDEPENDENT_OPERATOR_REVIEW` means the supplied records and GET probe pass programmatic consistency checks, **not** that the actual evidence was authenticated. `productionDecision: NO_GO` is unconditional. Do not authorize a pilot or unrestricted production until an independent authorized operator reviews the underlying evidence, defects and recovery plan.

Expected external proof remains **NOT VERIFIED** for these categories: actual Neon migration chain, separate-database encrypted restore, real Android device and TalkBack, real browser navigation/keyboard testing, Dari/Pashto RTL and English LTR on physical builds, AFN reconciliation under concurrent real PostgreSQL connections, live push receipts, schedulers/alarms and backup/rollback. Source test success does not imply any of these succeeded.

## Future defect workflow

When a real defect appears, stop the canary, record a fail/blocked journey and a defect in the external evidence ledger; reproduce it with a failing source regression, fix and review the production code in a PR, rerun the full affected journey against the new exact candidate build, then regenerate the Phase 11/12 evidence for the new SHA. A previously signed manifest from an older build does not carry across automatically.
