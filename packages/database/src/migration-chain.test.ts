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

  // Phase 3: actual SQL constraints, not just runtime/store checks, must
  // reject cross-school and cross-year edges (and competing ACTIVE years).
  const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const schoolA = uuid(1), schoolB = uuid(2);
  const yearA = uuid(3), yearA2 = uuid(4), yearB = uuid(5);
  const gradeA = uuid(6), gradeB = uuid(7);
  const classA = uuid(8), classA2 = uuid(9), classB = uuid(10);
  const parentA = uuid(11), parentB = uuid(12), adminA = uuid(13), adminB = uuid(14);
  const studentA = uuid(15), subjectA = uuid(16), invoiceA = uuid(17);

  for (const [schoolId, code] of [[schoolA, "PHASE3A"], [schoolB, "PHASE3B"]] as Array<[string, string]>) {
    await client.query(
      "INSERT INTO schools(id,code,name,slug,province,city) VALUES($1,$2,$3,$4,'Kabul','Kabul')",
      [schoolId, code, code, code.toLowerCase()]
    );
  }
  for (const [id, schoolId, name] of [
    [yearA, schoolA, "2026"], [yearA2, schoolA, "2027"], [yearB, schoolB, "2026"]
  ]) {
    await client.query(
      "INSERT INTO academic_years(id,school_id,name,start_date,end_date) VALUES($1,$2,$3,'2026-01-01','2027-12-31')",
      [id, schoolId, name]
    );
  }
  for (const [id, schoolId] of [[gradeA, schoolA], [gradeB, schoolB]]) {
    await client.query(
      "INSERT INTO grade_levels(id,school_id,code,name) VALUES($1,$2,'1','Grade One')",
      [id, schoolId]
    );
  }
  for (const [id, schoolId, year, grade, code] of [
    [classA, schoolA, yearA, gradeA, "1-A"],
    [classA2, schoolA, yearA2, gradeA, "1-B"],
    [classB, schoolB, yearB, gradeB, "1-A"]
  ]) {
    await client.query(
      "INSERT INTO class_sections(id,school_id,academic_year_id,grade_level_id,code,name) VALUES($1,$2,$3,$4,$5,'Class')",
      [id, schoolId, year, grade, code]
    );
  }
  for (const [id, schoolId, role] of [
    [parentA, schoolA, "PARENT"], [parentB, schoolB, "PARENT"],
    [adminA, schoolA, "SCHOOL_ADMIN"], [adminB, schoolB, "SCHOOL_ADMIN"]
  ]) {
    await client.query(
      "INSERT INTO users(id,school_id,username,password_hash,role) VALUES($1,$2,$3,'hash',$4)",
      [id, schoolId, id, role]
    );
  }
  for (const [id, schoolId] of [[parentA, schoolA], [parentB, schoolB]]) {
    await client.query(
      "INSERT INTO parent_profiles(user_id,school_id,full_name) VALUES($1,$2,'Parent')",
      [id, schoolId]
    );
  }

  await client.query("UPDATE academic_years SET status='ACTIVE' WHERE id=$1", [yearA]);
  await client.query("UPDATE academic_years SET status='ACTIVE' WHERE id=$1", [yearB]);
  await assert.rejects(
    client.query("UPDATE academic_years SET status='ACTIVE' WHERE id=$1", [yearA2]),
    /academic_years_one_active_per_school|duplicate key/i,
    "A second active year in one school must be refused by PostgreSQL"
  );
  await assert.rejects(
    client.query(
      "INSERT INTO class_sections(id,school_id,academic_year_id,grade_level_id,code,name) VALUES($1,$2,$3,$4,'1-Z','Cross tenant')",
      [uuid(18), schoolA, yearB, gradeA]
    ),
    /foreign key|violates/i,
    "A class cannot use another school's academic year"
  );
  await assert.rejects(
    client.query(
      "INSERT INTO students(id,school_id,parent_user_id,student_code,full_name,academic_year_id,class_id) VALUES($1,$2,$3,'P3-INVALID','Wrong parent',$4,$5)",
      [uuid(19), schoolA, parentB, yearA, classA]
    ),
    /foreign key|violates/i,
    "Student's parent must belong to the same school"
  );
  await assert.rejects(
    client.query(
      "INSERT INTO students(id,school_id,parent_user_id,student_code,full_name,academic_year_id,class_id) VALUES($1,$2,$3,'P3-INVALID2','Wrong year',$4,$5)",
      [uuid(20), schoolA, parentA, yearA, classA2]
    ),
    /foreign key|violates/i,
    "Student's class must belong to the recorded academic year"
  );
  await client.query(
    "INSERT INTO students(id,school_id,parent_user_id,student_code,full_name,academic_year_id,class_id) VALUES($1,$2,$3,'P3-OK','Valid Student',$4,$5)",
    [studentA, schoolA, parentA, yearA, classA]
  );
  await assert.rejects(
    client.query(
      "INSERT INTO fee_invoices(id,school_id,student_id,invoice_number,amount,due_date,created_by) VALUES($1,$2,$3,1,500,'2026-12-31',$4)",
      [uuid(21), schoolB, studentA, adminB]
    ),
    /foreign key|violates/i,
    "Financial invoices cannot point at another school's students"
  );
  await client.query(
    "INSERT INTO fee_invoices(id,school_id,student_id,invoice_number,amount,due_date,created_by) VALUES($1,$2,$3,1,500,'2026-12-31',$4)",
    [invoiceA, schoolA, studentA, adminA]
  );
  await assert.rejects(
    client.query(
      "INSERT INTO fee_payments(id,school_id,invoice_id,amount,method,recorded_by) VALUES($1,$2,$3,100,'CASH',$4)",
      [uuid(22), schoolB, invoiceA, adminB]
    ),
    /foreign key|violates/i,
    "Payments must reference invoices from their own school"
  );
  await assert.rejects(
    client.query(
      "INSERT INTO auth_sessions(id,school_id,user_id,access_token_hash,refresh_token_hash,access_expires_at,refresh_expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '1 hour',now()+interval '7 days')",
      [uuid(23), schoolB, adminA, "phase3access", "phase3refresh"]
    ),
    /foreign key|violates/i,
    "Sessions must not cross school boundaries"
  );

  const phases = await client.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE indexname = 'academic_years_one_active_per_school'"
  );
  assert.equal(phases.rows.length, 1);

  // Audit Phase 6: duplicate usernames with different letter case must be
  // rejected by PostgreSQL itself, regardless of which import creates them.
  const usernameIndex = await client.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE indexname = 'users_school_username_casefold_unique'"
  );
  assert.equal(usernameIndex.rows.length, 1);
  await client.query(
    "INSERT INTO users(id,school_id,username,password_hash,role) VALUES($1,$2,$3,'hash','TEACHER')",
    [uuid(40), schoolA, "MixedCase"]
  );
  await assert.rejects(
    client.query(
      "INSERT INTO users(id,school_id,username,password_hash,role) VALUES($1,$2,$3,'hash','TEACHER')",
      [uuid(41), schoolA, "mixedcase"]
    ),
    /duplicate key|unique/i,
    "One school cannot have two accounts with the same case-insensitive username."
  );
  await client.query(
    "INSERT INTO users(id,school_id,username,password_hash,role) VALUES($1,$2,$3,'hash','TEACHER')",
    [uuid(42), schoolB, "mixedcase"]
  );
});
