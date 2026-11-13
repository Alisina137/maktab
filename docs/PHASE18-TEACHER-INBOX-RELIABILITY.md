# Phase 18 — Teacher Inbox Reliability and Navigation Recovery

**Date:** November 13, 2026.  
**Status:** Source changes delivered for review; live staging/device evidence pending.  
**Scope:** Teacher Today, Notifications Center and More. This phase is a follow-on quality phase; the original product specification did not define an eighteenth implementation phase.

## Tasks

| ID | Delivered change | Risk addressed |
| --- | --- | --- |
| 18.1 | Settle Teacher Learning, Announcements and Notifications independently, with per-resource ready/error flags and identity/epoch checks. | A slow Learning call previously blocked an otherwise healthy inbox because Promise.allSettled waited for all three requests. |
| 18.2 | Compute the entire authorized matching inbox collection and reveal it in progressive 30-row slices instead of silently capping at 100. | Wrong result counts and inaccessible notifications above item 100. |
| 18.3 | Improve inbox search accessibility, show **displayed / matching** counts, distinguish no results from a first-load server failure, and provide a visible header refresh. | Ambiguous empty/loading states and hidden recovery controls. |
| 18.4 | Replace the notification-write Set on scope changes and guard old write completions, while protecting locally marked items from stale fetch responses. | A slow prior-session completion could interfere with a new account's busy/write tracking. |
| 18.5 | When a notification has no recognized app destination, mark it read but show localized feedback instead of closing the inbox silently. Keep the server deep-link allowlist unchanged. | Tapping a notification could appear broken without explanation. |
| 18.6 | Add executable pagination/notification-destination tests and source integration guards to root verification and Ubuntu/Windows CI; document real-world acceptance. | Prevent regressions during later phases. |

## Verification

```powershell
cd C:\projects\maktab
pnpm install --frozen-lockfile
pnpm verify:phase18
pnpm verify
```

## Manual acceptance (NOT performed here)

On the *same exact deployed SHA*, sign in as Teacher on a real Android device (Dari, Pashto and English). With slow Learning and healthy Notifications requests, confirm that the inbox becomes usable before Learning finishes. Check slow/rejected Notifications and Announcements independently, retry, no-match vs no-data UI, 165+ notifications with several Show More actions, mark one/all, and filter/search reset. Then log out Teacher A and sign into Teacher B while a previous mark request is pending; confirm A's data and mutation state never appear. Open a notification with an unsupported destination and verify feedback. Test accessibility, device back, screen-reader labels and low-bandwidth mode.

No migrations, API schema changes, new permissions or environment variables are required. **Production remains NO-GO** until independent Phase 11/12 isolated Neon staging, actual Android/browser journeys, push/scheduler and restore rehearsal, and operator signoff are recorded.
