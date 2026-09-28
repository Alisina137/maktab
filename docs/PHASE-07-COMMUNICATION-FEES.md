# Phase 7 — Communication & Fees

## Outcome

Phase 7 completes the MVP school-family communication layer with scoped announcements, basic fee visibility, in-app notifications, push-delivery plumbing, and idempotent reminder jobs.

## Announcements

Supported audience scopes:

```text
SCHOOL
CLASS
ROLE
```

Every announcement must have an explicit audience.

For CLASS scope, a class ID is required. For ROLE scope, one of TEACHER / PARENT / STUDENT is required.

User visibility requires both:

1. same school tenant
2. matching audience relationship

### Negaran announcements

Authenticated teachers may publish through:

```text
POST /v1/teacher/announcements
```

but only when:

- the audience is CLASS
- the class is supplied
- the teacher is the active Negaran for that class/date

A Negaran therefore cannot use the endpoint for school-wide or unrelated-class communication.

### Admin announcement routes

```text
GET  /v1/admin/communication
POST /v1/admin/announcements
POST /v1/admin/announcements/:announcementId/archive
```

Announcements can publish immediately or use a future ISO timestamp.

Scheduled announcements are materialized into recipient notification records by the Phase 7 job.

## Basic fees

Fee management is intentionally manual in the MVP. MaktabLink records what the school says was paid; it does not collect money online.

Invoice lifecycle:

```text
DRAFT
→ ISSUED
→ PARTIALLY_PAID
→ PAID
→ OVERDUE

eligible unpaid invoice
→ CANCELLED
```

Routes:

```text
POST /v1/admin/fees/invoices
POST /v1/admin/fees/invoices/:invoiceId/issue
POST /v1/admin/fees/invoices/:invoiceId/cancel
POST /v1/admin/fees/invoices/:invoiceId/payments
POST /v1/admin/fees/payments/:paymentId/reverse
PATCH /v1/admin/fees/reminder-settings
```

Parent/student visibility:

```text
GET /v1/parent/children/:studentId/fees
GET /v1/student/fees
```

The view includes:

- amount
- paid
- outstanding
- due date
- invoice status
- payment/reversal history

### Immutable payments

A PAYMENT row is never silently edited through the API.

If a payment was recorded incorrectly, the administrator supplies a reason and MaktabLink appends a REVERSAL row referencing the original transaction.

A second reversal of the same payment is rejected.

Payment and reversal operations are written to the audit log.

## Reminder jobs

Fee reminder days are configurable per school; the default is:

```text
7 days before
1 day before
overdue
```

The scheduled worker entry point is:

```text
POST /v1/platform/jobs/communication/run
x-platform-provisioning-key: ...
```

The deployment environment must call this endpoint on a recurring schedule.

Each run:

1. materializes due scheduled announcements
2. creates configured fee reminders
3. marks unpaid past-due invoices OVERDUE
4. creates one overdue reminder
5. attempts pending/failed push deliveries

Deduplication keys make repeated scheduled runs idempotent.

## Notifications and push

Unified user routes:

```text
GET  /v1/notifications
POST /v1/notifications/:notificationId/read
POST /v1/notifications/devices
POST /v1/notifications/devices/deactivate
```

Mobile automatically attempts to register its Expo push token after an authenticated permanent-password session becomes available.

Push registration is best-effort. Failure never blocks the mobile UI.

Server push behavior:

```text
Notification
→ active user Device(s)
→ NotificationPushDelivery
→ Expo Push Service
```

Each notification/device delivery keeps independent:

- PENDING / SENT / FAILED status
- attempt count
- provider message ID
- last error
- last-attempt time

A failed provider call changes only delivery state. The original school action and in-app notification remain stored.

### Required real-device configuration

The mobile package includes:

```text
expo-notifications
expo-device
```

and the `expo-notifications` config plugin.

An EAS project ID must be available through EAS config or:

```env
EXPO_PUBLIC_EAS_PROJECT_ID=...
```

Android remote push requires a development/production build; Expo Go cannot test remote push delivery.

## Mobile experience

Parent:

- scoped announcements
- selected child's fees/payment history
- unified notifications

Teacher:

- Negaran class announcement composer
- scoped announcements
- unified notifications

Student:

- scoped announcements
- own fees/payment history
- unified notifications

Dari, Pashto, and English labels are included with existing RTL behavior.

## Admin workspace

The Phase 7 admin surface supports:

- SCHOOL / CLASS / ROLE announcement creation
- future announcement publish time
- announcement archive
- draft fee creation
- invoice issue/cancel
- manual payment recording
- payment history
- reason-required reversal
- reminder-day configuration
- billed/paid/outstanding summaries

## Database migration

```text
packages/database/drizzle/0007_phase7_communication_fees.sql
```

It adds:

- communication settings
- announcements
- fee invoices
- fee payment/reversal ledger
- mobile devices
- push delivery attempts
- supporting enums/indexes

Apply after pulling:

```powershell
pnpm db:migrate
```

## Verification coverage

Phase 7 automated coverage includes:

- class announcement visible to the intended class parent
- same class announcement hidden from another class parent
- class notification recipient isolation
- partial fee payment
- outstanding balance calculation
- immutable payment reversal
- duplicate reversal rejection
- parent linked-child fee visibility
- configurable 7-day reminder
- repeated reminder job creates no duplicate
- failed push attempt retained as FAILED delivery state
- push failure does not remove the announcement
- push failure does not change the fee invoice
- existing Phase 1–6 regressions
- TypeScript typecheck
- Next.js production build
- Expo Android production export

The CI and local migration state are tracked in `docs/PROJECT-STATE.md`.
