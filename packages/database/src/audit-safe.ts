/**
 * Public-school-admin audit payloads are never a free-form dump of raw metadata.
 * Credentials, 2FA codes, contact details, raw diffs and integration tokens must
 * not leave the server through audit views or core school exports.
 */
export function safeAuditMetadata(metadata: unknown): Record<string, string | number | boolean> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const source = metadata as Record<string, unknown>;
  const allowed = ["reason", "role", "status", "bulk", "count", "entityType", "importedCount", "rejectedCount"] as const;
  const result: Record<string, string | number | boolean> = {};
  for (const key of allowed) {
    const value = source[key];
    if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
      result[key] = value;
    } else if (typeof value === "string" && value.length <= 500) {
      result[key] = value;
    }
  }
  return result;
}

/** Category prefixes are intentionally explicit; uncategorized events fall under operations. */
const auditPrefixes: Record<string, readonly string[]> = {
  accounts: ["user.", "admin.", "auth.", "parent.", "student.", "teacher."],
  academics: ["academic.", "class.", "subject.", "timetable.", "assignment.", "negaran."],
  attendance: ["attendance."],
  learning: ["homework.", "exam.", "grade.", "result.", "learning."],
  communication: ["announcement.", "notification.", "communication."],
  fees: ["fee.", "payment.", "invoice."],
  operations: ["school.", "subscription.", "pilot.", "export.", "import."]
};
export type AuditCategory = keyof typeof auditPrefixes | "all";
export const auditCategoryOptions = [...Object.keys(auditPrefixes), "all"] as const;

export function categorizeAuditAction(action: string): string {
  for (const [category, prefixes] of Object.entries(auditPrefixes)) {
    if (prefixes.some(prefix => action.toLowerCase().startsWith(prefix))) return category;
  }
  return "operations";
}
