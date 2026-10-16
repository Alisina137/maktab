# MaktabLink — Pilot Operations refinement Phase 6: Operational Auditability & Release Oversight

**Implementation:** committed directly to branch `main`. Full typecheck, integration tests and build need to be executed on the local workstation or CI.

## Scope

The new **Pilot Operations → Operations Oversight** subtab is available at `/admin/pilot/oversight`.

It includes (1) the existing independent release gate snapshot from `GET /v1/admin/pilot/release-readiness` and (2) a chronological, filtered school operations history from `GET /v1/admin/pilot/oversight?window=30d&kind=ALL&limit=15&offset=0`. Pilot setup/approval are distinguished from **independent Step 20 production acceptance**. Production is always **NO-GO** on these records.

## Recorded event sources

| Category | Database source | Allowed information |
| --- | --- | --- |
| Support | `pilot_support_updates` | Status/response event and timestamp |
| Evidence | Allowlisted `audit_logs` evidence submission/review actions | Fixed label and timestamp |
| Decision | `pilot_launch_decision_history` | Pilot approved/not-approved label and timestamp |
| Import | `family_import_batches` | Batch outcome and timestamp |
| Export | Allowlisted `audit_logs` pilot export actions | Export type and timestamp |

No actor identifiers, passwords, tokens, original audit metadata, support notes, ticket descriptions, evidence references, import rows or operator notes are exposed in the response. Returned event IDs are opaque identifiers. This timeline is a summarized operational index, not a replacement for the existing detailed school-scoped Audit & Exports workflow.

## Authorization and query bounds

- `requireSchoolAdmin` resolves the school exclusively from `context.user.schoolId`.
- Unknown query fields, other-school IDs, invalid categories, and unbounded pagination return HTTP 400.
- Supported filters: 7/30/90 Kabul civil calendar days; ALL/SUPPORT/EVIDENCE/DECISION/IMPORT/EXPORT; page sizes 1–30 and offsets 0–50,000.
- Every SQL query branch has an explicit, parameterized `school_id` predicate. Stable newest-first ordering is timestamp descending, kind ascending, ID descending.
- Returned records and production gate snapshots are `Cache-Control: no-store`.
- Independent requests have abortable loading/error/retry handling, avoiding stale-session leakage and false success claims.
- All event fields use fixed server-side labels rather than reflecting private text or untrusted audit metadata.
- No schema migration and no new school billing or operator release-write capability.

## Release interpretation

The production gate is **always NO-GO** until real device testing, live migrations, encrypted backup restore, exact deployment commit CI, notification delivery, scheduler checks, security acceptance and final independent operator sign-off happen outside these dashboard records.

## Verification

```powershell
cd C:\projects\maktab
git pull origin main
pnpm verify:pilot:phase6
pnpm typecheck
pnpm test
pnpm build
git status
```

Original Phase 6 launch/support verification remains intact and the new refinement verifier runs afterward. New source and API tests cover validation, pagination, tenant separation, evidence/import/export redaction and the permanent NO-GO release gate. New unit tests cover Kabul midnight across year boundaries. These changes have not had their complete dependency-backed tests run in this execution environment.

## Manual acceptance

1. Open `/admin/pilot/oversight` as a school admin; confirm unauthorized requests return 401.
2. Create support, evidence, import, export and decision events in School A; confirm School B cannot see A's records.
3. Test category/date filters, previous/next pages, refresh and narrow-screen layout.
4. Confirm no actor identities or private record details appear, including in response JSON.
5. Simulate network failure; ensure no green status appears and retry is available.
6. Check English Gregorian/Kabul time, Dari and Pashto Solar Hijri, RTL focus, zoom and keyboard behavior.
7. Confirm production release still shows NO-GO even if a school has pilot approval and verified evidence.

## Next

Phase 7: pilot operations consolidation, UX polish and final security/regression review.
