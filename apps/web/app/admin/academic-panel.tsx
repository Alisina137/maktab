"use client";

import Link from "next/link";
import { Children, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { adminApi, friendlyAdminError } from "./admin-client";
import { AdminLoader, AdminSkeleton } from "./admin-loader";
import { AdminHijriDatePicker, formatAdminHijriDate } from "./admin-hijri-date-picker";
import { useAdminWorkspace } from "./admin-workspace";
import { adminText, type AdminLocale } from "./admin-i18n";

export const academicSectionNames = [
  "years",
  "grades",
  "subjects",
  "classes",
  "teachers",
  "assignments",
  "negaran",
  "timetable"
] as const;

export type AcademicSection = (typeof academicSectionNames)[number] | "overview";

export function isAcademicSection(value: string): value is Exclude<AcademicSection, "overview"> {
  return (academicSectionNames as readonly string[]).includes(value);
}

type AcademicYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
};

type GradeLevel = { id: string; code: string; name: string; sortOrder: number };
type ClassSection = { id: string; academicYearId: string; gradeLevelId: string; code: string; name: string };
type Subject = { id: string; code: string; name: string };
type Teacher = { userId: string; employeeCode: string; fullName: string; phone: string | null };
type Assignment = { id: string; academicYearId: string; teacherUserId: string; subjectId: string; classId: string };
type Negaran = { id: string; academicYearId: string; teacherUserId: string; classId: string; startDate: string; endDate: string | null };
type TimetablePeriod = {
  id: string;
  academicYearId: string;
  teacherUserId: string;
  subjectId: string;
  classId: string;
  weekday: string;
  startsAt: string;
  endsAt: string;
};
type User = { id: string; username: string; role: string; status: string };

type Overview = {
  academicYears: AcademicYear[];
  gradeLevels: GradeLevel[];
  classes: ClassSection[];
  subjects: Subject[];
  teachers: Teacher[];
  assignments: Assignment[];
  negaranAssignments: Negaran[];
  timetable: TimetablePeriod[];
};

const schoolWeekdays = ["SATURDAY", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"] as const;

async function request<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", "Bearer " + accessToken);
  return adminApi<T>(path, { ...init, headers });
}

