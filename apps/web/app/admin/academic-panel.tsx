"use client";
import { useTransientAdminFeedback } from "./admin-feedback";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminLoader, AdminSkeleton } from "./admin-loader";
import { AdminHijriDatePicker, formatAdminHijriDate } from "./admin-hijri-date-picker";
import { useAdminWorkspace } from "./admin-workspace";
import { adminErrorText, adminText } from "./admin-i18n";

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
const schoolWeekdays = ["SATURDAY", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"] as const;

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
  const { error, notice, setError, setNotice } = useTransientAdminFeedback();

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
      setError(adminErrorText(locale, cause, "Could not load academic structure."));
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
      setNotice(t(success));
      await load();
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Academic action failed."));
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
      <section className="admin-panel academic-section admin-loading-card">
        <AdminLoader label={t("Loading Phase 3 data…")} />
        <AdminSkeleton rows={5} />
        {error ? (
          <>
            <div className="admin-error" role="alert">{error}</div>
            <button className="admin-secondary" onClick={() => void load()}>{t("Retry")}</button>
          </>
        ) : null}
      </section>
    );
  }

  const teacherAccounts = users.filter((user) => user.role === "TEACHER" && user.status !== "ARCHIVED");
  const profiledTeacherIds = new Set(overview.teachers.map((teacher) => teacher.userId));

  return (
    <section className="academic-section admin-page-enter">
      <div className="admin-section-header academic-heading">
        <div>
          <span className="eyebrow">{t("Phase 3 · Academic Structure")}</span>
          <h2>{t("Model the school year")}</h2>
          <p>{t("Academic years, grades, classes, subjects, teachers, assignments, Negaran responsibility, and conflict-safe timetables.")}</p>
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
        <AcademicForm title={t("Academic year")} hint={t("Dates are stored canonically; the school calendar presentation can remain Solar Hijri.")}>
          <form className="admin-form" onSubmit={(event) => submit(event, "/v1/admin/academics/years", (form) => ({
            name: formValue(form, "name"),
            startDate: formValue(form, "startDate"),
            endDate: formValue(form, "endDate")
          }), "Academic year created.")}>
            <label>{t("Name")}<input name="name" placeholder="1405" required /></label>
            <label>{t("Start date")}<AdminHijriDatePicker locale={locale} name="startDate" required /></label>
            <label>{t("End date")}<AdminHijriDatePicker locale={locale} name="endDate" required /></label>
            <button className="admin-primary" disabled={busy}>{t("Create year")}</button>
          </form>
        </AcademicForm>

        <AcademicForm title={t("Grade level")} hint={t("Reusable grade definition such as Grade 7.")}>
          <form className="admin-form" onSubmit={(event) => submit(event, "/v1/admin/academics/grades", (form) => ({
            code: formValue(form, "code"),
            name: formValue(form, "name"),
            sortOrder: Number(formValue(form, "sortOrder") || "0")
          }), "Grade level created.")}>
            <label>{t("Code")}<input name="code" placeholder="G7" required /></label>
            <label>{t("Name")}<input name="name" placeholder={t("Grade 7")} required /></label>
            <label>{t("Sort order")}<input name="sortOrder" type="number" min="0" max="100" defaultValue="7" required /></label>
            <button className="admin-primary" disabled={busy}>{t("Create grade")}</button>
          </form>
        </AcademicForm>

        <AcademicForm title={t("Subject")} hint={t("School-level subject catalog.")}>
          <form className="admin-form" onSubmit={(event) => submit(event, "/v1/admin/academics/subjects", (form) => ({
            code: formValue(form, "code"),
            name: formValue(form, "name")
          }), "Subject created.")}>
            <label>{t("Code")}<input name="code" placeholder="MATH" required /></label>
            <label>{t("Name")}<input name="name" placeholder={t("Mathematics")} required /></label>
            <button className="admin-primary" disabled={busy}>{t("Create subject")}</button>
          </form>
        </AcademicForm>

        <AcademicForm title={t("Class section")} hint={t("A class belongs to one academic year and grade.")}>
          <form className="admin-form" onSubmit={(event) => submit(event, "/v1/admin/academics/classes", (form) => ({
            academicYearId: formValue(form, "academicYearId"),
            gradeLevelId: formValue(form, "gradeLevelId"),
            code: formValue(form, "code"),
            name: formValue(form, "name")
          }), "Class created.")}>
            <Select name="academicYearId" label={t("Academic year")} items={overview.academicYears.filter((year) => year.status === "DRAFT" || year.status === "ACTIVE").map((year) => [year.id, `${year.name} · ${t(year.status)}`])} />
            <Select name="gradeLevelId" label={t("Grade")} items={overview.gradeLevels.map((grade) => [grade.id, grade.name])} />
            <label>{t("Code")}<input name="code" placeholder="7A" required /></label>
            <label>{t("Name")}<input name="name" placeholder={t("Grade 7 A")} required /></label>
            <button className="admin-primary" disabled={busy}>{t("Create class")}</button>
          </form>
        </AcademicForm>

        <AcademicForm title={t("Teacher profile")} hint={t("Attach school details to an existing TEACHER account.")}>
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
            <label>{t("Full name")}<input name="fullName" placeholder={t("Teacher full name")} required /></label>
            <label>{t("Phone")}<input name="phone" placeholder="07xxxxxxxx" /></label>
            <button className="admin-primary" disabled={busy}>{t("Create teacher profile")}</button>
          </form>
        </AcademicForm>

        <AcademicForm title={t("Teacher assignment")} hint={t("Teacher → Subject → Class for one academic year.")}>
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

        <AcademicForm title={t("Negaran assignment")} hint={t("One primary class supervisor may be active for a class at a time.")}>
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
            <label>{t("Start date")}<AdminHijriDatePicker locale={locale} name="startDate" required /></label>
            <label>{t("End date (optional)")}<AdminHijriDatePicker locale={locale} name="endDate" /></label>
            <button className="admin-primary" disabled={busy}>{t("Assign Negaran")}</button>
          </form>
        </AcademicForm>

        <AcademicForm title={t("Timetable period")} hint={t("A period must match an existing teacher assignment. Class and teacher overlaps are rejected.")}>
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
            <Select name="weekday" label={t("Weekday")} items={schoolWeekdays.map((day) => [day, t(day)])} />
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
            <p>{t("Lifecycle: DRAFT → ACTIVE → CLOSED → ARCHIVED. Only one year can be active.")}</p>
          </div>
        </div>
        <div className="academic-rows">
          {overview.academicYears.map((year) => (
            <div className="academic-row" key={year.id}>
              <div>
                <strong>{year.name}</strong>
                <span>{formatAdminHijriDate(locale, year.startDate)} → {formatAdminHijriDate(locale, year.endDate)} · {t(year.status)}</span>
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
          title={t("Teacher assignments")}
          rows={overview.assignments.map((item) => ({
            id: item.id,
            title: teacherMap.get(item.teacherUserId)?.fullName ?? item.teacherUserId,
            detail: `${subjectMap.get(item.subjectId)?.name ?? t("Subject")} · ${classMap.get(item.classId)?.name ?? t("Class")} · ${yearMap.get(item.academicYearId)?.name ?? t("Year")}`
          }))}
        />
        <DataList
          title={t("Negaran history")}
          rows={overview.negaranAssignments.map((item) => ({
            id: item.id,
            title: classMap.get(item.classId)?.name ?? t("Class"),
            detail: `${teacherMap.get(item.teacherUserId)?.fullName ?? t("Teacher")} · ${formatAdminHijriDate(locale, item.startDate)} → ${item.endDate ? formatAdminHijriDate(locale, item.endDate) : t("Current")}`,
            action: item.endDate ? undefined : (
              <NegaranEndAction
                locale={locale}
                busy={busy}
                onEnd={(endDate) =>
                  mutate(`/v1/admin/academics/negaran/${item.id}/end`, { endDate }, "Negaran assignment ended.")
                }
              />
            )
          }))}
        />
      </div>

      <TimetableViews
        timetable={overview.timetable}
        teachers={overview.teachers}
        classes={overview.classes}
        subjects={overview.subjects}
        academicYears={overview.academicYears}
        locale={locale}
      />
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
        <option value="" disabled>—</option>
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
  locale: "fa-AF" | "ps-AF" | "en";
  busy: boolean;
  onEnd: (endDate: string) => Promise<void>;
}) {
  const t = (english: string) => adminText(locale, english);
  const [endDate, setEndDate] = useState("");

  return (
    <div className="admin-negaran-end">
      <AdminHijriDatePicker locale={locale} value={endDate} onChange={setEndDate} />
      <button disabled={busy || !endDate} onClick={() => void onEnd(endDate)}>
        {t("End assignment")}
      </button>
    </div>
  );
}


function TimetableViews({
  timetable,
  teachers,
  classes,
  subjects,
  academicYears,
  locale
}: {
  timetable: TimetablePeriod[];
  teachers: Teacher[];
  classes: ClassSection[];
  subjects: Subject[];
  academicYears: AcademicYear[];
  locale: "fa-AF" | "ps-AF" | "en";
}) {
  const t = (english: string) => adminText(locale, english);
  const [view, setView] = useState<"TEACHER" | "CLASS">("TEACHER");

  const classMap = useMemo(() => new Map(classes.map((item) => [item.id, item])), [classes]);
  const teacherMap = useMemo(() => new Map(teachers.map((item) => [item.userId, item])), [teachers]);
  const subjectMap = useMemo(() => new Map(subjects.map((item) => [item.id, item])), [subjects]);
  const yearMap = useMemo(() => new Map(academicYears.map((item) => [item.id, item])), [academicYears]);

  const visiblePeriods = useMemo(
    () => timetable.filter((period) => period.weekday !== "FRIDAY"),
    [timetable]
  );

  const timeSlots = useMemo(() => {
    const slots = new Map<string, { key: string; startsAt: string; endsAt: string }>();
    for (const period of visiblePeriods) {
      const key = `${period.startsAt}-${period.endsAt}`;
      if (!slots.has(key)) {
        slots.set(key, { key, startsAt: period.startsAt, endsAt: period.endsAt });
      }
    }
    return [...slots.values()].sort((left, right) =>
      left.startsAt.localeCompare(right.startsAt) || left.endsAt.localeCompare(right.endsAt)
    );
  }, [visiblePeriods]);

  const teacherGroups = useMemo(
    () =>
      teachers
        .map((teacher) => ({
          id: teacher.userId,
          title: teacher.fullName,
          subtitle: teacher.employeeCode,
          periods: visiblePeriods.filter((period) => period.teacherUserId === teacher.userId)
        }))
        .sort((left, right) => left.title.localeCompare(right.title)),
    [teachers, visiblePeriods]
  );

  const classGroups = useMemo(
    () =>
      classes
        .map((classSection) => ({
          id: classSection.id,
          title: classSection.name,
          subtitle: classSection.code,
          periods: visiblePeriods.filter((period) => period.classId === classSection.id)
        }))
        .sort((left, right) => left.title.localeCompare(right.title)),
    [classes, visiblePeriods]
  );

  const groups = view === "TEACHER" ? teacherGroups : classGroups;

  return (
    <article className="admin-panel academic-list-panel academic-timetable-panel">
      <div className="admin-section-header academic-timetable-heading">
        <div>
          <h2>{t("Timetable")}</h2>
          <p>{t("Weekly timetable from Saturday through Thursday. Friday is not shown.")}</p>
        </div>
        <div className="academic-timetable-toggle" role="tablist" aria-label={t("Timetable view")}>
          <button
            type="button"
            role="tab"
            aria-selected={view === "TEACHER"}
            className={view === "TEACHER" ? "academic-timetable-tab academic-timetable-tab-active" : "academic-timetable-tab"}
            onClick={() => setView("TEACHER")}
          >
            {t("Teacher timetables")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "CLASS"}
            className={view === "CLASS" ? "academic-timetable-tab academic-timetable-tab-active" : "academic-timetable-tab"}
            onClick={() => setView("CLASS")}
          >
            {t("Class timetables")}
          </button>
        </div>
      </div>

      {timeSlots.length === 0 ? (
        <div className="admin-empty-state academic-timetable-empty">
          <strong>{t("No timetable periods yet")}</strong>
          <span>{t("Add timetable periods above and they will appear here automatically.")}</span>
        </div>
      ) : (
        <div className="academic-timetable-groups">
          {groups.map((group) => (
            <section className="academic-timetable-card" key={group.id}>
              <div className="academic-timetable-card-heading">
                <div>
                  <strong>{group.title}</strong>
                  <span>{group.subtitle}</span>
                </div>
                <span className="academic-timetable-count">
                  {group.periods.length} {t("period(s)")}
                </span>
              </div>

              <div className="academic-timetable-scroll">
                <table className="academic-week-grid">
                  <thead>
                    <tr>
                      <th className="academic-week-day-column">{t("Day")}</th>
                      {timeSlots.map((slot) => (
                        <th key={slot.key}>
                          <span>{slot.startsAt}</span>
                          <small>{slot.endsAt}</small>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {schoolWeekdays.map((day) => (
                      <tr key={day}>
                        <th className="academic-week-day-column" scope="row">{t(day)}</th>
                        {timeSlots.map((slot) => {
                          const periods = group.periods.filter(
                            (period) =>
                              period.weekday === day &&
                              period.startsAt === slot.startsAt &&
                              period.endsAt === slot.endsAt
                          );

                          return (
                            <td key={slot.key}>
                              {periods.length > 0 ? (
                                <div className="academic-timetable-cell-stack">
                                  {periods.map((period) => (
                                    <div className="academic-timetable-cell" key={period.id}>
                                      <strong>{subjectMap.get(period.subjectId)?.name ?? t("Subject")}</strong>
                                      <span>
                                        {view === "TEACHER"
                                          ? classMap.get(period.classId)?.name ?? t("Class")
                                          : teacherMap.get(period.teacherUserId)?.fullName ?? t("Teacher")}
                                      </span>
                                      {periods.length > 1 ? (
                                        <small>{yearMap.get(period.academicYearId)?.name ?? ""}</small>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="academic-timetable-free" aria-label={t("No class scheduled")}>—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
