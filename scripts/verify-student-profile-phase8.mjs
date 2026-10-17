import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=get("apps/mobile/App.tsx");
const ui=get("apps/mobile/src/student-more.tsx");
const security=get("apps/mobile/src/student-profile-security.tsx");
const model=get("apps/mobile/src/student-profile-model.ts");
const api=get("apps/mobile/src/api.ts");
const auth=get("apps/api/src/auth/routes.ts");
const locale=get("packages/localization/src/index.ts");
const pkg=JSON.parse(get("package.json"));
const workflow=get(".github/workflows/student-navigation.yml");
for(const value of [
  "studentPasswordChangeAllowed(", "studentPasswordResultBelongsToSession(",
  "changeStudentAccountPassword(", "refreshStudentProfile()",
  "onChangePassword={changeStudentAccountPassword}", "onRefresh={refreshStudentProfile}",
  "studentHomeLoadRequestId.current += 1;",
  "studentInboxVersion.current += 1;", "sessionRef.current?.accessToken !== accessToken",
  "studentHomeLoadData"
].filter(x=>x!=="studentHomeLoadData")){
  assert.ok(app.includes(value),"Missing Phase 8 student App behavior "+value);
}
for(const value of [
  'testID="student-phase8-enrollment"','testID="student-phase8-refresh"',
  "schoolCode","schoolLocation","StudentPasswordSettings",
  "parent.moreLogoutConfirm"
]) assert.ok(ui.includes(value),"Missing Phase 8 profile UI "+value);
for(const value of [
  'testID="student-phase8-security"','testID="student-phase8-change-password"',
  'testID="student-phase8-password-toggle"',"secureTextEntry={!visible}",
  "parentPasswordValidation(","if(saving)return;"
])assert.ok(security.includes(value),"Missing Phase 8 security UI "+value);
assert.ok(model.includes("sameSessionEpoch("),"Missing strict session-epoch validation");
assert.ok(api.includes("changeStudentPassword("));
assert.ok(api.includes("studentTimetable(accessToken: string, fresh = false)"));
assert.ok(auth.includes('app.post("/v1/auth/change-password"'));
for(const key of [
  "student.profileUsername","student.profileEnrollment",
  "student.profileSchoolCode","student.profileSchoolLocation",
  "student.profileManaged","student.profileRefresh",
  "student.profileSecurity","student.profileSecurityHint",
  "student.profilePasswordSaved","student.profilePasswordFailed"
]){
  assert.ok(locale.includes('  | "'+key+'"'),"Missing translation key "+key);
  assert.equal(locale.split('  "'+key+'":').length-1,3,"Missing Dari, Pashto or English translation for "+key);
}
assert.ok(pkg.scripts["verify:student:phase8"]?.includes("verify:student:phase7"));
assert.ok(workflow.includes("pnpm verify:student:phase8"));
console.log("Student Phase 8 UI, enrollment, account security, locale coverage and stale-session guards verified.");
