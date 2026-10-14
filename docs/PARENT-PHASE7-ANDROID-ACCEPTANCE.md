# Parent Phase 7 — Android & Release Acceptance Runbook

**Status: NOT RUN — NO-GO.** Source tests and GitHub Actions cannot replace a real phone, school test accounts, or an independent operator. Never use real children's personal information in screenshots or publicly uploaded logs.

## Preconditions

- Pull the exact candidate commit from `origin/main`; run `git rev-parse HEAD` and record the full 40-character SHA. Confirm a clean tree using `git status --porcelain`. CI must pass on the **same SHA**, both Linux and Windows.
- Use a non-production or authorized pilot school with **two parents**, at least **three linked students** across distinct classes, and a school in a different tenant. Include a parent with **zero linked children**.
- Seed the test school using normal school/admin workflows (no direct inserts that bypass permissions): at least two different-class timetables, a published and a draft homework, an unpublished and a released exam, attendance marks covering PRESENT/ABSENT/LATE/EXCUSED plus unmarked date, one school-wide/class-specific/parent-specific announcement, >40 notifications, a draft invoice, a partially-paid issued invoice, a paid invoice, a cancelled invoice, and a reversal record.
- Device matrix: Android small screen with TalkBack; Android tablet or large phone; 200% font scaling; three app languages (Dari, Pashto, English); airplane-mode and changing network, where permitted.
- Never record temporary or live credentials, bearer tokens, receipts containing sensitive identifying information, or private student information in publicly available artifacts.

## Required paths — write PASS/FAIL/NOT_RUN with redacted evidence

| Gate | Operator exercise | Expected result |
| --- | --- | --- |
| `login_and_session` | Log in as Parent A, force first password change, sign out, sign back in | Only that parent's session and data; old tokens invalid after password change |
| `linked_children` | Start with zero, one, then several children; switch repeatedly while requests are slow, then relaunch | Zero-child Profile/School/Preferences still accessible; no other child data; preference survives restart for the same account |
| `cross_account_school` | Repeat child API calls with Parent B credentials and Parent A's student IDs; switch to second school | 403/404 and no cross-tenant/cross-parent data, including fees and attendance |
| `home` | Check Home cards, outstanding notices, and links to timetable/homework/attendance/inbox/fees | No fabricated events; every available card opens matching destination |
| `academics` | Search published/closed homework, filter by subject/due, expand released exam and timetable | Drafts and private grades are hidden; child switches reset subject/exam details |
| `attendance` | Browse first/last dates of Gregorian and Solar Hijri months (incl. leap year); test records, missing and excused | Saturday-first grid; missing != absence; no imaginary denominator; dated notes only when actually recorded |
| `inbox` | Use class-parent-school audience, read/unread filters, >40 items, mark-all-read, and unknown/archived links | Correct audience, no leaks; 20-at-a-time display only; exact authorized target; bad links stay harmless |
| `fees` | Compare two children's invoices, partial and reversed payments, draft/cancelled and outstanding totals | Current child's authorized ledger only; account cannot create/pay/reverse invoices |
| `profile_school` | Open profile with linked and unlinked accounts; test official school contact actions | Correct server-managed parent data and contacts; no fictitious edit affordances |
| `password_rotation` | Try wrong current, same password, invalid confirmation, then valid password; retry after logout | Validation enforced; prior token cannot regain access; no late response restores a signed-out session |
| `offline_recovery` | Toggle airplane mode during sibling switching, fee refresh, inbox mark-read and session refresh; restore network | No stale cross-child data; failure recoverable per resource; no false paid/read state; no reconnect-flapping notifications |
| `multilingual_rtl` | Switch English, Dari, Pashto; navigate all tabs, date/time/amount controls, relaunch | RTL mirrored, Solar Hijri labels correct, date-time formats localized and preference retained |
| `accessibility` | TalkBack every control, 200% font, compact Android width, landscape and tablet | 44+ dp tap areas for primary actions; labels/statuses, visible selected tabs; scrollable More subtabs |
| `push_cold_start` | Tap push when app is killed, foreground, and before Home loads; withdraw linked child; open old links | Only current authorized linked child targeted; old/unknown destination never reveals data |
| `test_ci` | Run full verify on exact SHA, review Linux & Windows CI, API integration, typecheck, build | Exact candidate SHA passes; no old job/branch accepted as evidence |
| `operator_signoff` | Independent reviewer checks redacted evidence and risks | Dated, named decision with separate full Step 20 review |

## Automated checks

```powershell
cd C:\projects\maktab
git status --short
git rev-parse HEAD
pnpm verify:parent:phase7
pnpm verify
```

Phase 7 tests combine existing Phase 1–6 model/source gates with authenticated Fastify/PGlite parent isolation and password rotation, strict token-epoch tests, and the offline evidence report validator. They **do not claim an actual phone was operated**.

The local offline evaluator is:

```powershell
node scripts/parent-phase7-acceptance.mjs --output parent-phase7-no-go.json
```

That command deliberately writes a machine-readable `NO_GO` report with every missing device gate marked `NOT_RUN`. To evaluate real observations later, use `--manifest path/to/redacted-operator-manifest.json` along with `--output`. The file must contain `commitSha` (40-character full Git SHA), `operator`, `device`, `environment` (`STAGING` or `PRODUCTION`), and each key under `PARENT_GATES` with `result: PASS|FAIL|NOT_RUN`, `reference`, and recent UTC `observedAt`. Evidence older than 31 days, credential-shaped references, missing gates and nonmatching SHAs block readiness. Even when complete, the result is `READY_FOR_INDEPENDENT_REVIEW` with `productionDecision: NO_GO`; full Step 20 operator approval is a separate gate. Use a private location for the manifest and redacted evidence.

## Acceptance decision

- **Automated:** Only claim green when the final SHA has passed source/model/API tests, TypeScript checks and build on GitHub.
- **Device/operator:** All 16 listed checks remain `NOT_RUN` until genuinely executed, evidenced and independently reviewed on the exact deployed build.
- **Production:** **NO-GO** until all original Step 20 gates (real PostgreSQL, rollback, backups, end-to-end role tests, push and operator sign-off) also pass. Automated verification is not production authorization.
