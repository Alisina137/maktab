import { gradeNumberFromCode } from "./grade-level-suggestions";

export type ClassGrade = { id: string; code: string; name: string; sortOrder: number };
export type ClassIdentity = {
  id: string;
  gradeLevelId: string;
  code: string;
  name: string;
};
export type SuggestedClassIdentity = { code: string; name: string; letter: string };

/** Get the grade number from G-7/G7 first; legacy grade names and sort order are fallbacks. */
export function classGradeNumber(grade: ClassGrade): number | null {
  const byCode = gradeNumberFromCode(grade.code);
  if (byCode !== null) return byCode;
  const nameMatch = /^Grade\s+0*([1-9][0-9]*)$/i.exec(grade.name.trim());
  const byName = nameMatch ? Number(nameMatch[1]) : null;
  if (byName !== null && Number.isSafeInteger(byName) && byName <= 100) return byName;
  return Number.isInteger(grade.sortOrder) && grade.sortOrder >= 1 && grade.sortOrder <= 100
    ? grade.sortOrder : null;
}

/**
 * Scan existing class codes and names within the selected academic year.
 * Count 7-A and older 7A, Class 7A and Grade 7 A as occupying the letter.
 * This also avoids a same-year code collision if a historical class was
 * associated with a different grade record.
 */
export function occupiedClassLetters(
  gradeNumber: number,
  classes: readonly ClassIdentity[],
  excludeClassId?: string
): Set<string> {
  const used = new Set<string>();
  for (const item of classes) {
    if (item.id === excludeClassId) continue;
    const code = /^0*([1-9][0-9]*)-?([A-Z])$/i.exec(item.code.trim());
    const codeLetter = code?.[2];
    if (codeLetter && Number(code?.[1]) === gradeNumber) used.add(codeLetter.toUpperCase());
    const name = /^(?:Class|Grade)\s+0*([1-9][0-9]*)\s*([A-Z])$/i.exec(item.name.trim());
    const nameLetter = name?.[2];
    if (nameLetter && Number(name?.[1]) === gradeNumber) used.add(nameLetter.toUpperCase());
  }
  return used;
}

/** Find the first free A–Z section for this grade in the selected academic year. */
export function nextAvailableClassIdentity(
  grade: ClassGrade,
  classes: readonly ClassIdentity[],
  excludeClassId?: string
): SuggestedClassIdentity | null {
  const number = classGradeNumber(grade);
  if (number === null) return null;
  const used = occupiedClassLetters(number, classes, excludeClassId);
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (!used.has(letter)) {
      return { code: number + "-" + letter, name: "Class " + number + letter, letter };
    }
  }
  return null;
}

/** The new code and name must use the selected grade's x and the same A–Z letter. */
export function matchingClassLetter(
  grade: ClassGrade,
  code: string,
  name: string
): string | null {
  const number = classGradeNumber(grade);
  if (number === null) return null;
  const match = /^([1-9][0-9]*)-([A-Z])$/.exec(code.trim());
  const letter = match?.[2];
  if (!letter || Number(match?.[1]) !== number) return null;
  return name.trim() === "Class " + number + letter ? letter : null;
}
