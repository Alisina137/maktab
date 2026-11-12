import assert from "node:assert/strict";
import test from "node:test";
import {
  classGradeNumber, matchingClassLetter, nextAvailableClassIdentity, occupiedClassLetters,
  type ClassGrade, type ClassIdentity
} from "../apps/web/app/admin/class-section-suggestions";

const grade = (number: number, code = "G-" + number): ClassGrade => ({
  id: "grade-" + number, code, name: "Grade " + number, sortOrder: number
});
const row = (id: string, code: string, name: string, gradeNumber = 7): ClassIdentity => ({
  id, code, name, gradeLevelId: "grade-" + gradeNumber
});

test("selecting grade suggests grade-A and Class gradeA", () => {
  assert.deepEqual(nextAvailableClassIdentity(grade(1), []), { code: "1-A", name: "Class 1A", letter: "A" });
  assert.deepEqual(nextAvailableClassIdentity(grade(7), []), { code: "7-A", name: "Class 7A", letter: "A" });
  assert.deepEqual(nextAvailableClassIdentity(grade(10), []), { code: "10-A", name: "Class 10A", letter: "A" });
});

test("letters advance alphabetically, skip existing sections, and fill free gaps", () => {
  const existing = [
    row("a", "7-A", "Class 7A"), row("c", "7-C", "Class 7C"),
    row("other-grade", "8-A", "Class 8A", 8)
  ];
  assert.deepEqual(nextAvailableClassIdentity(grade(7), existing),
    { code: "7-B", name: "Class 7B", letter: "B" });
  assert.deepEqual(nextAvailableClassIdentity(grade(8), existing),
    { code: "8-B", name: "Class 8B", letter: "B" });
  assert.deepEqual(nextAvailableClassIdentity(grade(9), existing),
    { code: "9-A", name: "Class 9A", letter: "A" });
});

test("legacy class codes and names reserve the matching letter", () => {
  const old = [
    row("one", "7A", "Grade 7 A"), row("two", "7-B", "Legacy B"),
    row("three", "OTHER", "Class 7C"), row("four", "9-A", "Class 9A")
  ];
  assert.deepEqual([...occupiedClassLetters(7, old)].sort(), ["A","B","C"]);
  assert.deepEqual(nextAvailableClassIdentity(grade(7), old),
    { code: "7-D", name: "Class 7D", letter: "D" });
});

test("editing can exclude current class and preserve existing values", () => {
  const classes = [row("current", "7-A", "Class 7A"), row("other", "7-B", "Class 7B")];
  assert.deepEqual(nextAvailableClassIdentity(grade(7), classes, "current"),
    { code: "7-A", name: "Class 7A", letter: "A" });
  assert.deepEqual(nextAvailableClassIdentity(grade(7), classes),
    { code: "7-C", name: "Class 7C", letter: "C" });
});

test("validates same number and letter with the exact canonical format", () => {
  assert.equal(matchingClassLetter(grade(7), "7-A", "Class 7A"), "A");
  assert.equal(matchingClassLetter(grade(10), "10-Z", "Class 10Z"), "Z");
  for (const [code,name] of [
    ["7A","Class 7A"],["7-A","Class 7B"],["8-A","Class 8A"],
    ["7-a","Class 7a"],["7-AA","Class 7AA"],["07-A","Class 7A"],
    ["7-A","Grade 7 A"]
  ]) assert.equal(matchingClassLetter(grade(7), code, name), null);
});

test("supports old G7 grade codes and sort-order fallback", () => {
  assert.equal(classGradeNumber(grade(7,"G7")), 7);
  assert.equal(classGradeNumber(grade(7,"LEGACY")), 7);
  assert.equal(classGradeNumber({id:"old",code:"OLD",name:"Other",sortOrder:5}), 5);
  assert.equal(classGradeNumber({id:"bad",code:"OLD",name:"Other",sortOrder:0}), null);
});

test("stops suggestions when all 26 class letters are used", () => {
  const all = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ", (letter) =>
    row(letter, "7-" + letter, "Class 7" + letter));
  assert.equal(nextAvailableClassIdentity(grade(7),all), null);
  assert.deepEqual(nextAvailableClassIdentity(grade(8),all),
    { code:"8-A", name:"Class 8A", letter:"A" });
});
