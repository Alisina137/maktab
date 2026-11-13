/** Deterministic five-row Staff registration queue pagination. */
export function registrationQueuePage<T extends { status: string }>(
  rows: readonly T[],
  filter: string,
  requestedPage: number,
  pageSize = 5
) {
  const filtered = filter === "ALL" ? [...rows] : rows.filter(row => row.status === filter);
  const safeSize = Number.isInteger(pageSize) && pageSize > 0 && pageSize <= 50 ? pageSize : 5;
  const pages = Math.max(1, Math.ceil(filtered.length / safeSize));
  const page = Number.isFinite(requestedPage)
    ? Math.max(1, Math.min(pages, Math.floor(requestedPage)))
    : 1;
  const startIndex = (page - 1) * safeSize;
  const items = filtered.slice(startIndex, startIndex + safeSize);
  return {
    items,
    page,
    pages,
    total: filtered.length,
    start: filtered.length ? startIndex + 1 : 0,
    end: startIndex + items.length
  };
}
