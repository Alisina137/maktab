/** Client-side guidance for the existing school-scoped account creation API.
 * The server remains authoritative for validation and username uniqueness.
 */
export type SchoolAccountRole = "SCHOOL_ADMIN" | "SCHOOL_STAFF" | "TEACHER" | "PARENT" | "STUDENT";

export interface AccountCreationDraft {
  role: SchoolAccountRole;
  username: string;
  parentFullName: string;
  parentPhone: string;
  studentRecordId: string;
}

export interface AccountCreationIssues {
  username?: string;
  parentFullName?: string;
  parentPhone?: string;
  studentRecordId?: string;
}

export function validateAccountCreation(
  draft: AccountCreationDraft,
  existingUsernames: readonly string[],
  eligibleStudentIds: readonly string[]
): AccountCreationIssues {
  const issues: AccountCreationIssues = {};
  const username = draft.username.trim();
  if (username.length < 3 || username.length > 64) {
    issues.username = "Username must contain between 3 and 64 characters.";
  } else if (
    (draft.role === "PARENT" || draft.role === "STUDENT")
      ? !/^[A-Za-z0-9]+$/.test(username)
      : !/^[A-Za-z0-9._@+-]+$/.test(username)
  ) {
    issues.username = draft.role === "PARENT" || draft.role === "STUDENT"
      ? "Parent and student usernames may contain English letters and numbers only."
      : "This username contains unsupported characters.";
  } else if (existingUsernames.some((value) => value.toLowerCase() === username.toLowerCase())) {
    issues.username = "That username already exists in this school.";
  }

  if (draft.role === "PARENT") {
    const nameLength = draft.parentFullName.trim().length;
    if (nameLength < 2 || nameLength > 160) {
      issues.parentFullName = "Parent name must contain between 2 and 160 characters.";
    }
    if (draft.parentPhone.trim().length > 32) {
      issues.parentPhone = "Phone number must contain at most 32 characters.";
    }
  }

  if (draft.role === "STUDENT" && !eligibleStudentIds.includes(draft.studentRecordId)) {
    issues.studentRecordId = "Select an eligible student record before creating its login.";
  }

  return issues;
}
