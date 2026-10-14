/** Pure, testable guards for the Admin Accounts directory.
 * The API remains responsible for school permissions and write validation.
 */
export type AccountSelectionCandidate = {
  id: string;
  role: "SCHOOL_ADMIN" | "SCHOOL_STAFF" | "TEACHER" | "PARENT" | "STUDENT";
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
};

export const MAX_ACCOUNT_BULK_SELECTION = 20;

export function isSelectableAccount(user: AccountSelectionCandidate, adminId: string): boolean {
  return user.id !== adminId && user.role !== "SCHOOL_ADMIN" &&
    (user.status === "ACTIVE" || user.status === "INVITED" || user.status === "SUSPENDED");
}

export function updateAccountSelection(
  current: ReadonlySet<string>,
  ids: readonly string[],
  checked: boolean,
  visibleUsers: readonly AccountSelectionCandidate[],
  adminId: string
): Set<string> {
  // Never keep off-page or ineligible accounts, even after network refresh.
  const eligibleVisible = new Set(visibleUsers.filter((user) => isSelectableAccount(user, adminId)).map((user) => user.id));
  const next = new Set([...current].filter((id) => eligibleVisible.has(id)));
  for (const id of ids) {
    if (!eligibleVisible.has(id)) continue;
    if (!checked) next.delete(id);
    else if (next.size < MAX_ACCOUNT_BULK_SELECTION) next.add(id);
  }
  return next;
}

export function shouldAcceptAccountDirectoryResult(
  requestedToken: string,
  requestedQuery: string,
  currentToken: string,
  currentQuery: string,
  aborted: boolean
): boolean {
  return !aborted && requestedToken === currentToken && requestedQuery === currentQuery.trim();
}
