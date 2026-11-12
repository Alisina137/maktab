/**
 * Phase 3 migration preflight: SELECT-only, no PII, no secrets, no data edits.
 * Run on a restored staging copy with baseline migrations through 0031.
 * Violations are counted, not repaired; operators decide remediation.
 */
import { config as loadEnv } from "dotenv";
import postgres from "postgres";
import { fileURLToPath } from "node:url";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

export const integrityChecks = [
  { name: "multiple_active_years", sql: `SELECT COUNT(*)::integer AS total FROM (SELECT school_id FROM academic_years WHERE status = 'ACTIVE' GROUP BY school_id HAVING COUNT(*) > 1) repeated` },
  { name: "class_foreign_year", sql: `SELECT COUNT(*)::integer AS total FROM class_sections c LEFT JOIN academic_years y ON c.academic_year_id = y.id AND c.school_id = y.school_id WHERE y.id IS NULL` },
  { name: "class_foreign_grade", sql: `SELECT COUNT(*)::integer AS total FROM class_sections c LEFT JOIN grade_levels g ON c.grade_level_id = g.id AND c.school_id = g.school_id WHERE g.id IS NULL` },
  { name: "parent_profile_school", sql: `SELECT COUNT(*)::integer AS total FROM parent_profiles p LEFT JOIN users u ON u.id = p.user_id AND u.school_id = p.school_id WHERE u.id IS NULL` },
  { name: "teacher_profile_school", sql: `SELECT COUNT(*)::integer AS total FROM teacher_profiles p LEFT JOIN users u ON u.id = p.user_id AND u.school_id = p.school_id WHERE u.id IS NULL` },
  { name: "student_parent_school", sql: `SELECT COUNT(*)::integer AS total FROM students s LEFT JOIN parent_profiles p ON s.parent_user_id = p.user_id AND s.school_id = p.school_id WHERE p.user_id IS NULL` },
  { name: "student_class_year", sql: `SELECT COUNT(*)::integer AS total FROM students s LEFT JOIN class_sections c ON s.class_id = c.id AND s.school_id = c.school_id AND s.academic_year_id = c.academic_year_id WHERE c.id IS NULL` },
  { name: "history_student_school", sql: `SELECT COUNT(*)::integer AS total FROM student_class_history h LEFT JOIN students s ON h.student_id = s.id AND h.school_id = s.school_id WHERE s.id IS NULL` },
  { name: "history_class_year", sql: `SELECT COUNT(*)::integer AS total FROM student_class_history h LEFT JOIN class_sections c ON h.class_id = c.id AND h.school_id = c.school_id AND h.academic_year_id = c.academic_year_id WHERE c.id IS NULL` },
  { name: "assignment_teacher_school", sql: `SELECT COUNT(*)::integer AS total FROM teacher_assignments a LEFT JOIN teacher_profiles p ON a.teacher_user_id = p.user_id AND a.school_id = p.school_id WHERE p.user_id IS NULL` },
  { name: "assignment_subject_school", sql: `SELECT COUNT(*)::integer AS total FROM teacher_assignments a LEFT JOIN subjects s ON a.subject_id = s.id AND a.school_id = s.school_id WHERE s.id IS NULL` },
  { name: "assignment_class_year", sql: `SELECT COUNT(*)::integer AS total FROM teacher_assignments a LEFT JOIN class_sections c ON a.class_id = c.id AND a.school_id = c.school_id AND a.academic_year_id = c.academic_year_id WHERE c.id IS NULL` },
  { name: "invoice_student_school", sql: `SELECT COUNT(*)::integer AS total FROM fee_invoices i LEFT JOIN students s ON i.student_id = s.id AND i.school_id = s.school_id WHERE s.id IS NULL` },
  { name: "payment_invoice_school", sql: `SELECT COUNT(*)::integer AS total FROM fee_payments p LEFT JOIN fee_invoices i ON p.invoice_id = i.id AND p.school_id = i.school_id WHERE i.id IS NULL` },
  { name: "session_user_school", sql: `SELECT COUNT(*)::integer AS total FROM auth_sessions s LEFT JOIN users u ON s.user_id = u.id AND s.school_id = u.school_id WHERE u.id IS NULL` },
  { name: "verification_user_school", sql: `SELECT COUNT(*)::integer AS total FROM admin_password_verifications v LEFT JOIN users u ON v.user_id = u.id AND v.school_id = u.school_id WHERE u.id IS NULL` }
];

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL must be configured.");
  }
  const db = postgres(connectionString, {
    max: 1, prepare: false, connect_timeout: 30, idle_timeout: 5
  });
  try {
    let violations = 0;
    // Wrap all checks in a single read-only snapshot of the staging database.
    await db.begin(async (tx) => {
      await tx.unsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
      for (const check of integrityChecks) {
        const [result] = await tx.unsafe(check.sql);
        const count = Number(result?.total ?? 0);
        if (!Number.isSafeInteger(count) || count < 0) {
          throw new Error("Invalid integrity count returned.");
        }
        violations += count;
        console.log(`[integrity] ${check.name}: ${count} ${count ? "FAIL" : "PASS"}`);
      }
    });
    if (violations > 0) {
      throw new Error(`${violations} integrity issue(s) must be investigated before migration 0032. No records were changed.`);
    }
    console.log("[integrity] PASS: no detected violations. A verified backup is still required before migrating.");
  } finally {
    await db.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((error) => {
  // Raw PostgreSQL errors can include connection or record details. Keep logs sanitized.
  console.error("[integrity] Preflight failed. Check database connectivity and migration 0031 baseline. " +
    (error instanceof Error && error.message.includes("integrity issue(s)")
      ? error.message : "No changes were made."));
  process.exitCode = 1;
});
