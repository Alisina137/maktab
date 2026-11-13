# MaktabLink

MaktabLink is a mobile-first, multi-tenant school-family platform for private schools in Afghanistan.

This repository follows the approved **MaktabLink Product Specification V1** and **Software Development Workflow V5 — GitHub-First Delivery**.

## Current implementation

Phases 1–8 provide the core school platform. Later refinements add expanded administrator workflows, the independent school-staff web portal, and improved teacher, parent, and student experiences.

**Release status: NO-GO for unrestricted production rollout.** Automated CI success does not establish deployed PostgreSQL, live-device, push, backup/restore, scheduler, accessibility, or operator acceptance. See [the final release-readiness report](docs/RELEASE-READINESS-STEP20.md) and [Phase 1 foundation audit](docs/FINAL-AUDIT-PHASE1.md).

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
- Phase 8 school subscription lifecycle, suspension safeguards, pilot-readiness exports and audit controls
- independent school staff portal at `/staff` with explicitly scoped permissions and workflows
- administrator refinements for Accounts, Academics, Families, Attendance, Learning, Communication/Fees, Profile and Pilot Operations
- teacher, parent and student navigation, learning, security and resilience refinements

## Setup

Use **Node.js 22.13+** and **pnpm 12.5.1**, as pinned in `package.json`. CI exercises Node 22 on Linux and Node 24 on Windows. Use the committed lockfile rather than resolving new dependencies during installation.

Copy `.env.example` to the root `.env`, then configure `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (the direct Neon connection for migrations), and required platform/auth secrets. Never commit credentials or paste connection strings into logs.

```powershell
cd C:\projects\maktab
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
pnpm install --frozen-lockfile
pnpm db:check
pnpm db:migrate
pnpm verify:foundation
pnpm verify
```

If `.env` already exists, **do not overwrite it**. Review the example for new configuration keys. Back up existing data before migrating. `db:check` probes the real database and cannot be proven by CI.

## Run locally

Start the API first, then launch web and mobile from separate terminals:

```powershell
pnpm dev:api
pnpm dev:web
pnpm dev:mobile
```

`pnpm dev:api` starts the API on port **4000**, waits for `/ready`, then launches `ngrok http 4000` when ngrok is installed/configured. After checking the public HTTPS tunnel, it synchronizes the ignored `apps/mobile/.env.local` with `EXPO_PUBLIC_API_URL`. Port **4040** is the ngrok **inspector**, not the API. `pnpm dev:mobile` launches Expo Go through an Expo tunnel; restart Expo if the API URL changes.

The API continues running locally if ngrok is unavailable. To use an Expo tunnel without ngrok, configure an independently reachable HTTPS endpoint. The mobile client falls back to a detected LAN host when no explicit API URL is supplied. Do not expose production data or credentials through a development tunnel.

Web routes:

- School administrator: `http://localhost:3000/admin`
- School staff (separate role and session): `http://localhost:3000/staff`

See [staff portal](docs/STAFF-WEB-PORTAL.md) for role-specific access and onboarding.

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

Phase 7 and later migrations:

```text
packages/database/drizzle/0007_phase7_communication_fees.sql
packages/database/drizzle/0008_phase8_pilot_readiness.sql
packages/database/drizzle/0009_school_image.sql
...
packages/database/drizzle/0031_staff_workflow.sql
```

Apply the **full ordered Drizzle journal** with `pnpm db:migrate`; do not cherry-pick migrations. Later migrations cover administrator security, teaching workflows, fee reconciliation, attendance follow-ups and staff operations.

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

Attendance notifications are stored as in-app queue records; Phase 7 additionally supports queued remote push deliveries. Actual push delivery still needs provider credentials and a supported device build.

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
pnpm verify:foundation  # fast tooling, lockfile, CI and repository-hygiene guard
pnpm verify             # full regressions, typechecks, tests and production builds
```

Automated tests are not a production go-live sign-off. Record the exact deployed SHA, real Android/browser journeys, production database migrations, push delivery, a backup/restore drill, external schedulers, accessibility, and operator approval.

See [Phase 1 foundation audit](docs/FINAL-AUDIT-PHASE1.md), [Phase 2 security audit](docs/FINAL-AUDIT-PHASE2.md), [Phase 3 database integrity audit](docs/FINAL-AUDIT-PHASE3.md), [Phase 4 admin UX audit](docs/FINAL-AUDIT-PHASE4.md), [Phase 5 academic workflow audit](docs/FINAL-AUDIT-PHASE5.md), [Phase 6 account and family audit](docs/FINAL-AUDIT-PHASE6.md), [Phase 7 communication and fees audit](docs/FINAL-AUDIT-PHASE7.md), [Phase 8 localization and offline audit](docs/FINAL-AUDIT-PHASE8.md), [Phase 9 API and operations audit](docs/FINAL-AUDIT-PHASE9.md), [Phase 10 final full-project audit](docs/FINAL-AUDIT-PHASE10.md), [project state](docs/PROJECT-STATE.md), [production operations](docs/PRODUCTION-OPERATIONS.md), and [Step 20 release readiness](docs/RELEASE-READINESS-STEP20.md).
