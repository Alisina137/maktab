/** Only the school-scoped grade overview is passed to these helpers. */
export type GradeCodeRecord = { code: string; name: string };

export function gradeNumberFromCode(code: string): number | null {
  // Reserve both new G-7 and previously saved G7 / G-007 codes.
  const match = /^G-?0*([1-9][0-9]*)$/i.exec(code.trim());
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number <= 100 ? number : null;
}

function gradeNumberFromName(name: string): number | null {
  const match = /^Grade\\s+0*([1-9][0-9]*)$/i.exec(name.trim());
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number <= 100 ? number : null;
}

export function usedGradeNumbers(grades: readonly GradeCodeRecord[]): Set<number> {
  const used = new Set<number>();
  for (const grade of grades) {
    const codeNumber = gradeNumberFromCode(grade.code);
    const nameNumber = gradeNumberFromName(grade.name);
    if (codeNumber !== null) used.add(codeNumber);
    if (nameNumber !== null) used.add(nameNumber);
  }
  return used;
}

/** The API allows sort orders 0–100. Return null when no free grade remains. */
export function nextAvailableGradeNumber(grades: readonly GradeCodeRecord[]): number | null {
  const used = usedGradeNumbers(grades);
  for (let number = 1; number <= 100; number += 1) {
    if (!used.has(number)) return number;
  }
  return null;
}

/** New grade submissions must use the same unpadded positive x in both fields. */
export function matchingNewGradeNumber(code: string, name: string): number | null {
  const match = /^G-([1-9][0-9]*)$/.exec(code.trim());
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isSafeInteger(number) || number > 100) return null;
  return name.trim() === `Grade ${number}` ? number : null;
}