function formValue(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export function AcademicPanel({
  accessToken,
  section = "overview"
}: {
  accessToken: string;
  section?: AcademicSection;
}) {
  const {
    locale,
    showToast,
    selectedAcademicYearId,
    selectedAcademicYear,
    refreshAcademicYears
  } = useAdminWorkspace();
  const t = (english: string) => adminText(locale, english);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const yearMap = useMemo(() => new Map(overview?.academicYears.map((item) => [item.id, item]) ?? []), [overview]);
  const gradeMap = useMemo(() => new Map(overview?.gradeLevels.map((item) => [item.id, item]) ?? []), [overview]);
  const classMap = useMemo(() => new Map(overview?.classes.map((item) => [item.id, item]) ?? []), [overview]);
  const subjectMap = useMemo(() => new Map(overview?.subjects.map((item) => [item.id, item]) ?? []), [overview]);
  const teacherMap = useMemo(() => new Map(overview?.teachers.map((item) => [item.userId, item]) ?? []), [overview]);
  const userMap = useMemo(() => new Map(users.map((item) => [item.id, item])), [users]);

  useEffect(() => {
    void load();
  }, [accessToken]);

  useEffect(() => {
    setEditingId(null);
  }, [section, selectedAcademicYearId]);

  async function load(showFailureToast = false) {
    setLoadError("");
    try {
      const [academicData, accountData] = await Promise.all([
        request<Overview>(accessToken, "/v1/admin/academics"),
        request<{ users: User[] }>(accessToken, "/v1/admin/users")
      ]);
      setOverview(academicData);
      setUsers(accountData.users);
      return true;
    } catch (cause) {
      const message = friendlyAdminError(cause, "Could not load academic structure.", locale);
      setLoadError(message);
      if (showFailureToast) {
        showToast({ kind: "error", title: t("Academics"), message });
      }
      return false;
    }
  }

  async function mutate(
    path: string,
    payload: Record<string, unknown> | undefined,
    context: string,
    success: string,
    method: "POST" | "PATCH" | "DELETE" = "POST"
  ): Promise<boolean> {
    setBusy(true);
    try {
      await request(accessToken, path, {
        method,
        ...(payload ? { body: JSON.stringify(payload) } : {})
      });
      showToast({ kind: "success", title: t(context), message: t(success) });
      await load(true);
      await refreshAcademicYears();
      return true;
    } catch (cause) {
      showToast({
        kind: "error",
        title: t(context),
        message: friendlyAdminError(cause, "Academic action failed.", locale)
      });
      if (method === "DELETE") {
        await load(false);
        await refreshAcademicYears();
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
    path: string,
    payload: Record<string, unknown>,
    context: string,
    success: string,
    method: "POST" | "PATCH"
  ) {
    event.preventDefault();
    const succeeded = await mutate(path, payload, context, success, method);
    if (succeeded) setEditingId(null);
  }

  async function remove(path: string, context: string, success: string, message = "Delete this record permanently?") {
    if (!window.confirm(t(message))) return;
    const succeeded = await mutate(path, undefined, context, success, "DELETE");
    if (succeeded) setEditingId(null);
  }

  function beginEdit(id: string) {
    setEditingId(id);
    window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('[data-academic-pane="form"]')?.click();
      document.getElementById("academic-entity-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  if (!overview) {
    return (
      <section className="admin-panel academic-section admin-loading-card">
        <AdminLoader label={t("Loading Phase 3 data…")} />
        <AdminSkeleton rows={5} />
        {loadError ? (
          <>
            <div className="admin-error" role="alert">{loadError}</div>
            <button className="admin-secondary" onClick={() => void load()}>{t("Retry")}</button>
          </>
        ) : null}
      </section>
    );
  }

  const teacherAccounts = users.filter((user) => user.role === "TEACHER" && user.status !== "ARCHIVED");
  const profiledTeacherIds = new Set(overview.teachers.map((teacher) => teacher.userId));
  const effectiveYearId =
    selectedAcademicYearId ||
    overview.academicYears.find((year) => year.status === "ACTIVE")?.id ||
    overview.academicYears.at(-1)?.id ||
    "";
  const effectiveYear =
    selectedAcademicYear ??
    overview.academicYears.find((year) => year.id === effectiveYearId) ??
    null;
  const selectedClasses = overview.classes.filter((item) => item.academicYearId === effectiveYearId);
  const selectedAssignments = overview.assignments.filter((item) => item.academicYearId === effectiveYearId);
  const selectedNegaranAssignments = overview.negaranAssignments.filter((item) => item.academicYearId === effectiveYearId);
  const selectedTimetable = overview.timetable.filter((item) => item.academicYearId === effectiveYearId);
  const selectedYearMutable = effectiveYear?.status === "DRAFT" || effectiveYear?.status === "ACTIVE";
  const selectedYearHistorical = effectiveYear?.status === "CLOSED" || effectiveYear?.status === "ARCHIVED";

  if (section === "overview") {
    const modules = [
      { key: "years", title: "Academic years", description: "Create years and manage Draft, Active, Closed, and Archived lifecycle.", count: overview.academicYears.length },
      { key: "grades", title: "Grade levels", description: "Manage the reusable school grade catalog.", count: overview.gradeLevels.length },
      { key: "subjects", title: "Subjects", description: "Manage the reusable school subject catalog.", count: overview.subjects.length },
      { key: "classes", title: "Classes", description: "Create and manage classes for the selected academic year.", count: selectedClasses.length },
      { key: "teachers", title: "Teacher profiles", description: "Attach academic teacher profiles to teacher accounts.", count: overview.teachers.length },
      { key: "assignments", title: "Teacher assignments", description: "Assign teachers to subjects and classes in the selected year.", count: selectedAssignments.length },
      { key: "negaran", title: "Negaran assignments", description: "Manage class-supervisor responsibility and history.", count: selectedNegaranAssignments.length },
      { key: "timetable", title: "Timetable periods", description: "Create periods and review weekly teacher/class timetables.", count: selectedTimetable.length }
    ] as const;

    return (
      <section className="academic-section admin-page-enter">
        <div className="admin-section-header academic-heading">
          <div>
            <span className="eyebrow">{t("Phase 3 · Academic Structure")}</span>
            <h2>{t("Academic modules")}</h2>
            <p>{t("Open one academic module at a time. Each page contains one form and the records created by that form.")}</p>
          </div>
          <button className="admin-secondary" onClick={() => void load(true)} disabled={busy}>{t("Refresh")}</button>
        </div>

        <div className="academic-form-grid academic-module-grid">
          {modules.map((module) => (
            <Link className="admin-panel academic-form-card academic-module-card" href={"/admin/academics/" + module.key} key={module.key}>
              <div className="academic-module-card-heading">
                <h2>{t(module.title)}</h2>
                <strong>{module.count}</strong>
              </div>
              <p>{t(module.description)}</p>
              <span className="academic-module-open">{t("Open module")} →</span>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  const pageTitle: Record<Exclude<AcademicSection, "overview">, string> = {
    years: "Academic years",
    grades: "Grade levels",
    subjects: "Subjects",
    classes: "Classes",
    teachers: "Teacher profiles",
    assignments: "Teacher assignments",
    negaran: "Negaran assignments",
    timetable: "Timetable periods"
  };

  const historicalNotice = ["classes", "assignments", "negaran", "timetable"].includes(section) && selectedYearHistorical ? (
    <div className="admin-panel admin-copy" role="status">
      <strong>{effectiveYear?.name}</strong> · {t("Historical academic year · read-only")}
      <div>{t("Year-bound academic structure is shown for reference. Switch to a draft or active year to make operational changes.")}</div>
    </div>
  ) : null;

  if (section === "years") {
    const editing = overview.academicYears.find((item) => item.id === editingId) ?? null;
    return (
      <AcademicEntityPage section={section} title={t(pageTitle[section])} locale={locale} busy={busy}>
        <AcademicForm title={t(editing ? "Edit academic year" : "Academic year")} hint={t("Dates are stored canonically; the school calendar presentation can remain Solar Hijri.")}>
          <form
            id="academic-entity-form"
            className="admin-form"
            key={editing?.id ?? "new-year"}
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              const payload = {
                name: formValue(form, "name"),
                startDate: formValue(form, "startDate"),
                endDate: formValue(form, "endDate")
              };
              void submit(
                event,
                editing ? "/v1/admin/academics/years/" + editing.id : "/v1/admin/academics/years",
                payload,
                editing ? "Edit academic year" : "Academic year",
                editing ? "Academic year updated." : "Academic year created.",
                editing ? "PATCH" : "POST"
              );
            }}
          >
            <label>{t("Name")}<input name="name" defaultValue={editing?.name ?? ""} placeholder="1405" required /></label>
            <label>{t("Start date")}<AdminHijriDatePicker locale={locale} name="startDate" defaultValue={editing?.startDate ?? ""} required /></label>
            <label>{t("End date")}<AdminHijriDatePicker locale={locale} name="endDate" defaultValue={editing?.endDate ?? ""} required /></label>
            <FormActions editing={Boolean(editing)} busy={busy} createLabel={t("Create year")} saveLabel={t("Save changes")} cancelLabel={t("Cancel edit")} onCancel={() => setEditingId(null)} />
          </form>
        </AcademicForm>

        <EntityList
          title={t("Academic years")}
          rows={overview.academicYears.map((year) => ({
            id: year.id,
            title: year.name,
            detail: formatAdminHijriDate(locale, year.startDate) + " → " + formatAdminHijriDate(locale, year.endDate) + " · " + t(year.status),
            action: (
              <>
                {year.status === "DRAFT" ? (
                  <>
                    <button disabled={busy} onClick={() => beginEdit(year.id)}>{t("Edit")}</button>
                    <button disabled={busy} onClick={() => void mutate("/v1/admin/academics/years/" + year.id + "/activate", undefined, "Activate academic year", "Academic year activated.")}>{t("Activate")}</button>
                  </>
                ) : null}
                {year.status === "ACTIVE" ? (
                  <button disabled={busy} onClick={() => void mutate("/v1/admin/academics/years/" + year.id + "/close", undefined, "Close academic year", "Academic year closed.")}>{t("Close")}</button>
                ) : null}
                {year.status === "CLOSED" ? (
                  <>
                    <button disabled={busy} onClick={() => void mutate("/v1/admin/academics/years/" + year.id + "/activate", undefined, "Reactivate academic year", "Academic year reactivated.")}>{t("Reactivate")}</button>
                    <button disabled={busy} onClick={() => void mutate("/v1/admin/academics/years/" + year.id + "/archive", undefined, "Archive academic year", "Academic year archived.")}>{t("Archive")}</button>
                  </>
                ) : null}
                {year.status === "ARCHIVED" ? (
                  <>
                    <button disabled={busy} onClick={() => void mutate("/v1/admin/academics/years/" + year.id + "/unarchive", undefined, "Unarchive academic year", "Academic year unarchived.")}>{t("Unarchive")}</button>
                    <button
                      className="admin-danger"
                      disabled={busy}
                      onClick={() => void remove(
                        "/v1/admin/academics/years/" + year.id,
                        "Delete academic year",
                        "Academic year deleted permanently.",
                        "Delete this archived academic year permanently? This is allowed only when it has no linked school data."
                      )}
                    >
                      {t("Delete")}
                    </button>
                  </>
                ) : null}
              </>
            )
          }))}
        />
      </AcademicEntityPage>
    );
  }

  if (section === "grades") {
    const editing = overview.gradeLevels.find((item) => item.id === editingId) ?? null;
    return (
      <AcademicEntityPage section={section} title={t(pageTitle[section])} locale={locale} busy={busy}>
        <AcademicForm title={t(editing ? "Edit grade level" : "Grade level")} hint={t("Reusable grade definition such as Grade 7.")}>
          <form
            id="academic-entity-form"
            className="admin-form"
            key={editing?.id ?? "new-grade"}
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void submit(
                event,
                editing ? "/v1/admin/academics/grades/" + editing.id : "/v1/admin/academics/grades",
                {
                  code: formValue(form, "code"),
                  name: formValue(form, "name"),
                  sortOrder: Number(formValue(form, "sortOrder") || "0")
                },
                editing ? "Edit grade level" : "Grade level",
                editing ? "Grade level updated." : "Grade level created.",
                editing ? "PATCH" : "POST"
              );
            }}
          >
            <label>{t("Code")}<input name="code" defaultValue={editing?.code ?? ""} placeholder="G7" required /></label>
            <label>{t("Name")}<input name="name" defaultValue={editing?.name ?? ""} placeholder={t("Grade 7")} required /></label>
            <label>{t("Sort order")}<input name="sortOrder" type="number" min="0" max="100" defaultValue={editing?.sortOrder ?? 7} required /></label>
            <FormActions editing={Boolean(editing)} busy={busy} createLabel={t("Create grade")} saveLabel={t("Save changes")} cancelLabel={t("Cancel edit")} onCancel={() => setEditingId(null)} />
          </form>
        </AcademicForm>
        <EntityList
          title={t("Grade levels")}
          rows={overview.gradeLevels.map((grade) => ({
            id: grade.id,
            title: grade.name,
            detail: grade.code + " · " + t("Sort order") + " " + grade.sortOrder,
            action: <CrudActions t={t} busy={busy} onEdit={() => beginEdit(grade.id)} onDelete={() => void remove("/v1/admin/academics/grades/" + grade.id, "Delete grade level", "Grade level deleted.")} />
          }))}
        />
      </AcademicEntityPage>
    );
  }

  if (section === "subjects") {
    const editing = overview.subjects.find((item) => item.id === editingId) ?? null;
    return (
      <AcademicEntityPage section={section} title={t(pageTitle[section])} locale={locale} busy={busy}>
        <AcademicForm title={t(editing ? "Edit subject" : "Subject")} hint={t("School-level subject catalog.")}>
          <form
            id="academic-entity-form"
            className="admin-form"
            key={editing?.id ?? "new-subject"}
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void submit(
                event,
                editing ? "/v1/admin/academics/subjects/" + editing.id : "/v1/admin/academics/subjects",
                { code: formValue(form, "code"), name: formValue(form, "name") },
                editing ? "Edit subject" : "Subject",
                editing ? "Subject updated." : "Subject created.",
                editing ? "PATCH" : "POST"
              );
            }}
          >
            <label>{t("Code")}<input name="code" defaultValue={editing?.code ?? ""} placeholder="MATH" required /></label>
            <label>{t("Name")}<input name="name" defaultValue={editing?.name ?? ""} placeholder={t("Mathematics")} required /></label>
            <FormActions editing={Boolean(editing)} busy={busy} createLabel={t("Create subject")} saveLabel={t("Save changes")} cancelLabel={t("Cancel edit")} onCancel={() => setEditingId(null)} />
          </form>
        </AcademicForm>
        <EntityList
          title={t("Subjects")}
          rows={overview.subjects.map((subject) => ({
            id: subject.id,
            title: subject.name,
            detail: subject.code,
            action: <CrudActions t={t} busy={busy} onEdit={() => beginEdit(subject.id)} onDelete={() => void remove("/v1/admin/academics/subjects/" + subject.id, "Delete subject", "Subject deleted.")} />
          }))}
        />
      </AcademicEntityPage>
    );
  }

  if (section === "classes") {
    const editing = selectedClasses.find((item) => item.id === editingId) ?? null;
    return (
      <AcademicEntityPage section={section} title={t(pageTitle[section])} locale={locale} busy={busy} notice={historicalNotice}>
        <AcademicForm title={t(editing ? "Edit class section" : "Class section")} hint={t("A class belongs to one academic year and grade.")}>
          <form
            id="academic-entity-form"
            className="admin-form"
            key={editing?.id ?? "new-class-" + effectiveYearId}
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void submit(
                event,
                editing ? "/v1/admin/academics/classes/" + editing.id : "/v1/admin/academics/classes",
                {
                  academicYearId: effectiveYearId,
                  gradeLevelId: formValue(form, "gradeLevelId"),
                  code: formValue(form, "code"),
                  name: formValue(form, "name")
                },
                editing ? "Edit class section" : "Class section",
                editing ? "Class updated." : "Class created.",
                editing ? "PATCH" : "POST"
              );
            }}
          >
            <ReadOnlyYear year={effectiveYear} locale={locale} />
            <Select name="gradeLevelId" label={t("Grade")} items={overview.gradeLevels.map((grade) => [grade.id, grade.name])} defaultValue={editing?.gradeLevelId ?? ""} disabled={!selectedYearMutable} />
            <label>{t("Code")}<input name="code" defaultValue={editing?.code ?? ""} placeholder="7A" required disabled={!selectedYearMutable} /></label>
            <label>{t("Name")}<input name="name" defaultValue={editing?.name ?? ""} placeholder={t("Grade 7 A")} required disabled={!selectedYearMutable} /></label>
            <FormActions editing={Boolean(editing)} busy={busy || !selectedYearMutable} createLabel={t("Create class")} saveLabel={t("Save changes")} cancelLabel={t("Cancel edit")} onCancel={() => setEditingId(null)} />
          </form>
        </AcademicForm>
        <EntityList
          title={t("Classes")}
          rows={selectedClasses.map((item) => ({
            id: item.id,
            title: item.name,
            detail: item.code + " · " + (gradeMap.get(item.gradeLevelId)?.name ?? t("Grade")),
            action: selectedYearMutable ? <CrudActions t={t} busy={busy} onEdit={() => beginEdit(item.id)} onDelete={() => void remove("/v1/admin/academics/classes/" + item.id, "Delete class section", "Class deleted.")} /> : undefined
          }))}
        />
      </AcademicEntityPage>
    );
  }

  if (section === "teachers") {
    const editing = overview.teachers.find((item) => item.userId === editingId) ?? null;
    return (
      <AcademicEntityPage section={section} title={t(pageTitle[section])} locale={locale} busy={busy}>
        <AcademicForm title={t(editing ? "Edit teacher profile" : "Teacher profile")} hint={t("Attach school details to an existing TEACHER account.")}>
          <form
            id="academic-entity-form"
            className="admin-form"
            key={editing?.userId ?? "new-teacher"}
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              const profile = {
                employeeCode: formValue(form, "employeeCode"),
                fullName: formValue(form, "fullName"),
                phone: formValue(form, "phone") || undefined
              };
              void submit(
                event,
                editing ? "/v1/admin/academics/teachers/" + editing.userId : "/v1/admin/academics/teachers",
                editing ? profile : { userId: formValue(form, "userId"), ...profile },
                editing ? "Edit teacher profile" : "Teacher profile",
                editing ? "Teacher profile updated." : "Teacher profile created.",
                editing ? "PATCH" : "POST"
              );
            }}
          >
            {editing ? (
              <label>{t("Teacher account")}<input value={userMap.get(editing.userId)?.username ?? editing.userId} disabled readOnly /></label>
            ) : (
              <Select
                name="userId"
                label={t("Teacher account")}
                items={teacherAccounts.filter((user) => !profiledTeacherIds.has(user.id)).map((user) => [user.id, user.username])}
              />
            )}
            <label>{t("Employee code")}<input name="employeeCode" defaultValue={editing?.employeeCode ?? ""} placeholder="T-001" required /></label>
            <label>{t("Full name")}<input name="fullName" defaultValue={editing?.fullName ?? ""} placeholder={t("Teacher full name")} required /></label>
            <label>{t("Phone")}<input name="phone" defaultValue={editing?.phone ?? ""} placeholder="07xxxxxxxx" /></label>
            <FormActions editing={Boolean(editing)} busy={busy} createLabel={t("Create teacher profile")} saveLabel={t("Save changes")} cancelLabel={t("Cancel edit")} onCancel={() => setEditingId(null)} />
          </form>
        </AcademicForm>
        <EntityList
          title={t("Teacher profiles")}
          rows={overview.teachers.map((teacher) => ({
            id: teacher.userId,
            title: teacher.fullName,
            detail: teacher.employeeCode + (teacher.phone ? " · " + teacher.phone : ""),
            action: <CrudActions t={t} busy={busy} onEdit={() => beginEdit(teacher.userId)} onDelete={() => void remove("/v1/admin/academics/teachers/" + teacher.userId, "Delete teacher profile", "Teacher profile deleted.")} />
          }))}
        />
      </AcademicEntityPage>
    );
  }

  if (section === "assignments") {
    const editing = selectedAssignments.find((item) => item.id === editingId) ?? null;
    return (
      <AcademicEntityPage section={section} title={t(pageTitle[section])} locale={locale} busy={busy} notice={historicalNotice}>
        <AcademicForm title={t(editing ? "Edit teacher assignment" : "Teacher assignment")} hint={t("Teacher → Subject → Class for one academic year.")}>
          <form
            id="academic-entity-form"
            className="admin-form"
            key={editing?.id ?? "new-assignment-" + effectiveYearId}
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              void submit(
                event,
                editing ? "/v1/admin/academics/assignments/" + editing.id : "/v1/admin/academics/assignments",
                {
                  academicYearId: effectiveYearId,
                  classId: formValue(form, "classId"),
                  subjectId: formValue(form, "subjectId"),
                  teacherUserId: formValue(form, "teacherUserId")
                },
                editing ? "Edit teacher assignment" : "Teacher assignment",
                editing ? "Teacher assignment updated." : "Teacher assignment created.",
                editing ? "PATCH" : "POST"
              );
            }}
          >
            <ReadOnlyYear year={effectiveYear} locale={locale} />
            <Select name="classId" label={t("Class")} items={selectedClasses.map((item) => [item.id, item.name])} defaultValue={editing?.classId ?? ""} disabled={!selectedYearMutable} />
            <Select name="subjectId" label={t("Subject")} items={overview.subjects.map((item) => [item.id, item.name])} defaultValue={editing?.subjectId ?? ""} disabled={!selectedYearMutable} />
            <Select name="teacherUserId" label={t("Teacher")} items={overview.teachers.map((item) => [item.userId, item.fullName])} defaultValue={editing?.teacherUserId ?? ""} disabled={!selectedYearMutable} />
            <FormActions editing={Boolean(editing)} busy={busy || !selectedYearMutable} createLabel={t("Assign teacher")} saveLabel={t("Save changes")} cancelLabel={t("Cancel edit")} onCancel={() => setEditingId(null)} />
          </form>
        </AcademicForm>
        <EntityList
          title={t("Teacher assignments")}
          rows={selectedAssignments.map((item) => ({
            id: item.id,
            title: teacherMap.get(item.teacherUserId)?.fullName ?? item.teacherUserId,
            detail: (subjectMap.get(item.subjectId)?.name ?? t("Subject")) + " · " + (classMap.get(item.classId)?.name ?? t("Class")),
            action: selectedYearMutable ? <CrudActions t={t} busy={busy} onEdit={() => beginEdit(item.id)} onDelete={() => void remove("/v1/admin/academics/assignments/" + item.id, "Delete teacher assignment", "Teacher assignment deleted.")} /> : undefined
          }))}
        />
      </AcademicEntityPage>
    );
  }

  if (section === "negaran") {
    const editing = selectedNegaranAssignments.find((item) => item.id === editingId) ?? null;
    return (
      <AcademicEntityPage section={section} title={t(pageTitle[section])} locale={locale} busy={busy} notice={historicalNotice}>
        <AcademicForm title={t(editing ? "Edit Negaran assignment" : "Negaran assignment")} hint={t("One primary class supervisor may be active for a class at a time.")}>
          <form
            id="academic-entity-form"
            className="admin-form"
            key={editing?.id ?? "new-negaran-" + effectiveYearId}
            onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              const endDate = formValue(form, "endDate");
              void submit(
                event,
                editing ? "/v1/admin/academics/negaran/" + editing.id : "/v1/admin/academics/negaran",
                {
                  academicYearId: effectiveYearId,
                  classId: formValue(form, "classId"),
                  teacherUserId: formValue(form, "teacherUserId"),
                  startDate: formValue(form, "startDate"),
                  ...(endDate ? { endDate } : {})
                },
                editing ? "Edit Negaran assignment" : "Negaran assignment",
                editing ? "Negaran assignment updated." : "Negaran assigned.",
                editing ? "PATCH" : "POST"
              );
            }}
          >
            <ReadOnlyYear year={effectiveYear} locale={locale} />
            <Select name="classId" label={t("Class")} items={selectedClasses.map((item) => [item.id, item.name])} defaultValue={editing?.classId ?? ""} disabled={!selectedYearMutable} />
            <Select name="teacherUserId" label={t("Teacher")} items={overview.teachers.map((item) => [item.userId, item.fullName])} defaultValue={editing?.teacherUserId ?? ""} disabled={!selectedYearMutable} />
            <label>{t("Start date")}<AdminHijriDatePicker locale={locale} name="startDate" defaultValue={editing?.startDate ?? ""} required disabled={!selectedYearMutable} /></label>
            <label>{t("End date (optional)")}<AdminHijriDatePicker locale={locale} name="endDate" defaultValue={editing?.endDate ?? ""} disabled={!selectedYearMutable} /></label>
            <FormActions editing={Boolean(editing)} busy={busy || !selectedYearMutable} createLabel={t("Assign Negaran")} saveLabel={t("Save changes")} cancelLabel={t("Cancel edit")} onCancel={() => setEditingId(null)} />
          </form>
        </AcademicForm>
        <EntityList
          title={t("Negaran history")}
          rows={selectedNegaranAssignments.map((item) => ({
            id: item.id,
            title: classMap.get(item.classId)?.name ?? t("Class"),
            detail: (teacherMap.get(item.teacherUserId)?.fullName ?? t("Teacher")) + " · " + formatAdminHijriDate(locale, item.startDate) + " → " + (item.endDate ? formatAdminHijriDate(locale, item.endDate) : t("Current")),
            action: selectedYearMutable ? (
              <>
                <button disabled={busy} onClick={() => beginEdit(item.id)}>{t("Edit")}</button>
                {effectiveYear?.status === "DRAFT" ? (
                  <button className="admin-danger" disabled={busy} onClick={() => void remove("/v1/admin/academics/negaran/" + item.id, "Delete Negaran assignment", "Negaran assignment deleted.")}>{t("Delete")}</button>
                ) : null}
                {!item.endDate && effectiveYear?.status === "ACTIVE" ? (
                  <NegaranEndAction
                    locale={locale}
                    busy={busy}
                    onEnd={(endDate) => mutate("/v1/admin/academics/negaran/" + item.id + "/end", { endDate }, "End Negaran assignment", "Negaran assignment ended.")}
                  />
                ) : null}
              </>
            ) : undefined
          }))}
        />
      </AcademicEntityPage>
    );
  }

  const editing = selectedTimetable.find((item) => item.id === editingId) ?? null;
  return (
    <AcademicEntityPage section="timetable" title={t(pageTitle.timetable)} locale={locale} busy={busy} notice={historicalNotice}>
      <AcademicForm title={t(editing ? "Edit timetable period" : "Timetable period")} hint={t("A period must match an existing teacher assignment. Class and teacher overlaps are rejected.")}>
        <form
          id="academic-entity-form"
          className="admin-form"
          key={editing?.id ?? "new-period-" + effectiveYearId}
          onSubmit={(event) => {
            const form = new FormData(event.currentTarget);
            void submit(
              event,
              editing ? "/v1/admin/academics/timetable/" + editing.id : "/v1/admin/academics/timetable",
              {
                academicYearId: effectiveYearId,
                classId: formValue(form, "classId"),
                subjectId: formValue(form, "subjectId"),
                teacherUserId: formValue(form, "teacherUserId"),
                weekday: formValue(form, "weekday"),
                startsAt: formValue(form, "startsAt"),
                endsAt: formValue(form, "endsAt")
              },
              editing ? "Edit timetable period" : "Timetable period",
              editing ? "Timetable period updated." : "Timetable period created.",
              editing ? "PATCH" : "POST"
            );
          }}
        >
          <ReadOnlyYear year={effectiveYear} locale={locale} />
          <Select name="classId" label={t("Class")} items={selectedClasses.map((item) => [item.id, item.name])} defaultValue={editing?.classId ?? ""} disabled={!selectedYearMutable} />
          <Select name="subjectId" label={t("Subject")} items={overview.subjects.map((item) => [item.id, item.name])} defaultValue={editing?.subjectId ?? ""} disabled={!selectedYearMutable} />
          <Select name="teacherUserId" label={t("Teacher")} items={overview.teachers.map((item) => [item.userId, item.fullName])} defaultValue={editing?.teacherUserId ?? ""} disabled={!selectedYearMutable} />
          <Select name="weekday" label={t("Weekday")} items={schoolWeekdays.map((day) => [day, t(day)])} defaultValue={editing?.weekday ?? ""} disabled={!selectedYearMutable} />
          <label>{t("Starts")}<input name="startsAt" type="time" defaultValue={editing?.startsAt ?? ""} required disabled={!selectedYearMutable} /></label>
          <label>{t("Ends")}<input name="endsAt" type="time" defaultValue={editing?.endsAt ?? ""} required disabled={!selectedYearMutable} /></label>
          <FormActions editing={Boolean(editing)} busy={busy || !selectedYearMutable} createLabel={t("Add period")} saveLabel={t("Save changes")} cancelLabel={t("Cancel edit")} onCancel={() => setEditingId(null)} />
        </form>
      </AcademicForm>

      <EntityList
        title={t("Timetable periods")}
        rows={selectedTimetable.map((item) => ({
          id: item.id,
          title: (classMap.get(item.classId)?.name ?? t("Class")) + " · " + (subjectMap.get(item.subjectId)?.name ?? t("Subject")),
          detail: (teacherMap.get(item.teacherUserId)?.fullName ?? t("Teacher")) + " · " + t(item.weekday) + " · " + item.startsAt + "–" + item.endsAt,
          action: selectedYearMutable ? <CrudActions t={t} busy={busy} onEdit={() => beginEdit(item.id)} onDelete={() => void remove("/v1/admin/academics/timetable/" + item.id, "Delete timetable period", "Timetable period deleted.")} /> : undefined
        }))}
      />

      <TimetableViews
        timetable={selectedTimetable}
        teachers={overview.teachers}
        classes={selectedClasses}
        subjects={overview.subjects}
        locale={locale}
      />
    </AcademicEntityPage>
  );
}

