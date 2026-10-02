import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { and, asc, desc, eq, ne, or } from "drizzle-orm";
import { createDatabaseClient } from "./client.js";
import {
  academicYears,
  announcements,
  classSections,
  dailyAttendances,
  examSubjects,
  exams,
  feeInvoices,
  feePayments,
  gradeRecords,
  homeworks,
  parentProfiles,
  schools,
  studentAttendances,
  students,
  subjects,
  teacherAssignments,
  teacherProfiles,
  timetablePeriods,
  users
} from "./schema.js";

for (const candidate of [resolve(process.cwd(), "../../.env"), resolve(process.cwd(), ".env")]) {
  if (existsSync(candidate)) {
    config({ path: candidate });
    break;
  }
}

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error("DATABASE_URL is required in the project root .env file.");
}

const requestedSchoolCode = process.env.DEMO_SCHOOL_CODE?.trim() || null;
const requestedParentUsername = process.env.DEMO_PARENT_USERNAME?.trim().toLowerCase() || null;
const requestedStudentCode = process.env.DEMO_STUDENT_CODE?.trim().toUpperCase() || null;

function schoolLocalDate(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kabul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(instant);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Could not resolve the Kabul local date.");
  return year + "-" + month + "-" + day;
}

function plusDays(days: number) {
  return schoolLocalDate(new Date(Date.now() + days * 86_400_000));
}

const weekdayNames = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY"
] as const;

function weekdayFor(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return weekdayNames[new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()];
}

function periodsOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && startB < endA;
}

const client = createDatabaseClient(connectionString);
const db = client.db;

