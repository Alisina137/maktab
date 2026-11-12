/** Shared, bounded client-side paging for the school's filtered family lists.
 * Pagination is applied AFTER filtering. Out-of-range pages clamp when rows
 * are removed, a school changes, or the academic year is switched.
 */
export const FAMILY_LIST_PAGE_SIZE = 5;

export function paginateFamilyRows<T>(rows: readonly T[], requestedPage: number) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / FAMILY_LIST_PAGE_SIZE));
  const normalized = Number.isSafeInteger(requestedPage) ? requestedPage : 1;
  const page = Math.min(pages, Math.max(1, normalized));
  const offset = (page - 1) * FAMILY_LIST_PAGE_SIZE;
  const items = rows.slice(offset, offset + FAMILY_LIST_PAGE_SIZE);
  return {
    items,
    page,
    pages,
    total,
    start: total ? offset + 1 : 0,
    end: total ? offset + items.length : 0
  };
}
