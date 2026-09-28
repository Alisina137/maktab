# MaktabLink

MaktabLink is a mobile-first, multi-tenant school-family platform for private schools in Afghanistan.

This repository follows the approved **MaktabLink Product Specification V1** and **Software Development Workflow V5 — GitHub-First Delivery**.

## Current implementation

Phase 7 adds scoped school-family communication, manual fee visibility, reminder jobs, and push-delivery plumbing on top of the verified Phase 1–6 foundations.

Implemented:

- TypeScript monorepo with pnpm
- Next.js school-admin web app
- Expo Android-first mobile app
- Fastify API
- PostgreSQL + Drizzle
- strict school tenant isolation
- Dari, Pashto, and English localization
- school-issued accounts and secure authentication
- academic years with DRAFT → ACTIVE → CLOSED → ARCHIVED lifecycle
- grade levels
- class sections tied to an academic year
- subject catalog
- teacher profiles extending existing TEACHER accounts
- teacher → subject → class assignments
- dated Negaran assignments with retained history
- one active primary Negaran per class/date range
- timetable periods tied to valid teacher assignments
- teacher and class timetable conflict rejection
- teacher academic read API
- school-admin academic management UI
- audit logs for Phase 3 administrative mutations
- parent profiles extending school-scoped PARENT accounts
- students linked through one singular parentUserId
- one parent account supporting multiple children in the same school
- duplicate student-code rejection per school
- retained student class history when class/year changes
- school-admin family onboarding and one-time parent credentials
- validated CSV/XLSX import for parents, students, and teachers
- import column mapping and error preview before commit
- credential generation for imported parent/teacher accounts
- parent mobile home with linked-child switching
- tenant-scoped parent home API
- school-local Teacher Today agenda
- active Negaran supervised-class cards
- explicit daily attendance for every active student
- Present / Absent / Late / Excused attendance states
- one attendance sheet per school/class/date with duplicate-request protection
- same-day Negaran correction and post-day admin correction boundary
- parent attendance history scoped to linked children
- idempotent in-app absence/late alerts
- parent alert read/unread state
- admin attendance reports with class/date filters
- submitted/pending class counts for single-day oversight
- audited school-admin attendance corrections
- school-controlled STUDENT accounts linked one-to-one to student records
- teacher homework creation bound to active subject/class assignments
- homework DRAFT → PUBLISHED → CLOSED → ARCHIVED lifecycle
- class-specific published homework visibility for parents and linked students
- exam DRAFT → SCHEDULED → IN_PROGRESS → RESULTS_READY → PUBLISHED → ARCHIVED lifecycle
- exam subject/class maximum-score configuration
- teacher grade entry restricted to assigned subject/class combinations
- maximum-score and student-class validation for marks
- draft grade isolation from parent/student APIs
- atomic exam result publication
- published result visibility for linked parents and the student account
- idempotent homework/result notification queue records
- school-admin published-grade correction workflow with required audit reason
- Phase 6 teacher/parent/student mobile learning UI in Dari, Pashto, and English
- SCHOOL / CLASS / ROLE scoped announcements with explicit audiences
- Negaran class announcements restricted to the actively supervised class
- audience-filtered announcement visibility for parents, teachers, and students
- manual AFN fee invoices with DRAFT / ISSUED / PARTIALLY_PAID / PAID / OVERDUE / CANCELLED states
- parent/student fee visibility with billed, paid, outstanding, due date, and payment history
- immutable fee payment transactions with separate reversal records
- configurable fee reminder days with idempotent due/overdue notification jobs
- unified notification read/unread feed
- Expo push-token device registration and retryable push-delivery records
- Expo Push Service provider adapter
- push-provider failure isolation from school business actions
- school-admin communication and fee workspace
- Teacher/Parent/Student Phase 7 mobile communication UI

## Setup

```powershell
cd C:\projects\maktab
pnpm install
pnpm db:migrate
pnpm verify
```

## Run locally

Use separate terminals:

```powershell
pnpm dev:api
pnpm dev:web
pnpm dev:mobile
```

For normal LAN development, the mobile app derives the API host from Expo and uses port 4000.

For Expo tunnel development, Metro and the API need separate public endpoints. Set `EXPO_PUBLIC_API_URL` to the public HTTPS URL that forwards to the local API before starting Expo:

```powershell
$env:EXPO_PUBLIC_API_URL="https://YOUR-API-TUNNEL.example"
pnpm --filter @maktablink/mobile exec expo start --tunnel --clear
```

The mobile client prefers `EXPO_PUBLIC_API_URL` when provided and otherwise falls back to LAN host detection. Mobile API requests time out after 10 seconds instead of leaving loading states indefinitely.

School administration:

```text
http://localhost:3000/admin
```

The admin workspace contains account management, academic structure, student/family onboarding, attendance, exams/results, announcements, and fee administration.

## Database

Phase 3 migration:

```text
packages/database/drizzle/0002_phase3_academic_structure.sql
```

Phase 4 migrations:

```text
packages/database/drizzle/0003_phase4_student_family.sql
packages/database/drizzle/0004_phase4_parent_profile_backfill.sql
```

Phase 5 migration:

```text
packages/database/drizzle/0005_phase5_attendance.sql
```

Phase 6 migration:

```text
packages/database/drizzle/0006_phase6_learning.sql
```

Phase 7 migration:

```text
packages/database/drizzle/0007_phase7_communication_fees.sql
```

Phase 4 adds:

- `parent_profiles`
- `students`
- `student_class_history`
- `student_status`

The `students.parent_user_id` column is singular by design; there is no parent/student many-to-many join table.

Phase 5 adds:

- `daily_attendances`
- `student_attendances`
- `notifications`
- attendance/record/delivery status enums

Attendance notifications are currently in-app queue records. Push delivery remains a later notification phase.

Phase 6 adds:

- nullable singular `students.user_id` linkage for school-issued STUDENT accounts
- `homeworks`
- `exams`
- `exam_subjects`
- `grade_records`
- homework/exam/grade publication-state enums

Homework and result publication create deduplicated notification records for authorized parent/student recipients.

Phase 7 adds:

- `communication_settings`
- `announcements`
- `fee_invoices`
- `fee_payments`
- `devices`
- `notification_push_deliveries`
- announcement, fee, device, and push-delivery enums

Payments are append-only at the application layer. Corrections are recorded as separate reversal rows instead of modifying or deleting the original payment.

### Push configuration

The mobile app can register an Expo push token when an EAS project ID is available. Configure either the EAS project normally or set:

```env
EXPO_PUBLIC_EAS_PROJECT_ID=YOUR_EAS_PROJECT_ID
```

Push registration is best-effort and does not block the app.

Remote push notifications on Android are not testable through Expo Go; use an Expo development/production build with push credentials.

### Scheduled communication job

Phase 7 exposes this protected job endpoint:

```text
POST /v1/platform/jobs/communication/run
```

with the existing `x-platform-provisioning-key` header.

A deployment scheduler should invoke it regularly. Each run materializes due scheduled announcements, fee reminders/overdue notices, then retries pending/failed push deliveries. Deduplication makes the reminder/announcement materialization idempotent.

## Verification

```powershell
pnpm verify
```

See `docs/PROJECT-STATE.md`, `docs/PHASE-03-ACADEMIC-STRUCTURE.md`, `docs/PHASE-04-STUDENT-FAMILY.md`, `docs/PHASE-05-ATTENDANCE.md`, `docs/PHASE-06-HOMEWORK-EXAMS-RESULTS.md`, and `docs/PHASE-07-COMMUNICATION-FEES.md`.
