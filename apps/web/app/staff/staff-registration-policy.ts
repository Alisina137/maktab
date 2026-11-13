/** Pure comparison of a working registration draft against the last persisted row. */
export type RegistrationDraftFields = {
  fullName: string;
  studentCode: string;
  parentName: string;
  academicYearId: string;
  gradeLevelId: string;
  documents: {
    identityChecked: boolean;
    consentChecked: boolean;
    priorRecordChecked: boolean;
  };
  notes: string;
};

export function hasUnsavedRegistrationChanges(
  working: RegistrationDraftFields,
  persisted: RegistrationDraftFields | null
): boolean {
  if (!persisted) return true;
  return working.fullName !== persisted.fullName ||
    working.studentCode !== persisted.studentCode ||
    working.parentName !== persisted.parentName ||
    working.academicYearId !== persisted.academicYearId ||
    working.gradeLevelId !== persisted.gradeLevelId ||
    working.notes !== persisted.notes ||
    working.documents.identityChecked !== persisted.documents.identityChecked ||
    working.documents.consentChecked !== persisted.documents.consentChecked ||
    working.documents.priorRecordChecked !== persisted.documents.priorRecordChecked;
}
