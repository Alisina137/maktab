"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { adminApi } from "./admin-client";
import { adminText, type AdminLocale } from "./admin-i18n";
import { AcademicSectionIcon } from "./academic-section-icons";

type Overview = {
  academicYears: Array<{ id: string; name: string; status: string }>;
  gradeLevels: Array<{ id: string; code: string; name: string }>;
  classes: Array<{ id: string; academicYearId: string; gradeLevelId: string; code: string; name: string }>;
  subjects: Array<{ id: string; code: string; name: string }>;
  teachers: Array<{ userId: string; fullName: string; employeeCode: string }>;
  assignments: Array<{ id: string; academicYearId: string; teacherUserId: string; subjectId: string; classId: string }>;
  timetable: Array<{ id: string; academicYearId: string; teacherUserId: string; subjectId: string; classId: string; weekday: string; startsAt: string; endsAt: string }>;
};

const tabs = [
  { label: "Overview", href: "/admin/academics" },
  { label: "Classes", href: "/admin/academics/classes" },
  { label: "Teacher profiles", href: "/admin/academics/teachers" },
  { label: "Subjects", href: "/admin/academics/subjects" },
  { label: "Timetable", href: "/admin/academics/timetable" },
  { label: "Academic years", href: "/admin/academics/years" }
] as const;

type SymbolName = "students" | "teachers" | "classes" | "subjects" | "calendar" | "chart" | "arrow" | "clock" | "refresh";

const symbols: Record<SymbolName, string> = {
  students: "M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2h14zM9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm13 9v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8",
  teachers: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-2a8 8 0 0 1 16 0v2H4z",
  classes: "M12 3 2 8l10 5 10-5-10-5zM2 12l10 5 10-5M2 16l10 5 10-5",
  subjects: "M4 19.5C4 18 5 17 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2ZM9 7h7M9 11h5",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  chart: "M4 20V12M10 20V5M16 20v-9M22 20V8M2 20h22",
  arrow: "M5 12h14M13 6l6 6-6 6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 2",
  refresh: "M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5"
};

function Icon({ name, size = 20 }: { name: SymbolName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={symbols[name]} /></svg>;
}

function numberOf(value: number, locale: AdminLocale) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : locale).format(value);
}

