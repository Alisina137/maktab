import assert from "node:assert/strict";
import test from "node:test";
import { summarizeTeaching } from "@maktablink/database";

test("phase 5 teaching report separates lesson states, progress, and homework statuses", () => {
  assert.deepEqual(summarizeTeaching(
    [{status:"PLANNED"}, {status:"COMPLETED"}, {status:"COMPLETED"}, {status:"POSTPONED"}],
    [{status:"NOT_STARTED"}, {status:"IN_PROGRESS"}, {status:"COMPLETED"}],
    [{status:"DRAFT"}, {status:"PUBLISHED"}, {status:"CLOSED"}, {status:"ARCHIVED"}], 3
  ), {
    lessonPlanned:1, lessonCompleted:2, lessonPostponed:1,
    unitsTotal:3, unitsCompleted:1, unitsInProgress:1,
    homeworksPublished:2, homeworkDrafts:1, assessmentCount:3
  });
});

test("empty lesson and unit data is a valid dashboard state", () => {
  assert.deepEqual(summarizeTeaching([], [], [], 0), {
    lessonPlanned:0, lessonCompleted:0, lessonPostponed:0,
    unitsTotal:0, unitsCompleted:0, unitsInProgress:0,
    homeworksPublished:0, homeworkDrafts:0, assessmentCount:0
  });
});
