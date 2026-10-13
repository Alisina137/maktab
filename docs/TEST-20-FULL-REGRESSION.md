# Step 20 — Full Regression & Release Readiness

Date: 2026-10-14. Baseline before Step 20: `5e035a3f5ba0`, GitHub Ubuntu verification and Windows/Node 24 API checks both passing.

The statuses below deliberately distinguish **automated API/store evidence**, **source-level assertions**, and **manual acceptance**. A green unit/integration suite is not proof that Android, browser, external PostgreSQL, live push or operator flows were exercised.

| ID | Scope | Evidence / release acceptance | Current state |
|---|---|---|---|
| 20.1 | Platform school/Admin provisioning | Protected `/v1/platform/pilot/onboard`, first-login password change, duplicates and atomic setup | Automated API integration; operator smoke pending |
| 20.2 | Year, grade, class, subject, timetable, assignments | API academic setup, slot collisions, year validation, teacher view | Automated API/store integration; browser smoke pending |
| 20.3 | Parent/Student provisioning/linking | Parent with multiple children; student account; cross-school linking rejected | Automated API/store integration; mobile smoke pending |
| 20.4 | Teacher/Negaran provisioning | Teacher account/profile/assignments, Negaran dated supervision | Automated API/store integration; mobile smoke pending |
| 20.5 | Parent complete workflow | Parent login, child switch, attendance, homework, published results, announcements, fees | Multiple API integration tests; full Android journey pending |
| 20.6 | Student complete workflow | Student login, active enrollment, learning/announcements/results/fees scope | Multiple API integration tests; full Android journey pending |
| 20.7 | Teacher complete workflow | Teacher timetable/Today, class details, teaching plans, attendance, homework, grading | Multiple API integration tests; full Android journey pending |
| 20.8 | Attendance E2E | Negaran daily attendance, parent visibility, duplicate submission and notifications | Automated API integration; push/device smoke pending |
| 20.9 | Homework E2E | Assignment, draft privacy, publication, submissions, review, archive | Automated API integration; live device/file smoke pending |
| 20.10 | Exams/grades/results E2E | Subject/date setup, mark validation, draft hiding, publication/correction and audit | Automated API integration; device/browser acceptance pending |
| 20.11 | Announcements/notifications E2E | School/class/role audience, read state, inbox, scheduler/push failure retries | Automated API/store integration; real push test pending |
| 20.12 | Fees/payments E2E | Invoice, partial payments, reversals, reminders, family access, idempotency | Automated API/store integration; real cash reconciliation and concurrent PG pending |
| 20.13 | Suspension/subscription E2E | Restriction and reactivation, account/session handling, subscription jobs/reminders | Automated API integration; deployed job/suspension smoke pending |
| 20.14 | Cross-role/school security | Role 401/403, linked child/class scope, school 404, duplicate/error privacy | Automated API/store integration; security review pending |
| 20.15 | Dari/Pashto/English | Translation key parity, Solar Hijri vs Gregorian, numbers, AFN, LTR IDs, RTL navigation | Locale unit tests and static guard; manual translations/device checks pending |
| 20.16 | Responsive/accessibility | CSS mobile breakpoints/focus/reduced-motion, RN accessibility labels/roles | Source checks; **real keyboard, TalkBack, large-text, zoom, tablet/mobile smoke not run** |
| 20.17 | Network/reconnection | Scoped cached reads, refresh, stale-response protection, debounce, ngrok health/retry | Automated unit/static/API tests; real intermittent network test pending |
| 20.18 | DB/migrations/config | Full journal SQL chain regression, Neon dual-URL check, secrets, backup tool syntax | Local in-memory SQL + static checks; **Neon connect timeout and live migration remain unresolved** |
| 20.19 | Full automated verification/release build | `pnpm verify`, CI Ubuntu Node 22 and Windows Node 24, Next/Expo builds | Final CI evidence required for release candidate |
| 20.20 | Final go/no-go | This matrix + report of failures, warnings, required manual evidence | **NO-GO until blockers cleared** |

## Required release acceptance protocol

1. Ensure CI completes successfully for the **exact release SHA**. Never use a green job from an older commit to approve newer source.
2. Apply all checked-in migrations to a non-production clone with the real PostgreSQL driver, then verify connectivity, `/ready` and `/metrics`.
3. Onboard a fresh disposable school with a secure platform credential; create Admin, academic year, classes, two teachers, Negaran, two parent/child pairs, and a second isolated school. Check first-login password replacement and pilot readiness transitions.
4. In Android, log in as Teacher, Parent, and Student. Perform attendance, homework/submission/review, exam setup/mark entry/publish/correction, targeted announcement, and partial fee payment/reversal. Confirm unread and read state, sibling switching, and cross-school/role denial.
5. Verify English, Dari and Pashto screens with RTL, Solar Hijri dates, localized AFN, long text, reduced motion, Android TalkBack/font scaling and web keyboard/zoom/focus at mobile/tablet/desktop widths.
6. Reproduce airplane-mode recovery, invalid token, account suspension, temporary database outage and transient ngrok connection drop. Confirm no false reconnected message or private-data cache leakage.
7. Verify live push in Android with real EAS credentials, background/foreground receipt, idempotent retries and navigation to the correct school/child destination.
8. Run parallel multi-connection PostgreSQL payment/scheduling tests, check duplicate protection and that only active recipients receive alerts.
9. Run protected external communication/subscription jobs under an actual scheduler. Confirm backup encryption, off-host backup, and **non-production** restore drill; verify retention, operational monitoring and alerting.
10. Have school operators sign off on real-world workflows, rollback/incident contact, manual fee reconciliation and deployment configuration. Record dates, devices, build SHA and defects.

## Changes identified in Step 20

- Public website landing page contained **stale Phase 3 text** stating parent/family onboarding and attendance were not built. The page now accurately describes currently implemented workflows, retains a semantic heading hierarchy and responsive feature cards.
- **Security regression discovered:** Switching a school to INACTIVE previously blocked new logins, but previously issued Admin/Teacher/Parent/Student access and refresh tokens were not consistently denied; an ARCHIVED account could also retain token-based access. The auth access/refresh guards now enforce school activation and archive status on each operation, with an API integration regression that checks blocked tokens and later school reactivation.
- Previously, tests manually listed 19 of 20 SQL migration journal entries, skipping the teacher assignment uniqueness migration. Added a regression that replays the **full ordered journal** against PostgreSQL-compatible PGlite and inspects critical constraints.
- Release coverage evidence and CI parent-resilience checks are being added as explicit gates to reduce the chance of silently dropping prior workflow tests.

## Release blockers / warnings (not automatically fixable in CI)

**BLOCKERS for production launch:**
- Live remote PostgreSQL readiness and migration completion unverified after Neon `CONNECT_TIMEOUT` on the user's Windows machine.
- Real browser/Android cross-role journey, TalkBack/RTL/large-text acceptance and live push delivery not signed off.
- Operational external scheduler, monitoring/alerting and encrypted backup + restore on a disposable database not demonstrated.
- No final operator reconciliation or approved pilot go/no-go sign-off.
- Final CI run of release SHA must be green (including SQL chain and both OS jobs).

**Known limitations:** Fees are manually recorded (not an online payment gateway); remote push requires EAS/FCM credentials; external uptime, job scheduler and backup storage must be configured by the deployment operator. PGlite's single-process tests are not a substitute for actual cross-connection PostgreSQL race testing.

**Decision:** NO-GO for production. Automated regression can be green while the release remains blocked for external/live acceptance. An internal supervised pilot requires its own documented, narrowly scoped risk acceptance.
