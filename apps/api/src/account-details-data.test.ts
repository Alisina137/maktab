import assert from "node:assert/strict";
import test from "node:test";
import {
  accountFamilyDetails, accountTeacherDetails,
  type AccountFamilyOverview, type AccountAcademicOverview
} from "../../web/app/admin/account-details-data.js";

const families: AccountFamilyOverview = {
  parents: [
    { user: { id: "p1", username: "parent1" }, profile: { userId: "p1", fullName: "Parent One", phone: null }, childCount: 2 },
    { user: { id: "p2", username: "parent2" }, profile: { userId: "p2", fullName: "Parent Two", phone: null }, childCount: 1 }
  ],
  students: [
    { student: { id: "s1", userId: "login1", parentUserId: "p1", studentCode: "ST01", fullName: "Child One", phone: null, status: "ACTIVE" }, classSection: { id: "c1", code: "7A", name: "Class 7" }, academicYear: { id: "y1", name: "2026", status: "ACTIVE" } },
    { student: { id: "s2", userId: "login2", parentUserId: "p1", studentCode: "ST02", fullName: "Child Two", phone: null, status: "ACTIVE" }, classSection: { id: "c1", code: "7A", name: "Class 7" }, academicYear: { id: "y1", name: "2026", status: "ACTIVE" } },
    { student: { id: "s3", userId: "login3", parentUserId: "p2", studentCode: "ST03", fullName: "Unrelated", phone: null, status: "ACTIVE" }, classSection: { id: "c2", code: "8A", name: "Class 8" }, academicYear: { id: "y1", name: "2026", status: "ACTIVE" } }
  ]
};

test("Phase 3 account details: parent lists only explicitly linked children", () => {
  const result = accountFamilyDetails("p1", families);
  assert.deepEqual(result.children.map((row) => row.student.id), ["s1", "s2"]);
  assert.equal(result.student, null);
  assert.equal(result.parent, null);
});

test("Phase 3 account details: student joins only its own login and linked parent", () => {
  const result = accountFamilyDetails("login3", families);
  assert.equal(result.children.length, 0);
  assert.equal(result.student?.student.fullName, "Unrelated");
  assert.equal(result.parent?.profile.userId, "p2");
  assert.notEqual(result.parent?.profile.userId, "p1");
  assert.deepEqual(accountFamilyDetails("not-a-user", families), { children: [], student: null, parent: null });
  assert.deepEqual(accountFamilyDetails("login3", null), { children: [], student: null, parent: null });
});

const academics: AccountAcademicOverview = {
  academicYears: [{ id: "y1", name: "2026" }],
  classes: [{ id: "c1", code: "7A", name: "Class 7" }, { id: "c2", code: "8A", name: "Class 8" }],
  subjects: [{ id: "sub1", code: "MATH", name: "Mathematics" }],
  teachers: [
    { userId: "t1", employeeCode: "T001", fullName: "Teacher One", phone: null },
    { userId: "t2", employeeCode: "T002", fullName: "Teacher Two", phone: null }
  ],
  assignments: [
    { teacherUserId: "t1", academicYearId: "y1", classId: "c1", subjectId: "sub1" },
    { teacherUserId: "t2", academicYearId: "y1", classId: "c2", subjectId: "sub1" }
  ],
  negaranAssignments: [
    { teacherUserId: "t1", academicYearId: "y1", classId: "c1", startDate: "2026-09-01", endDate: null },
    { teacherUserId: "t2", academicYearId: "y1", classId: "c2", startDate: "2026-09-01", endDate: null }
  ]
};

test("Phase 3 account details: teacher assignments and Negaran remain scoped to selected teacher", () => {
  const result = accountTeacherDetails("t1", academics);
  assert.equal(result.profile?.employeeCode, "T001");
  assert.deepEqual(result.assignments, [{ year: "2026", className: "Class 7 · 7A", subject: "Mathematics" }]);
  assert.deepEqual(result.supervision, [{ year: "2026", className: "Class 7 · 7A", startDate: "2026-09-01", endDate: null }]);
  assert.deepEqual(accountTeacherDetails("t3", academics), { profile: null, assignments: [], supervision: [] });
  assert.deepEqual(accountTeacherDetails("t1", null), { profile: null, assignments: [], supervision: [] });
});
