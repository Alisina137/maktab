# Testing Step 14 — Homework

Date: 2026-10-13. Source of truth: Product Specification V1 and `docs/PHASE-06-HOMEWORK-EXAMS-RESULTS.md`.

## Implementation / test matrix

| Check | Automated assertion / rule | Device acceptance |
| --- | --- | --- |
| 14.1 | Teacher creation requires an ACTIVE school-scoped assignment for the **same teacher**, class, subject and year; forged assignment IDs return 404. | Select each assigned class/subject; verify no unassigned option. |
| 14.2 | Title (2–160 chars), content (1–5000), offset-aware deadline, future due date and HTTPS attachment URL validated by API; mobile checks required content, date and HTTPS before saving. | Try missing title/content, past/invalid date, invalid URL. |
| 14.3 | New homework is DRAFT and absent from both Parent and Student academic feeds; before publication, learner file access is denied. | Observe draft only in teacher workflow. |
| 14.4 | Only owning teacher can edit a DRAFT; server update includes a DRAFT condition to prevent a race with scheduled/manual publication. | Edit title, instructions, date, attachments; reload. |
| 14.5 | Manual publication atomically updates state, creates deduplicated class/academic-year-scoped notifications and writes an audit. Repeat publish returns HTTP 409. Scheduled publication uses the same durable fan-out/audit guarantees. | Confirm publish alert and published badge, refresh. |
| 14.6 | Linked Parent sees only homework for the selected child; another child in another class sees none. | Switch children after publishing. |
| 14.7 | Linked Student sees published class/year homework but not draft/other class. | Reload Student Homework; verify attachment and instructions. |
| 14.8 | Close changes PUBLISHED → CLOSED; learners can still read it, but student cannot submit and teacher cannot edit. | See past/closed section; try late submission. |
| 14.9 | Archive changes CLOSED → ARCHIVED; second archive returns HTTP 409; teacher keeps archived history and submission review. | Use teacher Archived filter and view submissions. |
| 14.10 | All edits are denied for PUBLISHED/CLOSED/ARCHIVED; file/schedule APIs enforce DRAFT. | Try editing after each status transition. |
| 14.11 | Unauthorized roles, another teacher and another class cannot create, edit or publish each other's homework. Access is tenant-scoped. | Sign in as second teacher and separate-class parent/student. |
| 14.12 | Exactly one parent/student alert per published homework; repeated requests do not duplicate alerts. Parent UI labels closed work and opens HTTPS/file attachments. Archived homework is not in Parent/Student feeds; it remains in teacher history. | Inspect inbox, loading/empty/error states, English/Dari/Pashto RTL, reconnect and older work. |

## Status semantics

`DRAFT → PUBLISHED → CLOSED → ARCHIVED`. The previous product specification deliberately exposes only **PUBLISHED** and **CLOSED** homework to Parent/Student academic feeds. Archiving hides the item from learner feeds but does **not** delete the homework, its file record, teacher listing or stored student submissions. Teacher may still review historical submissions through their existing authorized endpoint. This is a visibility rule, not data deletion.

Homework notifications are database inbox records; live push delivery and Expo deep-link behavior need physical Android acceptance. A failed external push must not roll back publication. The database notification fan-out and homework lifecycle event are committed in the same database transaction to avoid a published item with no durable inbox event.

## Automated verification

Primary integration regression: `apps/api/src/app.test.ts` test `homework stays private as draft, then becomes visible to parent and linked student after publish`, expanded for Test 14. Existing `apps/api/src/learning-workflow.test.ts` validates Asia/Kabul homework date parsing and workflow filtering. CI executes typecheck, API tests, Next.js build and Android export.

## Remaining manual device checks

Sign in on Android as Teacher, Parent and Student with two class assignments and an unrelated teacher account. Test authoring, draft edit, attachment permission, publish confirmation, notification read, parent child switching, historical closed/archive behavior, larger fonts, TalkBack, RTL, airplane mode and duplicate taps. Also verify the scheduler only publishes while the server is running and the deadline is in the future. Record any failures before pilot acceptance.

Do not mark physical-device acceptance complete based only on GitHub CI.
