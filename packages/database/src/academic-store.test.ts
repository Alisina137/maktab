import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  createAcademicStore,
  createAccountStore,
  createSchoolStore,
  databaseSchema,
  type FoundationDatabase
} from "./index.js";

async function createTestDatabase() {
  const client = new PGlite();
  for (const file of [
    "0000_phase1_foundation.sql",
    "0001_phase2_auth_accounts.sql",
    "0002_phase3_academic_structure.sql",
    "0008_phase8_pilot_readiness.sql",
    "0009_school_image.sql"
  ]) {
    const sql = await readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
    await client.exec(sql.replaceAll("--> statement-breakpoint", ""));
  }

  const db = drizzle(client, { schema: databaseSchema }) as unknown as FoundationDatabase;
  return { client, db };
}

test("a teacher can teach several classes and subjects while separately supervising one class", async (t) => {
  const { client, db } = await createTestDatabase();
  t.after(async () => client.close());

  const schools = createSchoolStore(db);
  const accounts = createAccountStore(db);
  const academics = createAcademicStore(db);

  const school = await schools.createSchool({
    code: "ACADEMIC-A",
    name: "Academic School",
    slug: "academic-school",
    province: "Kabul",
    city: "Kabul",
    defaultLanguage: "fa-AF"
  });

  const teacherUser = await accounts.createUser({
    schoolId: school.school.id,
    username: "teacher.one",
    passwordHash: "hash-one",
    role: "TEACHER"
  });
  const secondTeacherUser = await accounts.createUser({
    schoolId: school.school.id,
    username: "teacher.two",
    passwordHash: "hash-two",
    role: "TEACHER"
  });

  await academics.createTeacherProfile(school.school.id, {
    userId: teacherUser.id,
    employeeCode: "T-001",
    fullName: "Teacher One"
  });
  await academics.createTeacherProfile(school.school.id, {
    userId: secondTeacherUser.id,
    employeeCode: "T-002",
    fullName: "Teacher Two"
  });

  const year = await academics.createAcademicYear(school.school.id, {
    name: "1405",
    startDate: "2026-03-21",
    endDate: "2027-03-20"
  });
  await academics.setAcademicYearStatus(school.school.id, year.id, "ACTIVE");

  const grade7 = await academics.createGradeLevel(school.school.id, {
    code: "G7",
    name: "Grade 7",
    sortOrder: 7
  });
  const grade8 = await academics.createGradeLevel(school.school.id, {
    code: "G8",
    name: "Grade 8",
    sortOrder: 8
  });
  const class7A = await academics.createClassSection(school.school.id, {
    academicYearId: year.id,
    gradeLevelId: grade7.id,
    code: "7A",
    name: "Grade 7 A"
  });
  const class8A = await academics.createClassSection(school.school.id, {
    academicYearId: year.id,
    gradeLevelId: grade8.id,
    code: "8A",
    name: "Grade 8 A"
  });
  const math = await academics.createSubject(school.school.id, { code: "MATH", name: "Mathematics" });
  const physics = await academics.createSubject(school.school.id, { code: "PHYS", name: "Physics" });

  await academics.createTeacherAssignment(school.school.id, {
    academicYearId: year.id,
    classId: class7A.id,
    subjectId: math.id,
    teacherUserId: teacherUser.id
  });
  await academics.createTeacherAssignment(school.school.id, {
    academicYearId: year.id,
    classId: class8A.id,
    subjectId: physics.id,
    teacherUserId: teacherUser.id
  });
  await academics.createTeacherAssignment(school.school.id, {
    academicYearId: year.id,
    classId: class7A.id,
    subjectId: physics.id,
    teacherUserId: secondTeacherUser.id
  });

  await assert.rejects(
    academics.createTeacherAssignment(school.school.id, {
      academicYearId: year.id,
      classId: class7A.id,
      subjectId: math.id,
      teacherUserId: secondTeacherUser.id
    }),
    /class and subject already have a teacher/i
  );

  const negaran = await academics.createNegaranAssignment(school.school.id, {
    academicYearId: year.id,
    classId: class7A.id,
    teacherUserId: teacherUser.id,
    startDate: "2026-03-21"
  });

  const view = await academics.getTeacherView(school.school.id, teacherUser.id);
  assert.equal(view.assignments.length, 2);
  assert.equal(view.negaranAssignments.length, 1);
  assert.equal(view.negaranAssignments[0]?.id, negaran.id);
  assert.deepEqual(view.assignmentDetails.map((item) => [item.classCode, item.subjectName]), [
    ["7A", "Mathematics"], ["8A", "Physics"]
  ]);
  assert.equal(view.schedule.length, 0);
  const otherTeacherView = await academics.getTeacherView(school.school.id, secondTeacherUser.id);
  assert.deepEqual(otherTeacherView.assignmentDetails.map((item) => item.subjectName), ["Physics"]);
  assert.deepEqual(otherTeacherView.schedule, []);

  await academics.createTimetablePeriod(school.school.id, {
    academicYearId: year.id,
    classId: class7A.id,
    subjectId: math.id,
    teacherUserId: teacherUser.id,
    weekday: "SATURDAY",
    startsAt: "08:00",
    endsAt: "08:45"
  });

  await assert.rejects(
    academics.createTimetablePeriod(school.school.id, {
      academicYearId: year.id,
      classId: class8A.id,
      subjectId: physics.id,
      teacherUserId: teacherUser.id,
      weekday: "SATURDAY",
      startsAt: "08:30",
      endsAt: "09:15"
    }),
    /teacher is already scheduled/i
  );
  const currentSchedule = await academics.getTeacherView(school.school.id, teacherUser.id);
  assert.deepEqual(
    currentSchedule.schedule.map((item) => [item.weekday, item.startsAt, item.className, item.subjectName]),
    [["SATURDAY", "08:00", "Grade 7 A", "Mathematics"]]
  );
  assert.deepEqual((await academics.getTeacherView(school.school.id, secondTeacherUser.id)).schedule, []);

  await assert.rejects(
    academics.createTimetablePeriod(school.school.id, {
      academicYearId: year.id,
      classId: class7A.id,
      subjectId: physics.id,
      teacherUserId: secondTeacherUser.id,
      weekday: "SATURDAY",
      startsAt: "08:15",
      endsAt: "09:00"
    }),
    /class already has another timetable period/i
  );

  await assert.rejects(
    academics.createNegaranAssignment(school.school.id, {
      academicYearId: year.id,
      classId: class7A.id,
      teacherUserId: secondTeacherUser.id,
      startDate: "2026-09-01"
    }),
    /already has a Negaran/i
  );

  await assert.rejects(
    academics.createNegaranAssignment(school.school.id, {
      academicYearId: year.id,
      classId: class8A.id,
      teacherUserId: teacherUser.id,
      startDate: "2026-09-01"
    }),
    /teacher is already Negaran/i
  );
});

