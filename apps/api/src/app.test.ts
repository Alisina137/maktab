import assert from "node:assert/strict";
import test from "node:test";
import type { CreateSchoolInput, UpdateSchoolSettingsInput } from "@maktablink/contracts";
import type { PlatformSchoolStore, School, SchoolContext } from "@maktablink/database";
import { buildApp } from "./app.js";

function memoryStore(): PlatformSchoolStore {
  const records = new Map<string, SchoolContext>();
  let next = 1;

  return {
    async createSchool(input: CreateSchoolInput) {
      const id = `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
      const now = new Date();
      const school: School = {
        id,
        code: input.code,
        name: input.name,
        slug: input.slug,
        province: input.province,
        city: input.city,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now
      };
      const context: SchoolContext = {
        school,
        settings: {
          schoolId: id,
          defaultLanguage: input.defaultLanguage,
          timezone: "Asia/Kabul",
          dateSystem: "solar-hijri",
          weekStartsOn: 6,
          createdAt: now,
          updatedAt: now
        }
      };
      records.set(id, context);
      return context;
    },
    async listSchools() {
      return [...records.values()].map((record) => record.school);
    },
    async getSchoolContext(id: string) {
      return records.get(id) ?? null;
    },
    async updateSchoolSettings(id: string, input: UpdateSchoolSettingsInput) {
      const current = records.get(id);
      if (!current) return null;
      const nextContext: SchoolContext = {
        school: current.school,
        settings: { ...current.settings, ...input, updatedAt: new Date() }
      };
      records.set(id, nextContext);
      return nextContext;
    }
  };
}

const key = "phase-1-test-provisioning-key";

test("platform routes reject a missing provisioning key", async () => {
  const app = buildApp({ schoolStore: memoryStore(), provisioningKey: key });
  const response = await app.inject({ method: "GET", url: "/v1/platform/schools" });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("platform can provision and list a school", async () => {
  const app = buildApp({ schoolStore: memoryStore(), provisioningKey: key });
  const headers = { "x-platform-provisioning-key": key };
  const created = await app.inject({
    method: "POST",
    url: "/v1/platform/schools",
    headers,
    payload: {
      code: "school-a",
      name: "School A",
      slug: "school-a",
      province: "Kabul",
      city: "Kabul"
    }
  });
  assert.equal(created.statusCode, 201);

  const listed = await app.inject({ method: "GET", url: "/v1/platform/schools", headers });
  assert.equal(listed.statusCode, 200);
  const body = listed.json<{ schools: School[] }>();
  assert.equal(body.schools.length, 1);
  assert.equal(body.schools[0]?.code, "SCHOOL-A");
  await app.close();
});
