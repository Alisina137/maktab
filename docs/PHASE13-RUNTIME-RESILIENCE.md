# Phase 13 — Mobile Stability, Offline Privacy & Staff Workflow Safety

**Status:** All six defined Phase 13 source tasks implemented; physical/mobile/browser/staging acceptance still UNVERIFIED.  
**Opened:** 2026-11-13  
**Repository:** `Alisina137/maktab`; follows [Phase 12](PHASE12-FUNCTIONAL-JOURNEYS.md).  
**Production decision:** **NO-GO**, unchanged from Phases 10–12.

## Objective

Repair a user-visible crash discovered during the Phase 12 source review and harden the actual runtime boundaries supporting parents, students, teachers and staff. Unlike another superficial checklist, this phase changes product code and locks the behavior with executable tests. The release still depends on the independent Phase 11/12 real-world acceptance runbooks.

## All tasks and implementation

| Task | Delivered behavior | Verification |
| --- | --- | --- |
| **13.1 Teacher loading crash** | Removed an accidental `<TeacherHubLoading>` self-render which recursively rendered without a terminating condition. All Today, learning, announcement and inbox spinner states now show one ActivityIndicator plus locale-specific text. | Source guard refuses self-recursion and requires accessible translated spinner. |
| **13.2 Safe mobile session restoration** | A corrupted/mismatched SecureStore entry can no longer be cast to a trusted `StoredSession`. The parser enforces UUIDs, matching school identities, allowed mobile roles/statuses, school metadata, credentials and well-formed expiries; invalid entries are deleted and the normal login flow resumes. Saving malformed sessions is also denied. | Executable malformed session tests. |
| **13.3 Parent child selection persistence** | Preferences are filtered to canonical school:parent IDs and valid child IDs, kept in a null-prototype dictionary, and capped to 100 recent entries. Corrupt JSON is discarded. Writing arbitrary invalid selection identifiers now fails safely. | Executable corruption/prototype/bounds tests. |
| **13.4 Scoped offline cache safety** | SecureStore cached responses are now **v2** envelopes that include the exact expected user/school owner and request path. Reading rejects cache hash collisions, different accounts, different URLs, wrong versions and stale snapshots. This prevents an unrelated entry being reused even if a compact key hash collides. | Executable owner/path/version identity tests plus source guard. |
| **13.5 Staff registration submission safety** | A Staff user cannot submit a previously saved draft while their currently edited fields or document checklist have unsaved changes. All editable fields are compared against the persisted record; both button and handler reject pending unsaved edits. Creation/approval permissions remain unchanged. | Executable dirty form field-by-field tests. |
| **13.6 End-to-end source regression wiring** | Added `pnpm verify:phase13` and attached it to root `pnpm verify` and both Linux/Windows CI. It checks product source and executes pure policy tests. Existing Phase 12 connected Fastify/Postgres-emulated learning, family and financial journeys remain required in the root verification. | Actual GitHub Actions results must be checked at the exact merged SHA. |

## Important compatibility boundaries

**Offline cache format:** Phase 13 rotates cached read envelopes from v1 to v2 to encode their owner and path. Old v1 snapshots will be ignored, not migrated into unverified identity boundaries. A device may need one successful online fetch to repopulate its offline read cache after updating. This does not delete database records, credentials or server-side student data.

**Persisted sessions:** Valid existing mobile sessions are retained. Broken JSON and sessions with a missing, mismatched or impossible identity are discarded. A user with a corrupted session must sign in again; the app must never show another school's cached data merely to preserve a stale home screen.

**Staff drafts:** Editing a draft is permitted. The **Submit for review** action remains disabled until all changes are saved, required checks are complete, and the record is still owned by the logged-in staff member. The school administrator is the only enrollment approver.

## Reproduce and validate source changes

```powershell
cd C:\projects\maktab
pnpm verify:phase13
pnpm verify:phase12:step1
pnpm verify:phase12:step2
pnpm verify:phase12:step3
pnpm verify:phase12:step4
pnpm verify:phase12:step5
pnpm verify:phase12:step6
```

`pnpm verify` runs these checks plus the wider regression suite. This source testing is not a claim of staging deployment, verified Expo Go/Android behavior or independent browser acceptance.

## External follow-through (not performed by this PR)

On the actual Phase 13 candidate SHA, independently check: loading skeletons/spinners on a real Android device (especially poor network), account switch between two schools, logout/login recovery, parent selected-child isolation, offline content before/after cache v2 update, RTL in Dari/Pashto and English navigation, Staff web drafts with unsaved changes, and fresh-session permission changes. Then complete real Neon migrations/restore, live push/scheduler and independent operator signoff according to [Phase 11](PHASE11-EXECUTION-RUNBOOK.md) and [Phase 12](PHASE12-RELEASE-ACCEPTANCE.md).

**Do not infer a pilot GO from these source checks.** No staging credentials, real user devices or operator acceptance are available in this implementation context. The required 20 live journeys and 11 release gates are still UNVERIFIED until externally evidenced.
