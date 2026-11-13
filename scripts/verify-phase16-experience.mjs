#!/usr/bin/env node
// Source call-site guard complements executable policy tests.
// This is NOT a browser, device, Neon, or independent operator acceptance.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

const storage=read("apps/web/app/staff/staff-client.ts");
for(const token of [
  "validStoredStaffSession(value)",
  "const value:unknown=JSON.parse(raw)",
  "window.sessionStorage.removeItem(KEY)"
])assert.ok(storage.includes(token),"Staff session validation/cleanup missing: "+token);

const dashboard=read("apps/web/app/staff/dashboard/page.tsx");
for(const token of [
  "const sessionEpoch=useRef(0)",
  "sessionEpoch.current+=1;",
  "staffRequestIdentityCurrent(",
  "staffSessionMustExit(cause,\"/v1/auth/refresh\")",
  "staffSessionMustExit(cause,path)",
  "assertCurrent();",
  "verifiedStaffProfileIdentity(current.current,data)",
  'onClick={()=>setProfileRetryEpoch(epoch=>epoch+1)}',
  "Staff access temporarily unavailable. Check connection and retry."
])assert.ok(dashboard.includes(token),"Staff session/UX runtime protection missing: "+token);
assert.ok(!dashboard.includes("catch{exit();throw Error(\"Your staff session has expired.\");}"),
  "A temporary refresh outage must not clear a valid Staff session.");
assert.ok(!dashboard.includes("failure.status===503||"),
  "Generic server outage must not sign Staff out.");

const login=read("apps/web/app/staff/page.tsx");
for(const token of [
  "const pendingSchool=useRef<School|null>(null)",
  "pendingSchool.current=school;",
  "school:pendingSchool.current",
  "root.lang=previousLang;root.dir=previousDir;",
  "onClick={()=>setSchoolRetryEpoch(epoch=>epoch+1)}",
  'disabled={busy||schoolsLoading||!schoolId}',
  'Retry loading schools'
])assert.ok(login.includes(token),"Staff school-picker or activation protection missing: "+token);

const policy=read("apps/web/app/staff/staff-session-policy.ts");
for(const token of [
  "user.schoolId === school.id",
  'user.status === "ACTIVE"',
  "instant(session.refreshExpiresAt) > now",
  "profile.school.id === stored.school.id",
  "staffSessionMustExit",
  "startEpoch === nowEpoch"
])assert.ok(policy.includes(token),"Phase 16 Staff policy regression: "+token);

const dictionary=read("apps/web/app/admin/admin-i18n.ts");
for(const token of [
  "Staff access temporarily unavailable. Check connection and retry.",
  "Retry loading schools"
])assert.ok(dictionary.split('"'+token+'"').length>=3,
  "Staff recovery feedback missing Dari/Pashto translation: "+token);

console.log("Phase 16 source guards: persisted Staff identity, expiry, request epochs, retry UX and RTL recovery verified.");
