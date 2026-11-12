/**
 * Suggest the first available teacher employee number within the school.
 * Both modern T-1 and legacy zero-padded T-001 reserve employee number 1.
 * Other historical code formats are ignored rather than blocking creation.
 */
export function nextAvailableTeacherEmployeeCode(codes: readonly string[]): string {
  const used = new Set<number>();
  for (const value of codes) {
    const match = /^T-(\d+)$/i.exec(value.trim());
    if (!match) continue;
    const number = Number(match[1]);
    if (Number.isSafeInteger(number) && number > 0) used.add(number);
  }

  let next = 1;
  while (used.has(next)) next += 1;
  return `T-${next}`;
}