test("academic structure remains tenant scoped and only one year can be active", async (t) => {
  const { client, db } = await createTestDatabase();
  t.after(async () => client.close());

  const schools = createSchoolStore(db);
  const accounts = createAccountStore(db);
  const academics = createAcademicStore(db);

  const schoolA = await schools.createSchool({
    code: "ACADEMIC-AA",
    name: "Academic A",
    slug: "academic-a",
    province: "Kabul",
    city: "Kabul",
    defaultLanguage: "fa-AF"
  });
  const schoolB = await schools.createSchool({
    code: "ACADEMIC-BB",
    name: "Academic B",
    slug: "academic-b",
    province: "Kabul",
    city: "Kabul",
    defaultLanguage: "ps-AF"
  });

  const yearA1 = await academics.createAcademicYear(schoolA.school.id, {
    name: "Year A1",
    startDate: "2026-01-01",
    endDate: "2026-12-31"
  });
  const yearA2 = await academics.createAcademicYear(schoolA.school.id, {
    name: "Year A2",
    startDate: "2027-01-01",
    endDate: "2027-12-31"
  });
  await academics.setAcademicYearStatus(schoolA.school.id, yearA1.id, "ACTIVE");
  await assert.rejects(
    academics.setAcademicYearStatus(schoolA.school.id, yearA2.id, "ACTIVE"),
    /only one academic year/i
  );

  const teacher = await accounts.createUser({
    schoolId: schoolA.school.id,
    username: "teacher.scope",
    passwordHash: "hash",
    role: "TEACHER"
  });
  await academics.createTeacherProfile(schoolA.school.id, {
    userId: teacher.id,
    employeeCode: "T-SCOPE",
    fullName: "Scoped Teacher"
  });

  const grade = await academics.createGradeLevel(schoolA.school.id, {
    code: "G7",
    name: "Grade 7",
    sortOrder: 7
  });
  const classSection = await academics.createClassSection(schoolA.school.id, {
    academicYearId: yearA1.id,
    gradeLevelId: grade.id,
    code: "7A",
    name: "7 A"
  });
  const foreignSubject = await academics.createSubject(schoolB.school.id, {
    code: "MATH",
    name: "Mathematics"
  });

  await assert.rejects(
    academics.createTeacherAssignment(schoolA.school.id, {
      academicYearId: yearA1.id,
      classId: classSection.id,
      subjectId: foreignSubject.id,
      teacherUserId: teacher.id
    }),
    /Subject not found/i
  );
});


