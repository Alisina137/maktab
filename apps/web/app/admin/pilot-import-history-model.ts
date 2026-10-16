/** Phase 3: fail-closed, read-only normalization of school-only import history.
 * Counts in this model describe the CURRENT SERVER PAGE, never an all-time total.
 * The server derives school scope from the authenticated session.
 */
export type ImportEntity = "PARENT" | "STUDENT" | "TEACHER";
export type ImportOutcome = "COMPLETED" | "REJECTED" | "FAILED";
export type ImportHistoryRow = {
  id: string;
  entityType: ImportEntity;
  status: ImportOutcome;
  rowCount: number;
  importedCount: number;
  rejectedCount: number;
  createdAt: string;
  actorUsername: string | null;
};
export type ImportHistoryPage = {
  rows: ImportHistoryRow[];
  limit: number;
  offset: number;
  hasMore: boolean;
};
export type ImportPageInsights = {
  batches: number;
  completed: number;
  rejected: number;
  failed: number;
  importedRows: number;
  rejectedRows: number;
  rowStart: number;
  rowEnd: number;
  morePages: boolean;
};
function record(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new Error("Invalid history response.");
  return x as Record<string, unknown>;
}
function integer(x: unknown, max: number): number {
  if (!Number.isSafeInteger(x) || (x as number) < 0 || (x as number) > max)
    throw new Error("Invalid history count.");
  return x as number;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const entitySet = new Set<string>(["PARENT", "STUDENT", "TEACHER"]);
const statusSet = new Set<string>(["COMPLETED", "REJECTED", "FAILED"]);
export function parseImportHistoryPage(
  raw: unknown, requestedOffset: number, requestedLimit: number
): ImportHistoryPage {
  const obj = record(raw);
  const offset = integer(obj.offset, 1_000_000);
  const limit = integer(obj.limit, 50);
  if (offset !== requestedOffset || limit !== requestedLimit || limit === 0 ||
      typeof obj.hasMore !== "boolean" || !Array.isArray(obj.rows) ||
      obj.rows.length > limit || (obj.hasMore && obj.rows.length !== limit))
    throw new Error("Unexpected import history page.");
  const seen = new Set<string>();
  const rows = obj.rows.map((rawRow): ImportHistoryRow => {
    const r = record(rawRow);
    if (typeof r.id !== "string" || !UUID.test(r.id) || seen.has(r.id) ||
        typeof r.entityType !== "string" || !entitySet.has(r.entityType) ||
        typeof r.status !== "string" || !statusSet.has(r.status) ||
        typeof r.createdAt !== "string" || !Number.isFinite(Date.parse(r.createdAt)) ||
        (r.actorUsername !== null && typeof r.actorUsername !== "string"))
      throw new Error("Unexpected import history row.");
    seen.add(r.id);
    const rowCount = integer(r.rowCount, 1_000_000);
    const importedCount = integer(r.importedCount, 1_000_000);
    const rejectedCount = integer(r.rejectedCount, 1_000_000);
    if (importedCount > rowCount || rejectedCount > rowCount ||
        importedCount + rejectedCount > rowCount)
      throw new Error("Contradictory import counts.");
    return { id: r.id, entityType: r.entityType as ImportEntity,
      status: r.status as ImportOutcome, rowCount, importedCount, rejectedCount,
      createdAt: r.createdAt, actorUsername: r.actorUsername };
  });
  return { rows, limit, offset, hasMore: obj.hasMore };
}
export function importPageInsights(page: ImportHistoryPage): ImportPageInsights {
  const by = (status: ImportOutcome) => page.rows.filter(row => row.status === status).length;
  return {
    batches: page.rows.length,
    completed: by("COMPLETED"), rejected: by("REJECTED"), failed: by("FAILED"),
    importedRows: page.rows.reduce((sum, row) => sum + row.importedCount, 0),
    rejectedRows: page.rows.reduce((sum, row) => sum + row.rejectedCount, 0),
    rowStart: page.rows.length ? page.offset + 1 : 0,
    rowEnd: page.offset + page.rows.length,
    morePages: page.hasMore
  };
}