const academicPaneLabels: Record<Exclude<AcademicSection, "overview">, { form: string; list: string }> = {
  years: { form: "Create academic year", list: "List of academic years" },
  grades: { form: "Create grade", list: "List of grades" },
  subjects: { form: "Create subject", list: "List of subjects" },
  classes: { form: "Create class", list: "List of classes" },
  teachers: { form: "Create teacher profile", list: "List of teacher profiles" },
  assignments: { form: "Assign teacher", list: "List of teacher assignments" },
  negaran: { form: "Assign Negaran", list: "List of Negaran assignments" },
  timetable: { form: "Add timetable period", list: "List of timetable periods" }
};

function AcademicEntityPage({
  section,
  title,
  locale,
  busy,
  notice,
  children
}: {
  section: Exclude<AcademicSection, "overview">;
  title: string;
  locale: AdminLocale;
  busy: boolean;
  notice?: ReactNode;
  children: ReactNode;
}) {
  const t = (english: string) => adminText(locale, english);
  const paneLabels = academicPaneLabels[section];
  const [activePane, setActivePane] = useState<"FORM" | "LIST">("FORM");
  const content = Children.toArray(children);
  const formPane = content[0] ?? null;
  const listPane = content[1] ?? null;
  const extraContent = content.slice(2);

  return (
    <section className="academic-section admin-page-enter">
      <div className="admin-section-header academic-heading">
        <div>
          <Link className="admin-kicker academic-back-link" href="/admin/academics">← {t("Back to Academics")}</Link>
          <h2>{title}</h2>
          <p>{t("Create, review, edit, and safely delete records from this academic module.")}</p>
        </div>
      </div>
      {notice}

      <div className="academic-pane-switch" role="tablist" aria-label={t("Academic page view")}>
        <button
          type="button"
          role="tab"
          data-academic-pane="form"
          aria-selected={activePane === "FORM"}
          className={activePane === "FORM" ? "academic-pane-switch-button academic-pane-switch-button-active" : "academic-pane-switch-button"}
          onClick={() => setActivePane("FORM")}
        >
          {t(paneLabels.form)}
        </button>
        <button
          type="button"
          role="tab"
          data-academic-pane="list"
          aria-selected={activePane === "LIST"}
          className={activePane === "LIST" ? "academic-pane-switch-button academic-pane-switch-button-active" : "academic-pane-switch-button"}
          onClick={() => setActivePane("LIST")}
        >
          {t(paneLabels.list)}
        </button>
      </div>

      <div className={"academic-single-module academic-single-module-" + activePane.toLowerCase()}>
        <div className="academic-responsive-pane academic-responsive-pane-form">{formPane}</div>
        <div className="academic-responsive-pane academic-responsive-pane-list">{listPane}</div>
        {extraContent.map((item, index) => (
          <div className="academic-module-extra" key={"academic-extra-" + index}>{item}</div>
        ))}
      </div>
    </section>
  );
}

