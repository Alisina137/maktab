import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
const model=read("apps/mobile/src/teacher-phase8-model.ts");
const more=read("apps/mobile/src/teacher-more.tsx");
const hub=read("apps/mobile/src/teacher-hub.tsx");
const experience=read("apps/mobile/src/teacher-experience.tsx");
const api=read("apps/mobile/src/api.ts");
const localization=read("packages/localization/src/index.ts");
const destination=read("apps/mobile/src/notification-destination.ts");
const tests=read("scripts/test-teacher-phase8-model.ts");
const pkg=JSON.parse(read("package.json"));
const ci=read(".github/workflows/teacher-navigation.yml");
for(const marker of ["teacherInboxList(","teacherUnreadCount(","teacherAnnouncementPreview(",
 "teacherProfileSummary(","teacherHubLoadStatus(","!item.archivedAt",
 "academics?.assignmentDetails","filter===\"UNREAD\"","filter===\"READ\""])
 assert.ok(model.includes(marker),"Phase 8 model missing: "+marker);
for(const marker of ['testID="teacher-profile-summary"',
 "teacher.profileEmployeeCode","teacher.profileVerifiedDetails",
 "profile.supervisionClasses","profile.assignments","profile.weeklyPeriods"])
 assert.ok(more.includes(marker),"Phase 8 profile missing: "+marker);
for(const marker of ['testID="teacher-inbox-search"',
 "teacherInboxList(","teacherAnnouncementPreview(","teacher.onlyUnread",
 "teacher.inboxRead","teacher.inboxShowMore","notificationsError",
 "announcementsError","actionBusy"])
 assert.ok(hub.includes(marker),"Phase 8 inbox missing: "+marker);
for(const marker of ["hubOwner===activeScope","visibleLearning=hubScoped",
 "visibleNotifications=hubScoped","visibleAnnouncements=hubScoped",
 "currentScope.current!==activeScope","Promise.allSettled([",
 "api.notifications(accessToken,true)","api.teacherLearning(accessToken,true)",
 "teacherUnreadCount(visibleNotifications)",'testID="teacher-hub-recovery"',
 "profile={profile}","actionBusy={hubActionBusy}"])
 assert.ok(experience.includes(marker),"Phase 8 session or recovery guard missing: "+marker);
assert.ok(api.includes("notifications(accessToken: string, fresh = false)"));
assert.ok(destination.includes('if (role === "PARENT"'));
for(const key of ["teacher.profileTeacherRole","teacher.profileAssignedSubjects",
 "teacher.profileClasses","teacher.profileWeeklyPeriods","teacher.profileSupervised",
 "teacher.profileEmployeeCode","teacher.profileVerifiedDetails","teacher.inboxSearch",
 "teacher.inboxRead","teacher.inboxShowMore","teacher.hubStale",
 "teacher.hubUnavailable"]){
 assert.ok(localization.includes('  | "'+key+'"'),"Missing key "+key);
 assert.equal(localization.split('"'+key+'":').length-1,3,
   "Missing en/Dari/Pashto dictionary values "+key);
}
for(const marker of ["stable descending order","hide archived entries",
 "does not fabricate unknown metrics","transient offline conditions",
 "do not accept unknown app URLs"])
 assert.ok(tests.includes(marker),"Phase 8 acceptance case missing: "+marker);
assert.ok(pkg.scripts["verify:teacher:phase8"]?.includes("verify:teacher:phase7"));
assert.ok(pkg.scripts["verify:teacher:phase8"]?.includes("test-teacher-phase8-model.ts"));
assert.ok(ci.includes("run: pnpm verify:teacher:phase8"));
console.log("Teacher Phase 8 security, scoped profile, inbox, offline recovery, translations and regression checks passed.");
