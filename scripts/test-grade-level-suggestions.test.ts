import assert from "node:assert/strict";
import test from "node:test";
import { nextAvailableGradeNumber, matchingNewGradeNumber, usedGradeNumbers } from
  "../apps/web/app/admin/grade-level-suggestions";

const row = (code: string, name: string) => ({ code, name });

test("suggests matching G-x, Grade x and x, starting at one", () => {
  assert.equal(nextAvailableGradeNumber([]), 1);
  assert.equal(nextAvailableGradeNumber([row("G-1", "Grade 1")]), 2);
  assert.equal(nextAvailableGradeNumber([row("G-1", "Grade 1"), row("G-2", "Grade 2")]), 3);
});

test("skips occupied numbers without skipping a free gap", () => {
  assert.equal(nextAvailableGradeNumber([
    row("G-1","Grade 1"),row("G-3","Grade 3"),row("G-4","Grade 4")
  ]), 2);
  assert.equal(nextAvailableGradeNumber([row("G-2","Grade 2")]), 1);
});

test("legacy G7, G-007 and Grade 8 names reserve their numeric grades", () => {
  const grades = [
    row("G7", "Legacy 7"), row("g-002", "Old grade"), row("Other","Grade 3"),
    row("G-0001","Grade one"), row("G-8", "Grade 8")
  ];
  assert.equal(nextAvailableGradeNumber(grades), 4);
  assert.deepEqual([...usedGradeNumbers(grades)].sort((a,b)=>a-b), [1,2,3,7,8]);
});

test("new code and name must share x and have no padding", () => {
  for (const x of [1,2,7,10,100]) assert.equal(matchingNewGradeNumber(`G-${x}`, `Grade ${x}`), x);
  for (const [code, name] of [
    ["G-1","Grade 2"], ["G-001","Grade 1"], ["G1","Grade 1"],
    ["G-0","Grade 0"], ["G-101","Grade 101"], ["g-1","Grade 1"],
    ["G-3","Grade 03"], ["G-3","صنف 3"]
  ]) assert.equal(matchingNewGradeNumber(code, name), null);
});

test("reports no available grade when all 100 are occupied", () => {
  assert.equal(nextAvailableGradeNumber(Array.from({length:100}, (_,i)=>row(`G-${i+1}`, `Grade ${i+1}`))), null);
});
