import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const model=read("apps/mobile/src/student-records-model.ts");
const calendar=read("apps/mobile/src/student-attendance.tsx");
const fees=read("apps/mobile/src/student-fees.tsx");
const more=read("apps/mobile/src/student-more.tsx");
const app=read("apps/mobile/App.tsx");
const api=read("apps/mobile/src/api.ts");
const backend=read("apps/api/src/attendance/routes.ts");
const store=read("packages/database/src/attendance-store.ts");
const l10n=read("packages/localization/src/index.ts");
const tests=read("scripts/test-student-records-phase6.ts");
const pkg=JSON.parse(read("package.json"));
const workflow=read(".github/workflows/student-navigation.yml");
const ci=read(".github/workflows/ci.yml");

for(const k of ["studentVisibleAttendance(","studentAttendanceSummary(","studentAttendanceWeekdays(",
 "studentCalendarOffset(","studentVisibleFees(","studentFeeSummary(","studentFilterFees(",
 "studentSortedPayments(","studentAttendanceStatus"]){
 assert.ok(model.includes(k),"Phase 6 records model missing "+k);
}
for(const k of ['testID="student-attendance-phase6"',"api.studentAttendance(accessToken,month.from,month.to)",
 'attendanceMonth(anchor,locale)',"studentVisibleAttendance(","studentAttendanceSummary(",
 "studentAttendanceWeekdays(locale)","studentCalendarOffset(month.from,locale)",
 "student.attendanceRateHelp","student.attendanceNoRecords"]){
 assert.ok(calendar.includes(k),"Phase 6 attendance screen missing "+k);
}
for(const k of ['testID="student-fees-phase6"',"api.studentFees(accessToken,true)",
 "studentVisibleFees(value.invoices,studentId)","studentFeeSummary(rows)",
 "studentFilterFees(rows,filter)","studentSortedPayments(row)",
 "student.feeReadOnly","student.feeContactSchool"]){
 assert.ok(fees.includes(k),"Phase 6 fee screen missing "+k);
}
for(const k of ['testID="student-more-records"','onOpenRecords:(tab:"ATTENDANCE"|"FEES")=>void;',
 "student.attendanceTitle","student.feeTitle"]){
 assert.ok(more.includes(k),"Phase 6 More link missing "+k);
}
for(const k of ['"student-attendance"','"student-fees"','<StudentAttendanceContent',
 '<StudentFeesContent','onOpenRecords={(tab)=>','session?.user.role === "STUDENT"',
 '!studentEnrollmentUnavailable']){
 assert.ok(app.includes(k),"Phase 6 App route or role guard missing "+k);
}
assert.ok(api.includes("/v1/student/attendance?from="));
assert.ok(api.includes("studentFees(accessToken: string, fresh = false)"));
assert.ok(backend.includes('"/v1/student/attendance"'));
assert.ok(backend.includes('context.user.role!=="STUDENT"'));
assert.ok(backend.includes("attendance.getStudentAttendance("));
assert.ok(store.includes("async getStudentAttendance("));
assert.ok(store.includes("eq(students.userId,studentUserId)"));
assert.ok(store.includes("eq(students.status,\"ACTIVE\")"));
assert.ok(store.includes("eq(dailyAttendances.academicYearId,student.academicYearId)"));
assert.ok(store.includes("eq(dailyAttendances.classId,student.classId)"));
assert.ok(!calendar.includes("submitDailyAttendance("));
assert.ok(!fees.includes("submitPayment("));
for(const k of [
 "student.recordsTitle","student.recordsHint","student.attendanceTitle",
 "student.attendanceHint","student.feeTitle","student.feeHint",
 "student.attendanceCalendar","student.attendanceExplanation",
 "student.recordsLoadError","student.recordsRetry","student.attendanceSummary",
 "student.attendanceRate","student.attendanceRateHelp","student.attendanceSelected",
 "student.attendanceHistory","student.attendanceNoRecords","student.feeOverview",
 "student.feeReadOnly","student.feeIssued","student.feePartiallyPaid",
 "student.feePaid","student.feeOverdue","student.feeCancelled",
 "student.feeAll","student.feeDue","student.feeTotal",
 "student.feeOutstanding","student.feeInvoiceCount",
 "student.feePaymentHistory","student.feeNoPayments",
 "student.feeNoInvoices","student.feeContactSchool"
]){
 assert.ok(l10n.includes('  | "'+k+'"'),"Phase 6 translation type missing "+k);
 assert.equal(l10n.split('"'+k+'":').length-1,3,"Missing 3 locales for "+k);
}
for(const phrase of ["only recorded school days","calendar uses Solar Hijri",
 "fees exclude other pupils","payment history is immutable"]){
 assert.ok(tests.includes(phrase),"Phase 6 test coverage missing "+phrase);
}
assert.ok(pkg.scripts["verify:student:phase6"]?.includes("verify:student:phase5"));
assert.ok(pkg.scripts["verify:student:phase6"]?.includes("test-student-records-phase6.ts"));
assert.ok(workflow.includes("run: pnpm verify:student:phase6") ||
  workflow.includes("run: pnpm verify:student:phase7"));
assert.ok(ci.includes("run: pnpm verify:student:phase6") ||
  ci.includes("run: pnpm verify:student:phase7"));
console.log("Student Phase 6 attendance, enrolled record privacy, fees ledger, locale and regressions verified.");
