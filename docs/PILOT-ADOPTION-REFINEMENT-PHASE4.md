# Pilot Operations — Phase 4: Usage & Adoption

Status: **Code committed directly on `main`**. Full dependency-backed tests and production/browser acceptance must be executed on the user's machine/CI.

## Implementation

A new route-backed `/admin/pilot/adoption` subtab appears directly after Data Onboarding. It is served within the existing School Admin authenticated workspace, preserves RTL/LTR support, highlights its tab and loads independently of School Readiness / Subscription reporting failures.

The read-only endpoint `GET /v1/admin/pilot/adoption?window=today|7d|30d` accepts only a strictly validated reporting window and derives the school ID **exclusively from the authenticated admin session**. It returns aggregated counts only, no user names, PII, account sessions, private student records or JWT material. It sets `Cache-Control: no-store`.

### Metrics

**Teacher/Parent/Student login coverage**

- Eligible Teachers and Parents are active account holders with matching role profiles.
- Eligible Students are active STUDENT accounts associated with active students in the current active academic year.
- **Signed in** = account `users.last_login_at` falls in the selected Kabul-local period. This is NOT DAU/WAU/MAU, time-spent, app engagement, number of sessions or proof of academic participation: logging in again later overwrites the earlier last-login event. The UI explicitly discloses this.
- **Activated** = eligible accounts that have completed the required initial password change (`must_change_password = false`). It is independent of the selected window.
- Percentages with zero eligible accounts return null, shown as `—`, not fake 0%/100%.

**Academic event counts**

- Homework publications: current-active-year homework rows with `published_at` within the chosen reporting interval.
- Homework submissions: current-active-year homework submissions with `submitted_at` within the interval.
- Attendance class-days and student marks: school/current-year attendance recorded for dates in the Kabul-local interval and submitted no later than report time. These are counts of recorded events, not an expected-attendance completion percentage.
- Published announcements: visible, non-archived announcements scheduled for publication during the window.

**Windows**

- Today, last seven days and last thirty days use **Asia/Kabul** civil calendar dates and the current time as the upper timestamp bound.
- Aggregation occurs in database-side SQL, with school and active-year filters at each relevant join. There are no individual-level activity feeds in Pilot Operations.

### Interface

- Three role cards: signed-in count / eligible accounts, percentage, progress bar and initial-password-change counts.
- Five contextual event statistic cards link into existing Attendance, Learning and Communication administrative sections.
- 1/7/30-day selection, screen-reader labels, responsive design, loading, abort-on-session-change, independent fetch error/retry and Dari, Pashto and English translations.

## Validation

```powershell
pnpm verify:pilot:phase4
pnpm typecheck
pnpm test
pnpm build
```

New API and PGlite database tests cover role counts, multiple reporting windows, event records, other-school isolation, endpoint auth, strict parameter validation and no-store responses. The previous audit/export Phase 4 verification remains included in `verify:pilot:phase4`.

### Manual acceptance

1. Use separate admin accounts for two test schools; counts must not cross school boundaries.
2. Sign in with teacher, parent and student accounts, check last-login metrics across today/7d/30d, and confirm no duplicate counting from multiple sessions.
3. Publish a homework assignment, submit it, record attendance, publish an announcement, then refresh each reporting window. Counters should change based on actual server data.
4. Verify empty schools show `—` for unavailable percentages, not success or completion claims.
5. Open Adoption when Subscription/School Readiness APIs fail; Adoption must still load independently.
6. Test RTL in Dari/Pashto, English LTR, keyboard selection, narrow screens, 200% zoom, and session switching under slow network.
7. Run full CI on the exact `main` SHA; conduct a production data privacy review. Usage reports DO NOT grant pilot or production approval.

## No migration

All aggregation queries use existing `users`, `academic_years`, `students`, `parent_profiles`, `teacher_profiles`, `homeworks`, `homework_submissions`, `daily_attendances`, `student_attendances` and `announcements` tables.

## Next

Phase 5: Service Health reporting and subscription assistance without exposing internal infrastructure or platform-level billing permissions.
