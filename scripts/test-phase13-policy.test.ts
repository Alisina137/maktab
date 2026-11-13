import assert from "node:assert/strict";
import test from "node:test";
import {
  validStoredSession, validStudentPreferenceId, parseParentChildPreferences
} from "../apps/mobile/src/stored-session-policy.js";
import { cacheEnvelopeBelongsTo } from "../apps/mobile/src/read-cache-policy.js";

const schoolId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const parentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const childId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const expiry = "2027-10-21T00:00:00Z";
function valid() {
  return {
    school: { id: schoolId, code: "SCHOOL13", name: "Pilot School",
      province: "Kabul", city: "Kabul", imageUrl: null, defaultLanguage: "fa-AF" },
    auth: { accessToken: "token123", refreshToken: "refresh123",
      accessExpiresAt: expiry, refreshExpiresAt: expiry, mustChangePassword: false,
      user: { id: parentId, schoolId, role: "PARENT", status: "ACTIVE",
        username: "pilotparent", mustChangePassword: false } }
  };
}

test("Phase 13 13.2 accepts only coherent stored school identity and end-user role", () => {
  assert.equal(validStoredSession(valid()), true);
  const mutations: Array<(row: ReturnType<typeof valid>) => void> = [
    row => { row.auth.user.schoolId = childId; },
    row => { row.auth.user.id = "not a UUID"; },
    row => { row.school.id = "not a UUID"; },
    row => { row.auth.user.role = "SCHOOL_ADMIN"; },
    row => { row.auth.user.status = "REMOVED"; },
    row => { row.auth.accessToken = ""; },
    row => { row.auth.refreshToken = ""; },
    row => { row.auth.refreshExpiresAt = "invalid"; },
    row => { row.auth.accessExpiresAt = "invalid"; },
    row => { row.school.defaultLanguage = "unknown"; },
    row => { row.school.name = ""; }
  ];
  for (const mutate of mutations) {
    const input = valid(); mutate(input);
    assert.equal(validStoredSession(input), false, JSON.stringify(input));
  }
  for (const v of [null, {}, [], "string", 3, { school: {} }]) {
    assert.equal(validStoredSession(v), false);
  }
});

test("Phase 13 13.3 parent selection preferences only survive for valid school/account/child UUIDs", () => {
  const validKey = schoolId + ":" + parentId;
  assert.equal(validStudentPreferenceId(childId), true);
  assert.equal(validStudentPreferenceId("__proto__"), false);
  const input = JSON.parse(JSON.stringify({
    [validKey]: childId, "__proto__": "poison",
    [schoolId + ":not-a-uuid"]: childId,
    [schoolId + ":" + childId + ":more"]: childId,
    [childId + ":" + parentId]: "not-a-uuid"
  })) as Record<string, unknown>;
  const sanitized = parseParentChildPreferences(input);
  assert.equal(sanitized[validKey], childId);
  assert.deepEqual(Object.keys(sanitized), [validKey]);
  assert.equal(Object.getPrototypeOf(sanitized), null);
  for (const bad of [null, [], "string", 20, {}]) {
    assert.equal(Object.keys(parseParentChildPreferences(bad)).length, 0);
  }
});

test("Phase 13 13.3 malformed preference maps cannot grow without bound", () => {
  const entries = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [
    schoolId + ":" + "bbbbbbbb-bbbb-4bbb-8bbb-" + i.toString(16).padStart(12, "0"), childId
  ]));
  const clean = parseParentChildPreferences(entries);
  assert.equal(Object.keys(clean).length, 100);
});

test("Phase 13 13.4 offline cache rejects hash collisions and cross-school or URL payload reuse", () => {
  const path = "/v1/parent/home";
  const entry = { version: 2, owner: schoolId + ":" + parentId, path,
    savedAt: "2026-11-13T09:00:00Z", data: { children: [] } };
  const owner = schoolId + ":" + parentId;
  assert.equal(cacheEnvelopeBelongsTo(entry, owner, path, 2), true);
  assert.equal(cacheEnvelopeBelongsTo(entry, schoolId + ":" + childId, path, 2), false);
  assert.equal(cacheEnvelopeBelongsTo(entry, owner, "/v1/parent/fees", 2), false);
  assert.equal(cacheEnvelopeBelongsTo(entry, owner, path, 1), false);
  assert.equal(cacheEnvelopeBelongsTo({ ...entry, owner: "evil" }, owner, path, 2), false);
  assert.equal(cacheEnvelopeBelongsTo({ ...entry, path: "/v1/student/home" }, owner, path, 2), false);
  assert.equal(cacheEnvelopeBelongsTo({ ...entry, data: undefined }, owner, path, 2), true);
  const noData = { ...entry } as Record<string, unknown>;
  delete noData.data;
  assert.equal(cacheEnvelopeBelongsTo(noData, owner, path, 2), false);
  assert.equal(cacheEnvelopeBelongsTo(null, owner, path, 2), false);
});
