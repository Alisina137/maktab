# MaktabLink Staff Panel — Phase 8 Release Checklist

## Status
Phase 8 adds a deterministic regression gate to validate staff-module wiring, privilege boundaries, migrations, and prior-phase tests. This checklist is **not evidence of a completed deployment**. All commands must pass against the operator's checked-out repository before release.

## Run in PowerShell (C:\\projects\\maktab)
```powershell
git pull origin main
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm verify:staff:phase8
git status --short
```

## Eight role-based acceptance journeys

1. **Login / access:** Create a SCHOOL_STAFF user from Admin > Accounts; first login must change the temporary password. Staff cannot enter /admin or mobile teacher/parent/student screens. Revoking permissions or suspending the account must invalidate its old access token.
2. **Directory:** Without DIRECTORY_VIEW, directory access is forbidden. With it, school-local student/parent/teacher searches work; no other school's records, secrets or phone numbers are disclosed.
3. **Registration:** ENROLLMENT_REQUESTS allows staff to create/edit/submit an application, not enroll directly. Administrator approves; cross-school parent/student selections fail. Repeated submissions are rejected.
4. **Attendance:** ATTENDANCE_REVIEW permits read-only records and a proposed correction. Administrator rejects/approves, with audit evidence. Changed/archived records cannot be silently overwritten; parent notifications reflect the authoritative mark.
5. **Fees:** FEES_VIEW displays issued invoices and payment history; FEES_COLLECT controls posting. Retrying with the same idempotency key must not double charge. Staff cannot issue, reverse, refund or delete payments. Test own receipt and other-school isolation.
6. **Tasks:** TASKS_VIEW displays only assigned tasks. Staff update status; administrator assigns/cancels. Due date must be a real ISO date. Concurrent/old updates fail; cancellation sends notification and is audited.
7. **Communications:** COMMUNICATION_DRAFT permits composing/revising/submitting copy. Staff cannot publish. Administrator reviews (approve/reject); an approved draft is **not** a sent announcement. A separate administrator publication is required.
8. **Notifications / settings:** Each staff member sees only their own notifications and may mark them read. Preferences persist. Notification badge, compact list, RTL/LTR, Dari, Pashto, and English should be checked across phone/tablet/desktop widths.

## Security regressions
- Test **SCHOOL_STAFF** with no assigned profile, view-only permissions, and revoked permissions; UI gating **and** API enforcement must agree.
- Test school A staff using school B record IDs across **all** staff routes.
- Confirm staff cannot invoke `/v1/admin/...` mutations.
- Verify drafts and task payloads reject unknown keys, oversized text, invalid UUIDs or statuses.
- Verify `Cache-Control: no-store` on staff private-data responses; logouts clear cached session and sensitive data.
- Test two administrators processing the same correction/draft concurrently; one final outcome only.
- Check empty, error, loading, conflict and offline states for all permission-aware screens.

## Verification conditions
- `pnpm verify:staff:phase8` completes successfully.
- `pnpm typecheck` completes successfully.
- All database migrations through `0031_staff_workflow.sql` are applied on a **backup-first** environment.
- Manual responsive RTL review and representative end-to-end staff/admin flows are documented.
- Realistic financial or student data is **not** used for initial smoke tests; use dedicated test-school accounts.

## Rollback
If Phase 8 verification fails, **do not** deploy. Avoid reversing schema changes on production blindly: isolate the failing change, create a forward migration or revert the application commit as appropriate, and rerun the full suite.
