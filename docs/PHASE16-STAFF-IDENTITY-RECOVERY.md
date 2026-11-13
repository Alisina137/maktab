# Phase 16 — Staff Identity Integrity and Recoverable Portal Access

**Date:** 2026-11-13.  
**Source status:** All six Phase 16 implementation tasks delivered in this branch.  
**External pilot decision:** **NO-GO**, pending independent Phase 11/12 checks.

## Why this phase

The Staff browser portal previously trusted minimally checked `sessionStorage` objects, accepted any successful `/v1/staff/me` result without comparing its school/user identifiers with the selected login, and could erase the session on an ordinary `503` outage or refresh network failure. Staff members affected by an API tunnel outage were forced to sign in again rather than retrying. The first-login password-change screen also depended on mutable school-picker state.

## Task-by-task implementation

| Task | Delivered runtime behavior | Acceptance in code |
| --- | --- | --- |
| **16.1 Persisted Staff session validation** | Before storing or restoring an account, validate typed fields, active Staff role, school/user UUID linkage, unexpired refresh credentials, login-status flags, and authentication token/date shapes. Malformed, suspended, archived, or cross-school entries are removed instead of entering the dashboard. | Dedicated executable session-policy tests and source guards. |
| **16.2 Server-verifiable user and school identity** | Only display the Staff dashboard when the server's `/v1/staff/me` returns the same Staff user ID, status and school ID as the stored account. Validate identity after refresh token rotation as well. | Cross-school, wrong-user, wrong-role and suspended-status tests. |
| **16.3 Distinguish terminal revocation from temporary outage** | A proven invalid session `401` or non-permission-denial `403` signs the Staff member out. Ordinary network failures, `503` outages, a single module's `permission_denied`, or an incorrectly entered current password no longer automatically destroy Staff session storage. Server authorization is unchanged. | Error-classification test matrix plus source checks. |
| **16.4 Reject old async responses after logout** | Each authenticated Staff request carries its account ID, school ID and an incrementing session epoch. After sign-out or another account transition, an old refresh or API result is rejected instead of updating Staff pages. Pending refreshes are still single-flight for each active account. | Unit tests for stale epoch/account/school and verified runtime call sites. |
| **16.5 Recoverable sign-in and dashboard experience** | A Staff user can retry a temporary failed `/me` load without throwing away a session; school-discovery failures offer an explicit Retry button. First-login password activation stays bound to the school selected when login succeeded. Dari/Pashto recovery copy is provided and Staff login restores the previous HTML language/direction when leaving. | Page source assertions and localization checks. |
| **16.6 CI, regression and state** | `pnpm verify:phase16` runs policy tests and source guards. Both CI OS jobs and root `pnpm verify` include it, along with existing Staff phases, school isolation, mobile and API suites. | Exact-commit GitHub Actions results. |

## Developer validation

```powershell
cd C:\projects\maktab
pnpm verify:phase16
pnpm verify:staff
pnpm verify
```

The source changes require no migrations, account permissions, backend roles or new environment variables. They do not bypass server authentication; successful access still depends on actual server verification. Stored browser data remains untrusted.

## Remaining external requirements

A real browser operator should test Staff login in English and RTL Dari/Pashto, sign out with an in-flight API request, refresh rotation on a slow network, 503/API tunnel outage followed by Retry, expired/revoked sessions, school switching, first-login password activation and scoped permissions. Record evidence for the exact staged SHA.

Production readiness is still **NO-GO**: real isolated Neon staging, Android devices, notification/push and scheduler providers, database backup restore, role-based end-to-end live journeys and independent pilot approval remain **unverified**. Complete the [Phase 11 runbook](PHASE11-EXECUTION-RUNBOOK.md) and [Phase 12 acceptance](PHASE12-RELEASE-ACCEPTANCE.md) before any production decision.
