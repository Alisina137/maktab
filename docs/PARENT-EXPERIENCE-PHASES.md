# Parent Experience — Phase 1 Navigation & Child Context

Implemented from repository `main` baseline Phase 7, continuing without replacing school authentication or parent academic/fee APIs. This phase is the **navigation foundation**, not completion of Phases 2–7.

## Completed

- **Five bottom tabs**, ordered Home → Academics → Attendance → Inbox → More, with Home active by default, visible active styling, RTL mirroring and accessibility labels. Tab changes scroll the parent screen back to the top.
- **Parent child selector on every main tab**. Uses only child records from authorized `/v1/parent/home`, supports a modal listing of connected students, keeps the selected child across tabs and saves the preference keyed to school/account. The older redundant Home-only picker is removed; the Home child identity card remains.
- **Academics sub-navigation** (Homework → Results → Timetable), with first subtab active by default. Published results move out of More and appear only under Academics. Timetable shows real school-provided weekly periods (no invented exam dates); homework content is preserved.
- **Attendance tab** initially surfaces the existing authorized attendance history; full monthly calendar, detailed statistics and correction requests are reserved for Phase 3.
- **Inbox** uses Announcements and Notifications subtabs, with existing read/unread and mark-all-read operations. Full filtering, pagination and fine-grained item deep links belong to Phase 5. Home notification preview remains available for continuity.
- **More** preserves fees, official school contact and logout; full parent profile/settings will be Phase 6.
- **Improved request identity safeguards**: Parent Home and notifications now reject stale responses after a session change, child-specific requests reject responses for a previously selected child or token, explicit logout and home-data clearance invalidate request generations. Child switching clears child-specific state before refetch. Announcement and fee reads settle independently, preventing one failing network request from blocking both.
- **Notification routes**: parent announcement → Inbox announcements, homework → Academics homework, result → Academics results, fees → More; non-parent roles remain unchanged.
- **Translations** for new navigation and empty timetable in English, Dari and Pashto; retains Solar Hijri dates, local number formatting, authenticated API access and RTL support.
- **No DB migration**. Source contract regression: `pnpm verify:parent:phase1`. CI Linux/Windows and full TypeScript/Expo checks remain mandatory.

## Acceptance checklist on actual Android

1. Parent with one child: Home default, selected student visible on all five tabs and academic/inbox subtabs. Check no unnecessary switch modal for a single child.
2. Parent with three linked children: change from Attendance or Academics, navigate to every tab and verify only the selected child's published timetable, homework, results, attendance and invoices. Reopen app and verify account-and-school-keyed preference.
3. Switch between linked children rapidly on an unreliable connection. Old API responses must not overwrite the current child's records; sign out and sign in to a different school/account to verify complete isolation.
4. Check Home, Academics subtab order, Attendance, Inbox and More in Dari and Pashto RTL and English LTR. Verify visible active tab, safe-area bottom bar and Android Back closing the child modal.
5. Tap Home notification cards and push deep links for announcement, homework, published result and fee; verify correct main tab and nested destination.
6. Force one of announcements/fees endpoints to fail while the other succeeds; verify the healthy resource remains available, with recoverable error state.
7. Run `pnpm verify:parent:phase1`, `pnpm verify:parent-localization`, `pnpm verify:parent-resilience`, `pnpm --filter @maktablink/mobile typecheck` and the complete `pnpm verify` suite.

## Phase 2 — Actionable Parent Home and independent loading (implemented)

**Core Home behavior**
- Replaced passive overview cards with accessible, clickable cards navigating to the matching Attendance, Academic Homework/Results/Timetable, Fees or Inbox tab/subtab. Default navigation and school-specific child selection from Phase 1 are unchanged.
- Added **Needs your attention** area with capped, prioritized records derived only from verified data: today's recorded ABSENT or LATE status, published homework due today/tomorrow, unpaid issued/overdue invoice due, and actual unread notifications. Alerts are not invented for dates without attendance records, draft homework or unpublished marks. Actions navigate to the appropriate view.
- Removed misleading placeholder next-exam card until a genuine exam schedule API exists. Timetable sorting and due-date calculations respect **Kabul civil dates (UTC+04:30)**. Homework and result data are published-only.
- Home is compact: the global persistent child selector remains, duplicated large child hero removed, school greeting retained with a compact child student-code and academic-year line. The Home notification preview shows three latest records and links to the full Inbox.
- Every resource (attendance, timetable, learning, announcements, fees, notifications) has an independent loading/error/ready state. A failed request shows *Information unavailable* and a retry action instead of a false "no data" result or infinite spinner on Home. Targeted retries and full dashboard refresh are available.
- Per-resource request sequence IDs prevent an earlier retry response from overwriting a newer response, while the existing selected-child and access-token guards prevent cross-child and cross-account data leakage. Home list failures are recoverable with retry; account/session errors still go through the central auth guard.
- Preserved existing authenticated read-only attendance, school-parent API, keyboard/RTL, English/Dari/Pashto, Solar Hijri dates and AFN formatting. No database migration and no school-admin behavior change.
- Model unit tests cover Kabul-boundary dates, unknown attendance versus actual absence, published homework due ordering, and cancellation-safe invoice alerts. Automated source guard: `pnpm verify:parent:phase2`.

