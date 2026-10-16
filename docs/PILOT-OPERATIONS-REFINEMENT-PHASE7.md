# MaktabLink — Pilot Operations, Phase 7 (Final UX & Regression Consolidation)

**Status:** All Phase 7 source changes committed to `main`. The original Step 20 operator release acceptance remains a separate NO-GO gate until independently verified. Complete dependency-backed typechecks, integration tests, and builds must run after pulling.

## What changed

### Unified navigation

The nine existing Pilot Operations sections retain their exact deep-link URLs, so old bookmarks and links are preserved:

| Group | Tabs |
| --- | --- |
| Get started | Overview; School readiness; Data onboarding |
| Monitor | Usage & adoption; Service health; Operations oversight |
| Manage | Subscription; Audit & exports; Launch & support |

One canonical `PILOT_TABS` registry in `apps/web/app/admin/pilot-operations-navigation.tsx` powers both desktop links and the mobile selector. The active tab uses `aria-current="page"` and horizontal-only scrolling; tab switches do not call a full-page `scrollIntoView`. On narrow devices the nine links are replaced with one labeled, grouped select and `router.push`. Direct routes still render through the existing Pilot section page.

The parent page's global **Refresh** action is hidden in Usage, Service Health, Operations Oversight and Launch & Support, where it formerly reloaded unrelated parent data without refreshing the selected subpanel. Those subpanels retain their own real refresh/retry actions.

### Overview — three real operational summaries

A compact **At a glance** section reads three independent existing, authenticated school endpoints, each `Cache-Control: no-store` and canceled on session changes:

1. **Latest sign-ins in 7 days**, from the existing role-based Adoption report. The count is `signedIn / eligible` when eligible accounts exist; it is **not** DAU/WAU/MAU, sessions, or learning outcomes.
2. **Recorded operational alerts** as the sum of school-specific stale pending/failed notifications, unresolved critical tickets and failed family imports. This is a count of observed signals; zero alerts **never proves** uptime, notification delivery, backup status or scheduler health.
3. **Independent production gate**, showing the backend's **PRODUCTION NO-GO** and the count of still-unverified external requirements. School setup and pilot approval cannot imply production acceptance.

Failures render an unknown dash and an explicit unavailable summary message, not false zero successes or a green release badge. `Promise.allSettled` permits partial results when any one service is unavailable. A real **Refresh summaries** action updates all three cards. Each card links to its detailed module.

### Consistent locale and time rules

All major Pilot Operations event date-times now share `formatPilotTimestamp`:

- **English** → Gregorian date, 12-hour AM/PM, `Asia/Kabul`.
- **Dari / Pashto** → Solar Hijri date, local time in `Asia/Kabul`.

The shared helper is used in imports/audit history, the overview audit feed, evidence and ticket history, service health, and operations oversight. English timestamps no longer accidentally inherit a Persian calendar, and timestamps never depend on the browser's default timezone.

### Compatibility, safety and regression

- Added `scripts/verify-pilot-operations-refinement-phase7.mjs`.
- Updated the prior Phase 4/5/6 refinement guard scripts to read the canonical registry. Their original behavior and authorization requirements remain enforced.
- **Preserved**, without weakening, the original `verify-pilot-operations-phase7.mjs`, Step 20 release report tests, and exact-commit NO-GO evidence generation.
- No database migration, new secrets, billing writes, platform approval writes, or additional cross-tenant access.
- Responsive desktop/phone grids; keyboard-accessible nav and cards; Dari/Pashto label coverage.

## Validation

Run on a clean synced checkout:

```powershell
cd C:\projects\maktab
git pull origin main
pnpm verify:pilot:phase7
pnpm typecheck
pnpm test
pnpm build
git status
```

For independent cross-phase regression of all seven Pilot Operations phases:

```powershell
pnpm verify:pilot:phase3
pnpm verify:pilot:phase4
pnpm verify:pilot:phase5
pnpm verify:pilot:phase6
pnpm verify:pilot:phase7
```

The existing Phase 7 release report may still issue machine-readable NO-GO until exact-SHA external acceptance evidence exists. **Do not change this result just to make checks appear green.**

## Manual acceptance

1. Verify every URL from all nine sections in English, Dari and Pashto. All sections remain accessible through desktop grouped links and the mobile grouped selector.
2. Switch among distant tabs on a desktop, mobile viewport and RTL layout. The active item must remain visible **without vertically jumping the document**. Keyboard Tab and select should operate normally.
3. On Overview with no eligible users, confirm sign-ins show an unknown dash, not 100%.
4. Simulate a network failure for one of Adoption / Service / Release while other endpoints are responding. Remaining cards must still render with truthful values; failed sources show an unknown dash.
5. Confirm the three-card Refresh actually refetches the endpoints. Confirm old unrelated parent Refresh does not reappear on Usage, Service, Oversight and Launch.
6. Compare English dates against Kabul AM/PM and Dari/Pashto equivalents against local Solar Hijri for the same audit, ticket and import event.
7. Verify production remains NO-GO with pilot approval, unresolved critical support cases and missing external checks.
8. Run the complete test/typecheck/build commands and record the exact resulting Git commit SHA, device tests, and release-operator acceptance separately.

## Release status

**Code ready for local regression; production not automatically approved.** Step 20 retains its independent evidence and operator sign-off requirements.
