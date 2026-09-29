import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createSchoolStore, type FoundationDatabase } from "./index.js";
import * as schema from "./schema.js";

async function createTestStore() {
  const client = new PGlite();
  for (const file of ["0000_phase1_foundation.sql", "0008_phase8_pilot_readiness.sql", "0009_school_image.sql"]) {
    const sql = await readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8");
    await client.exec(sql.replaceAll("--> statement-breakpoint", ""));
  }
  const db = drizzle(client, { schema });
  return {
    client,
    store: createSchoolStore(db as unknown as FoundationDatabase)
  };
}

test("two schools keep settings isolated by school id", async (t) => {
  const { client, store } = await createTestStore();
  t.after(async () => client.close());

  const schoolA = await store.createSchool({
    code: "SCHOOL-A",
    name: "School A",
    slug: "school-a",
    province: "Kabul",
    city: "Kabul",
    defaultLanguage: "fa-AF"
  });
  const schoolB = await store.createSchool({
    code: "SCHOOL-B",
    name: "School B",
    slug: "school-b",
    province: "Kabul",
    city: "Kabul",
    defaultLanguage: "ps-AF"
  });

  await store.updateSchoolSettings(schoolA.school.id, {
    timezone: "Asia/Kabul",
    dateSystem: "gregorian",
    defaultLanguage: "en"
  });

  const contextA = await store.getSchoolContext(schoolA.school.id);
  const contextB = await store.getSchoolContext(schoolB.school.id);

  assert.equal(contextA?.school.code, "SCHOOL-A");
  assert.equal(contextA?.settings.defaultLanguage, "en");
  assert.equal(contextA?.settings.dateSystem, "gregorian");

  assert.equal(contextB?.school.code, "SCHOOL-B");
  assert.equal(contextB?.settings.defaultLanguage, "ps-AF");
  assert.equal(contextB?.settings.dateSystem, "solar-hijri");
  assert.notEqual(contextA?.school.id, contextB?.school.id);
});


test("public school search matches name, code, city, and province", async (t) => {
  const { client, store } = await createTestStore();
  t.after(async () => client.close());

  const kabul = await store.createSchool({
    code: "KBL-DEMO-01",
    name: "MaktabLink Demo School",
    slug: "maktablink-demo-school",
    province: "Kabul",
    city: "Kabul City",
    defaultLanguage: "fa-AF"
  });
  const herat = await store.createSchool({
    code: "HRT-NOOR-02",
    name: "Noor Academy",
    slug: "noor-academy",
    province: "Herat",
    city: "Herat City",
    defaultLanguage: "ps-AF"
  });

  assert.deepEqual((await store.listPublicSchools("demo")).map((item) => item.id), [kabul.school.id]);
  assert.deepEqual((await store.listPublicSchools("KBL-DEMO")).map((item) => item.id), [kabul.school.id]);
  assert.deepEqual((await store.listPublicSchools("Kabul City")).map((item) => item.id), [kabul.school.id]);
  assert.deepEqual((await store.listPublicSchools("Herat")).map((item) => item.id), [herat.school.id]);
});


test("school image URL is optional and exposed in public school results", async (t) => {
  const { client, store } = await createTestStore();
  t.after(async () => client.close());

  const withImage = await store.createSchool({
    code: "IMG-001",
    name: "Image School",
    slug: "image-school",
    province: "Kabul",
    city: "Kabul",
    imageUrl: "https://example.com/schools/image-school.jpg",
    defaultLanguage: "fa-AF"
  });

  const withoutImage = await store.createSchool({
    code: "IMG-002",
    name: "No Image School",
    slug: "no-image-school",
    province: "Kabul",
    city: "Kabul",
    defaultLanguage: "fa-AF"
  });

  assert.equal(withImage.school.imageUrl, "https://example.com/schools/image-school.jpg");
  assert.equal(withoutImage.school.imageUrl, null);

  const publicSchools = await store.listPublicSchools("IMG-");
  const imageSchool = publicSchools.find((school) => school.id === withImage.school.id);
  const noImageSchool = publicSchools.find((school) => school.id === withoutImage.school.id);

  assert.equal(imageSchool?.imageUrl, "https://example.com/schools/image-school.jpg");
  assert.equal(noImageSchool?.imageUrl, null);
});
