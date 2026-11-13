# MaktabLink — Phase 14: Session Integrity and Staff Workflow Recovery

**Status:** Six defined Phase 14 source tasks implemented, pending exact-commit CI acceptance. **Production: NO-GO.**  
**Date:** November 13, 2026.  
**Predecessors:** [Phase 13](PHASE13-RUNTIME-RESILIENCE.md), [Phase 12](PHASE12-FUNCTIONAL-JOURNEYS.md), [Phase 11 operations](PHASE11-EXECUTION-RUNBOOK.md).

## Why Phase 14

Connected API journeys do not by themselves prevent a restored user's delayed network reply from replacing a newer login, two SecureStore writes from finishing in the wrong order, or a Staff UI from telling the operator that a persisted registration failed just because a follow-up list refresh failed. This phase repairs those runtime integrity and usability gaps while preserving school boundaries and explicit permissions.

## All Phase 14 development tasks

| Task | Implemented behavior | Validation |
| --- | --- | --- |
| **14.1 Mobile restoration identity** | Restored parent, student and teacher sessions now check the exact starting credential/school epoch after health, `/me`, and refresh network awaits. If the user signs out or changes account, the older response stops before mutating current UI state, storage or navigation. A corrupted old restore cannot erase an active newer session. | Static guard plus prior mobile epoch tests. |
| **14.2 Ordered native session writes** | `saveStoredSession` and `clearStoredSession` use a serialized write queue. Even a delayed native save is completed before the later logout delete, so it cannot resurrect an older credential. Failed writes do not poison the queue. Reads drain pending session writes first. | Executable async queue tests (pending write, logout, rejection recovery). |
| **14.3 Parent preferred-child consistency** | Child preference writes are serialized and read-after-write coherent across multiple parent views. Every write validates UUIDs, keeps the most recently touched selection and enforces the 100-entry preference bound instead of expanding indefinitely. Parent/child school linkage is still authenticated by the API, not implied by preferences. | Executable preference last-write and bounding tests. |
| **14.4 Staff registration editing safety** | The form prompts before discarding unsaved edits when selecting another application, starting a new form, or navigating away/reloading the browser. The actual POST/PUT result becomes the local saved source of truth immediately, preventing an unreliable list reload from falsely claiming the save failed and causing duplicate submission. Submit results likewise remain visible after a transient reload failure. | UI source checks and existing dirty-draft field tests. |
| **14.5 Permission-aware Staff navigation and search** | Portal navigation is derived from one capability policy. A revoked or missing permission falls back to Home instead of leaving a dead page selected. Switching account group stops stale loading/clears old results, and directory failures expose an explicit Retry button with `aria-live` status. New recovery/confirmation labels have Dari and Pashto strings. | Executable permission matrix tests, locale/source checks, Staff portal regression. |
| **14.6 Cross-platform regression gate** | `pnpm verify:phase14` runs source guards and executable tests; wired into root `pnpm verify` and both GitHub Actions Linux and Windows CI. | Exact-branch Actions results; no manual staging status is inferred. |

## How to validate development changes

```powershell
cd C:\projects\maktab
pnpm verify:phase14
pnpm verify
```

The canonical full `pnpm verify` continues to run Phase 12, Phase 13, identity, school-isolation, Staff and Teacher regressions. The Phase 14 script is a source/API-fixture regression, not an Android or browser automation run.

## Operating boundaries and compatibility

No schema changes, migrations, staff permission grants, finance ledger rewrites, school subscription policy changes or production access are introduced. Native session writes are serialized to prevent out-of-order completion. The app continues to refuse invalid and cross-school persisted session data, and persisted selected-child preferences remain user preferences rather than access controls.

**Still unverified externally:** separate production-safe Neon staging, real Android/Expo and desktop-browser usage, Dari/Pashto RTL on devices, offline/online transitions under actual mobile network failures, external notifications/push, scheduler timing, encrypted backup restore, payment reconciliation and an independent operator's evidence-based pilot approval. Evidence must be linked to the **exact deployed SHA** and preserved outside Git according to the Phase 11/12 acceptance runbooks. Neither Phase 14 tests nor a green CI job authorizes a pilot GO or production rollout.