function AcademicForm({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <article className="admin-panel academic-form-card academic-single-form">
      <h2>{title}</h2>
      <p>{hint}</p>
      {children}
    </article>
  );
}

function FormActions({
  editing,
  busy,
  createLabel,
  saveLabel,
  cancelLabel,
  onCancel
}: {
  editing: boolean;
  busy: boolean;
  createLabel: string;
  saveLabel: string;
  cancelLabel: string;
  onCancel: () => void;
}) {
  return (
    <div className="admin-actions">
      <button className="admin-primary" disabled={busy}>{editing ? saveLabel : createLabel}</button>
      {editing ? <button className="admin-secondary" type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button> : null}
    </div>
  );
}

function CrudActions({
  t,
  busy,
  onEdit,
  onDelete
}: {
  t: (value: string) => string;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <button disabled={busy} onClick={onEdit}>{t("Edit")}</button>
      <button className="admin-danger" disabled={busy} onClick={onDelete}>{t("Delete")}</button>
    </>
  );
}

function Select({
  label,
  name,
  items,
  defaultValue = "",
  disabled = false
}: {
  label: string;
  name: string;
  items: Array<[string, string]>;
  defaultValue?: string;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <select name={name} required defaultValue={defaultValue} key={name + "-" + defaultValue} disabled={disabled}>
        <option value="" disabled>—</option>
        {items.map(([value, text]) => <option value={value} key={value}>{text}</option>)}
      </select>
    </label>
  );
}