async function main() {
  const conditions = [
    eq(students.status, "ACTIVE"),
    eq(schools.status, "ACTIVE"),
    eq(users.role, "PARENT"),
    ne(users.status, "ARCHIVED"),
    eq(academicYears.status, "ACTIVE")
  ];
  if (requestedSchoolCode) conditions.push(eq(schools.code, requestedSchoolCode));
  if (requestedParentUsername) conditions.push(eq(users.username, requestedParentUsername));
  if (requestedStudentCode) conditions.push(eq(students.studentCode, requestedStudentCode));

  const [target] = await db
    .select({
      schoolId: schools.id,
      schoolCode: schools.code,
      schoolName: schools.name,
      parentUserId: parentProfiles.userId,
      parentUsername: users.username,
      studentId: students.id,
      studentCode: students.studentCode,
      studentName: students.fullName,
      academicYearId: students.academicYearId,
      classId: students.classId,
      className: classSections.name,
      classCode: classSections.code
    })
    .from(students)
    .innerJoin(parentProfiles, and(
      eq(parentProfiles.userId, students.parentUserId),
      eq(parentProfiles.schoolId, students.schoolId)
    ))
    .innerJoin(users, and(
      eq(users.id, parentProfiles.userId),
      eq(users.schoolId, students.schoolId)
    ))
    .innerJoin(schools, eq(schools.id, students.schoolId))
    .innerJoin(academicYears, and(
      eq(academicYears.id, students.academicYearId),
      eq(academicYears.schoolId, students.schoolId)
    ))
    .innerJoin(classSections, and(
      eq(classSections.id, students.classId),
      eq(classSections.schoolId, students.schoolId)
    ))
    .where(and(...conditions))
    .orderBy(asc(schools.createdAt), asc(users.createdAt), asc(students.createdAt))
    .limit(1);

  if (!target) {
    throw new Error(
      "No active Parent + Student in an active academic year was found. Create/link them first, or set DEMO_SCHOOL_CODE / DEMO_PARENT_USERNAME / DEMO_STUDENT_CODE."
    );
  }

  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(
      eq(users.schoolId, target.schoolId),
      eq(users.role, "SCHOOL_ADMIN"),
      ne(users.status, "ARCHIVED")
    ))
    .orderBy(asc(users.createdAt))
    .limit(1);
  if (!admin) throw new Error("The selected school has no school administrator account.");

  let [assignment] = await db
    .select({
      id: teacherAssignments.id,
      teacherUserId: teacherAssignments.teacherUserId,
      subjectId: teacherAssignments.subjectId,
      subjectName: subjects.name,
      teacherName: teacherProfiles.fullName
    })
    .from(teacherAssignments)
    .innerJoin(subjects, and(
      eq(subjects.id, teacherAssignments.subjectId),
      eq(subjects.schoolId, teacherAssignments.schoolId)
    ))
    .innerJoin(teacherProfiles, and(
      eq(teacherProfiles.userId, teacherAssignments.teacherUserId),
      eq(teacherProfiles.schoolId, teacherAssignments.schoolId)
    ))
    .where(and(
      eq(teacherAssignments.schoolId, target.schoolId),
      eq(teacherAssignments.academicYearId, target.academicYearId),
      eq(teacherAssignments.classId, target.classId)
    ))
    .orderBy(asc(teacherAssignments.createdAt))
    .limit(1);

  if (!assignment) {
    const [teacher] = await db
      .select({ userId: teacherProfiles.userId, fullName: teacherProfiles.fullName })
      .from(teacherProfiles)
      .innerJoin(users, and(
        eq(users.id, teacherProfiles.userId),
        eq(users.schoolId, teacherProfiles.schoolId)
      ))
      .where(and(
        eq(teacherProfiles.schoolId, target.schoolId),
        ne(users.status, "ARCHIVED")
      ))
      .orderBy(asc(teacherProfiles.createdAt))
      .limit(1);
    if (!teacher) {
      throw new Error("No teacher profile exists in this school. Create one teacher first, then rerun this command.");
    }

    let [subject] = await db
      .select({ id: subjects.id, name: subjects.name })
      .from(subjects)
      .where(eq(subjects.schoolId, target.schoolId))
      .orderBy(asc(subjects.createdAt))
      .limit(1);

    if (!subject) {
      [subject] = await db
        .insert(subjects)
        .values({
          id: randomUUID(),
          schoolId: target.schoolId,
          code: "DASHDEMO",
          name: "Dashboard Demo Subject"
        })
        .returning({ id: subjects.id, name: subjects.name });
    }
    if (!subject) throw new Error("Could not create a demo subject.");

    await db.insert(teacherAssignments).values({
      id: randomUUID(),
      schoolId: target.schoolId,
      academicYearId: target.academicYearId,
      teacherUserId: teacher.userId,
      subjectId: subject.id,
      classId: target.classId
    });

    [assignment] = await db
      .select({
        id: teacherAssignments.id,
        teacherUserId: teacherAssignments.teacherUserId,
        subjectId: teacherAssignments.subjectId,
        subjectName: subjects.name,
        teacherName: teacherProfiles.fullName
      })
      .from(teacherAssignments)
      .innerJoin(subjects, and(
        eq(subjects.id, teacherAssignments.subjectId),
        eq(subjects.schoolId, teacherAssignments.schoolId)
      ))
      .innerJoin(teacherProfiles, and(
        eq(teacherProfiles.userId, teacherAssignments.teacherUserId),
        eq(teacherProfiles.schoolId, teacherAssignments.schoolId)
      ))
      .where(and(
        eq(teacherAssignments.schoolId, target.schoolId),
        eq(teacherAssignments.academicYearId, target.academicYearId),
        eq(teacherAssignments.classId, target.classId)
      ))
      .orderBy(asc(teacherAssignments.createdAt))
      .limit(1);
  }

  if (!assignment) throw new Error("Could not resolve a teacher assignment.");

  const today = plusDays(0);
  const yesterday = plusDays(-1);
  const feeDue = plusDays(7);
  const weekday = weekdayFor(today);

  async function upsertAttendance(
    date: string,
    status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
    note: string
  ) {
    const [attendance] = await db
      .insert(dailyAttendances)
      .values({
        id: randomUUID(),
        schoolId: target.schoolId,
        academicYearId: target.academicYearId,
        classId: target.classId,
        date,
        status: "SUBMITTED",
        submittedBy: admin.id,
        updatedBy: admin.id
      })
      .onConflictDoUpdate({
        target: [dailyAttendances.schoolId, dailyAttendances.classId, dailyAttendances.date],
        set: {
          academicYearId: target.academicYearId,
          updatedBy: admin.id,
          updatedAt: new Date()
        }
      })
      .returning({ id: dailyAttendances.id });

    if (!attendance) throw new Error("Could not create attendance for " + date + ".");

    await db
      .insert(studentAttendances)
      .values({
        id: randomUUID(),
        schoolId: target.schoolId,
        attendanceId: attendance.id,
        studentId: target.studentId,
        status,
        note
      })
      .onConflictDoUpdate({
        target: [studentAttendances.attendanceId, studentAttendances.studentId],
        set: { status, note, updatedAt: new Date() }
      });
  }

  await upsertAttendance(today, "PRESENT", "Demo: present today");
  await upsertAttendance(yesterday, "LATE", "Demo: late on the previous day");

  const homeworkTitle = "Parent Dashboard Demo Homework";
  const [existingHomework] = await db
    .select({ id: homeworks.id })
    .from(homeworks)
    .where(and(
      eq(homeworks.schoolId, target.schoolId),
      eq(homeworks.classId, target.classId),
      eq(homeworks.title, homeworkTitle)
    ))
    .limit(1);

  const homeworkValues = {
    assignmentId: assignment.id,
    academicYearId: target.academicYearId,
    subjectId: assignment.subjectId,
    teacherUserId: assignment.teacherUserId,
    content: "Complete questions 1-5 before the due date.",
    dueAt: new Date(Date.now() + 2 * 86_400_000),
    status: "PUBLISHED" as const,
    publishedAt: new Date(),
    updatedAt: new Date()
  };

  if (existingHomework) {
    await db.update(homeworks).set(homeworkValues).where(eq(homeworks.id, existingHomework.id));
  } else {
    await db.insert(homeworks).values({
      id: randomUUID(),
      schoolId: target.schoolId,
      classId: target.classId,
      title: homeworkTitle,
      ...homeworkValues
    });
  }

  const examName = "Parent Dashboard Demo Exam";
  let [exam] = await db
    .select({ id: exams.id })
    .from(exams)
    .where(and(
      eq(exams.schoolId, target.schoolId),
      eq(exams.academicYearId, target.academicYearId),
      eq(exams.name, examName)
    ))
    .limit(1);

  if (exam) {
    await db.update(exams).set({
      status: "PUBLISHED",
      publishedAt: new Date(),
      updatedAt: new Date()
    }).where(eq(exams.id, exam.id));
  } else {
    [exam] = await db
      .insert(exams)
      .values({
        id: randomUUID(),
        schoolId: target.schoolId,
        academicYearId: target.academicYearId,
        name: examName,
        type: "DEMO",
        status: "PUBLISHED",
        publishedAt: new Date()
      })
      .returning({ id: exams.id });
  }
  if (!exam) throw new Error("Could not create the demo exam.");

  let [examSubject] = await db
    .select({ id: examSubjects.id })
    .from(examSubjects)
    .where(and(
      eq(examSubjects.schoolId, target.schoolId),
      eq(examSubjects.examId, exam.id),
      eq(examSubjects.classId, target.classId),
      eq(examSubjects.subjectId, assignment.subjectId)
    ))
    .limit(1);

  if (!examSubject) {
    [examSubject] = await db
      .insert(examSubjects)
      .values({
        id: randomUUID(),
        schoolId: target.schoolId,
        examId: exam.id,
        subjectId: assignment.subjectId,
        classId: target.classId,
        maxScore: 100
      })
      .returning({ id: examSubjects.id });
  }
  if (!examSubject) throw new Error("Could not create the demo exam subject.");

  await db
    .insert(gradeRecords)
    .values({
      id: randomUUID(),
      schoolId: target.schoolId,
      examSubjectId: examSubject.id,
      studentId: target.studentId,
      score: 86,
      remark: "Strong demo result for the Parent dashboard.",
      status: "PUBLISHED",
      updatedBy: admin.id,
      publishedAt: new Date()
    })
    .onConflictDoUpdate({
      target: [gradeRecords.examSubjectId, gradeRecords.studentId],
      set: {
        score: 86,
        remark: "Strong demo result for the Parent dashboard.",
        status: "PUBLISHED",
        updatedBy: admin.id,
        publishedAt: new Date(),
        updatedAt: new Date()
      }
    });

  const feeDescription = "Parent Dashboard Demo Fee";
  let [invoice] = await db
    .select({ id: feeInvoices.id })
    .from(feeInvoices)
    .where(and(
      eq(feeInvoices.schoolId, target.schoolId),
      eq(feeInvoices.studentId, target.studentId),
      eq(feeInvoices.description, feeDescription)
    ))
    .orderBy(desc(feeInvoices.createdAt))
    .limit(1);

  if (!invoice) {
    [invoice] = await db
      .insert(feeInvoices)
      .values({
        id: randomUUID(),
        schoolId: target.schoolId,
        studentId: target.studentId,
        amount: 2500,
        currency: "AFN",
        description: feeDescription,
        dueDate: feeDue,
        status: "ISSUED",
        issuedAt: new Date(),
        createdBy: admin.id
      })
      .returning({ id: feeInvoices.id });
  } else {
    const payments = await db
      .select({ kind: feePayments.kind, amount: feePayments.amount })
      .from(feePayments)
      .where(and(
        eq(feePayments.schoolId, target.schoolId),
        eq(feePayments.invoiceId, invoice.id)
      ));
    const paid = payments.reduce(
      (total, payment) => total + (payment.kind === "PAYMENT" ? payment.amount : -payment.amount),
      0
    );
    await db.update(feeInvoices).set({
      amount: paid + 2500,
      dueDate: feeDue,
      status: paid > 0 ? "PARTIALLY_PAID" : "ISSUED",
      issuedAt: new Date(),
      cancelledAt: null,
      updatedAt: new Date()
    }).where(eq(feeInvoices.id, invoice.id));
  }

  const announcementTitle = "Parent Dashboard Demo Announcement";
  const [existingAnnouncement] = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(and(
      eq(announcements.schoolId, target.schoolId),
      eq(announcements.classId, target.classId),
      eq(announcements.title, announcementTitle)
    ))
    .orderBy(desc(announcements.createdAt))
    .limit(1);

  const announcementValues = {
    content: "This is sample class information for testing the Parent dashboard.",
    audienceScope: "CLASS" as const,
    classId: target.classId,
    audienceRole: null,
    publishAt: new Date(),
    archivedAt: null,
    updatedAt: new Date()
  };

  if (existingAnnouncement) {
    await db.update(announcements)
      .set(announcementValues)
      .where(eq(announcements.id, existingAnnouncement.id));
  } else {
    await db.insert(announcements).values({
      id: randomUUID(),
      schoolId: target.schoolId,
      title: announcementTitle,
      createdBy: admin.id,
      ...announcementValues
    });
  }

  const todayPeriods = await db
    .select({
      id: timetablePeriods.id,
      startsAt: timetablePeriods.startsAt,
      endsAt: timetablePeriods.endsAt,
      classId: timetablePeriods.classId,
      teacherUserId: timetablePeriods.teacherUserId
    })
    .from(timetablePeriods)
    .where(and(
      eq(timetablePeriods.schoolId, target.schoolId),
      eq(timetablePeriods.academicYearId, target.academicYearId),
      eq(timetablePeriods.weekday, weekday)
    ))
    .orderBy(asc(timetablePeriods.startsAt));

  let scheduleLabel = "not created";
  const existingClassPeriod = todayPeriods.find((period) => period.classId === target.classId);
  if (existingClassPeriod) {
    scheduleLabel = existingClassPeriod.startsAt + "-" + existingClassPeriod.endsAt;
  } else {
    const candidates = [
      ["08:00", "08:45"],
      ["09:00", "09:45"],
      ["10:00", "10:45"],
      ["11:00", "11:45"],
      ["12:00", "12:45"],
      ["13:00", "13:45"]
    ] as const;

    for (const [startsAt, endsAt] of candidates) {
      const conflict = todayPeriods.some(
        (period) =>
          (period.classId === target.classId || period.teacherUserId === assignment.teacherUserId) &&
          periodsOverlap(period.startsAt, period.endsAt, startsAt, endsAt)
      );
      if (conflict) continue;

      await db.insert(timetablePeriods).values({
        id: randomUUID(),
        schoolId: target.schoolId,
        academicYearId: target.academicYearId,
        classId: target.classId,
        subjectId: assignment.subjectId,
        teacherUserId: assignment.teacherUserId,
        weekday,
        startsAt,
        endsAt
      });
      scheduleLabel = startsAt + "-" + endsAt;
      break;
    }
  }

  console.log("");
  console.log("Parent dashboard demo data is ready.");
  console.log("School: " + target.schoolName + " (" + target.schoolCode + ")");
  console.log("Parent: " + target.parentUsername);
  console.log("Student: " + target.studentName + " (" + target.studentCode + ")");
  console.log("Class: " + target.className + " (" + target.classCode + ")");
  console.log("Today attendance (" + today + "): PRESENT");
  console.log("Previous attendance (" + yesterday + "): LATE");
  console.log("Homework: " + homeworkTitle + " - due in 2 days");
  console.log("Published result: " + examName + " - 86/100");
  console.log("Fee: " + feeDescription + " - AFN 2500 outstanding");
  console.log("Announcement: " + announcementTitle);
  console.log("Today timetable (" + weekday + "): " + assignment.subjectName + " · " + scheduleLabel);
  console.log("");
}

try {
  await main();
} finally {
  await client.close();
}