test("Audit Phase 5: overlapping supervision and timetable writes cannot both succeed", async (t) => {
  const { client, db } = await createTestDatabase();
  t.after(async () => client.close());
  const schoolStore = createSchoolStore(db);
  const accounts = createAccountStore(db);
  const academics = createAcademicStore(db);

  const school = await schoolStore.createSchool({
    code: "PHASE5-SCHOOL", name: "Phase Five School", slug: "phase5-school",
    province: "Kabul", city: "Kabul", defaultLanguage: "fa-AF"
  });
  const schoolId = school.school.id;
  const teacherUsers = await Promise.all(["phase5.one", "phase5.two"].map(async (username, index) => {
    const user = await accounts.createUser({
      schoolId, username, passwordHash: "hash", role: "TEACHER"
    });
    await academics.createTeacherProfile(schoolId, {
      userId: user.id, employeeCode: "T-5" + (index + 1), fullName: username
    });
    return user;
  }));
  const year = await academics.createAcademicYear(schoolId, {
    name: "Phase Five", startDate: "2026-01-01", endDate: "2027-12-31"
  });
  await academics.setAcademicYearStatus(schoolId, year.id, "ACTIVE");
  const grade = await academics.createGradeLevel(schoolId, {
    code: "G1", name: "Grade One", sortOrder: 1
  });
  const [klassA, klassB] = await Promise.all([
    academics.createClassSection(schoolId, {
      academicYearId: year.id, gradeLevelId: grade.id, code: "1-A", name: "Class 1A"
    }),
    academics.createClassSection(schoolId, {
      academicYearId: year.id, gradeLevelId: grade.id, code: "1-B", name: "Class 1B"
    })
  ]);
  const [subjectA, subjectB] = await Promise.all([
    academics.createSubject(schoolId, { code: "P5-MATH", name: "Phase Five Mathematics" }),
    academics.createSubject(schoolId, { code: "P5-SCI", name: "Phase Five Science" })
  ]);
  for (const input of [
    { classId: klassA.id, subjectId: subjectA.id, teacherUserId: teacherUsers[0]!.id },
    { classId: klassB.id, subjectId: subjectB.id, teacherUserId: teacherUsers[0]!.id },
    { classId: klassA.id, subjectId: subjectB.id, teacherUserId: teacherUsers[1]!.id }
  ]) {
    await academics.createTeacherAssignment(schoolId, { academicYearId: year.id, ...input });
  }

  const supervision = await Promise.allSettled([
    academics.createNegaranAssignment(schoolId, {
      academicYearId: year.id, classId: klassA.id,
      teacherUserId: teacherUsers[0]!.id, startDate: "2026-02-01"
    }),
    academics.createNegaranAssignment(schoolId, {
      academicYearId: year.id, classId: klassA.id,
      teacherUserId: teacherUsers[1]!.id, startDate: "2026-02-15"
    })
  ]);
  assert.equal(supervision.filter(row => row.status === "fulfilled").length, 1,
    "Two competing supervisors must not cover the same class/date");
  assert.equal(supervision.filter(row => row.status === "rejected").length, 1);
  const selectedSupervisor = supervision.find(row => row.status === "fulfilled");
  assert.equal(selectedSupervisor?.status, "fulfilled");
  if (selectedSupervisor?.status !== "fulfilled") throw new Error("No selected Negaran.");
  const closed = await academics.endNegaranAssignment(schoolId, selectedSupervisor.value.id, {
    endDate: "2026-03-31"
  });
  assert.equal(closed.endDate, "2026-03-31");
  await assert.rejects(
    academics.endNegaranAssignment(schoolId, selectedSupervisor.value.id, { endDate: "2026-04-01" }),
    /already closed/i,
    "Ending the same supervision twice must not overwrite the recorded end date"
  );

  const timetable = await Promise.allSettled([
    academics.createTimetablePeriod(schoolId, {
      academicYearId: year.id, classId: klassA.id, subjectId: subjectA.id,
      teacherUserId: teacherUsers[0]!.id, weekday: "SATURDAY",
      startsAt: "08:00", endsAt: "08:50"
    }),
    academics.createTimetablePeriod(schoolId, {
      academicYearId: year.id, classId: klassB.id, subjectId: subjectB.id,
      teacherUserId: teacherUsers[0]!.id, weekday: "SATURDAY",
      startsAt: "08:30", endsAt: "09:10"
    })
  ]);
  assert.equal(timetable.filter(row => row.status === "fulfilled").length, 1,
    "A teacher cannot be scheduled in overlapping classes even under concurrent writes");
  assert.equal(timetable.filter(row => row.status === "rejected").length, 1);
  const activeTimetable = await academics.getTeacherView(schoolId, teacherUsers[0]!.id);
  assert.equal(activeTimetable.schedule.length, 1);

  const winningSlot = timetable.find(row => row.status === "fulfilled");
  if (winningSlot?.status !== "fulfilled") throw new Error("No timetable period inserted.");
  const alternative = winningSlot.value.classId === klassA.id
    ? { classId: klassB.id, subjectId: subjectB.id, teacherUserId: teacherUsers[0]!.id }
    : { classId: klassA.id, subjectId: subjectA.id, teacherUserId: teacherUsers[0]!.id };
  const overlappingReassignment = await academics.createTimetablePeriod(schoolId, {
    academicYearId: year.id, classId: alternative.classId,
    subjectId: alternative.subjectId, teacherUserId: alternative.teacherUserId,
    weekday: "MONDAY", startsAt: "10:00", endsAt: "10:45"
  });
  await assert.rejects(
    academics.updateTimetablePeriod(schoolId, overlappingReassignment.id, {
      academicYearId: year.id, ...alternative,
      weekday: "SATURDAY", startsAt: "08:20", endsAt: "08:45"
    }),
    /already has another timetable period|already has another timetable|already scheduled/i
  );
});
