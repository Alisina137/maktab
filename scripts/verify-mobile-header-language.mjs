#!/usr/bin/env node
// Regression: logged-in student/teacher/parent screens must use More/Preferences
// as their language selector; public role/school/login onboarding keeps header picker.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=read("apps/mobile/App.tsx");
const headerStart=app.indexOf("<View style={styles.topbar}>");
const headerEnd=app.indexOf("<OnboardingProgress screen={screen} />",headerStart);
assert.ok(headerStart>=0&&headerEnd>headerStart,"Shared mobile header must remain present.");
const header=app.slice(headerStart,headerEnd);

// For all three signed-in roles, the common header renders the brand only.
// Student may also render the notification bell; signed-out/onboarding retains
// the menu to support language selection before creating or using an account.
assert.ok(header.includes("{(showStudentNavigation || !session) ? ("),
  "Header actions must be absent for signed-in Teacher/Parent unless needed.");
assert.ok(header.includes("{!session ? (\n          <View style={styles.languageSelectWrap}>"),
  "Header locale selector must be rendered ONLY when there is no active session.");
assert.ok(header.includes('testID="student-header-notifications"'),
  "Student unread notification bell must not be removed.");
assert.ok(header.includes('studentNotificationUnread(studentNotifications)'),
  "Student notification unread indicator must be retained.");
assert.ok(header.includes("styles.brandRow")&&header.includes('translate(locale, "app.name")'),
  "Brand/logo should remain visible for all logged-in roles.");
assert.equal(header.match(/<View style={styles.languageSelectWrap}>/g)?.length,1,
  "There must be exactly one conditional header language picker.");
assert.equal(header.match(/languageMenuOpen \? \(/g)?.length,1,
  "Header locale popup should only be shown for the onboarding selector.");

// All role-specific destinations already have functioning locale settings;
// preserve the destination and persistence wiring when trimming shared UI.
assert.ok(app.includes('onSelectLocale={chooseLocale}'),
  "Parent More → Preferences must retain locale switching.");
assert.ok(app.includes('onLocaleChange={chooseLocale}'),
  "Student More and Teacher More must retain locale switching.");
assert.ok(app.includes('void savePreferredLocale(value)'),
  "Changed language must still persist to SecureStore.");
assert.ok(app.includes('loadPreferredLocale()'),
  "Saved locale must still be restored on next launch.");
const student=read("apps/mobile/src/student-more.tsx");
assert.ok(student.includes('onPress={()=>onLocaleChange(next)}') &&
  student.includes("supportedLocales.map"),
  "Student More → Settings must offer all three languages.");
const parent=read("apps/mobile/src/parent-more.tsx");
assert.ok(parent.includes('onPress={()=>onSelectLocale(code)}') &&
  parent.includes("supportedLocales.map"),
  "Parent More → Preferences must offer all three languages.");
const teacher=read("apps/mobile/src/teacher-more.tsx");
assert.ok(teacher.includes('onPress={()=>onChangeLocale(next)}') &&
  teacher.includes("supportedLocales.map"),
  "Teacher More → Profile must offer all three languages.");

console.log("Mobile shared header: locale picker limited to sign-out/onboarding; student bell and all More-language settings preserved.");
