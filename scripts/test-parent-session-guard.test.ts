import test from "node:test";
import assert from "node:assert/strict";
import { sameSessionEpoch } from "../apps/mobile/src/parent-session-guard";
import type { SessionPayload, SchoolOption } from "../apps/mobile/src/api";

const school = {id:"school-a", code:"SCH", name:"School",
  province:"Kabul", city:"Kabul", imageUrl:null, defaultLanguage:"en"} as SchoolOption;
const session = {
  accessToken:"access-before", refreshToken:"refresh-before",
  accessExpiresAt:"2026-10-14T20:00:00Z",
  user:{id:"parent-a",schoolId:"school-a",username:"parent",
    role:"PARENT",status:"ACTIVE",mustChangePassword:false},
  mustChangePassword:false
} as SessionPayload;

test("same session requires exact token pair, user, role, tenant and selected school", () => {
  assert.equal(sameSessionEpoch(session,session,school,school),true);
  assert.equal(sameSessionEpoch(null,session,school,school),false);
  assert.equal(sameSessionEpoch(session,session,null,school),false);
  assert.equal(sameSessionEpoch({...session,accessToken:"after"},session,school,school),false);
  assert.equal(sameSessionEpoch({...session,refreshToken:"after"},session,school,school),false);
  assert.equal(sameSessionEpoch({...session,user:{...session.user,id:"parent-b"}},session,school,school),false);
  assert.equal(sameSessionEpoch({...session,user:{...session.user,role:"STUDENT"}},session,school,school),false);
  assert.equal(sameSessionEpoch({...session,user:{...session.user,schoolId:"school-b"}},session,school,school),false);
  assert.equal(sameSessionEpoch(session,session,{...school,id:"school-b"},school),false);
});
test("late refresh and password responses for the same parent are rejected after rotation", () => {
  const rotated = {...session,accessToken:"new-access",refreshToken:"new-refresh"};
  assert.equal(sameSessionEpoch(rotated,session,school,school),false);
  // An old password POST which finished after refresh must not overwrite the newer session.
  assert.equal(sameSessionEpoch(rotated,session,school,school),false);
  assert.equal(sameSessionEpoch(rotated,rotated,school,school),true);
});