**Manual Android verification required**
1. In Parent Home with actual linked student records, tap every card and verify its destination; Home, Academic and Inbox default subtabs remain correct.
2. Check an actual ABSENT, LATE, unrecorded day, pending homework and overdue fee; inspect clear color+text accessibility and ordering. Do not report a nonexistent event as critical.
3. Disconnect each API endpoint individually. The failed card must show retry, while the other resources remain usable. Retry after reconnect and verify accurate data.
4. Rapidly switch children and accounts while requests/refreshes are outstanding. No previous child/account record may appear or override later responses.
5. Verify small-screen layout, Dari/Pashto RTL, TalkBack, large fonts, Solar Hijri dates and Kabul timezone midnight boundaries.
6. Run `pnpm verify:parent:phase1`, `pnpm verify:parent:phase2`, `pnpm verify` plus Android physical smoke tests. Production Step 20 remains **NO-GO** until independent external acceptance evidence is recorded.

**Remaining work:** Phase 4 academic filters/details; Phase 5 inbox filtering/deep links; Phase 6 account and finance; Phase 7 full device/accessibility/security acceptance. This phase does not assert that live Android tests have occurred.

## Phase 3 — Attendance Calendar, Monthly Statistics & Daily Details (implemented)

**Calendar and history**
- Replaced the old plain Attendance-tab history with an interactive seven-column calendar. The grid starts on **Saturday**, matching the Afghan school week; the selected date is highlighted and each recorded status has a distinct color/dot with an accessible text label and legend. Future dates cannot be selected.
- English calendar navigation uses Gregorian months. Dari and Pashto navigation uses **Solar Hijri months and day numbers**, rather than merely formatting Gregorian month headers into Hijri dates. Day details remain formatted by the existing Afghan-localized date formatter.
- Prev/next month controls query the existing **school- and parent-authorized** `GET /v1/parent/children/:studentId/attendance?from=...&to=...` endpoint with the precise start/end of the displayed month. The API client now accepts optional date bounds, while the existing Home read continues to use its default rolling history. Future-month navigation is disabled.
- The **monthly chronological history** lists each recorded date and status, with a note preview and a tap-to-select action. A selected calendar date opens its **recorded status, class and teacher/school note**. A day without a submitted attendance mark explicitly says *Not recorded*, never *Absent*. No manual edits by parents are implied or exposed.

**Statistics and resilience**
- Monthly counts: Present, Absent, Late and Excused, plus recorded-day total.
- **Attendance rate denominator:** `PRESENT + LATE + ABSENT`; numerator: `PRESENT + LATE`. Excused and unrecorded days do not count in either the numerator or denominator. If the denominator is zero, the rate is unavailable (`—`), not a misleading `0%`. This is a *rate across marked, non-excused days*, not a claim that all school days were marked.
- Monthly queries have independent loading, error and retry states. On tab/child/account changes, late responses are ignored and the component is reset; sensitive session errors still use the global account guard. Home's independent resource loading remains intact.
- Accessible button labels, 44px minimum navigation targets, language-specific RTL/LTR layout, and complete new copy in **English, Dari and Pashto**. No migration or new authorization path.
- Automated model tests cover leap February, Hijri month boundaries, navigation, de-duplicated recorded totals, unknown days and excused exclusion. Guard: `pnpm verify:parent:phase3` (also included in `pnpm verify`).

**Manual Android verification still required**
1. View attendance for a parent with two children; switch children quickly while a prior month is loading. No old child's note or status may appear in the other child's calendar.
2. Open previous and next months in English and Dari/Pashto. Verify Solar Hijri day labels, Saturday-first weekday order, leap month changes and correct query data.
3. Verify Present, Absent, Late, Excused, no record, future day and school note. Confirm that absent is shown only with an actual submitted mark.
4. Compare the monthly totals/rate against real administrator attendance; missing and excused marks must never lower the percentage. Check no-denominator state (`—`).
5. Drop the connection while browsing a non-current month; verify explicit error, retry, and no stale data. Check session revocation and active child isolation.
6. Test TalkBack, large text, RTL and small-screen 7-column calendar.

**Deferred, not silently invented:** A parent-submitted attendance correction request workflow is not backed by an existing approved request/triage API. Phase 3 shows official school notes and attendance records only; a future correction workflow would need its own authenticated school-scoped record, school review, notifications and audit history. Step 20 release remains **NO-GO** pending device/operator evidence.

## Next phases

- Phase 2 — implemented: interactive prioritized Home and independent resource retry.
- Phase 3 — implemented: Attendance calendar, recorded-only monthly statistics, and dated detail.
- Phase 4 — full Academics homework/result/timetable filters and details.
- Phase 5 — Inbox paging/filtering and precise notification-to-item navigation.
- Phase 6 — Parent account/profile/security, fees, school info and preferences.
- Phase 7 — full Android/RTL/offline/multi-child regression and release evidence.

**Important:** Automated and source tests cannot establish that the live Android UI has been tested. Step 20 production release remains NO-GO until operator/device evidence is collected.
