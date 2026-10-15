# Pilot Operations refinement — Phase 1 (Overview and resilience)

## Implementation

- Retains the six existing route-backed subtabs; `Overview` remains the default and the selected tab is still scrolled into view.
- Adds eight clickable summary cards using existing **server-computed**, authenticated, school-scoped counts: students, teachers, parents, classes, subjects, teacher assignments, active academic years and core setup progress. No synthetic attendance/homework/activity engagement numbers.
- Strengthens **Needs attention** using the existing nine core checks, seven advanced coverage metrics, and recorded subscription statuses. Critical metrics appear before warnings; each gap links to its owner module. The list never reports "all clear" if advanced coverage or subscription data is unavailable.
- Adds recent school administration activities from the existing **redacted and school-scoped** `GET /v1/admin/pilot/audit` endpoint. This preview loads independently, is capped at six records, is never cached, aborts on session change, and provides retry without blocking school setup, exports or support.
- Improves subscription/readiness API isolation with `Promise.allSettled`. One failure does not hide the other service's data. Loading and persistent fetch errors are visible below the navigation with retry.
- The `Launch & Support` subtab is **not gated** by the readiness or subscription API response. A school admin can still open support during unrelated reporting errors; launch decisions continue to come from platform-scoped operator verification.
- Adds responsive summary cards, keyboard focus, narrow-screen activity layout and translations for new text in Dari, Pashto and English.
- No migration, API schema modification or security permission changes. Audit records remain allowlisted. Changes are on `main`.

## Scope boundaries

- Today attendance and homework engagement are **not** shown as counters; those would need explicit period-scoped analytics from trusted endpoints in a later phase. No zero count should be shown to imply an unmeasured metric is zero.
- The Overview's setup progress reports **core check** completion and does not constitute operational readiness, production approval or release sign-off.
- The recent activity feed uses authorized audit events, **not** a universal user activity tracker.
- Pilot approval and Step 20 independent real-device/production gates remain separate and stay NO-GO without real proof.

## Automated regression

```powershell
pnpm verify:pilot
pnpm typecheck
pnpm build
```

`verify:pilot` runs both the existing Pilot Phase 1 guard and `verify-pilot-overview-refinement-phase1.mjs`. Main CI also runs the complete existing regression suite.

## Manual acceptance still required

1. Sign in as a school administrator: Overview displays eight correctly linked cards and actual database counts. Refresh and verify server counts after changing academic data.
2. Seed school-specific missing teacher assignments, parent links and account activations. Confirm critical warnings take priority, link to the correct module and disappear after real corrections.
3. Test ACTIVE, GRACE, PAST_DUE and SUSPENDED subscription states; confirm admin-only/support access and no false green status when billing read fails.
4. Simulate a failing subscription endpoint, a failing advanced readiness endpoint and a failing audit endpoint independently: navigation should remain available, unrelated data should still render, errors should be recoverable, and Launch & Support should open.
5. Open Overview for two schools in sequence. Verify abort / stale session guards prevent activities and overview records leaking between them.
6. Check mobile 320px/375px, 200% zoom, screen reader, keyboard tab focus, Dari/Pashto RTL, English LTR and long audit action labels.
7. Verify Linux/Windows CI at exact committed `main` SHA before deployment. Independent Step 20 production gate still requires separate operator acceptance.