function ReadOnlyYear({ year, locale }: { year: AcademicYear | null; locale: AdminLocale }) {
  const t = (english: string) => adminText(locale, english);
  return (
    <label>
      {t("Academic year")}
      <input value={year ? year.name + " · " + t(year.status) : "—"} disabled readOnly />
    </label>
  );
}

function EntityList({
  title,
  rows
}: {
  title: string;
  rows: Array<{ id: string; title: string; detail: string; action?: ReactNode }>;
}) {
  return (
    <article className="admin-panel academic-list-panel">
      <div className="admin-section-header">
        <div>
          <h2>{title}</h2>
          <p>{rows.length} record(s)</p>
        </div>
      </div>
      <div className="academic-rows">
        {rows.map((row) => (
          <div className="academic-row" key={row.id}>
            <div><strong>{row.title}</strong><span>{row.detail}</span></div>
            {row.action ? <div className="admin-actions">{row.action}</div> : null}
          </div>
        ))}
        {rows.length === 0 ? <p className="admin-copy">—</p> : null}
      </div>
    </article>
  );
}

function NegaranEndAction({
  locale,
  busy,
  onEnd
}: {
  locale: AdminLocale;
  busy: boolean;
  onEnd: (endDate: string) => Promise<unknown>;
}) {
  const t = (english: string) => adminText(locale, english);
  const [endDate, setEndDate] = useState("");
  return (
    <div className="admin-negaran-end">
      <AdminHijriDatePicker locale={locale} value={endDate} onChange={setEndDate} />
      <button disabled={busy || !endDate} onClick={() => void onEnd(endDate)}>{t("End assignment")}</button>
    </div>
  );
}

