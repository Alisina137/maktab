import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const nav=read("apps/mobile/src/parent-navigation.tsx");
const app=read("apps/mobile/App.tsx");
const shell=read("apps/mobile/src/parent-shell.tsx");
const inbox=read("apps/mobile/src/parent-inbox.tsx");
const timetable=read("apps/mobile/src/parent-timetable.tsx");
const destination=read("apps/mobile/src/notification-destination.ts");
const messages=read("packages/localization/src/index.ts");

const order=["HOME","ACADEMICS","ATTENDANCE","INBOX","MORE"];
const actual=[...nav.matchAll(/\{ key: "([A-Z]+)", label: "parent\.nav/g)]
  .slice(0,5).map((item)=>item[1]);
assert.deepEqual(actual,order,"Exactly five correctly ordered Parent bottom tabs");
assert.ok(nav.includes('accessibilityState={{ selected: active }}') &&
  nav.includes("bottomBarRtl") && nav.includes("bottomTabActive"),
  "Parent bottom bar must indicate selected tab and mirror RTL");
assert.ok(app.includes('useState<ParentTab>("HOME")') &&
  app.includes('useState<ParentAcademicsTab>("HOMEWORK")') &&
  app.includes('useState<ParentInboxTab>("ANNOUNCEMENTS")'),
  "Parent and child navigation defaults must always select first tabs");
const parentBranch=app.split('session?.user.role === "PARENT" && session.user.status !== "SUSPENDED" && (')[1] ?? "";
const childPicker=parentBranch.indexOf("<ParentChildSwitcher");
const homeOnly=parentBranch.indexOf('parentTab === "HOME"');
assert.ok(childPicker >=0 && homeOnly>childPicker,
  "Child selector must remain accessible on all parent destinations, not only Home");
assert.ok(shell.includes("selectedChildId") &&
  shell.includes("Modal visible={open}") &&
  shell.includes("childrenList.map") &&
  shell.includes("accessibilityState={{ selected: active }}") &&
  shell.includes("onRequestClose") && shell.includes("rtlRow"),
  "Child switcher must support secure selection, RTL and Android back");
for(const marker of [
  'parentTab === "ACADEMICS"', 'parentTab === "ATTENDANCE"',
  'parentTab === "INBOX"', 'parentTab === "MORE"',
  'section="RESULTS"', 'section="FEES"', 'parentAcademicsTab === "HOMEWORK"',
  'parentInboxTab === "ANNOUNCEMENTS"',
  "ParentTimetableContent", "ParentNotificationsContent"
]) assert.ok(app.includes(marker),"Missing parent section: "+marker);
assert.ok(!app.includes('parentTab === "HOMEWORK"') && !app.includes('parentTab === "ANNOUNCEMENTS"'),
  "Obsolete bottom-tab conditions must be removed");
assert.ok(app.includes("parentHomeRequestId") &&
  app.includes("parentNotificationsRequestId") &&
  app.includes("parentChildLoadRequestId.current += 1;") &&
  app.includes("sessionRef.current?.accessToken === accessToken") &&
  app.includes("selectedChildIdRef.current === studentId") &&
  app.includes("isCurrentParentChildRequest(accessToken, studentId, requestId)"),
  "Parent requests must reject stale session and switched-child responses");
assert.ok(app.includes("Promise.allSettled([") &&
  app.includes("api.parentFees(accessToken, studentId)"),
  "Communication and fee read failures must not block each other");
assert.ok(app.includes('destination === "PARENT_RESULTS"') &&
  app.includes('setParentAcademicsTab("RESULTS")') &&
  app.includes('destination === "PARENT_FEES"') &&
  destination.includes('"PARENT_FEES"'),
  "Parent notification destinations must target correct parent pages");
assert.ok(inbox.includes("formatLocalizedDate(item.createdAt") &&
  inbox.includes("onMarkAllRead") && inbox.includes("accessibilityRole=\"button\""),
  "Inbox must preserve read and notification navigation behavior");
assert.ok(timetable.includes("formatLocalizedTimeRange") &&
  timetable.includes("item.period.weekday"),
  "Timetable must display actual authenticated child periods");
for(const key of [
  "parent.navAcademics","parent.navAttendance","parent.navInbox",
  "parent.navTimetable","parent.noTimetable"
]){
  const marker=JSON.stringify(key)+":";
  assert.ok(messages.split(marker).length===4,
    "Parent navigation must translate "+key+" in English, Dari and Pashto");
}
assert.ok(messages.includes('calendar = locale === "en" ? "gregory" : "persian"'),
  "Dari/Pashto must still use Solar Hijri");
console.log("Parent Experience Phase 1: five-tab shell, persistent child switcher, stale response isolation, deep links, RTL and translations verified.");
