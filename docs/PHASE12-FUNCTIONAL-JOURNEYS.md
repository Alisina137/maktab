# MaktabLink — Phase 12: Functional User Journeys & Pilot Quality

**Started:** 2026-11-13  
**Status:** In progress; Step 12.1 source implementation delivered for CI review.  
**Scope:** Additional functional end-to-end API journeys, error/permission boundaries, and later user-facing journey hardening.  
**Production release:** **NO-GO** — this phase does not supersede unfinished Phase 11 real-device/Neon/staging acceptance.

## Objective

Automated CRUD/permission tests and attractive pages are not enough if a school operator cannot onboard a real family from beginning to end. Phase 12 creates **connected workflows** exercising multiple layers of the app, preserving backend-authoritative roles, school separation, first-login safety and read-only/secret-safe responses. Each subsequent step will address a complete school user journey instead of making disconnected UI edits.

### Phase 12 steps

| Step | User flow and exit criteria | Source progress | External proof |
| --- | --- | --- | --- |
| **12.1** | **Admin → School → Academic year → Grade → Class → Parent → Student → Login → Parent & Student home.** Set up two independent schools with repeated usernames, require password change, verify real class relationship and child isolation, deny wrong-role access, assert private responses are never publicly cached. | **Implemented in API integration suite** | Physical devices/deployed Neon not tested |
| **12.2** | **Staff and Teacher:** provision profiles, permissions, teacher assignment, daily schedule and denied cross-class/role operations. Review empty/loading/error navigation on affected screens. | Planned | Not tested |
| **12.3** | **Attendance and Learning:** register/correct attendance, assign/publish homework, record and publish grades, ensure students/parents never see drafts or another child's records. | Planned | Not tested |
| **12.4** | **Communication and Fees:** audience-targeted announcements, delivery fallbacks, invoice/AFN payment/reversal, parent/student balances and retry idempotency. | Planned | Not tested |
| **12.5** | **Experience and navigation:** audit route/tab discoverability, form validation, list empty/loading/success/error states, responsive layouts, screen-reader interactions and Dari/Pashto RTL against actual pages; fix proven defects. | Planned | Not tested |
| **12.6** | **Integrated release-candidate journey:** run connected school flows against a separately deployed staging stack; reproduce and resolve real defects; link exact commit SHA, devices and evidence to Phase 11 independent acceptance. | Planned | Not tested |

## Implemented — Step 12.1

Added one comprehensive Fastify/PGlite integration test in `apps/api/src/app.test.ts`:

```text
Phase 12 Step 1: complete school-to-family onboarding journey is functional and tenant-isolated
```

This test uses the **full ordered migrations** via the established `createTestApp()` fixture and calls actual HTTP routes through Fastify's injection layer. For *each of two synthetic schools*, it provisions school/admin, creates and activates an academic year, adds grade and class, creates parent and student records, creates the student login, signs in both end users, forces first-password change, then checks Student home and timetable data. It uses the **same parent and student usernames in both schools** to detect accidental globally scoped account identity. It verifies Parent home child identities and that cross-school parent timetable, attendance, learning and fees requests return 404. It also verifies role restrictions, unauthenticated denial, no-store caching and omission of credential fields.

**Boundaries:** Fastify/PGlite is an in-process integrated backend test, not browser E2E, real Neon concurrency, a physical Expo app or operational authorization. Existing Phase 11 live-journey/gate statuses stay unverified until independently evidenced.

## Security defect discovered and corrected during Step 12.1

The first CI run of the connected onboarding journey **failed** because the Parent home response included a nested student's `passwordHash` field. This was a real API serialization defect in `GET /v1/parent/home`: the family store correctly uses full database User objects internally, but the route returned them without applying `safeUser`. The corresponding Admin family overview had the same exposure risk.

**Correction:** `apps/api/src/families/routes.ts` now strips authentication hashes from every nested `user` record in Parent home and Admin family parents/students/enrollments. It preserves the original data associations and internal store queries. The new journey asserts that neither response serializes `passwordHash`, ensuring this regression remains visible in CI. First-login temporary credential responses remain intentionally available only to the authorized administrator at account creation and are unaffected.

This finding demonstrates why Phase 12 tests *connected* user flows rather than relying solely on isolated route checks.

## Verification

This is wired into both Ubuntu and Windows GitHub Actions, and the root `pnpm verify` sequence:

```powershell
cd C:\projects\maktab
pnpm install --frozen-lockfile
pnpm verify:phase12:step1
pnpm verify
```

Check the **exact merged SHA** in GitHub Actions before treating code checks as PASS. A successful run means the software fixture's connected workflow passed, not that a parent used the app successfully on a device.

## Phase 11 dependencies (not waived)

Before a school pilot: independently run the Phase 11 Neon preflight/migration, Android/RTL/TalkBack/offline, real push and scheduled jobs, staged encrypted restore, cross-school browser checks, finance reconciliation and operator review. Refer to `docs/PHASE11-EXECUTION-RUNBOOK.md`.

**Next implementation step:** 12.2 — Staff/Teacher assigned-class and permissions journey.
