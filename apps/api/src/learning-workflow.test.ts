import assert from "node:assert/strict";
import test from "node:test";
import { filterHomework, homeworkDueAt, homeworkDueFields, gradeDraftsFromSheet, gradeProgress, pendingGradeEntries } from "../../mobile/src/learning-workflow.js";
import type { GradeSheetPayload, HomeworkPayload } from "../../mobile/src/api.js";

test("homework deadline is fixed to Asia/Kabul, not Android or server timezone", () => {
  assert.equal(homeworkDueAt("2026-10-13", "09:45"), "2026-10-13T05:15:00.000Z");
  assert.deepEqual(homeworkDueFields("2026-10-13T05:15:00.000Z"), { date: "2026-10-13", time: "09:45" });
  assert.equal(homeworkDueAt("2026-02-30", "09:00"), null);
  assert.equal(homeworkDueAt("2026-10-13", "25:60"), null);
  assert.equal(homeworkDueAt("", "09:00"), null);
});

test("homework search and status apply together without losing assignment scoping", () => {
  const items = [
    { id:"one", title:"Molecules", content:"Chemistry lesson", status:"DRAFT" },
    { id:"two", title:"Molecules", content:"Class test", status:"PUBLISHED" },
    { id:"three", title:"Math", content:"Equations", status:"DRAFT" }
  ] as HomeworkPayload[];
  assert.deepEqual(filterHomework(items, "mole", "DRAFT").map(x=>x.id), ["one"]);
  assert.deepEqual(filterHomework(items, "CHEMISTRY", "ALL").map(x=>x.id), ["one"]);
  assert.equal(filterHomework(items, "", "ALL").length, 3);
});

const gradeSheet = {
  examSubject: { maxScore: 50 },
  students: [
    { student: { id: "a", fullName: "Student A", studentCode:"S-1" }, grade: { score: 40, remark: "Good" } },
    { student: { id: "b", fullName: "Student B", studentCode:"S-2" }, grade: null }
  ]
} as GradeSheetPayload;

test("gradebook progress and changed-only saves preserve existing marks", () => {
  assert.deepEqual(gradeProgress(gradeSheet), { recorded: 1, missing: 1, total: 2 });
  const drafts = gradeDraftsFromSheet(gradeSheet);
  assert.deepEqual(pendingGradeEntries(gradeSheet, drafts), { entries: [], invalid: false });
  drafts.scores.b = "32";
  drafts.remarks.b = "Reviewed";
  const pending = pendingGradeEntries(gradeSheet, drafts);
  assert.equal(pending.invalid, false);
  assert.deepEqual(pending.entries, [{ studentId: "b", score:32, remark:"Reviewed" }]);
});

test("gradebook rejects exceeding maximum and accidental removal of official marks", () => {
  const drafts = gradeDraftsFromSheet(gradeSheet);
  drafts.scores.b = "51";
  assert.equal(pendingGradeEntries(gradeSheet, drafts).invalid, true);
  drafts.scores.b = "-1";
  assert.equal(pendingGradeEntries(gradeSheet, drafts).invalid, true);
  drafts.scores.b = "2.5";
  assert.equal(pendingGradeEntries(gradeSheet, drafts).invalid, true);
  drafts.scores.b = "";
  drafts.scores.a = "";
  assert.equal(pendingGradeEntries(gradeSheet, drafts).invalid, true);
});
