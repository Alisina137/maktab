import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createPilotStore, getPilotAdoptionReport, databaseSchema, type FoundationDatabase } from "./index.js";

test("Pilot Phase 2 coverage checks current school/year relations and pages missing records", async (t) => {
  const client = new PGlite();
  t.after(() => client.close());
  const migrations = [
    "0000_phase1_foundation.sql", "0001_phase2_auth_accounts.sql",
    "0002_phase3_academic_structure.sql", "0003_phase4_student_family.sql",
    "0004_phase4_parent_profile_backfill.sql", "0005_phase5_attendance.sql",
    "0006_phase6_learning.sql", "0007_phase7_communication_fees.sql",
    "0008_phase8_pilot_readiness.sql", "0009_school_image.sql",
    "0010_admin_profiles.sql", "0011_admin_contact_profile.sql",
    "0012_admin_password_2fa.sql", "0014_student_phone.sql",
    "0015_teacher_learning_workflows.sql", "0016_teacher_teaching_plans.sql",
    "0017_teacher_productivity.sql", "0018_exam_subject_dates.sql",
    "0019_fee_payment_idempotency.sql"
  ];
  for (const name of migrations) {
    const content = await readFile(new URL("../drizzle/" + name, import.meta.url), "utf8");
    await client.exec(content.replaceAll("--> statement-breakpoint", ""));
  }
  const ids = Array.from({ length: 17 }, () => randomUUID()) as [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string];
  const [a, b, year, past, otherYear, grade, classOne, classTwo, oldClass,
    foreignClass, subject, admin, teacher, parent, blockedParent, firstStudent, secondStudent] = ids;
  const teacherAssignment = randomUUID();
  const db = drizzle(client, { schema: databaseSchema }) as unknown as FoundationDatabase;
  const pilot = createPilotStore(db);

  const run = async (query: string, params: unknown[] = []) => client.query(query, params);
  await run(`INSERT INTO schools(id, code, name, slug, province, city) VALUES
    ($1,'PILOT-A','A school','pilot-a','Kabul','Kabul'),
    ($2,'PILOT-B','B school','pilot-b','Kabul','Kabul')`, [a,b]);
  await run(`INSERT INTO subscriptions(school_id, plan_code, status, billing_cycle, price_afn, setup_fee_afn)
    VALUES ($1, 'PILOT','ACTIVE','ANNUAL',0,0),($2,'PILOT','ACTIVE','ANNUAL',0,0)`, [a,b]);
  await run(`INSERT INTO academic_years(id,school_id,name,start_date,end_date,status) VALUES
    ($1,$4,'Current','2026-01-01','2026-12-31','ACTIVE'),
    ($2,$4,'Previous','2025-01-01','2025-12-31','CLOSED'),
    ($3,$5,'Other','2026-01-01','2026-12-31','ACTIVE')`, [year,past,otherYear,a,b]);
  await run(`INSERT INTO grade_levels(id,school_id,code,name) VALUES ($1,$2,'7','Grade Seven')`,[grade,a]);
  const foreignGrade=randomUUID();
  await run(`INSERT INTO grade_levels(id,school_id,code,name) VALUES ($1,$2,'7','Grade Seven')`,[foreignGrade,b]);
  await run(`INSERT INTO class_sections(id,school_id,academic_year_id,grade_level_id,code,name) VALUES
    ($1,$5,$6,$9,'7A','Class One'),($2,$5,$6,$9,'7B','Class Two'),
    ($3,$5,$7,$9,'OLD','Old class'),($4,$8,$10,$11,'B1','Private school B')`,
    [classOne,classTwo,oldClass,foreignClass,a,year,past,b,grade,otherYear,foreignGrade]);
  await run(`INSERT INTO subjects(id,school_id,code,name) VALUES ($1,$2,'MATH','Mathematics')`,[subject,a]);
  await run(`INSERT INTO users(id,school_id,username,password_hash,role,status,must_change_password) VALUES
    ($1,$6,'adminA','test','SCHOOL_ADMIN','ACTIVE',false),
    ($2,$6,'teacherA','test','TEACHER','ACTIVE',true),
    ($3,$6,'parentA','test','PARENT','ACTIVE',false),
    ($4,$6,'parentBlocked','test','PARENT','SUSPENDED',false),
    ($5,$7,'adminB','test','SCHOOL_ADMIN','ACTIVE',false)`,
    [admin,teacher,parent,blockedParent,randomUUID(),a,b]);
  await run(`INSERT INTO teacher_profiles(user_id,school_id,employee_code,full_name)
    VALUES ($1,$2,'T1','Teacher One')`,[teacher,a]);
  await run(`INSERT INTO parent_profiles(user_id,school_id,full_name)
    VALUES ($1,$3,'Parent One'),($2,$3,'Parent Two')`,[parent,blockedParent,a]);
  await run(`INSERT INTO students(id,school_id,parent_user_id,student_code,full_name,academic_year_id,class_id,status)
    VALUES ($1,$7,$3,'ST-1','Student One',$8,$5,'ACTIVE'),
           ($2,$7,$4,'ST-2','Student Two',$8,$6,'ACTIVE')`,
    [firstStudent,secondStudent,parent,blockedParent,classOne,classTwo,a,year]);
  await run(`INSERT INTO teacher_assignments(id,school_id,academic_year_id,teacher_user_id,subject_id,class_id)
    VALUES ($1,$2,$3,$4,$5,$6)`,
    [teacherAssignment,a,year,teacher,subject,classOne]);
  await run(`INSERT INTO timetable_periods(id,school_id,academic_year_id,class_id,subject_id,teacher_user_id,weekday,starts_at,ends_at)
    VALUES ($1,$2,$3,$4,$5,$6,'SATURDAY','08:00','08:45')`,
    [randomUUID(),a,year,classOne,subject,teacher]);
  await run(`INSERT INTO negaran_assignments(id,school_id,academic_year_id,teacher_user_id,class_id,start_date,end_date)
    VALUES ($1,$2,$3,$4,$5,'2026-01-01',NULL)`,
    [randomUUID(),a,year,teacher,classOne]);

  const base = await pilot.getReadiness(a);
  assert.equal(base.ready, true, "Historical nine checks alone would incorrectly report ready");
  const advanced = await pilot.getAdvancedReadiness(a);
  assert.equal(advanced.coreReady, true);
  assert.equal(advanced.ready, false, "Missing teaching and parent access must block automated readiness");
  const byKey = Object.fromEntries(advanced.metrics.map((m) => [m.key, m]));
  assert.deepEqual([byKey.teaching?.complete, byKey.teaching?.total, byKey.teaching?.status],[1,2,"critical"]);
  assert.deepEqual([byKey.timetable?.complete, byKey.timetable?.total],[1,2]);
  assert.deepEqual([byKey.negaran?.complete, byKey.negaran?.total],[1,2]);
  assert.deepEqual([byKey.class_students?.complete, byKey.class_students?.total],[2,2]);
  assert.deepEqual([byKey.family_links?.complete, byKey.family_links?.total,byKey.family_links?.status],[1,2,"critical"]);
  assert.equal(byKey.student_logins?.complete, 0);
  assert.equal(byKey.teacher_logins?.status, "warning");

  const issues = await pilot.listReadinessIssues(a, "teaching", { limit: 1, offset: 0 });
  assert.equal(issues.rows.length, 1);
  assert.ok(issues.rows[0]?.label.includes("Class Two"));
  assert.equal(issues.rows.some((row) => row.label.includes("Private school B")), false);
  assert.equal(issues.hasMore, false);
  const studentIssues = await pilot.listReadinessIssues(a, "family_links", { limit: 1, offset: 0 });
  assert.ok(studentIssues.rows[0]?.label.includes("Student Two"));
  assert.deepEqual((await pilot.listReadinessIssues(a, "family_links", { limit: 1, offset: 1 })).rows, []);
  const other = await pilot.getAdvancedReadiness(b);
  assert.equal(other.metrics.find((row) => row.key === "teaching")?.total, 1);
  assert.equal(other.metrics.find((row) => row.key === "family_links")?.total, 0);
  const otherIssues = await pilot.listReadinessIssues(b, "teaching", { limit: 5, offset: 0 });
  assert.ok(otherIssues.rows[0]?.label.includes("Private school B"));
  assert.equal(otherIssues.rows.some((row) => row.label.includes("Class Two")), false);

  // Pilot Operations refinement Phase 2: validate real period-level conflict checks.
  const clean = await pilot.getOperationalReadiness(a);
  assert.equal(clean.evaluatedPeriods, 1);
  assert.equal(clean.ready, true);
  assert.equal(clean.metrics.every((row) => row.missing === 0), true);
  const noPeriods = await pilot.getOperationalReadiness(b);
  assert.equal(noPeriods.evaluatedPeriods, 0);
  assert.equal(noPeriods.ready, false, "No timetable cannot be treated as verified operational readiness");
  assert.equal(noPeriods.metrics[0]?.status, "not_applicable");

  // Two active-year classes with the SAME active teacher on overlapping times.
  await run(`INSERT INTO teacher_assignments(id,school_id,academic_year_id,teacher_user_id,subject_id,class_id)
    VALUES ($1,$2,$3,$4,$5,$6)`, [randomUUID(),a,year,teacher,subject,classTwo]);
  await run(`INSERT INTO timetable_periods(id,school_id,academic_year_id,class_id,subject_id,teacher_user_id,weekday,starts_at,ends_at)
    VALUES ($1,$2,$3,$4,$5,$6,'SATURDAY','08:15','09:00')`,
    [randomUUID(),a,year,classTwo,subject,teacher]);
  let operational = await pilot.getOperationalReadiness(a);
  assert.equal(operational.metrics.find((m) => m.key === "teacher_overlap")?.missing, 2);
  assert.equal(operational.metrics.find((m) => m.key === "class_overlap")?.missing, 0);
  assert.equal(operational.ready, false);
  let collisions = await pilot.listOperationalIssues(a, "teacher_overlap", { limit: 1, offset: 0 });
  assert.equal(collisions.rows.length, 1);
  assert.equal(collisions.hasMore, true);
  const nextCollision = await pilot.listOperationalIssues(a, "teacher_overlap", { limit: 1, offset: 1 });
  assert.equal(nextCollision.rows.length, 1);
  assert.notEqual(collisions.rows[0]?.id, nextCollision.rows[0]?.id);

  // A second simultaneous period in class one is also a class collision.
  await run(`INSERT INTO timetable_periods(id,school_id,academic_year_id,class_id,subject_id,teacher_user_id,weekday,starts_at,ends_at)
    VALUES ($1,$2,$3,$4,$5,$6,'SATURDAY','08:20','08:40')`,
    [randomUUID(),a,year,classOne,subject,teacher]);
  operational = await pilot.getOperationalReadiness(a);
  assert.equal(operational.metrics.find((m) => m.key === "class_overlap")?.missing, 2);
  assert.equal(operational.metrics.find((m) => m.key === "teacher_overlap")?.missing, 3);

  // Invalid period plus unmatched subject assignment must be visible, not hidden.
  const extraSubject = randomUUID();
  await run("INSERT INTO subjects(id,school_id,code,name) VALUES ($1,$2,'SCI','Science')", [extraSubject,a]);
  await run(`INSERT INTO timetable_periods(id,school_id,academic_year_id,class_id,subject_id,teacher_user_id,weekday,starts_at,ends_at)
    VALUES ($1,$2,$3,$4,$5,$6,'FRIDAY','10:00','09:00')`,
    [randomUUID(),a,year,classOne,extraSubject,teacher]);
  operational = await pilot.getOperationalReadiness(a);
  assert.equal(operational.metrics.find((m) => m.key === "invalid_period")?.missing, 1);
  assert.equal(operational.metrics.find((m) => m.key === "assignment_gap")?.missing, 1);
  const badPeriods = await pilot.listOperationalIssues(a, "invalid_period", { limit: 10, offset: 0 });
  assert.equal(badPeriods.rows.length, 1);
  assert.ok(badPeriods.rows[0]?.label.includes("FRIDAY"));
  const gaps = await pilot.listOperationalIssues(a, "assignment_gap", { limit: 10, offset: 0 });
  assert.equal(gaps.rows.length, 1);
  // Every query is scoped by school and active academic year.
  assert.deepEqual((await pilot.listOperationalIssues(b, "teacher_overlap", {limit: 10, offset: 0})).rows, []);
  assert.deepEqual((await pilot.listOperationalIssues(b, "invalid_period", {limit: 10, offset: 0})).rows, []);
  // Pilot refinement Phase 4: authenticated aggregate sign-ins and educational records.
  const now = new Date("2026-10-16T12:00:00Z");
  await run("UPDATE users SET last_login_at=$1 WHERE id=$2 AND school_id=$3",
    ["2026-10-15T08:00:00Z", teacher, a]);
  await run("UPDATE users SET last_login_at=$1 WHERE id=$2 AND school_id=$3",
    ["2026-09-30T08:00:00Z", parent, a]);

  const homeworkId = randomUUID();
  await run(`INSERT INTO homeworks(id,school_id,assignment_id,academic_year_id,class_id,subject_id,
    teacher_user_id,title,content,due_at,status,published_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,'Test Homework','Assignments',
      '2026-10-20T08:00:00Z','PUBLISHED','2026-10-15T09:00:00Z')`,
    [homeworkId,a,teacherAssignment,year,classOne,subject,teacher]);
  await run(`INSERT INTO homework_submissions(id,school_id,homework_id,student_id,answer,submitted_at)
    VALUES($1,$2,$3,$4,'Submitted','2026-10-15T10:00:00Z')`,
    [randomUUID(),a,homeworkId,firstStudent]);
  const attendanceId = randomUUID();
  await run(`INSERT INTO daily_attendances(id,school_id,academic_year_id,class_id,date,
    submitted_by,submitted_at,updated_by) VALUES ($1,$2,$3,$4,'2026-10-15',
    $5,'2026-10-15T08:00:00Z',$5)`, [attendanceId,a,year,classOne,admin]);
  await run(`INSERT INTO student_attendances(id,school_id,attendance_id,student_id,status)
    VALUES ($1,$2,$3,$4,'PRESENT')`, [randomUUID(),a,attendanceId,firstStudent]);
  await run(`INSERT INTO announcements(id,school_id,title,content,audience_scope,publish_at,created_by)
    VALUES($1,$2,'News','Test','SCHOOL','2026-10-15T11:00:00Z',$3)`,
    [randomUUID(),a,admin]);

  const sevenDays = await getPilotAdoptionReport(db, a, "7d", now);
  assert.equal(sevenDays.window, "7d");
  assert.equal(sevenDays.timeZone, "Asia/Kabul");
  const teacherUse = sevenDays.roles.find((role) => role.role === "TEACHER")!;
  const parentUse = sevenDays.roles.find((role) => role.role === "PARENT")!;
  const studentUse = sevenDays.roles.find((role) => role.role === "STUDENT")!;
  assert.deepEqual([teacherUse.eligible, teacherUse.signedIn, teacherUse.activated], [1,1,0]);
  assert.deepEqual([parentUse.eligible, parentUse.signedIn, parentUse.activated], [1,0,1]);
  assert.equal(studentUse.eligible, 0);
  assert.equal(studentUse.signedInPercent, null);
  assert.deepEqual(sevenDays.activities, {
    homeworkPublished: 1, homeworkSubmissions: 1,
    attendanceClassDays: 1, attendanceStudentMarks: 1,
    announcementsPublished: 1
  });
  const todayReport = await getPilotAdoptionReport(db, a, "today", now);
  assert.equal(todayReport.roles.find((role) => role.role === "TEACHER")?.signedIn, 0);
  assert.equal(todayReport.activities.homeworkPublished, 0);
  const thirtyDays = await getPilotAdoptionReport(db, a, "30d", now);
  assert.equal(thirtyDays.roles.find((role) => role.role === "PARENT")?.signedIn, 1);

  // A different school must not receive any of A's records or sign-in counts.
  const otherAdoption = await getPilotAdoptionReport(db, b, "30d", now);
  assert.equal(otherAdoption.roles.every((role) => role.signedIn === 0), true);
  assert.equal(Object.values(otherAdoption.activities).every((value) => value === 0), true);

});
