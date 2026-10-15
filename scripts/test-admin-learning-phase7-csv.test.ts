import assert from "node:assert/strict";
import test from "node:test";
import { academicReportCsv, learningAuditCsv } from "../apps/api/src/learning/reports-csv.ts";
import type { AdminAcademicReport, AdminLearningAudit } from "@maktablink/database";

test("academic CSV safely quotes names, neutralizes formulas and excludes unpublished individual results",()=>{
  const report: AdminAcademicReport={
    academicYearId:"year",total:1,limit:500,offset:0,coverage:"ASSIGNED_CLASS_SUBJECTS_ONLY",
    summary:{assignments:1,examSubjects:0,publishedExamSubjects:0,publishedGrades:0,
      publishedHomework:0,submissionsAwaitingReview:0,curriculumUnits:0,
      completedUnits:0,completedLessons:0},
    rows:[{assignmentId:"assignment",classId:"class",subjectId:"subject",
      className:"=HYPERLINK(\"https://bad.test\")",subjectName:'History, "Unit 3"',
      teacherName:"\n +1+1",examSubjects:0,publishedExamSubjects:0,publishedGrades:0,
      publishedHomework:0,submissionsAwaitingReview:0,curriculumUnits:0,
      completedUnits:0,completedLessons:0}]
  };
  const csv=academicReportCsv(report);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv,/"'=HYPERLINK\(""https:\/\/bad.test""\)"/);
  assert.match(csv,/'\n \+1\+1/);
  assert.match(csv,/"History, ""Unit 3"""/);
  assert.equal(csv.includes("student_name"),false);
  assert.equal(csv.includes("raw_score"),false);
  assert.ok(csv.endsWith("\r\n"));
});

test("audit export includes action and actor but never free-form private metadata",()=>{
  const audit: AdminLearningAudit={total:1,limit:500,offset:0,
    scope:"MATCHED_LIVE_YEAR_ENTITIES",timezone:"UTC",
    rows:[{id:"event",createdAt:new Date("2026-10-15T06:02:03.000Z"),
      action:"grade.corrected",entityType:"grade_record",actorUsername:"@teacher"}]
  };
  const csv=learningAuditCsv(audit);
  assert.match(csv,/2026-10-15T06:02:03.000Z/);
  assert.match(csv,/"'@teacher"/);
  assert.equal(csv.includes("previousScore"),false);
  assert.equal(csv.includes("reason"),false);
  assert.ok(csv.includes("grade.corrected"));
});
