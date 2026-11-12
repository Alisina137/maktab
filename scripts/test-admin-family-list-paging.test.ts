import assert from "node:assert/strict";
import test from "node:test";
import { paginateFamilyRows, FAMILY_LIST_PAGE_SIZE } from
  "../apps/web/app/admin/family-list-paging";

const records = Array.from({ length: 23 }, (_, index) => ({ id: index + 1 }));

test("five rows per page for both parent and student account lists", () => {
  assert.equal(FAMILY_LIST_PAGE_SIZE, 5);
  assert.deepEqual(paginateFamilyRows(records, 1).items.map((row) => row.id), [1,2,3,4,5]);
  assert.deepEqual(paginateFamilyRows(records, 2).items.map((row) => row.id), [6,7,8,9,10]);
  assert.deepEqual(paginateFamilyRows(records, 5).items.map((row) => row.id), [21,22,23]);
  assert.equal(paginateFamilyRows(records, 5).pages, 5);
  assert.deepEqual(
    [1,2,3,4,5].flatMap((page) => paginateFamilyRows(records,page).items.map((row)=>row.id)),
    records.map((row)=>row.id)
  );
});

test("filter first, then page, without repeating or skipping matches", () => {
  const odd = records.filter((row) => row.id % 2 === 1);
  const p1 = paginateFamilyRows(odd, 1), p2 = paginateFamilyRows(odd, 2);
  assert.deepEqual(p1.items.map((row) => row.id), [1,3,5,7,9]);
  assert.deepEqual(p2.items.map((row) => row.id), [11,13,15,17,19]);
  assert.equal(p2.total, 12);
  assert.equal(p2.start, 6);
  assert.equal(p2.end, 10);
});

test("empty lists, single pages, deleted rows and invalid page numbers clamp", () => {
  assert.deepEqual(paginateFamilyRows([], 4), {
    items: [], page: 1, pages: 1, total: 0, start: 0, end: 0
  });
  assert.equal(paginateFamilyRows(records.slice(0, 3), 7).page, 1);
  assert.deepEqual(paginateFamilyRows(records.slice(0, 3), 7).items.map((r) => r.id), [1,2,3]);
  assert.equal(paginateFamilyRows(records.slice(0, 8), 5).page, 2);
  assert.equal(paginateFamilyRows(records, -3).page, 1);
  assert.equal(paginateFamilyRows(records, Number.NaN).page, 1);
  assert.equal(paginateFamilyRows(records, 1.2).page, 1);
  assert.equal(paginateFamilyRows(records, 100).page, 5);
  assert.equal(paginateFamilyRows(records.slice(0,5), 1).pages, 1);
  assert.equal(paginateFamilyRows(records.slice(0,6), 1).pages, 2);
});
