# Phase 4 — Student & Family System

## Outcome

Phase 4 lets a school onboard families while preserving the product's strict school and parent/student ownership rules.

## Implemented scope

### Parent accounts

A school administrator creates a parent account through the family domain rather than public registration.

Creation is transactional:

```text
PARENT user
+
ParentProfile
```

The API returns the generated temporary password once. The existing Phase 2 forced-password-change flow remains authoritative.

### Students

Each student stores:

- school ID
- singular parent user ID
- student code
- full name
- academic year
- class
- status

There is no parent/student many-to-many table.

A parent may therefore own several students in one school, while each student has exactly one parent at a time.

### Tenant and relationship validation

Before student creation or reassignment, the family store validates that:

- the parent belongs to the same school
- the parent is available rather than suspended/archived
- the academic year belongs to the same school
- the class belongs to the same school and selected year
- the target year is not closed/archived
- the student code is unique within the school

### Class-history retention

`student_class_history` records current/prior placement.

Changing a student's class or academic year closes the previous open history row and starts a new one. Withdrawing a student closes the active placement without deleting history.

### Parent mobile home

Authenticated parents can call:

```text
GET /v1/parent/home
```

The server derives school and parent identity from the access token. The mobile app:

- loads only linked children
- selects the first child by default
- lets the parent switch among siblings
- shows student code, class, and academic year
- shows a useful empty state when no child is linked

### School-admin family workspace

The web admin can:

- create a parent and receive its temporary credential
- add a student and link an existing parent
- review parent child-counts and account state
- reset/suspend/reactivate parent accounts
- review current student/class/parent relationships
- print the currently displayed temporary credentials

### Bulk import

Supported input:

- CSV/TSV
- XLSX

Supported entities:

- parents
- students
- teachers

The browser workflow is:

```text
Select type
→ Upload file
→ Preview headers/rows
→ Map columns
→ Validate
→ Review row errors
→ Confirm
→ Import
→ Show generated credentials
```

The API limits uploads to 5 MB and previews/imports at most 1,000 data rows per request.

Validation detects, as applicable:

- malformed rows
- duplicate/existing usernames
- duplicate/existing employee codes
- duplicate/existing student codes
- missing/unavailable parent account
- unknown academic year
- class not found in the selected academic year

Validation does not mutate student/family data.

## API routes

```text
GET   /v1/admin/families
POST  /v1/admin/families/parents
POST  /v1/admin/families/students
PATCH /v1/admin/families/students/:studentId

POST  /v1/admin/families/import/preview
POST  /v1/admin/families/import/validate
POST  /v1/admin/families/import/commit

GET   /v1/parent/home
```

## Database migration

```text
packages/database/drizzle/0003_phase4_student_family.sql
```

Apply it after pulling:

```powershell
pnpm db:migrate
```

This migration is additive. Reverting source code does not automatically remove the new enum/tables or their data; database rollback must be planned separately rather than using a destructive shortcut.

## Verification coverage

Phase 4 automated coverage includes:

- one parent owning three students
- same-school sibling visibility through one parent login
- singular parent ownership on every student record
- cross-school parent link rejection
- per-school duplicate student-code rejection
- CSV parsing with quoted cells
- XLSX first-worksheet parsing
- duplicate bulk-import validation without mutation
- existing Phase 1–3 regression suites
- production web build
- Expo Android export

The final CI result and real Neon migration status are recorded separately in `docs/PROJECT-STATE.md`.

## Step 8 family-management refinements

- New parent and student login usernames accept only English letters and digits, with no spaces or special characters.
- Duplicate parent/student usernames return an action-oriented conflict message, and the Admin family workspace surfaces that conflict in a dedicated popup.
- Parent accounts can be permanently deleted only when no student record is linked to them. The API enforces this rule even if the UI is bypassed.
- The Add Student form suggests the lowest unused student code in the `S-xxxx` sequence. Codes use at least four digits, fill gaps first, and naturally continue to five digits after `S-9999`.
- Parent selection in Add Student is username-first: options display only the unique parent username, and a search field filters the available parent accounts by username.

### Student account/list administration

The Admin Families student list now mirrors parent-account administration where applicable:

- Reset password for students with a login
- Suspend/Reactivate students with a login
- Delete the student record when no protected attendance, grade, or fee records depend on it

Deleting a dependency-free student also removes its school-issued login account when present. Students without login accounts expose only student-record actions.

