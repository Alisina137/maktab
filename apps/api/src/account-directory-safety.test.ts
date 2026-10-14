import assert from "node:assert/strict";
import test from "node:test";
import {
  isSelectableAccount,
  updateAccountSelection,
  MAX_ACCOUNT_BULK_SELECTION,
  shouldAcceptAccountDirectoryResult,
  type AccountSelectionCandidate
} from "../../web/app/admin/account-directory-safety.js";

const user = (index: number, status: AccountSelectionCandidate["status"] = "ACTIVE"): AccountSelectionCandidate => ({
  id: `user-${index}`, role: "TEACHER", status
});

test("Phase 6: selection is capped to 20 and cannot retain off-page users", () => {
  const page = Array.from({ length: 50 }, (_, index) => user(index));
  const selected = updateAccountSelection(new Set(), page.map((entry) => entry.id), true, page, "admin");
  assert.equal(selected.size, MAX_ACCOUNT_BULK_SELECTION);
  assert.deepEqual([...selected], page.slice(0, 20).map((entry) => entry.id));

  const nextPage = Array.from({ length: 10 }, (_, index) => user(50 + index));
  const moved = updateAccountSelection(selected, [nextPage[0]!.id], true, nextPage, "admin");
  assert.deepEqual([...moved], [nextPage[0]!.id]);

  const deselected = updateAccountSelection(moved, [nextPage[0]!.id], false, nextPage, "admin");
  assert.equal(deselected.size, 0);
});

test("Phase 6: current admin, other admins and archived users cannot be selected", () => {
  const page: AccountSelectionCandidate[] = [
    user(1), { id: "admin", role: "SCHOOL_ADMIN", status: "ACTIVE" },
    { id: "admin2", role: "SCHOOL_ADMIN", status: "ACTIVE" },
    user(2, "ARCHIVED"), user(3, "SUSPENDED")
  ];
  assert.equal(isSelectableAccount(page[0]!, "admin"), true);
  assert.equal(isSelectableAccount(page[1]!, "admin"), false);
  assert.equal(isSelectableAccount(page[2]!, "admin"), false);
  assert.equal(isSelectableAccount(page[3]!, "admin"), false);
  assert.equal(isSelectableAccount(page[4]!, "admin"), true);
  const selected = updateAccountSelection(new Set(page.map((entry) => entry.id)), [], true, page, "admin");
  assert.deepEqual([...selected], ["user-1", "user-3"]);
});

test("Phase 6: stale query results, aborted requests and previous-school responses are ignored", () => {
  assert.equal(shouldAcceptAccountDirectoryResult("token-a", "parent",
    "token-a", "parent", false), true);
  assert.equal(shouldAcceptAccountDirectoryResult("token-a", "parent",
    "token-a", "parentx", false), false);
  assert.equal(shouldAcceptAccountDirectoryResult("token-a", "parent",
    "token-b", "parent", false), false);
  assert.equal(shouldAcceptAccountDirectoryResult("token-a", "parent",
    "token-a", "parent", true), false);
  assert.equal(shouldAcceptAccountDirectoryResult("token-a", "parent",
    "token-a", " parent ", false), true);
});
