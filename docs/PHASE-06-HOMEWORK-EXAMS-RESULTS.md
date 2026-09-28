# Phase 6 — Homework, Exams & Results

## Outcome

Phase 6 makes academic communication operational after attendance: teachers can publish class homework and enter draft marks, the school controls result publication, and parents/students can see only published academic data they are authorized to access.

## Delivered scope

- school-issued student login linkage
- teacher homework creation/edit/publish/close/archive
- class/subject assignment enforcement for homework
- exam cycles
- exam class/subject/max-score setup
- teacher draft grade entry
- score and class validation
- results-ready completeness checks
- atomic result publication
- parent published homework/results visibility
- student published homework/results visibility
- homework/result notification queue records
- published-grade school-admin correction with audit history
- Dari/Pashto/English mobile learning UI

## Student accounts

Phase 6 adds an optional unique `students.user_id`.

Existing student records do not require a student login. A school administrator may create one through Students & Families:

```text
POST /v1/admin/families/students/:studentId/account
```

The workflow:

```text
existing same-school Student
→ create school-issued STUDENT user
→ link user ID to that one Student
→ return one-time temporary password
→ existing forced-password-change flow
```

The generic admin account form intentionally cannot create STUDENT identities because that would create an unlinked login.

The mobile student endpoint:

```text
GET /v1/student/home
```

derives the authenticated student user ID from the session. The client cannot request another student ID.

## Homework

Teacher routes:

```text
GET   /v1/teacher/learning
POST  /v1/teacher/homework
PATCH /v1/teacher/homework/:homeworkId
POST  /v1/teacher/homework/:homeworkId/publish
POST  /v1/teacher/homework/:homeworkId/close
POST  /v1/teacher/homework/:homeworkId/archive
```

Homework is created from an existing active `TeacherAssignment`.

The assignment supplies the authoritative:

- academic year
- class
- subject
- teacher

The client cannot substitute a different class/subject after choosing that assignment.

Lifecycle:

```text
DRAFT → PUBLISHED → CLOSED → ARCHIVED
```

Rules enforced:

- only the owning teacher may edit/manage the homework
- only DRAFT homework is editable
- publication requires the assignment's academic year to remain ACTIVE
- due date cannot already be past at publication
- parent/student APIs do not return DRAFT homework
- PUBLISHED/CLOSED homework is visible to the target class
- publication creates deduplicated notification records for linked parent/student recipients

The mobile teacher UI supports an optional attachment URL field. A dedicated object-storage upload UI is not added in this phase.

## Exams and grade entry

School-admin routes:

```text
GET  /v1/admin/learning
POST /v1/admin/exams
POST /v1/admin/exam-subjects
POST /v1/admin/exams/:examId/status
POST /v1/admin/exams/:examId/publish
PATCH /v1/admin/grades/:gradeId/correct
```

Teacher grade routes:

```text
GET  /v1/teacher/exam-subjects/:examSubjectId/grades
POST /v1/teacher/exam-subjects/:examSubjectId/grades
```

Exam lifecycle:

```text
DRAFT
→ SCHEDULED
→ IN_PROGRESS
→ RESULTS_READY
→ PUBLISHED
→ ARCHIVED
```

Phase 6 models the examination structure and lifecycle. Rich exam scheduling dates remain outside this MVP phase.

An ExamSubject stores:

- exam
- class
- subject
- maximum score

It can be created only if a teacher assignment already exists for that academic year/class/subject.

### Teacher permission boundary

Before a teacher can open or write a grade sheet, the store requires an exact active assignment match:

```text
school
+ teacher
+ academic year
+ class
+ subject
```

An unrelated teacher receives no grade-sheet access.

### Draft grade validation

Marks may be saved only while an exam is IN_PROGRESS.

Validation rejects:

- student outside the exam class/year
- duplicate student in one save request
- score greater than the configured maximum
- published grade overwrite through the teacher route

Teachers may save partial drafts over multiple requests.

## Results-ready and publication

Moving an exam from IN_PROGRESS to RESULTS_READY checks every ExamSubject and every active student. If any required mark is missing, the transition is rejected.

Parent/student APIs still return zero draft results while the exam is RESULTS_READY.

Publishing:

```text
POST /v1/admin/exams/:examId/publish
```

runs one transaction that publishes all GradeRecords and the Exam together. Only after that transaction do authorized parent/student reads return those results.

Learner routes:

```text
GET /v1/parent/children/:studentId/learning
GET /v1/student/home
```

Parent access requires the requested student to belong to that parent. Student access resolves the singular linked Student from the authenticated STUDENT account.

## Published corrections

There is no delete endpoint for published GradeRecords.

A school administrator may use:

```text
PATCH /v1/admin/grades/:gradeId/correct
```

The request requires:

- corrected score
- optional remark
- correction reason

The score is revalidated against the ExamSubject maximum.

The audit entry stores:

- previous score
- new score
- previous remark
- new remark
- correction reason

The corrected published result remains immediately visible to authorized learners.

## Mobile experience

### Teacher

Teacher Home now includes:

- existing Teacher Today/attendance
- active teaching assignments
- homework draft creation/editing
- homework publish/close/archive actions
- exam subjects currently open for mark entry
- per-student score/remark entry
- draft marks save

### Parent

For the selected child, Parent Home now includes:

- published homework
- published results
- existing attendance
- shared in-app notification stream, including homework/result events

Sibling switching automatically reloads the academic view for that child.

### Student

A linked STUDENT account now gets a real academic home showing:

- own student identity
- own published homework
- own published results

It does not expose a student selector.

## Database migration

```text
packages/database/drizzle/0006_phase6_learning.sql
```

It adds:

- `students.user_id`
- `homeworks`
- `exams`
- `exam_subjects`
- `grade_records`
- `homework_status`
- `exam_status`
- `grade_record_status`

Apply after pulling:

```powershell
pnpm db:migrate
```

The migration is additive. Source rollback does not automatically remove Phase 6 academic records.

## Verification coverage

Automated Phase 6 coverage verifies:

- school-controlled singular student-account linkage
- draft homework invisible to parent and student
- published homework visible to parent and student
- unrelated teacher cannot open another class/subject grade sheet
- score above max is rejected
- draft mark saved successfully
- draft result invisible to parent
- draft result invisible to linked student
- RESULTS_READY remains invisible
- publication exposes the same result to parent and student
- result publication queues parent notification
- school-admin published-grade correction changes the visible score
- existing Phase 1–5 regressions
- monorepo TypeScript typecheck
- Next.js production build
- Expo Android production export

The implementation CI commit and local migration state are tracked in `docs/PROJECT-STATE.md`.