function TimetableViews({
  timetable,
  teachers,
  classes,
  subjects,
  locale
}: {
  timetable: TimetablePeriod[];
  teachers: Teacher[];
  classes: ClassSection[];
  subjects: Subject[];
  locale: AdminLocale;
}) {
  const t = (english: string) => adminText(locale, english);
  const [view, setView] = useState<"TEACHER" | "CLASS">("TEACHER");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");

  const classMap = useMemo(() => new Map(classes.map((item) => [item.id, item])), [classes]);
  const teacherMap = useMemo(() => new Map(teachers.map((item) => [item.userId, item])), [teachers]);
  const subjectMap = useMemo(() => new Map(subjects.map((item) => [item.id, item])), [subjects]);
  const visiblePeriods = useMemo(() => timetable.filter((period) => period.weekday !== "FRIDAY"), [timetable]);

  const timeSlots = useMemo(() => {
    const slots = new Map<string, { key: string; startsAt: string; endsAt: string }>();
    for (const period of visiblePeriods) {
      const key = period.startsAt + "-" + period.endsAt;
      if (!slots.has(key)) slots.set(key, { key, startsAt: period.startsAt, endsAt: period.endsAt });
    }
    return [...slots.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.endsAt.localeCompare(b.endsAt));
  }, [visiblePeriods]);

  const teacherGroups = useMemo(
    () => teachers.map((teacher) => ({
      id: teacher.userId,
      title: teacher.fullName,
      subtitle: teacher.employeeCode,
      periods: visiblePeriods.filter((period) => period.teacherUserId === teacher.userId)
    })).sort((a, b) => a.title.localeCompare(b.title)),
    [teachers, visiblePeriods]
  );

  const classGroups = useMemo(
    () => classes.map((item) => ({
      id: item.id,
      title: item.name,
      subtitle: item.code,
      periods: visiblePeriods.filter((period) => period.classId === item.id)
    })).sort((a, b) => a.title.localeCompare(b.title)),
    [classes, visiblePeriods]
  );

  useEffect(() => {
    if (teacherGroups.length === 0) setSelectedTeacherId("");
    else if (!teacherGroups.some((item) => item.id === selectedTeacherId)) setSelectedTeacherId(teacherGroups[0]?.id ?? "");
  }, [teacherGroups, selectedTeacherId]);

  useEffect(() => {
    if (classGroups.length === 0) setSelectedClassId("");
    else if (!classGroups.some((item) => item.id === selectedClassId)) setSelectedClassId(classGroups[0]?.id ?? "");
  }, [classGroups, selectedClassId]);

  const groups = view === "TEACHER" ? teacherGroups : classGroups;
  const selectedId = view === "TEACHER" ? selectedTeacherId : selectedClassId;
  const selectedGroup = groups.find((item) => item.id === selectedId) ?? groups[0] ?? null;

  return (
    <article className="admin-panel academic-list-panel academic-timetable-panel">
      <div className="admin-section-header academic-timetable-heading">
        <div>
          <h2>{t("Timetable")}</h2>
          <p>{t("Weekly timetable from Saturday through Thursday. Friday is not shown.")}</p>
        </div>
        <div className="academic-timetable-toggle" role="tablist" aria-label={t("Timetable view")}>
          <button type="button" role="tab" aria-selected={view === "TEACHER"} className={view === "TEACHER" ? "academic-timetable-tab academic-timetable-tab-active" : "academic-timetable-tab"} onClick={() => setView("TEACHER")}>{t("Teacher timetables")}</button>
          <button type="button" role="tab" aria-selected={view === "CLASS"} className={view === "CLASS" ? "academic-timetable-tab academic-timetable-tab-active" : "academic-timetable-tab"} onClick={() => setView("CLASS")}>{t("Class timetables")}</button>
        </div>
      </div>

      {timeSlots.length === 0 ? (
        <div className="admin-empty-state academic-timetable-empty">
          <strong>{t("No timetable periods yet")}</strong>
          <span>{t("Add timetable periods above and they will appear here automatically.")}</span>
        </div>
      ) : !selectedGroup ? (
        <div className="admin-empty-state academic-timetable-empty"><strong>—</strong></div>
      ) : (
        <div className="academic-timetable-browser">
          <aside className="academic-timetable-selector">
            <div className="academic-timetable-selector-heading"><strong>{t(view === "TEACHER" ? "Teachers" : "Classes")}</strong><span>{groups.length}</span></div>
            <div className="academic-timetable-selector-list">
              {groups.map((group) => (
                <button
                  type="button"
                  key={group.id}
                  className={group.id === selectedGroup.id ? "academic-timetable-person academic-timetable-person-active" : "academic-timetable-person"}
                  onClick={() => view === "TEACHER" ? setSelectedTeacherId(group.id) : setSelectedClassId(group.id)}
                >
                  <span className="academic-timetable-person-avatar">{group.title.slice(0, 1).toUpperCase()}</span>
                  <span className="academic-timetable-person-copy"><strong>{group.title}</strong><small>{group.subtitle}</small></span>
                  <span className="academic-timetable-person-count">{group.periods.length}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="academic-timetable-card">
            <div className="academic-timetable-card-heading">
              <div><strong>{selectedGroup.title}</strong><span>{selectedGroup.subtitle}</span></div>
              <span className="academic-timetable-count">{selectedGroup.periods.length} {t("period(s)")}</span>
            </div>
            <div className="academic-timetable-scroll">
              <table className="academic-week-grid">
                <thead>
                  <tr>
                    <th className="academic-week-day-column">{t("Day")}</th>
                    {timeSlots.map((slot) => <th key={slot.key}><span>{slot.startsAt}</span><small>{slot.endsAt}</small></th>)}
                  </tr>
                </thead>
                <tbody>
                  {schoolWeekdays.map((day) => (
                    <tr key={day}>
                      <th className="academic-week-day-column" scope="row">{t(day)}</th>
                      {timeSlots.map((slot) => {
                        const periods = selectedGroup.periods.filter((period) => period.weekday === day && period.startsAt === slot.startsAt && period.endsAt === slot.endsAt);
                        return (
                          <td key={slot.key}>
                            {periods.length ? (
                              <div className="academic-timetable-cell-stack">
                                {periods.map((period) => (
                                  <div className="academic-timetable-cell" key={period.id}>
                                    <strong>{subjectMap.get(period.subjectId)?.name ?? t("Subject")}</strong>
                                    <span>{view === "TEACHER" ? classMap.get(period.classId)?.name ?? t("Class") : teacherMap.get(period.teacherUserId)?.fullName ?? t("Teacher")}</span>
                                  </div>
                                ))}
                              </div>
                            ) : <span className="academic-timetable-free">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </article>
  );
}
