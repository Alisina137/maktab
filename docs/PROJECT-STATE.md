# MaktabLink Project State

## Product objective

Build a mobile-first, multi-tenant school-family communication platform designed for private schools in Afghanistan.

## Source of truth

- Product: **MaktabLink Product Specification V1**, supplied 2026-09-28.
- Implementation process: **Software Development Workflow V5 — GitHub-First Delivery**.
- Repository: `Alisina137/maktab`.

## Locked product rules

- School controls school-user identities.
- Role selection is UX only; backend role is authoritative.
- Every operational/account/academic/family/attendance/learning/communication/fee operation is school-scoped.
- Parent sees only linked children; student sees only their own linked record.
- Negaran remains an assignment rather than a role.
- Announcements always have an explicit SCHOOL, CLASS, or ROLE audience.
- Announcement reads require both same-school membership and audience match.
- Negaran announcement capability is limited to the actively supervised class.
- Fee collection remains manual in the MVP; MaktabLink records rather than processes payment.
- Fee PAYMENT records are immutable; corrections use separate reasoned REVERSAL transactions.
- Sensitive finance/announcement operations are audited.
- Scheduled notification materialization is idempotent.
- Push-provider failure cannot undo the underlying school action.
- Cross-school access is prohibited.

## Current phase

**Phase 7 — Communication & Fees — complete and CI verified**

### Implemented outcomes

- migration `0007_phase7_communication_fees.sql`
- independent `communication_settings` with configurable fee reminder days
- SCHOOL / CLASS / ROLE announcement scopes
- explicit class/role audience validation
- admin immediate/future announcement publishing
- announcement archive
- active-Negaran class announcement endpoint
- audience-filtered Parent/Teacher/Student announcement feeds
- class-announcement recipient isolation
- fee DRAFT / ISSUED / PARTIALLY_PAID / PAID / OVERDUE / CANCELLED lifecycle
- whole-AFN manual fee invoices
- parent linked-child fee visibility
- linked Student own-fee visibility
- immutable PAYMENT ledger rows
- separate reason-required REVERSAL ledger rows
- duplicate reversal rejection
- fee billed/paid/outstanding derivation
- configurable due reminders
- idempotent fee due/overdue reminder creation
- scheduled announcement materialization
- unified read/unread notification API
- mobile device/push-token registration
- per-notification/per-device push delivery records
- Expo Push Service adapter
- failed push retry state
- push failure isolation from business records
- protected communication/reminder/push job endpoint
- Phase 7 admin announcement/fee workspace
- Phase 7 Parent/Teacher/Student mobile communication UI
- best-effort mobile push registration
- Dari/Pashto/English Phase 7 labels

## Verification

GitHub Actions CI passed on the complete Phase 7 implementation commit:

```text
5e4c041decedac3a2087683e2157f57e52ad6efc
```

Verified by CI:

- dependency installation, including Expo notification/device packages
- monorepo TypeScript typecheck
- Phase 1–7 database/API tests
- intended-class announcement visibility
- unrelated-class announcement isolation
- class-notification audience isolation
- historical/ended Negaran assignments excluded from current class communication
- partial payment and outstanding-balance behavior
- immutable payment reversal
- duplicate reversal rejection
- parent linked-child fee visibility
- scheduled fee reminder idempotency
- push provider failure handling
- persistence of announcement/fee data after push failure
- existing tenant/auth/academic/family/attendance/learning regressions
- Next.js production build
- Expo Android production export

## Local database status

Phase 7 is **not yet locally migrated/verified** in this conversation.

Pending migration:

```text
0007_phase7_communication_fees.sql
```

After pulling the final Phase 7 source:

```powershell
pnpm install
pnpm db:migrate
pnpm verify
```

The new mobile dependencies make `pnpm install` required before verification.

## Push deployment status

Code/configuration for device registration and Expo push delivery is implemented and CI-build verified.

Actual remote-push delivery to the user's Android device is not claimed as verified yet.

For real remote push:

- configure an EAS project ID / push credentials
- use an Expo development or production build
- Expo Go on Android cannot perform remote push notification testing

The mobile app remains functional if push setup is absent because registration is best-effort.

## Scheduled-job deployment status

Phase 7 implements the protected idempotent job endpoint:

```text
POST /v1/platform/jobs/communication/run
```

A production scheduler/cron still needs to invoke that endpoint on the deployment platform. The job infrastructure itself is an operational deployment concern and is not silently simulated by the API process.

## Phase 7 boundary

Implemented now:

- scoped announcements
- Negaran class communication
- basic manual fees
- fee payment/reversal history
- reminder jobs
- in-app notifications
- Expo push transport plumbing

Not included:

- online fee collection
- payment gateway integration
- unrestricted teacher announcements
- Phase 8 production/pilot operational hardening

## Next phase

**Phase 8 — Pilot Readiness**, when explicitly requested.

Phase 8 includes imports/pilot onboarding hardening, audit review, accessibility, error states, low-bandwidth optimization, backups, production observability, subscription controls, and admin documentation according to the Product Specification.
