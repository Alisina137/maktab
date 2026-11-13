import assert from "node:assert/strict";
import test from "node:test";
import {
  hasUnsavedRegistrationChanges, type RegistrationDraftFields
} from "../apps/web/app/staff/staff-registration-policy.js";

const original: RegistrationDraftFields = {
  fullName: "Pilot Student", studentCode: "P13-014",
  parentName: "Pilot Guardian",
  academicYearId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  gradeLevelId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  documents: {
    identityChecked: true, consentChecked: true, priorRecordChecked: false
  },
  notes: "Ready for review"
};
test("Phase 13 13.5 staff registration submits only unchanged persisted drafts", () => {
  assert.equal(hasUnsavedRegistrationChanges(original, { ...original, documents: { ...original.documents } }), false);
  assert.equal(hasUnsavedRegistrationChanges(original, null), true);
  for (const [field, value] of [
    ["fullName", "New name"], ["studentCode", "P13-NEW"],
    ["parentName", "Updated Guardian"], ["academicYearId", "changed"],
    ["gradeLevelId", "changed"], ["notes", "New notes"]
  ] as const) {
    assert.equal(hasUnsavedRegistrationChanges({ ...original, [field]: value }, original), true, field);
  }
  for (const field of ["identityChecked", "consentChecked", "priorRecordChecked"] as const) {
    assert.equal(hasUnsavedRegistrationChanges({
      ...original, documents: { ...original.documents,
        [field]: !original.documents[field] }
    }, original), true, field);
  }
});