export function AdminAcademicOverview({
  data, yearId, accessToken, locale, onRefresh
}: {
  data: Overview;
  yearId: string;
  accessToken: string;
  locale: AdminLocale;
  onRefresh: () => Promise<boolean>;
}) {
  const t = (key: string) => adminText(locale, key);
  const [studentTotal, setStudentTotal] = useState<number | null>(null);
  const [studentLoading, setStudentLoading] = useState(true);
  const [fetchNonce, setFetchNonce] = useState(0);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [classChoice, setClassChoice] = useState("");
  const [todayWeekday, setTodayWeekday] = useState("");
  const [todayDate, setTodayDate] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setStudentTotal(null);
    setStudentLoading(true);
    void adminApi<{ counts: { students: number } }>("/v1/admin/pilot/readiness", {
      headers: { Authorization: "Bearer " + accessToken },
      signal: controller.signal,
      cache: "no-store"
    }).then((result) => {
      if (controller.signal.aborted) return;
      const count = result?.counts?.students;
      setStudentTotal(Number.isSafeInteger(count) && count >= 0 ? count : null);
    }).catch(() => {
      if (!controller.signal.aborted) setStudentTotal(null);
    }).finally(() => {
      if (!controller.signal.aborted) setStudentLoading(false);
    });
    return () => controller.abort();
  }, [accessToken, fetchNonce]);

  useEffect(() => {
    const now = new Date();
    setTodayWeekday(new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Kabul" }).format(now).toUpperCase());
    setTodayDate(new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
      dateStyle: "medium", timeZone: "Asia/Kabul"
    }).format(now));
  }, [locale]);

  const selectedClasses = useMemo(() => data.classes.filter((row) => row.academicYearId === yearId)
    .sort((a, b) => a.name.localeCompare(b.name)), [data.classes, yearId]);
  const currentAssignments = useMemo(() => data.assignments.filter((row) => row.academicYearId === yearId),
    [data.assignments, yearId]);
  const gradeMap = useMemo(() => new Map(data.gradeLevels.map((row) => [row.id, row])),
    [data.gradeLevels]);
  const subjectMap = useMemo(() => new Map(data.subjects.map((row) => [row.id, row])),
    [data.subjects]);
  const teacherMap = useMemo(() => new Map(data.teachers.map((row) => [row.userId, row])),
    [data.teachers]);
  const classMap = useMemo(() => new Map(data.classes.map((row) => [row.id, row])),
    [data.classes]);
  const shownClass = selectedClasses.find((row) => row.id === classChoice) ?? selectedClasses[0] ?? null;
  const shownYear = data.academicYears.find((row) => row.id === yearId) ?? null;
  const selectedPeriods = data.timetable.filter((row) => row.academicYearId === yearId &&
    row.classId === shownClass?.id && row.weekday === todayWeekday)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const classTeacherCount = (id: string) => new Set(currentAssignments
    .filter((row) => row.classId === id).map((row) => row.teacherUserId)).size;
  const teacherClasses = (id: string) => new Set(currentAssignments
    .filter((row) => row.teacherUserId === id).map((row) => row.classId)).size;
  const subjectTeachers = (id: string) => new Set(currentAssignments
    .filter((row) => row.subjectId === id).map((row) => row.teacherUserId)).size;
  const displayTeachers = data.teachers.slice(0, 5);
  const displaySubjects = data.subjects.slice(0, 5);

  const metrics = [
    { label: "Total students", value: studentLoading ? "…" : studentTotal === null ? "—" : numberOf(studentTotal, locale), icon: "students", theme: "blue" },
    { label: "Total teachers", value: numberOf(data.teachers.length, locale), icon: "teachers", theme: "green" },
    { label: "Total classes", value: numberOf(selectedClasses.length, locale), icon: "classes", theme: "orange" },
    { label: "Total subjects", value: numberOf(data.subjects.length, locale), icon: "subjects", theme: "purple" }
  ] as const;

  async function refreshAll() {
    setRefreshBusy(true);
    try {
      await onRefresh();
      setFetchNonce((value) => value + 1);
    } finally {
      setRefreshBusy(false);
    }
  }

  return (
    <section className="ml-academic-overview admin-page-enter" aria-label={t("Academic Management")}>
      <div className="ml-academic-tabbar" role="navigation" aria-label={t("Academic sections")}>
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={tab.href === "/admin/academics" ? "ml-academic-tab ml-academic-tab-active" : "ml-academic-tab"}
            aria-current={tab.href === "/admin/academics" ? "page" : undefined}>
              <AcademicSectionIcon href={tab.href} size={16} />{t(tab.label)}
            </Link>
        ))}
        <button className="ml-academic-refresh" type="button" onClick={() => void refreshAll()}
          disabled={refreshBusy} aria-label={t("Refresh")} title={t("Refresh")}><Icon name="refresh" size={17} /></button>
      </div>

      <div className="ml-academic-metrics">
        {metrics.map((metric) => (
          <article key={metric.label} className={"ml-academic-metric ml-academic-metric-" + metric.theme}>
            <div className="ml-academic-metric-icon"><Icon name={metric.icon} size={25} /></div>
            <div className="ml-academic-metric-copy"><span>{t(metric.label)}</span><strong>{metric.value}</strong></div>
            <span className="ml-academic-metric-bg" aria-hidden="true"><Icon name={metric.icon} size={58} /></span>
          </article>
        ))}
      </div>

      <div className="ml-academic-directory-grid">
        <article className="ml-academic-card">
          <div className="ml-academic-card-heading"><h2><Icon name="classes" size={20} />{t("Classes")}</h2>
            <Link href="/admin/academics/classes">{t("View details")} <Icon name="arrow" size={15} /></Link></div>
          <div className="ml-academic-table-wrap">
            <table><thead><tr><th>{t("Class")}</th><th>{t("Grade levels")}</th><th>{t("Teachers")}</th></tr></thead>
            <tbody>
              {selectedClasses.slice(0, 5).map((row) => (
                <tr key={row.id}>
                  <td><Link href="/admin/academics/classes"><span className="ml-academic-table-icon">▦</span>{row.name}</Link></td>
                  <td>{gradeMap.get(row.gradeLevelId)?.name ?? "—"}</td>
                  <td>{numberOf(classTeacherCount(row.id), locale)}</td>
                </tr>
              ))}
              {!selectedClasses.length ? <tr><td colSpan={3}>{t("No classes yet.")}</td></tr> : null}
            </tbody></table>
          </div>
        </article>

        <article className="ml-academic-card">
          <div className="ml-academic-card-heading"><h2><Icon name="teachers" size={20} />{t("Teachers")}</h2>
            <Link href="/admin/academics/teachers">{t("View details")} <Icon name="arrow" size={15} /></Link></div>
          <div className="ml-academic-table-wrap">
            <table><thead><tr><th>{t("Teacher")}</th><th>{t("Subjects")}</th><th>{t("Classes")}</th></tr></thead>
              <tbody>
              {displayTeachers.map((row) => {
                const subjects = [...new Set(currentAssignments.filter((item) => item.teacherUserId === row.userId)
                  .map((item) => subjectMap.get(item.subjectId)?.name).filter((value): value is string => Boolean(value)))];
                return <tr key={row.userId}>
                  <td><Link href="/admin/academics/teachers"><span className="ml-academic-table-person">{row.fullName.charAt(0) || "T"}</span>{row.fullName}</Link></td>
                  <td title={subjects.join(", ")}>{subjects.slice(0, 2).join(", ") || "—"}</td>
                  <td>{numberOf(teacherClasses(row.userId), locale)}</td>
                </tr>;
              })}
              {!displayTeachers.length ? <tr><td colSpan={3}>{t("No teachers found.")}</td></tr> : null}
            </tbody></table>
          </div>
        </article>

        <article className="ml-academic-card">
          <div className="ml-academic-card-heading"><h2><Icon name="subjects" size={20} />{t("Subjects")}</h2>
            <Link href="/admin/academics/subjects">{t("View details")} <Icon name="arrow" size={15} /></Link></div>
          <div className="ml-academic-table-wrap">
            <table><thead><tr><th>{t("Subject")}</th><th>{t("Code")}</th><th>{t("Teachers")}</th></tr></thead>
              <tbody>
                {displaySubjects.map((row) => <tr key={row.id}>
                  <td><Link href="/admin/academics/subjects"><span className="ml-academic-table-icon ml-academic-table-subject">▣</span>{row.name}</Link></td>
                  <td>{row.code}</td><td>{numberOf(subjectTeachers(row.id), locale)}</td>
                </tr>)}
                {!displaySubjects.length ? <tr><td colSpan={3}>{t("No subjects found.")}</td></tr> : null}
              </tbody></table>
          </div>
        </article>
      </div>

      <div className="ml-academic-lower-grid">
        <article className="ml-academic-card ml-academic-timetable">
          <div className="ml-academic-card-heading">
            <h2><Icon name="calendar" size={20} />{t("Today's timetable")}</h2>
            <div className="ml-academic-timetable-controls">
              {selectedClasses.length > 0 ? (
                <select aria-label={t("Class")} value={shownClass?.id ?? ""}
                  onChange={(event) => setClassChoice(event.target.value)}>
                  {selectedClasses.map((row) => <option value={row.id} key={row.id}>{row.name}</option>)}
                </select>
              ) : null}
              <span className="ml-academic-date"><Icon name="calendar" size={16} />{todayDate}</span>
            </div>
          </div>
          {selectedPeriods.length ? (
            <div className="ml-academic-periods">
              {selectedPeriods.map((row, i) => <div className="ml-academic-period" key={row.id}>
                <small>{t("Period")} {numberOf(i + 1, locale)}</small>
                <span dir="ltr">{row.startsAt.slice(0, 5)} – {row.endsAt.slice(0, 5)}</span>
                <strong>{subjectMap.get(row.subjectId)?.name ?? "—"}</strong>
                <small>{teacherMap.get(row.teacherUserId)?.fullName ?? ""}</small>
              </div>)}
            </div>
          ) : <div className="ml-academic-no-periods"><Icon name="clock" size={23} />
            <span>{t("No lessons scheduled for today.")}</span>
            <Link href="/admin/academics/timetable">{t("Open timetable")} <Icon name="arrow" size={15} /></Link>
          </div>}
        </article>

        <article className="ml-academic-card ml-academic-summary">
          <div className="ml-academic-card-heading"><h2><Icon name="chart" size={20} />{t("Academic summary")}</h2>
            <Link href="/admin/academics/years">{t("View details")} <Icon name="arrow" size={15} /></Link></div>
          <dl>
            <div><dt>{t("Academic year")}</dt><dd>{shownYear?.name ?? "—"} {shownYear ? <span className="ml-academic-status">{t(shownYear.status)}</span> : null}</dd></div>
            <div><dt>{t("Grade levels")}</dt><dd>{numberOf(data.gradeLevels.length, locale)}</dd></div>
            <div><dt>{t("Classes")}</dt><dd>{numberOf(selectedClasses.length, locale)}</dd></div>
            <div><dt>{t("Teacher assignments")}</dt><dd>{numberOf(currentAssignments.length, locale)}</dd></div>
            <div><dt>{t("Timetable periods")}</dt><dd>{numberOf(data.timetable.filter((row) => row.academicYearId === yearId).length, locale)}</dd></div>
          </dl>
        </article>
      </div>
    </section>
  );
}
