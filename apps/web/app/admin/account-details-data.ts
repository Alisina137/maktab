import type { User } from "./admin-client";

export type AccountFamilyOverview = {
  parents: Array<{
    profile: { userId: string; fullName: string; phone: string | null };
    user: { id: string; username: string };
    childCount: number;
  }>;
  students: Array<{
    student: {
      id: string;
      userId: string | null;
      parentUserId: string;
      studentCode: string;
      fullName: string;
      phone: string | null;
      status: "ACTIVE" | "WITHDRAWN";
    };
    classSection: { id: string; code: string; name: string };
    academicYear: { id: string; name: string; status: string };
  }>;
};

export type AccountAcademicOverview = {
  academicYears: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; code: string; name: string }>;
  subjects: Array<{ id: string; code: string; name: string }>;
  teachers: Array<{ userId: string; employeeCode: string; fullName: string; phone: string | null }>;
  assignments: Array<{ teacherUserId: string; academicYearId: string; classId: string; subjectId: string }>;
  negaranAssignments: Array<{
    teacherUserId: string; academicYearId: string; classId: string;
    startDate: string; endDate: string | null;
  }>;
};

export function accountFamilyDetails(userId: string, overview: AccountFamilyOverview | null) {
  const children = overview?.students.filter((row) => row.student.parentUserId === userId) ?? [];
  const student = overview?.students.find((row) => row.student.userId === userId) ?? null;
  const parent = student
    ? overview?.parents.find((row) => row.profile.userId === student.student.parentUserId) ?? null
    : null;
  return { children, student, parent };
}

export function accountTeacherDetails(userId: string, overview: AccountAcademicOverview | null) {
  if (!overview) return { profile: null, assignments: [], supervision: [] };

  const profile = overview.teachers.find((row) => row.userId === userId) ?? null;
  const className = (id: string) => {
    const value = overview.classes.find((row) => row.id === id);
    return value ? `${value.name} · ${value.code}` : "—";
  };
  const yearName = (id: string) => overview.academicYears.find((row) => row.id === id)?.name ?? "—";
  const assignments = overview.assignments
    .filter((row) => row.teacherUserId === userId)
    .map((row) => ({
      year: yearName(row.academicYearId),
      className: className(row.classId),
      subject: overview.subjects.find((subject) => subject.id === row.subjectId)?.name ?? "—"
    }));
  const supervision = overview.negaranAssignments
    .filter((row) => row.teacherUserId === userId)
    .map((row) => ({
      year: yearName(row.academicYearId),
      className: className(row.classId),
      startDate: row.startDate,
      endDate: row.endDate
    }));
  return { profile, assignments, supervision };
}

export function accountLabel(user: Pick<User, "username" | "profile">) {
  return user.profile?.fullName?.trim() || user.username;
}
