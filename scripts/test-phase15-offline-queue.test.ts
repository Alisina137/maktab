import assert from "node:assert/strict";
import test from "node:test";
import {
  offlineReadPathAllowed, canPersistOfflineRead, requestIdentityCurrent
} from "../apps/mobile/src/offline-request-policy.js";
import { registrationQueuePage } from "../apps/web/app/staff/staff-registration-queue-model.js";

const studentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("Phase 15 Step 1: offline snapshots are restricted to approved family, student and teacher reads", () => {
  for (const path of [
    "/v1/school/admin-contact",
    "/v1/parent/home",
    "/v1/parent/children/" + studentId + "/attendance?from=2026-11-01&to=2026-11-13",
    "/v1/parent/children/" + studentId + "/timetable",
    "/v1/parent/children/" + studentId + "/fees",
    "/v1/parent/children/" + studentId + "/learning",
    "/v1/student/home", "/v1/student/timetable",
    "/v1/student/attendance?from=2026-11-01&to=2026-11-13",
    "/v1/student/fees", "/v1/announcements", "/v1/notifications",
    "/v1/teacher/today", "/v1/teacher/academics", "/v1/teacher/learning",
    "/v1/teacher/tasks", "/v1/teacher/classes/" + studentId,
    "/v1/teacher/negaran/" + studentId + "/history",
    "/v1/teacher/negaran/" + studentId + "/attendance?date=2026-11-13",
    "/v1/teacher/exam-subjects/" + studentId + "/grades"
  ]) assert.equal(offlineReadPathAllowed(path), true, path);
  for (const path of [
    "/v1/auth/me", "/v1/auth/refresh", "/v1/auth/login",
    "/v1/public/schools", "/health", "/v1/learning/files/" + studentId,
    "/v1/teacher/homework/" + studentId + "/submissions",
    "/v1/notifications/devices", "/v1/teacher/teaching/" + studentId,
    "/v1/platform/schools", "/v1/student/home?refresh_token=abc",
    "/v1/student/home?token=abc", "/v1/student/home?access_token=abc",
    "/v1/parent/home?secret=abc", "/v1/parent/home#attack",
    "/v1/student/home\nX-Secret:yes",
    "/v1/student/home/more",
    "/v1/parent/children/bad.id/learning"
  ]) assert.equal(offlineReadPathAllowed(path), false, path);
});

test("Phase 15 Step 2: offline cache is disabled without valid GET, bearer and school/account scope", () => {
  assert.equal(canPersistOfflineRead("/v1/parent/home", "GET", true, true, true), true);
  assert.equal(canPersistOfflineRead("/v1/parent/home", "POST", true, true, true), false);
  assert.equal(canPersistOfflineRead("/v1/parent/home", "GET", false, true, true), false);
  assert.equal(canPersistOfflineRead("/v1/parent/home", "GET", true, false, true), false);
  assert.equal(canPersistOfflineRead("/v1/parent/home", "GET", true, true, false), false);
  assert.equal(canPersistOfflineRead("/v1/auth/me", "GET", true, true, true), false);
  assert.equal(canPersistOfflineRead("/v1/public/schools", "GET", true, true, true), false);
  assert.equal(canPersistOfflineRead("/v1/learning/files/a", "GET", true, true, true), false);
});

test("Phase 15 Step 3: A -> logout -> A is a new identity epoch despite identical user and school", () => {
  const a = "school-one:parent-one";
  const b = "school-two:parent-one";
  assert.equal(requestIdentityCurrent(a, 7, a, 7), true);
  assert.equal(requestIdentityCurrent(a, 7, a, 9), false);
  assert.equal(requestIdentityCurrent(a, 7, null, 8), false);
  assert.equal(requestIdentityCurrent(a, 7, b, 7), false);
  assert.equal(requestIdentityCurrent(null, 7, null, 7), false);
  assert.equal(requestIdentityCurrent("", 7, "", 7), false);
});

const rows = Array.from({ length: 13 }, (_, i) => ({
  id: String(i + 1), status: i % 2 ? "SUBMITTED" : "DRAFT"
}));

test("Phase 15 Step 4: registration queue shows exactly five entries per page and clamps boundaries", () => {
  const first = registrationQueuePage(rows, "ALL", 1);
  assert.deepEqual(first.items.map(x=>x.id), ["1","2","3","4","5"]);
  assert.deepEqual([first.page,first.pages,first.total,first.start,first.end], [1,3,13,1,5]);
  const second = registrationQueuePage(rows, "ALL", 2);
  assert.deepEqual(second.items.map(x=>x.id), ["6","7","8","9","10"]);
  const last = registrationQueuePage(rows, "ALL", 99);
  assert.deepEqual(last.items.map(x=>x.id), ["11","12","13"]);
  assert.deepEqual([last.page,last.pages,last.total,last.start,last.end], [3,3,13,11,13]);
  assert.equal(registrationQueuePage(rows,"ALL",NaN).page,1);
  assert.equal(registrationQueuePage(rows,"ALL",-1).page,1);
});

test("Phase 15 Step 5: filtering and empty queues never show out-of-range or cross-status items", () => {
  const drafts = registrationQueuePage(rows,"DRAFT",10);
  assert.deepEqual(drafts.items.map(x=>x.id), ["11","13"]);
  assert.equal(drafts.pages,2);
  assert.ok(drafts.items.every(x=>x.status==="DRAFT"));
  const submitted = registrationQueuePage(rows,"SUBMITTED",1);
  assert.equal(submitted.items.length,5);
  assert.ok(submitted.items.every(x=>x.status==="SUBMITTED"));
  const empty=registrationQueuePage(rows,"REJECTED",99);
  assert.deepEqual(empty.items,[]);
  assert.deepEqual([empty.page,empty.pages,empty.total,empty.start,empty.end],[1,1,0,0,0]);
});
