# Pilot Critical Workflow Test Matrix

The Product Specification defines ten critical E2E scenarios.

MaktabLink currently verifies these workflows at the API/database boundary in CI using a real in-process Fastify application and PGlite PostgreSQL-compatible test database. Manual client/device smoke checks remain part of `PILOT-RUNBOOK.md`.

| ID | Required workflow | Automated coverage |
| --- | --- | --- |
| E2E-001 | School → parent credentials → parent login | `school-scoped credentials, forced password change, role matching, and suspension work together` |
| E2E-002 | Existing parent → add second child → both visible | `parent account can own three students and sees all three through one login` |
| E2E-003 | Cross-school child link rejected | `cross-school parent links and duplicate student codes are rejected` |
| E2E-004 | Teacher assigned Math 7A → class visible | `school admin can model teacher assignments, Negaran responsibility, and timetable` plus academic-store assignment test |
| E2E-005 | Teacher not assigned 8A → 8A inaccessible | grade/teacher permission and non-Negaran class-access tests |
| E2E-006 | Negaran → attendance → parent notification | `Negaran submits daily attendance once, duplicate retry is idempotent, and parent sees state plus alert` |
| E2E-007 | Homework → publish → student/parent visibility | `homework stays private as draft, then becomes visible to parent and linked student after publish` |
| E2E-008 | Draft marks invisible → publish → visible | `draft grades are hidden until admin publishes the complete exam, and unrelated teachers cannot grade` |
| E2E-009 | Subscription suspension behavior | `Phase 8 subscription suspension blocks end users and operational admin writes but preserves billing and export access` |
| E2E-010 | Bulk import validates errors safely | `bulk student import validation reports duplicate rows without committing them` |

Additional Phase 8 automated checks cover:

- pilot school onboarding without direct database manipulation
- readiness endpoint/database connectivity
- audit pagination
- downloadable import template
- safe export excluding password hashes
- idempotent subscription expiry reminder generation
- Phase 7 reminder-job idempotency
- push failure not rolling back school data
- all prior tenant/isolation regressions

## Manual pilot smoke checks

Before declaring a particular deployed environment ready, run the following on actual web/mobile builds:

- school admin first login/password change
- teacher Today → Negaran attendance
- parent child switch + attendance/homework/results/fees
- student published homework/results/announcements
- admin announcement audience check
- keyboard-only admin workflow
- TalkBack/large-text/reduced-motion/RTL checks
- network-loss cached-read check
- real push delivery if enabled
- encrypted backup + non-production restore drill

Passing CI validates the source implementation. It does not replace deployment/device/restore verification.
