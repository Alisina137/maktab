# Pilot Operations — Data Onboarding refinement Phase 3

Status: **Implemented code on main; actual CI and browser acceptance must be verified.**

## Implemented

### Guided school setup
- The Data Onboarding page now provides a **ten-step ordered setup guide**: school/subscription, active academic year, classes/subjects, teacher accounts, teaching coverage, parent accounts, active-year students, family relationship coverage, timetable coverage and current Negaran coverage.
- Completion is **read from existing authenticated core and advanced readiness endpoints**. No client-only checkboxes or manual claims of setup completion.
- Each step links to the existing Accounts, Academics, Families, or Subscription workflow. The earliest verifiably incomplete item is recommended as the next action.
- When advanced readiness is unavailable, the corresponding steps stay **Not verified**, and an incomplete known step remains actionable. Zero eligible records never count as completion.
- Completing the checklist **does not** imply pilot launch approval or production release authorization.

### Data quality after import
- Seven school-scoped, active-year metrics reuse the server's existing advanced readiness SQL: active parent/class relationships, teacher assignment coverage, student and teacher account activation, class enrollments, timetable coverage and current Negaran.
- Cards distinguish critical gaps, warnings, completed coverage, and inapplicable checks. Counts show **affected records against actual eligible records**, never synthetic success percentages.
- Remediation links navigate to the source module; the School Readiness page retains the paginated missing-record drilldowns. No raw private CSVs or passwords appear in reports.
- Data-quality reports are scoped to the current active-year populations, and are not universal student data quality or service/production health assertions.

### Import history improvements
- Existing family CSV/XLSX preview → validate → idempotent commit stays the sole import implementation, unchanged.
- The existing school-admin-protected history endpoint accepts optional strictly validated `status` (`COMPLETED|REJECTED|FAILED`), `actor` substring (2–64 characters), and `dateFrom/dateTo` calendar dates, in addition to prior `entityType` and bounded pagination.
- Filtering occurs **in PostgreSQL before limit/offset**, always constrained to the authorized school's ID. Dates represent **Asia/Kabul civil day boundaries**, with the ending day inclusive. Invalid dates, reversed ranges, unknown statuses, extra parameters or overlong actor input return HTTP 400.
- Import history UI has draft/applied filters, clear/reset, mobile layouts, Solar Hijri date selectors for Dari/Pashto, and consistent pagination/retry behavior under applied filters.
- Import history does not store or reveal temporary passwords, raw CSV files, fingerprints, verification tokens, or credentials.

## No migration
This phase uses existing tables, readiness coverage queries and the existing family_import_batches ledger. It introduces no database migration or permission change.

## Automated checks to run

```powershell
pnpm verify:pilot:phase3
pnpm typecheck
pnpm test
pnpm build
```

The phase3 verification command now runs the original idempotent import guard and the new refinement source guard. Existing API integration tests now check filtered history by outcome, actor and date, rejection of bad query parameters, and tenant isolation.

## Manual acceptance remaining

1. Set up an empty school; confirm checklist statuses are derived from actual records, unknowns are not counted complete, and next action navigates correctly.
2. Create multiple classes, assign teachers and Negaran, then import valid parents/students. Confirm progress updates only when authenticated backend data changes.
3. Import a student linked to a suspended parent, and leave a teacher login unactivated. Verify accurate critical and warning counts; resolve them in their owner modules.
4. Run both successful and rejected import attempts, then filter by entity, result, administrator and Kabul day. Verify paging applies **within the filtered set** and clear restores all records.
5. Verify a second school cannot see import history or readiness of the first. Check username wildcard searches, date boundary behavior, invalid inputs and session switching under slow network.
6. Check English/Dari/Pashto translations, RTL/LTR, narrow widths, 200% zoom, keyboard focus and date picker overlays.
7. Verify full regression/CI on the exact merged main SHA. Step 20 independent production release remains NO-GO until real proof is independently approved.

## Intentional limitations
- No import duplicates are deleted or rewritten automatically; account/relationship corrections remain within their authorized modules.
- No live attendance, homework completion or device engagement analytics are fabricated in Data Onboarding.
- This is not a replacement for encrypted PostgreSQL backup/restore workflows.
