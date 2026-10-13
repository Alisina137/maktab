import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

interface JournalEntry { idx: number; tag: string; when: number }

test("Step 20: the complete migration journal applies in order to a fresh PostgreSQL-compatible database", async (t) => {
  const journal = JSON.parse(
    await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8")
  ) as { entries: JournalEntry[] };
  assert.ok(journal.entries.length >= 20, "Expected all Phase 1–Step 17 schema migrations");
  assert.equal(new Set(journal.entries.map((entry) => entry.tag)).size, journal.entries.length,
    "Migration journal tags must be unique");
  const client = new PGlite();
  t.after(async () => client.close());

  for (const [position, entry] of journal.entries.entries()) {
    assert.equal(entry.idx, position, `Migration index mismatch for ${entry.tag}`);
    if (position > 0) {
      assert.ok(entry.when > journal.entries[position - 1]!.when,
        `Migration timestamps must increase: ${entry.tag}`);
    }
    const filename = `${entry.tag}.sql`;
    const sql = await readFile(new URL(`../drizzle/${filename}`, import.meta.url), "utf8");
    assert.ok(sql.trim().length > 0, `Empty migration: ${filename}`);
    try {
      await client.exec(sql.replaceAll("--> statement-breakpoint", ""));
    } catch (error) {
      throw new Error(`Full migration chain failed at ${filename}`, { cause: error });
    }
  }

  const columns = await client.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'fee_payments' AND column_name = 'idempotency_key'
  `);
  assert.equal(columns.rows.length, 1, "Step 17 payment retry column missing");

  const examDate = await client.query<{ column_name: string }>(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'exam_subjects' AND column_name = 'exam_date'
  `);
  assert.equal(examDate.rows.length, 1, "Step 15 exam date column missing");

  const indexes = await client.query<{ indexname: string }>(`
    SELECT indexname FROM pg_indexes
    WHERE indexname IN ('fee_payments_idempotency_unique', 'teacher_assignments_unique')
  `);
  assert.deepEqual(indexes.rows.map((row) => row.indexname).sort(),
    ["fee_payments_idempotency_unique", "teacher_assignments_unique"]);
});
