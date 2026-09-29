"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAdminWorkspace } from "./admin-workspace";
import { adminText } from "./admin-i18n";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const weekdays = ["SATURDAY", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

async function request<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.message ?? "Request failed.");
  return body as T;
}

function formValue(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export function AcademicPanel({ accessToken }: { accessToken: string }) {
  const { locale } = useAdminWorkspace();
  const t = (english: string) => adminText(locale, english);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const yearMap = useMemo(() => new Map(overview?.academicYears.map((item) => [item.id, item]) ?? []), [overview]);
  const classMap = useMemo(() => new Map(overview?.classes.map((item) => [item.id, item]) ?? []), [overview]);
  const subjectMap = useMemo(() => new Map(overview?.subjects.map((item) => [item.id, item]) ?? []), [overview]);
  const teacherMap = useMemo(() => new Map(overview?.teachers.map((item) => [item.userId, item]) ?? []), [overview]);

  useEffect(() => {
    void load();
  }, [accessToken]);

  async function load() {
    setError("");
    try {
      const [academicData, accountData] = await Promise.all([
        request<Overview>(accessToken, "/v1/admin/academics"),
        request<{ users: User[] }>(accessToken, "/v1/admin/users")
      ]);
      setOverview(academicData);
      setUsers(accountData.users);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load academic structure.");
    }
  }

  async function mutate(path: string, payload?: Record<string, unknown>, success = "Saved.") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(accessToken, path, {
        method: "POST",
        ...(payload ? { body: JSON.stringify(payload) } : {})
      });
      setNotice(success);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Academic action failed.");
    } finally {
      setBusy(false);
    }
  }

  function submit(
    event: FormEvent<HTMLFormElement>,
    path: string,
    toPayload: (form: FormData) => Record<string, unknown>,
    success: string
  ) {
    event.preventDefault();
    const element = event.currentTarget;
    const data = new FormData(element);
    void mutate(path, toPayload(data), success).then(() => {
      if (!error) element.reset();
    });
  }

  if (!overview) {
    return (
      <section className="admin-panel academic-section">
        <div className="admin-section-header">
          <div>
            <h2>{t("Academic structure")}</h2>
            <p>{t("Loading Phase 3 data…")}</p>
          </div>
          <button className="admin-secondary" onClick={() => void load()}>{t("Retry")}</button>
        </div>
        {error ? <div className="admin-error" role="alert">{error}</div> : null}
      </section>
    );
  }

  const teacherAccounts = users.filter((user) => user.role === "TEACHER" && user.status !== "ARCHIVED");
  const profiledTeacherIds = new Set(overview.teachers.map((teacher) => teacher.userId));

  return (
    <section className="academic-section">
      <div className="admin-section-header academic-heading">
        <div>
          <span className="eyebrow">{t("Phase 3 · Academic Structure")}</span>
          <h2>{t("Model the school year")}</h2>
          <p>Academic years, grades, classes, subjects, teachers, assignments, Negaran responsibility, and conflict-safe timetables.</p>
        </div>
        <button className="admin-secondary" onClick={() => void load()} disabled={busy}>{t("Refresh")}</button>
      </div>

      {error ? <div className="admin-error" role="alert">{error}</div> : null}
      {notice ? <div className="admin-success" role="status">{notice}</div> : null}

      <div className="academic-summary-grid">
        <Summary label={t("Academic years")} value={overview.academicYears.length} />
        <Summary label={t("Classes")} value={overview.classes.length} />
        <Summary label={t("Subjects")} value={overview.subjects.length} />
        <Summary label={t("Teachers")} value={overview.teachers.length} />
        <Summary label={t("Assignments")} value={overview.assignments.length} />
        <Summary label={t("Timetable periods")} value={overview.timetable.length} />
      </div>

      <div className="academic-form-grid">
        <AcademicForm title={t("Academic year")} hint="Dates are stored canonically; the school calendar presentation can remain Solar Hijri.">
          <form className="admin-form" onSubmit={(event) => submit(event, "/v1/admin/academics/years", (form) => ({
            name: formValue(form, "name"),
            startDate: formValue(form, "startDate"),
            endDate: formValue(form, "endDate")
          }), "Academic year created.")}>
            <label>{t("Name")}<input name="name" placeholder="1405" required /></label>
            <label>{t("Start date")}<input name="startDate" type="date" required /></label>
            <label>{t("End date")}<input name="endDate" type="date" required /></label>
            <button className="admin-primary" disabled={busy}>{t("Create year")}</button>
          </form>
        </AcademicForm>

        <AcademicForm title={t("Grade level")} hint="Reusable grade definition such as Grade 7.">
          <form className="admin-form" onSubmit={(event) => submit(event, "/v1/admin/academics/grades", (form) => ({
            code: formValue(form, "code"),
            name: formValue(form, "name"),
            sortOrder: Number(formValue(form, "sortOrder") || "0")
          }), "Grade level created.")}>
            <label>{t("Code")}<input name="code" placeholder="G7" required /></label>
            <label>{t("Name")}<input name="name" placeholder="Grade 7" required /></label>
            <label>{t("Sort order")}<input name="sortOrder" type="number" min="0" max="100" defaultValue="7" required /></label>
            <button className="admin-primary" disabled={busy}>{t("Create grade")}</button>
          </form>
        </AcademicForm>

        <AcademicForm title={t("Subject")} hint="School-level subject catalog.">
          <form className="admin-form" onSubmit={(event) => submit(event, "/v1/admin/academics/subjects", (form) => ({
            code: formValue(form, "code"),
            name: formValue(form, "name")
          }), "Subject created.")}>
            <label>{t("Code")}<input name="code" placeholder="MATH" required /></label>
            <label>{t("Name")}<input name="name" placeholder="Mathematics" required /></label>
            <button className="admin-primary" disabled={busy}>{t("Create subject")}</button>
          </form>
        </AcademicForm>

        <AcademicForm title={t("Class section")} hint="A class belongs to one academic year and grade.">
          <form className="admin-form" onSubmit={(event) => submit(event, "/v1/admin/academics/classes", (form) => ({
            academicYearId: formValue(form, "academicYearId"),
            gradeLevelId: formValue(form, "gradeLevelId"),
            code: formValue(form, "code"),
            name: formValue(form, "name")
          }), "Class created.")}>
            <Select name="academicYearId" label={t("Academic year")} items={overview.academicYears.filter((year) => year.status === "DRAFT" || year.status === "ACTIVE").map((year) => [year.id, `${year.name} · ${year.status}`])} />
            <Select name="gradeLevelId" label={t("Grade")} items={overview.gradeLevels.map((grade) => [grade.id, grade.name])} />
            <label>{t("Code")}<input name="code" placeholder="7A" required /></label>
            <label>{t("Name")}<input name="name" placeholder="Grade 7 A" required /></label>
            <button className="admin-primary" disabled={busy}>{t("Create class")}</button>
          </form>
        </AcademicForm>

        <AcademicForm title={t("Teacher profile")} hint="Attach school details to an existing TEACHER account.">
          <form className="admin-form" onSubmit={(event) => submit(event, "/v1/admin/academics/teachers", (form) => ({
            userId: formValue(form, "userId"),
            employeeCode: formValue(form, "employeeCode"),
            fullName: formValue(form, "fullName"),
            phone: formValue(form, "phone") || undefined
          }), "Teacher profile created.")}>
            <Select
              name="userId"
              label={t("Teacher account")}
              items={teacherAccounts.filter((user) => !profiledTeacherIds.has(user.id)).map((user) => [user.id, user.username])}
            />
            <label>{t("Employee code")}<input name="employeeCode" placeholder="T-001" required /></label>
            <label>{t("Full name")}<input name="fullName" placeholder="Teacher full name" required /></label>
            <label>{t("Phone")}<input name="phone" placeholder="07xxxxxxxx" /></label>
            <button className="admin-primary" disabled={busy}>{t("Create teacher profile")}</button>
          </form>
        </AcademicForm>

        <AcademicForm title={t("Teacher assignment")} hint="Teacher → Subject → Class for one academic year.">
          <form className="admin-form" onSubmit={(event) => submit(event, "/v1/admin/academics/assignments", (form) => ({
            academicYearId: formValue(form, "academicYearId"),
            classId: formValue(form, "classId"),
            subjectId: formValue(form, "subjectId"),
            teacherUserId: formValue(form, "teacherUserId")
          }), "Teacher assignment created.")}>
            <Select name="academicYearId" label={t("Academic year")} items={overview.academicYears.filter((year) => year.status === "DRAFT" || year.status === "ACTIVE").map((year) => [year.id, year.name])} />
            <Select name="classId" label={t("Class")} items={overview.classes.map((item) => [item.id, item.name])} />
            <Select name="subjectId" label={t("Subject")} items={overview.subjects.map((item) => [item.id, item.name])} />
            <Select name="teacherUserId" label={t("Teacher")} items={overview.teachers.map((item) => [item.userId, item.fullName])} />
            <button className="admin-primary" disabled={busy}>{t("Assign teacher")}</button>
          </form>
        </AcademicForm>

        <AcademicForm title={t("Negaran assignment")} hint="One primary class supervisor may be active for a class at a time.">
          <form className="admin-form" onSubmit={(event) => submit(event, "/v1/admin/academics/negaran", (form) => ({
            academicYearId: formValue(form, "academicYearId"),
            classId: formValue(form, "classId"),
            teacherUserId: formValue(form, "teacherUserId"),
            startDate: formValue(form, "startDate"),
            ...(formValue(form, "endDate") ? { endDate: formValue(form, "endDate") } : {})
          }), "Negaran assigned.")}>
            <Select name="academicYearId" label={t("Academic year")} items={overview.academicYears.filter((year) => year.status === "DRAFT" || year.status === "ACTIVE").map((year) => [year.id, year.name])} />
            <Select name="classId" label={t("Class")} items={overview.classes.map((item) => [item.id, item.name])} />
            <Select name="teacherUserId" label={t("Teacher")} items={overview.teachers.map((item) => [item.userId, item.fullName])} />
            <label>{t("Start date")}<input name="startDate" type="date" required /></label>
            <label>{t("End date (optional)")}<input name="endDate" type="date" /></label>
            <button className="admin-primary" disabled={busy}>{t("Assign Negaran")}</button>
          </form>
        </AcademicForm>

        <AcademicForm title={t("Timetable period")} hint="A period must match an existing teacher assignment. Class and teacher overlaps are rejected.">
          <form className="admin-form" onSubmit={(event) => submit(event, "/v1/admin/academics/timetable", (form) => ({
            academicYearId: formValue(form, "academicYearId"),
            classId: formValue(form, "classId"),
            subjectId: formValue(form, "subjectId"),
            teacherUserId: formValue(form, "teacherUserId"),
            weekday: formValue(form, "weekday"),
            startsAt: formValue(form, "startsAt"),
            endsAt: formValue(form, "endsAt")
          }), "Timetable period created.")}>
            <Select name="academicYearId" label={t("Academic year")} items={overview.academicYears.filter((year) => year.status === "DRAFT" || year.status === "ACTIVE").map((year) => [year.id, year.name])} />
            <Select name="classId" label={t("Class")} items={overview.classes.map((item) => [item.id, item.name])} />
            <Select name="subjectId" label={t("Subject")} items={overview.subjects.map((item) => [item.id, item.name])} />
            <Select name="teacherUserId" label={t("Teacher")} items={overview.teachers.map((item) => [item.userId, item.fullName])} />
            <Select name="weekday" label={t("Weekday")} items={weekdays.map((day) => [day, day[0] + day.slice(1).toLowerCase()])} />
            <label>{t("Starts")}<input name="startsAt" type="time" required /></label>
            <label>{t("Ends")}<input name="endsAt" type="time" required /></label>
            <button className="admin-primary" disabled={busy}>{t("Add period")}</button>
          </form>
        </AcademicForm>
      </div>

      <article className="admin-panel academic-list-panel">
        <div className="admin-section-header">
          <div>
            <h2>{t("Academic years")}</h2>
            <p>Lifecycle: DRAFT → ACTIVE → CLOSED → ARCHIVED. Only one year can be active.</p>
          </div>
        </div>
        <div className="academic-rows">
          {overview.academicYears.map((year) => (
            <div className="academic-row" key={year.id}>
              <div>
                <strong>{year.name}</strong>
                <span>{year.startDate} → {year.endDate} · {year.status}</span>
              </div>
              <div className="admin-actions">
                {year.status === "DRAFT" ? <button disabled={busy} onClick={() => void mutate(`/v1/admin/academics/years/${year.id}/activate`, undefined, "Academic year activated.")}>{t("Activate")}</button> : null}
                {year.status === "ACTIVE" ? <button disabled={busy} onClick={() => void mutate(`/v1/admin/academics/years/${year.id}/close`, undefined, "Academic year closed.")}>{t("Close")}</button> : null}
                {year.status === "CLOSED" ? <button disabled={busy} onClick={() => void mutate(`/v1/admin/academics/years/${year.id}/archive`, undefined, "Academic year archived.")}>{t("Archive")}</button> : null}
              </div>
            </div>
          ))}
        </div>
      </article>

      <div className="academic-data-grid">
        <DataList
          title="Teacher assignments"
          rows={overview.assignments.map((item) => ({
            id: item.id,
            title: teacherMap.get(item.teacherUserId)?.fullName ?? item.teacherUserId,
            detail: `${subjectMap.get(item.subjectId)?.name ?? "Subject"} · ${classMap.get(item.classId)?.name ?? "Class"} · ${yearMap.get(item.academicYearId)?.name ?? "Year"}`
          }))}
        />
        <DataList
          title="Negaran history"
          rows={overview.negaranAssignments.map((item) => ({
            id: item.id,
            title: classMap.get(item.classId)?.name ?? "Class",
            detail: `${teacherMap.get(item.teacherUserId)?.fullName ?? "Teacher"} · ${item.startDate} → ${item.endDate ?? "current"}`,
            action: item.endDate ? undefined : (
              <button
                disabled={busy}
                onClick={() => {
                  const endDate = window.prompt("End date (YYYY-MM-DD)");
                  if (endDate) void mutate(`/v1/admin/academics/negaran/${item.id}/end`, { endDate }, "Negaran assignment ended.");
                }}
              >
                End assignment
              </button>
            )
          }))}
        />
      </div>

      <article className="admin-panel academic-list-panel">
        <h2>{t("Timetable")}</h2>
        <div className="academic-table-wrap">
          <table className="academic-table">
            <thead>
              <tr><th>{t("Day")}</th><th>{t("Time")}</th><th>{t("Class")}</th><th>{t("Subject")}</th><th>{t("Teacher")}</th></tr>
            </thead>
            <tbody>
              {overview.timetable.map((period) => (
                <tr key={period.id}>
                  <td>{period.weekday}</td>
                  <td>{period.startsAt}–{period.endsAt}</td>
                  <td>{classMap.get(period.classId)?.name ?? "—"}</td>
                  <td>{subjectMap.get(period.subjectId)?.name ?? "—"}</td>
                  <td>{teacherMap.get(period.teacherUserId)?.fullName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="academic-summary"><strong>{value}</strong><span>{label}</span></div>;
}

function AcademicForm({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <article className="admin-panel academic-form-card">
      <h2>{title}</h2>
      <p>{hint}</p>
      {children}
    </article>
  );
}

function Select({ label, name, items }: { label: string; name: string; items: Array<[string, string]> }) {
  return (
    <label>
      {label}
      <select name={name} required defaultValue="">
        <option value="" disabled>Select {label.toLowerCase()}</option>
        {items.map(([value, text]) => <option value={value} key={value}>{text}</option>)}
      </select>
    </label>
  );
}

function DataList({
  title,
  rows
}: {
  title: string;
  rows: Array<{ id: string; title: string; detail: string; action?: React.ReactNode }>;
}) {
  return (
    <article className="admin-panel academic-list-panel">
      <h2>{title}</h2>
      <div className="academic-rows">
        {rows.map((row) => (
          <div className="academic-row" key={row.id}>
            <div><strong>{row.title}</strong><span>{row.detail}</span></div>
            {row.action ? <div className="admin-actions">{row.action}</div> : null}
          </div>
        ))}
        {rows.length === 0 ? <p className="admin-copy">Nothing here yet.</p> : null}
      </div>
    </article>
  );
}
