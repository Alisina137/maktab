# MaktabLink Final Audit — Phase 8: Localization, RTL/LTR, Accessibility and Offline Recovery

**Base revision:** `142a0bb4dc6da042b1917f36f4aed101981c8dc0` (Phase 7 merged).
**Scope:** Expo mobile shell, localized bottom navigation for parent/teacher/student, administrator and staff website language state, shared date/number localization, and secure offline GET cache.
**Schema / API contracts / new dependencies:** unchanged.
**Production decision:** remains **NO-GO** until independent device/browser acceptance, migrations from earlier phases, and final release gates.

## Observed source issues and implemented fixes

| Original condition | User impact | Change |
| --- | --- | --- |
| The offline cache used a mutable global school/user scope when an asynchronous network request **completed**, not when it started | A GET launched while parent A was signed in could resolve after switching to parent B and **store A's private data in B's cache namespace** | Capture the owner scope once, before any asynchronous read/network work. Pass the expected scope through cache reads, fallback, and writes; refuse any stale async read or response after a school/account change |
| Cache fallback could be attempted for invalid JSON even when the response status was 401 or 403 | An access denial rendered as an HTML proxy page could show an old private snapshot as if the user were still authorized | Never use offline fallback for any HTTP 4xx response with invalid JSON. Cache remains read-only and eligible only for actual connectivity/proxy failures in the same authorized scope |
| SecureStore snapshots accepted future timestamps and invalid data envelopes | Device-clock changes or malformed cached JSON could produce indefinite or unusable fallback content | Validate the envelope version, presence of data and timestamp; reject invalid, future-dated or older-than-seven-day snapshots |
| Admin and staff routes modified `document.documentElement.lang` and `dir` without reverting on unmount | Next.js client-side navigation could leave the landing page or a different workspace in the wrong script or text direction | Each workspace now restores the previous root language and direction on cleanup. The page's existing local `dir` remains authoritative while mounted |
| Admin locale persistence used raw `localStorage.getItem/setItem` without guards | Browsers with blocked or disabled storage could fail to render the language selector or dashboard | Catch storage errors, keep current in-memory selection, fall back to Dari on unavailable preferences |
| Admin template counters inserted ASCII digits in Dari/Pashto messages | RTL notification counts and formatted totals mixed scripts | Format numeric interpolation with eastern-Arabic digits for Dari/Pashto, without altering IDs, class codes or supplied string parameters |
| JavaScript Date silently rolled impossible Gregorian values (for example February 31) to another calendar day | School dates and deadlines could be **misrepresented** in English, Dari and Pashto | Validate the input's original year, month and day before localized/Solar-Hijri conversion; preserve an invalid input literally instead of inventing a date |
| Parent, teacher and student five-item mobile navigation bars used single-line or unrestricted labels | Long Dari/Pashto labels or increased system font sizes could clip, overflow or become too tiny | Permit two-line labels with stable line-height, centered text, RTL writing direction and existing touch/selected-state accessibility semantics |

## Automated regression checks

- `pnpm verify:localization:phase8`: static integration guards, localization package tests and a pure Node/TypeScript policy test for scoped offline cache and expiry.
- New test verifies the exact distinction between school A/parent A, school B/parent A, and school A/parent B, plus logout/switch during pending reads.
- New test covers stale, future, invalid, and current snapshots.
- Expanded localization tests verify invalid Gregorian dates stay unmodified in English/Dari/Pashto, while valid leap-day dates still convert.
- Existing navigation, sessions, parent offline/recovery, localization, staff portal and release tests remain in CI. Phase 8 checks run on both Linux and Windows.

### Local verification

```powershell
cd C:\projects\maktab
pnpm install --frozen-lockfile
pnpm verify:localization:phase8
pnpm typecheck
pnpm test
pnpm build
```

## Required manual acceptance before production

1. On a physical Android device and Expo Go, log into **two distinct parents at the same school** and parents from **two schools**, go offline, switch accounts, retry failed GETs, resume online, and confirm *no* first-account child or fee data appears to the next account.
2. Reproduce logout while a deliberately slowed fee, home or notification GET is in flight. Ensure the old response is ignored and not present on the next account's offline screen.
3. Test actual invalid token / revoked-session HTTP 401/403 (including HTML proxy fallback). Do not show stale academic or fee records after authoritative access denial.
4. Check offline cards and reconnect prompts on airplane mode, weak networks, tunnel 502/503, and provider back online. Distinguish cached read-only views from disabled mutations. Do not infer delivery success from a restored network connection alone.
5. On Android widths 320–480 px and 100%, 150%, and 200% text scaling, check all five bottom tabs for parent, teacher and student in **Dari, Pashto and English**; verify semantics with TalkBack and the correct RTL order.
6. Navigate web **Admin → Staff → Landing** and Staff → Admin with both RTL locales and English. Check root `lang`, `dir`, input alignment, menus, date/time format and tab order. Repeat when browser storage is disabled or restricted.
7. Exercise slow, empty, retry and permission-denied states for parent attendance, homework, results, fees, teacher schedule and staff requests. Confirm system font scale, touch targets and consistent role-aware navigation.

**Limitations:** CI/static source checks are not screenshot or TalkBack validation. The current seven-day cache may still show previously authorized local data while the phone cannot contact the server; device access control and session management must be covered by deployment security policy. No direct Neon, device or browser acceptance was run by this PR.
