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

## Next phases

- Phase 2 — interactive, action-prioritized Home dashboard and independent per-resource error/loading/refresh.
- Phase 3 — Attendance monthly calendar, totals, correctly defined denominator, and dated detail.
- Phase 4 — full Academics homework/result/timetable filters and details.
- Phase 5 — Inbox paging/filtering and precise notification-to-item navigation.
- Phase 6 — Parent account/profile/security, fees, school info and preferences.
- Phase 7 — full Android/RTL/offline/multi-child regression and release evidence.

**Important:** Automated and source tests cannot establish that the live Android UI has been tested. Step 20 production release remains NO-GO until operator/device evidence is collected.
