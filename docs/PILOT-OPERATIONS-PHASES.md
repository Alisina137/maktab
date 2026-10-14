# Pilot Operations — implementation phases

## Phase 1 — Overview and section navigation (implemented)

- Six route-backed sections: Overview (default), School Readiness, Data Onboarding, Subscription, Audit & Exports, Launch & Support.
- Main Admin Pilot Operations tab remains active across nested routes. Internal tabs are keyboard accessible, highlight the current route and auto-scroll into view on small screens (English/Dari/Pashto RTL).
- Overview uses existing school-scoped API data: six operational counts, server-derived core readiness progress, missing-check links to the owning modules, quick actions, billing health and deliberately *unverified* launch status.
- School Readiness retains all nine existing backend checks with direct links to Accounts, Academics, Families and Subscription when an item is incomplete. An automated setup success is **not** represented as production readiness.
- Data Onboarding links to existing setup workflows and retains school-authenticated CSV template downloads. The Families module remains the single source of truth for validating, previewing and committing imports.
- Subscription remains read-only to school admins; displays plan, status, price, setup fee, billing cycle, Solar Hijri dates and separate PAST_DUE/GRACE attention indicator. Platform-only changes remain restricted.
- Audit & Exports preserves pagination and original authenticated school-scoped JSON export, with a private-data handling reminder.
- Launch & Support is *informational* until durable evidence, approval and ticket workflows exist; no fake approvals or support requests.
- No database migration, new backend API, or permission changes.

### Automated verification

\`pnpm verify:pilot\` checks routes, admin navigation, translated navigation labels, keyboard/RTL/mobile styles, stale-response guard, server readiness usage, auth-protected endpoints and honest launch wording. CI runs this alongside existing checks on Ubuntu and Windows.

### Manual acceptance remaining

1. Open and refresh all six routes as admin. Tab must be highlighted, visible and deep-linkable.
2. Test 320px/375px/768px/desktop and 200% zoom, keyboard focus and RTL in English/Dari/Pashto.
3. Inspect readiness percentages and incomplete-check destinations with a seeded test school.
4. Check Parent/Student/Teacher CSV downloads and the unchanged Families import flow.
5. Verify an ACTIVE, PAST_DUE, GRACE and SUSPENDED subscription. No school-admin billing writes should be exposed.
6. Test audit pagination, export data isolation across two schools and error/retry behavior.
7. Confirm setup-ready never implies launch approved. Complete Step 20 real-device/Neon/backup/operator checks before production rollout.

## Phase 2 — Intelligent readiness
Real configuration coverage, missing relations, categorized severity and dedicated drilldowns with efficient tenant-scoped queries.

## Phase 3 — Durable onboarding history
Import history, duplicate/conflict reporting, retry safety while reusing existing Families import validation.

## Phase 4 — Audit and export security
Filters, human-readable details, redaction, export limits and event audit.

## Phase 5 — Subscription improvements
Expiry alerting, clearer billing health, read-only school-facing guidance.

## Phase 6 — Launch and support workflows
Real evidence collection, support tickets and platform-only launch approval.

## Phase 7 — Cross-role regression and release acceptance
Android/desktop/RTL/a11y plus production-environment proof, security and operator approval. Existing Step 20 NO-GO blockers remain in effect.
