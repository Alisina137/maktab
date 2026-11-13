# Phase 17 — Mobile Account Exit and Session Safety

**Date:** November 13, 2026.  
**Implementation scope:** six source development tasks continuing the pre-Phase-17 header language and Parent Profile logout fixes.  
**External release:** **NO-GO**, pending independent operational and physical-device validation.

## Why this phase

The three mobile account roles already have functional More sections, but Teacher sign-out was buried inside Profile and was not confirmed, while Student sign-out was at the end of a long settings/records page. The shared logout sequence waited for push deactivation before attempting server revocation, then awaited native credential deletion inside a `finally` without handling native SecureStore failures. A push outage could prevent token revocation; a SecureStore failure could leave the UI permanently busy or make logout appear successful despite a persisted refresh credential. A stale network status callback could also set a suspended account's React state without synchronizing its mutable authenticated reference.

## Delivered tasks

| ID | Runtime change | Automated evidence |
| --- | --- | --- |
| **17.1 Teacher sign-out discovery** | Add visible Sign out on Teacher → More landing while retaining Profile sign-out. Both use the same localized confirmation with cancel and destructive action, accessible label/hint, and the existing App logout handler. | UI-source guard. |
| **17.2 Student sign-out discovery** | Move Sign out immediately below Student More's profile summary, above the long enrollment, records and help lists. Keep localized destructive confirmation, accessibility hint and existing logout handler. | UI-source guard. |
| **17.3 Parent parity** | Preserve Parent More → Profile and More → Preferences sign-out from PR #64, using the identical shared App logout path. Signed-out header locale remains available, whereas authenticated users change language inside More. | Existing Parent Profile and header regression plus Phase 17 guard. |
| **17.4 Local-first sign-out** | Invalidate in-flight screen reads and show a private loading state. Attempt SecureStore credential deletion before declaring logout successful; retry one transient native-storage failure. If deletion fails twice, retain the account and show a localized actionable error so the user can try again. On success immediately clear role-specific UI, account identity, navigation, screen data and cache scope. | Executable local-deletion and source-order tests. |
| **17.5 Independent remote revocation and push race repair** | After successful device credential deletion, independently attempt push-device deactivation and refresh-token logout without blocking the signed-out role-picker screen. One remote error cannot skip the other. In push registration code, snapshot and clear the old registration *before* awaiting network deactivation so a delayed old-account request cannot erase the new account's registration. | Executable independent revocation tests plus actual call-site guards. |
| **17.6 Suspended-account consistency, CI and docs** | Align suspended-account ref with rendered session; invalidate old reads, disable offline fallback and reject delayed status probes across account changes; test status and logout source call sites. Add `pnpm verify:phase17` to root verification and Linux/Windows CI. New device sign-out failure string translated to English, Dari and Pashto. | Executable policy tests, source guard, CI, project state. |

### Account experience

- **Student:** More → visible Sign out below profile → Confirm or Cancel.
- **Parent:** More → Profile → Sign out, or More → Preferences → Sign out.
- **Teacher:** More → Sign out, or More → Profile → Sign out.
- **Onboarding:** language picker stays available before login; authenticated users still select language in their role's More settings.
- **Offline:** a server outage cannot prevent local sign-out once persisted credentials are removed. Remote provider cleanup is best-effort; the app cannot guarantee revocation at the server if disconnected. If the native credential store refuses deletion, the app does **not** silently claim a successful logout.

### Local verification

```powershell
cd C:\projects\maktab
pnpm verify:phase17
pnpm verify:parent:profile-logout
pnpm verify:mobile:header-language
pnpm verify
```

No database migration, new API route, tenant permission, or environment variable is required.

### Outstanding operational acceptance

On the **exact staged commit** with real Android/Expo builds, exercise Student/Teacher/Parent More in Dari/Pashto RTL and English, cancel/confirm logout, multiple quick taps, slow token logout, offline push deactivation, native secure storage failure injection, and A→logout→B while old push operations are pending. Test account suspension/reinstatement and stale cached requests. Confirm local credentials do not survive successful sign-out and record API revoke/device evidence. Source CI alone does not verify real OS credential-storage behavior.

Production remains **NO-GO** until the independent Phase 11/12 real Neon staging, Android/browser journeys, push/scheduler, backup restore and operator signoff gates are complete.
