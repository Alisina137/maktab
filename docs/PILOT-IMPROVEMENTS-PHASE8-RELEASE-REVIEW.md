# MaktabLink Pilot Operations — Improvements Phase 8 Acceptance

## Scope, build identity and release rule

This checklist covers **all nine school-admin Pilot Operations sections** and the improvements completed in Phases 1–7. Record the exact Git commit SHA, running deployment SHA, UTC/Kabul date, reviewer, school and tested device/browser in the acceptance evidence. The school administrator must not receive platform-operator permissions.

**Automated tests ≠ field acceptance.** CI validates source contracts, TypeScript, API integration tests and build, but cannot prove a live push provider, production data migrations, backup restore, user-device experience, delivery, or operator sign-off. A green CI build does not authorize production. Until each independent requirement is recorded and reviewed, the acceptance artifact deliberately reports **NO_GO** and its nine `sectionChecks` remain **UNVERIFIED**.

## Automated verification

Run from the same checkout/commit you intend to assess:

```powershell
cd C:\projects\maktab
git pull --ff-only origin main
git rev-parse HEAD
pnpm verify:pilot:improvements:phase8
pnpm verify:pilot:phase8
pnpm typecheck
pnpm test
pnpm build
node scripts/pilot-phase8-acceptance-report.mjs --output phase8-manual-no-go.json
```

Verify the GitHub **verify** and **windows-api-regression** checks on exactly that SHA; retain the `phase8-pilot-acceptance-no-go` report artifact. Record GitHub Actions job URLs, workflow conclusions and any failures. Never edit the report's statuses to imply evidence already exists.

## Nine-tab field acceptance matrix

For each row use **UNVERIFIED** until you actually execute the listed checks on an authenticated school account and retain dated results. Use two schools (A and B) and at least one unauthorized/non-admin session for permission checks. Preserve confidentiality: record counts and redacted screenshots, not private student, parent, teacher, token or ticket payloads.

| Pilot tab | Required manual journey | Evidence / expected |
| --- | --- | --- |
| **1. Overview** | Open default Pilot page, inspect school-only overview, follow actions; disconnect one report source and retry; switch languages | Valid cards remain while failed cards show unknown. No fake zero, healthy status or production GO. |
| **2. School readiness** | Create and omit configuration prerequisites; inspect failures, operational overlap checks, issue drilldowns and pagination | Counts match school records; bad configuration never yields automatic approval. |
| **3. Data onboarding** | Download parent/student/teacher templates; validate username and other mandatory columns; preview import with validation errors; retry same request key; open history | Student template includes username. Validation rejections are not represented as successfully imported rows. Retrying is idempotent. No imported cross-school records. |
| **4. Usage & adoption** | Switch today/7d/30d; compare eligible and activated counts with sample school accounts; use follow-up links | Latest-login coverage is not labeled DAU. Zero eligible roles show unknown rate. Partial/malformed report displays error. |
| **5. Service health** | Seed/observe school-only stale queue, failed notifications, critical tickets and failed import counters; retry failed endpoint | Priority actions and recorded counts correct. Empty queues never imply verified uptime, scheduler, push or backup recovery. |
| **6. Operations oversight** | Browse 7d/30d/90d, categories, notable-only view, forward/backward pages; inspect matching audit history | Stable ordering, correct school scope and page-only counts. Private actor, support text, evidence references and import contents absent. |
| **7. Subscription** | Validate trial/active/grace/past_due/suspended/cancelled states and expiry thresholds using platform test accounts | Write restrictions come from recorded status; no unauthorized billing edits. Calendar is Kabul; reminders are thresholds, not proof of delivery. Billing link opens editable draft only. |
| **8. Audit & exports** | Filter action/category/actor/date; paginate; export; inspect spreadsheet/CSV safety; attempt other school's scope | Privileged access enforced, metadata redacted, exports bounded and audited. No account passwords, tokens, private notes or cross-school rows. |
| **9. Launch & support** | Create/reply to a support ticket; request platform review of evidence; inspect decision history and all Step 20 checks | School cannot invoke platform-only decisions. Support is an explicit write. Even pilot-approved state remains **PRODUCTION NO_GO** until independent acceptance. |

## Cross-cutting live checks

1. **Sessions and tenancy:** verify school A/B isolation, unauthenticated and non-admin 401/403 paths, suspended/expired handling, token refresh/revocation, logout and switching accounts. Verify no stale data survives a session change.
2. **Date, accessibility and language:** test English Gregorian AM/PM and Dari/Pashto Solar Hijri with Kabul timezone; tablet/mobile responsive layouts, RTL focus order, keyboard/reader labels and touch controls.
3. **Network and operation resilience:** simulate API timeouts, dropped connectivity, retry, duplicate requests, reconnect and pagination/filter transitions without stale statistics or double submissions.
4. **Actual integrations:** independently verify live PostgreSQL migration, scoped data storage, encrypted backup AND restore, notification provider receipt, scheduler execution, operator monitoring and incident runbook.
5. **Exact-commit sign-off:** compare deployed SHA to tested CI SHA and verify all independent Step 20 evidence with an authorized operator. Record rollback owner and decision, separately from school-admin UI.

## Recording a result

For each tab and cross-cutting check capture: `section/journey`, `environment`, `school/session role`, `tester`, `timestamp`, `exact SHA`, `result (PASS/FAIL/BLOCKED)`, `redacted evidence reference`, and `issue follow-up`. Do not store credentials or personally identifying student records. Re-run on the exact release candidate whenever SHA or critical infrastructure changes.

**Release decision:** The automated Phase 8 artifact remains **NO_GO / REQUIRES_MANUAL_ACCEPTANCE**. It intentionally cannot be promoted from CI alone. Only the designated independent release process can make a deployment decision after real evidence is collected and reviewed.
