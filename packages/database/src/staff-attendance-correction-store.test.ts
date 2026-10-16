import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import type { FoundationDatabase } from "./client.js";
import { createStaffAttendanceCorrectionStore, StaffAttendanceCorrectionError } from "./staff-attendance-correction-store.js";
import { academicYears, auditLogs, classSections, dailyAttendances, gradeLevels,
  notifications, parentProfiles, schools, studentAttendances, students, users } from "./schema.js";

test("Staff Phase 5: approved corrections are atomic, scoped, audited and notify parents",async(t)=>{
  const client=new PGlite();
  t.after(async()=>client.close());
  const journal=JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json",import.meta.url),"utf8")) as {
    entries:Array<{tag:string}>;
  };
  for(const entry of journal.entries){
    const sql=await readFile(new URL(`../drizzle/${entry.tag}.sql`,import.meta.url),"utf8");
    await client.exec(sql.replaceAll("--> statement-breakpoint",""));
  }
  const db=drizzle(client,{schema:{}}) as unknown as FoundationDatabase;
  const store=createStaffAttendanceCorrectionStore(db);
  const schoolId=randomUUID(),otherSchool=randomUUID();
  const parentId=randomUUID(),staffId=randomUUID(),adminId=randomUUID();
  const yearId=randomUUID(),gradeId=randomUUID(),classId=randomUUID();
  const studentId=randomUUID(),attendanceId=randomUUID(),entryId=randomUUID();

  await db.insert(schools).values([
    {id:schoolId,code:"STAFF5A",name:"Staff Phase 5 A",slug:"staff-phase5-a",province:"Kabul",city:"Kabul"},
    {id:otherSchool,code:"STAFF5B",name:"Staff Phase 5 B",slug:"staff-phase5-b",province:"Kabul",city:"Kabul"}
  ]);
  await db.insert(users).values([
    {id:parentId,schoolId,username:"parent5",passwordHash:"hash",role:"PARENT",status:"ACTIVE",mustChangePassword:false},
    {id:staffId,schoolId,username:"staff5",passwordHash:"hash",role:"SCHOOL_STAFF",status:"ACTIVE",mustChangePassword:false},
    {id:adminId,schoolId,username:"admin5",passwordHash:"hash",role:"SCHOOL_ADMIN",status:"ACTIVE",mustChangePassword:false}
  ]);
  await db.insert(parentProfiles).values({userId:parentId,schoolId,fullName:"Parent Five"});
  await db.insert(academicYears).values({
    id:yearId,schoolId,name:"Staff Year 5",startDate:"2026-01-01",endDate:"2026-12-31",status:"ACTIVE"
  });
  await db.insert(gradeLevels).values({id:gradeId,schoolId,code:"G5",name:"Grade 5"});
  await db.insert(classSections).values({
    id:classId,schoolId,academicYearId:yearId,gradeLevelId:gradeId,code:"C5",name:"Class 5"
  });
  await db.insert(students).values({
    id:studentId,schoolId,parentUserId:parentId,studentCode:"S-0005",
    fullName:"Student Five",academicYearId:yearId,classId,status:"ACTIVE"
  });
  await db.insert(dailyAttendances).values({
    id:attendanceId,schoolId,academicYearId:yearId,classId,date:"2026-10-15",
    submittedBy:staffId,updatedBy:staffId,status:"SUBMITTED"
  });
  const [entry]=await db.insert(studentAttendances).values({
    id:entryId,schoolId,attendanceId,studentId,status:"PRESENT"
  }).returning();
  assert.ok(entry);

  await assert.rejects(store.create(otherSchool,staffId,{
    attendanceId,studentId,requestedStatus:"LATE",
    expectedUpdatedAt:entry.updatedAt.toISOString(),reason:"The student arrived late."
  }),(err:unknown)=>err instanceof StaffAttendanceCorrectionError && err.statusCode===404);
  const row=await store.create(schoolId,staffId,{
    attendanceId,studentId,requestedStatus:"LATE",
    expectedUpdatedAt:entry.updatedAt.toISOString(),reason:"The student arrived late."
  });
  assert.equal(row.status,"PENDING");
  assert.equal((await store.list(otherSchool)).length,0);
  assert.equal((await store.list(schoolId,staffId)).length,1);
  await assert.rejects(store.create(schoolId,staffId,{
    attendanceId,studentId,requestedStatus:"ABSENT",
    expectedUpdatedAt:entry.updatedAt.toISOString(),reason:"Another pending proposal"
  }),(err:unknown)=>err instanceof StaffAttendanceCorrectionError && err.statusCode===409);
  await assert.rejects(store.decide(otherSchool,row.id,adminId,{action:"APPROVE",note:"review"}),
    (err:unknown)=>err instanceof StaffAttendanceCorrectionError && err.statusCode===409);

  const approved=await store.decide(schoolId,row.id,adminId,{action:"APPROVE",note:"Checked class register"});
  assert.equal(approved.status,"APPROVED");
  const [after]=await db.select().from(studentAttendances)
    .where(and(eq(studentAttendances.schoolId,schoolId),eq(studentAttendances.id,entryId)));
  assert.equal(after?.status,"LATE");
  const [alert]=await db.select().from(notifications)
    .where(and(eq(notifications.schoolId,schoolId),eq(notifications.userId,parentId)));
  assert.equal(alert?.type,"ATTENDANCE_LATE");
  const [audit]=await db.select().from(auditLogs)
    .where(and(eq(auditLogs.schoolId,schoolId),eq(auditLogs.action,"attendance.corrected_by_admin")));
  assert.equal(audit?.actorUserId,adminId);
  await assert.rejects(store.decide(schoolId,row.id,adminId,{action:"APPROVE",note:"repeat"}),
    (err:unknown)=>err instanceof StaffAttendanceCorrectionError&&err.statusCode===409);

  const rejectedRequest=await store.create(schoolId,staffId,{
    attendanceId,studentId,requestedStatus:"EXCUSED",
    expectedUpdatedAt:after!.updatedAt.toISOString(),reason:"A medical note was received."
  });
  const rejected=await store.decide(schoolId,rejectedRequest.id,adminId,
    {action:"REJECT",note:"No verification provided"});
  assert.equal(rejected.status,"REJECTED");
  const [same]=await db.select({status:studentAttendances.status})
    .from(studentAttendances).where(eq(studentAttendances.id,entryId));
  assert.equal(same?.status,"LATE");

  const stale=await store.create(schoolId,staffId,{
    attendanceId,studentId,requestedStatus:"ABSENT",
    expectedUpdatedAt:after!.updatedAt.toISOString(),reason:"Request now stale after update"
  });
  await db.update(studentAttendances).set({updatedAt:new Date(after!.updatedAt.getTime()+1000)})
    .where(eq(studentAttendances.id,entryId));
  await assert.rejects(store.decide(schoolId,stale.id,adminId,{action:"APPROVE",note:""}),
    (err:unknown)=>err instanceof StaffAttendanceCorrectionError&&err.statusCode===409);
  const [unchanged]=await db.select().from(studentAttendances).where(eq(studentAttendances.id,entryId));
  assert.equal(unchanged?.status,"LATE");
  assert.equal((await store.list(schoolId,staffId)).find(x=>x.id===stale.id)?.status,"PENDING");
});
