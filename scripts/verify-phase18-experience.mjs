#!/usr/bin/env node
// Phase 18 source integration guards; does not substitute for device tests.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8").replace(/\r\n/g,"\n");
const experience=read("apps/mobile/src/teacher-experience.tsx");
const hub=read("apps/mobile/src/teacher-hub.tsx");
const model=read("apps/mobile/src/teacher-phase8-model.ts");
const locale=read("packages/localization/src/index.ts");
const block=experience.slice(experience.indexOf("    const requestId=++hubRequestId.current;"),
  experience.indexOf("  async function markAllTeacherNotificationsRead()"));
assert.ok(block.includes("const isCurrent=()") && block.includes("if(!isCurrent())return;"));
for(const item of ["learning","announcements","notifications"]){
  assert.ok(block.includes('void loadResource("'+item+'"'),"Resource must settle independently: "+item);
  assert.ok(block.includes("setHubReady(previous=>({...previous,[key]:true}))"));
}
assert.ok(!block.includes("Promise.allSettled"),"Teacher inbox must not block on other resource fetches.");
assert.ok(block.includes("notificationSnapshot===notificationVersion.current"));
assert.ok(block.includes("notificationWrites.current=new Set<string>()"),"Replace old in-flight write Set on account change.");
assert.ok(experience.includes("notificationWrites.current===writes") &&
  experience.includes("currentScope.current===scope"),"Old notification mutation must not clobber new-account state.");
assert.ok(model.includes("export function teacherInboxMatches") &&
  hub.includes("teacherInboxMatches(notifications,filter,search).length") &&
  hub.includes("Math.min(available,value+30)"),"Inbox must not cut off at 100 notifications.");
assert.ok(!hub.includes("Math.min(100,value+30)"));
assert.ok(hub.includes('testID="teacher-inbox-refresh"') &&
  hub.includes('"teacher.inboxNoMatches"') &&
  hub.includes('"teacher.hubUnavailable"') &&
  experience.includes('onNotice(translate(locale,"teacher.notificationUnavailable"))'));
for(const key of ['"teacher.inboxNoMatches"','"teacher.inboxRefresh"','"teacher.notificationUnavailable"'])
  assert.equal(locale.split(key).length,5,"Every language must have "+key);
console.log("Phase 18 Teacher inbox independent loading, safe mutations, full pagination, localized recovery and navigation guards passed.");
