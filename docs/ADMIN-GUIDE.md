# School Administrator Guide

## Purpose

The school-admin web application exists to configure and operate the school workflows used by Parent, Teacher, and Student mobile users.

## First login

Use the school-issued administrator username and temporary password.

On first login, create a private permanent password. Administrators can reset user passwords later but cannot retrieve permanent passwords.

## Recommended setup order

Use this order for a new school:

1. **Academic structure** — academic year, grades, classes, subjects.
2. **Accounts and teachers** — teacher/staff/admin identities and teacher profiles.
3. **Assignments** — teacher subject/class assignments, Negaran assignments, timetable.
4. **Students & Families** — parents, students, student credentials, validated imports.
5. **Learning** — exams/exam subjects; teachers then manage homework and draft marks.
6. **Communication & Fees** — announcements, issued fees, manual payments, reminder settings.
7. **Pilot Readiness** — confirm core checks, audit history, export, and subscription state.

## Students & Families

Parent/student identities must be created from the family workflow so relationships remain correct.

For bulk onboarding:

- download a CSV template from Pilot Readiness
- upload CSV/XLSX
- map columns
- validate all rows
- correct previewed errors
- explicitly confirm import

The system does not silently commit invalid rows.

## Attendance

Daily attendance is primarily a Negaran responsibility.

School admins can:

- review date/class reports
- see missing daily submissions
- correct an attendance mark when required

Admin corrections are audited.

## Homework and results

Teachers can create homework only for their active assignments.

Exam structure/publication remains under administration.

Draft marks are private. Parent/Student users receive results only after publication.

Published-grade correction requires a reason and audit history.

## Announcements

Announcements require an explicit audience:

- SCHOOL
- CLASS
- ROLE

A class announcement is visible only to users who match that school/class relationship.

## Fees

MVP fees are records, not online payment processing.

Administrators can:

- create/issue invoices
- record manual payments
- view outstanding balances
- record reversals

Payment records are immutable. A correction uses a separate reversal record with a reason.

## Pilot Readiness

The Pilot Readiness section provides:

- current subscription status
- operational-write state
- core onboarding checklist
- school-scoped data summary
- safe JSON export
- exact import templates
- paginated audit review

The export excludes password hashes and authentication sessions.

## Subscription suspension

If a school subscription is SUSPENDED/CANCELLED:

- Parent/Teacher/Student access is unavailable
- operational admin writes are blocked
- admin read/billing/export access remains
- school data remains stored

Platform support must update the subscription state; do not edit database rows manually.

## Support information to capture

When reporting an issue, include:

- school code
- affected role
- approximate time
- workflow/action
- visible error message
- API request ID if available

Do not send passwords, provisioning keys, database URLs, or backup encryption keys.
