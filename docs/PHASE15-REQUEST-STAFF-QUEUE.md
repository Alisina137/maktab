# Phase 15 — Safe Mobile Requests & Usable Staff Registration Queue

**Date:** November 13, 2026.  
**Scope:** Six defined source implementation tasks after [Phase 14](PHASE14-SESSION-STAFF-RECOVERY.md).  
**Production readiness:** **NO-GO** — independent Phase 11/12 physical acceptance is still unverified.

## Goal and delivered tasks

Phase 15 addresses a gap between good API integration tests and daily app behavior: fetching a school screen on a slow mobile connection must not allow a cancelled request or response from a previous login to update the next user's view. Also, the Staff enrollment queue should remain usable as hundreds of requests accumulate, not render the entire list at once.

| ID | Delivered runtime change | Verification |
| --- | --- | --- |
| **15.1 Offline snapshot allowlist** | Only explicit, authenticated read-only family, Student and Teacher school-data GET endpoints are eligible for persisted offline fallback. Authentication/me, login, refresh, password/security endpoints, public school search, file downloads, push/device, unknown URLs and writes are excluded. Query strings carrying token-like parameters are excluded. | Executable allowlist and mutation/credential tests. |
| **15.2 Caller cancellation vs offline failure** | The mobile request timeout and caller AbortSignal now both control the same fetch via an AbortController. A deliberate cancellation returns `request_cancelled` instead of opening an old cached screen; a genuine offline/timeout failure may use only an allowlisted current-identity snapshot. Event listeners/timers are cleaned up. | Source call-site checks plus policy tests; real Android scenarios still pending. |
| **15.3 Account-epoch response protection** | The mobile read-cache scope now exposes an incrementing identity epoch. At the beginning of logout, before awaiting slow push/provider deactivation, in-flight screen requests are invalidated. An A → logout → A transition is still a different authenticated epoch, so a previous request cannot complete into a new login merely because school/user IDs happen to match. The check covers online responses, preloaded offline snapshots, fetch errors and token-refresh retry boundaries. | Executable identity-epoch cases plus real request source assertions. |
| **15.4 Five-item registration queue** | Staff → Registration → Application queue displays a maximum of five requests per page, a translated results count, Previous/Next controls and accessible pagination announcement. Changing the status filter resets to page 1; deleted/reviewed rows clamp back into the available range. No enrollment approval or permissions are granted to Staff. | Executable pagination, filter, empty and page-clamp tests. |
| **15.5 Registration list recovery** | Refresh shows an explicit disabled/busy state, keeps the form mounted, and rejects late stale list responses using a request sequence. A previous save or submission remains visible if list refresh fails. Existing unsaved-change confirmation remains intact. New labels are translated for Dari and Pashto. | Source UI guard, earlier Stage 13/14 regression, locale assertions. |
| **15.6 CI and documentation** | `pnpm verify:phase15` runs the policy/pagination tests and source UI guard; included in root `pnpm verify` and both Windows and Linux CI. The project state and acceptance boundaries are documented. | GitHub Actions results on the exact merged commit. |

## Validation

```powershell
cd C:\projects\maktab
pnpm verify:phase15
pnpm verify
```

The wider suite already checks school isolation, attendance, grades, homework, announcements, AFN fees, session revocation, localization, staff/teacher/student navigation and prior source fixes. Phase 15 requires no database migration, schema changes or new environment variable.

## User-visible behavior

* On a poor mobile connection, a deliberately cancelled request will stop rather than silently substitute a cached response.
* Persisted offline snapshots remain available only for reviewed family/student/teacher read endpoints, with the existing 7-day TTL and school/user-scoped v2 envelope. Unsupported dynamic endpoints must load online; this is intentional to avoid accidental persistence of authentication or binary data.
* When switching school, logging out or switching users, late mobile requests from the previous login are ignored.
* Staff Registration queues are paginated at **five entries per page**, and switching the status filter starts from page 1. Parent/Student account-directory pagination elsewhere remains unchanged.
* All pages continue to honor authorization, and offline snapshots do **not** grant permission to mutate server records.

## External pilot acceptance (not performed)

Independent operators must verify Phase 15 on the **exact staged SHA** with real browser and Expo/Android devices: timeout, airplane mode, explicit cancellation, A→logout→A switching, a revoked school account, cached reads from another school, five-item Staff pagination, changing filters during loading, RTL/Dari/Pashto accessibility, and form preservation after a failed refresh.

Also still outstanding: separately isolated real Neon staging and rollback, push provider and scheduler, physical device evidence, restore drill and independent signoff for the 20 live journeys and 11 release gates under [Phase 11](PHASE11-EXECUTION-RUNBOOK.md) and [Phase 12](PHASE12-RELEASE-ACCEPTANCE.md). A green source CI does **not** imply external readiness or production approval.
