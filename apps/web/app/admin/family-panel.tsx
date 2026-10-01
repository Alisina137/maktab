"use client";
import { useTransientAdminFeedback } from "./admin-feedback";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminLoader, AdminSkeleton } from "./admin-loader";
import { formatAdminHijriDateTime } from "./admin-hijri-date-picker";
import { useAdminWorkspace } from "./admin-workspace";
import { adminErrorText, adminFormat, adminText } from "./admin-i18n";

type User = {
  id: string;
  username: string;
  role: string;
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  mustChangePassword: boolean;
  lastLoginAt: string | null;
};

type ParentSummary = {
  profile: { userId: string; fullName: string; phone: string | null };
  user: User;
  childCount: number;
};

type StudentRow = {
  student: {
    id: string;
    parentUserId: string;
    userId: string | null;
    studentCode: string;
    fullName: string;
    academicYearId: string;
    classId: string;
    status: "ACTIVE" | "WITHDRAWN";
  };
  user: User | null;
  classSection: { id: string; code: string; name: string; academicYearId: string };
  academicYear: { id: string; name: string; status: string };
};

type EnrollmentRow = {
  history: {
    id: string;
    academicYearId: string;
    classId: string;
    startedAt: string;
    endedAt: string | null;
  };
  student: StudentRow["student"];
  user: User | null;
  classSection: StudentRow["classSection"];
  academicYear: StudentRow["academicYear"];
};

type FamilyOverview = {
  parents: ParentSummary[];
  students: StudentRow[];
  enrollments: EnrollmentRow[];
};
type AcademicOverview = {
  academicYears: Array<{ id: string; name: string; status: string }>;
  classes: Array<{ id: string; code: string; name: string; academicYearId: string }>;
};

type ImportEntity = "PARENT" | "STUDENT" | "TEACHER";
type Preview = { headers: string[]; rows: Array<Record<string, string>> };
type Validation = {
  entityType: ImportEntity;
  valid: boolean;
  rowCount: number;
  validRowCount: number;
  errors: Array<{ row: number; field?: string; message: string }>;
  normalizedRows: Array<Record<string, string>>;
};
type Credential = { username: string; temporaryPassword: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const importFields: Record<ImportEntity, Array<{ key: string; label: string; required: boolean; aliases: string[] }>> = {
  PARENT: [
    { key: "username", label: "Username", required: true, aliases: ["username", "user", "parentusername"] },
    { key: "fullName", label: "Parent full name", required: true, aliases: ["fullname", "parentname", "name"] },
    { key: "phone", label: "Phone", required: false, aliases: ["phone", "mobile", "phonenumber"] }
  ],
  STUDENT: [
    { key: "studentCode", label: "Student code", required: true, aliases: ["studentcode", "code", "studentid"] },
    { key: "fullName", label: "Student full name", required: true, aliases: ["fullname", "studentname", "name"] },
    { key: "parentUsername", label: "Parent username", required: true, aliases: ["parentusername", "parent", "guardianusername"] },
    { key: "academicYear", label: "Academic year", required: true, aliases: ["academicyear", "year", "yearname"] },
    { key: "classCode", label: "Class code", required: true, aliases: ["classcode", "class", "section"] }
  ],
  TEACHER: [
    { key: "username", label: "Username", required: true, aliases: ["username", "user", "teacherusername"] },
    { key: "employeeCode", label: "Employee code", required: true, aliases: ["employeecode", "staffcode", "teachercode"] },
    { key: "fullName", label: "Teacher full name", required: true, aliases: ["fullname", "teachername", "name"] },
    { key: "phone", label: "Phone", required: false, aliases: ["phone", "mobile", "phonenumber"] }
  ]
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function nextAvailableStudentCode(students: StudentRow[]) {
  const used = new Set<number>();
  for (const item of students) {
    const match = /^S-(\d+)$/i.exec(item.student.studentCode.trim());
    if (!match?.[1]) continue;
    const number = Number(match[1]);
    if (Number.isInteger(number) && number > 0) used.add(number);
  }

  let next = 1;
  while (used.has(next)) next += 1;
  return `S-${String(next).padStart(4, "0")}`;
}

function isDuplicateUsernameError(cause: unknown) {
  return cause instanceof Error && cause.message === "This username already exists. Please type another username.";
}

async function request<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.message ?? "Request failed.");
  return body as T;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const comma = value.indexOf(",");
      if (comma < 0) reject(new Error("Could not encode the selected file."));
      else resolve(value.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function FamilyPanel({ accessToken }: { accessToken: string }) {
  const { locale, selectedAcademicYearId, selectedAcademicYear } = useAdminWorkspace();
  const t = (english: string) => adminText(locale, english);
  const [overview, setOverview] = useState<FamilyOverview | null>(null);
  const [academics, setAcademics] = useState<AcademicOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const { error, notice, setError, setNotice } = useTransientAdminFeedback();
  const [credentials, setCredentials] = useState<Credential[]>([]);

  const [studentYearId, setStudentYearId] = useState("");
  const [studentAccountId, setStudentAccountId] = useState("");
  const [studentAccountSubmitting, setStudentAccountSubmitting] = useState(false);
  const [studentCode, setStudentCode] = useState("");
  const [parentSearch, setParentSearch] = useState("");
  const [selectedParentUserId, setSelectedParentUserId] = useState("");
  const [usernamePopup, setUsernamePopup] = useState("");
  const [importEntity, setImportEntity] = useState<ImportEntity>("PARENT");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<Validation | null>(null);
  const [importFileName, setImportFileName] = useState("");

  const parentMap = useMemo(
    () => new Map(overview?.parents.map((item) => [item.user.id, item]) ?? []),
    [overview]
  );

  const availableClasses = useMemo(
    () => academics?.classes.filter((item) => item.academicYearId === studentYearId) ?? [],
    [academics, studentYearId]
  );

  const suggestedStudentCode = useMemo(
    () => nextAvailableStudentCode(overview?.students ?? []),
    [overview?.students]
  );

  const selectedYearStudents = useMemo(() => {
    if (!overview || !selectedAcademicYearId) return [] as EnrollmentRow[];
    const latestByStudent = new Map<string, EnrollmentRow>();
    for (const enrollment of overview.enrollments) {
      if (enrollment.academicYear.id !== selectedAcademicYearId) continue;
      const current = latestByStudent.get(enrollment.student.id);
      if (!current || current.history.startedAt < enrollment.history.startedAt) {
        latestByStudent.set(enrollment.student.id, enrollment);
      }
    }
    return Array.from(latestByStudent.values()).sort((a, b) =>
      a.student.fullName.localeCompare(b.student.fullName)
    );
  }, [overview, selectedAcademicYearId]);

  const selectedYearMutable =
    selectedAcademicYear?.status === "DRAFT" || selectedAcademicYear?.status === "ACTIVE";

  const availableParents = useMemo(
    () => overview?.parents.filter(
      (parent) => parent.user.status !== "SUSPENDED" && parent.user.status !== "ARCHIVED"
    ) ?? [],
    [overview?.parents]
  );

  const filteredParents = useMemo(() => {
    const query = parentSearch.trim().toLowerCase();
    if (!query) return availableParents;
    return availableParents.filter((parent) => parent.user.username.toLowerCase().includes(query));
  }, [availableParents, parentSearch]);

  useEffect(() => {
    void load();
  }, [accessToken]);

  useEffect(() => {
    if (selectedAcademicYearId) setStudentYearId(selectedAcademicYearId);
  }, [selectedAcademicYearId]);

  useEffect(() => {
    if (!studentCode && overview) setStudentCode(suggestedStudentCode);
  }, [overview, studentCode, suggestedStudentCode]);

  async function load(options?: { silentFeedback?: boolean }): Promise<FamilyOverview | null> {
    if (!options?.silentFeedback) setError("");
    try {
      const [familyData, academicData] = await Promise.all([
        request<FamilyOverview>(accessToken, "/v1/admin/families"),
        request<AcademicOverview>(accessToken, "/v1/admin/academics")
      ]);
      setOverview(familyData);
      setAcademics(academicData);
      setStudentYearId((current) =>
        selectedAcademicYearId ||
        current ||
        academicData.academicYears.find((year) => year.status === "ACTIVE")?.id ||
        academicData.academicYears[0]?.id ||
        ""
      );
      return familyData;
    } catch (cause) {
      if (!options?.silentFeedback) {
        setError(adminErrorText(locale, cause, "Could not load family data."));
      }
      return null;
    }
  }

  async function createParent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    try {
      const result = await request<{ user: User; temporaryPassword: string }>(
        accessToken,
        "/v1/admin/families/parents",
        {
          method: "POST",
          body: JSON.stringify({
            username: String(form.get("username") ?? "").trim(),
            fullName: String(form.get("fullName") ?? "").trim(),
            phone: String(form.get("phone") ?? "").trim() || undefined
          })
        }
      );
      setCredentials([{ username: result.user.username, temporaryPassword: result.temporaryPassword }]);
      setNotice(t("Parent account created. Give the temporary credential to the parent securely."));
      formElement.reset();
      await load({ silentFeedback: true });
    } catch (cause) {
      if (isDuplicateUsernameError(cause)) {
        setUsernamePopup(t("This username already exists. Please type another username."));
      } else {
        setError(adminErrorText(locale, cause, "Could not create parent."));
      }
    } finally {
      setBusy(false);
    }
  }

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(accessToken, "/v1/admin/families/students", {
        method: "POST",
        body: JSON.stringify({
          studentCode: studentCode.trim(),
          fullName: String(form.get("fullName") ?? "").trim(),
          parentUserId: selectedParentUserId,
          academicYearId: String(form.get("academicYearId") ?? ""),
          classId: String(form.get("classId") ?? "")
        })
      });
      setNotice(t("Student created and linked to the selected parent."));
      setParentSearch("");
      setSelectedParentUserId("");
      formElement.reset();
      const refreshed = await load({ silentFeedback: true });
      setStudentCode(nextAvailableStudentCode(refreshed?.students ?? []));
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not create student."));
    } finally {
      setBusy(false);
    }
  }

  async function createStudentAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentAccountId || studentAccountSubmitting) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const targetStudentId = studentAccountId;
    setBusy(true);
    setStudentAccountSubmitting(true);
    setError("");
    setNotice("");
    setCredentials([]);

    try {
      const result = await request<{ user: User; student: StudentRow["student"]; temporaryPassword: string }>(
        accessToken,
        `/v1/admin/families/students/${targetStudentId}/account`,
        {
          method: "POST",
          body: JSON.stringify({ username: String(form.get("username") ?? "").trim() })
        }
      );

      setOverview((current) => {
        if (!current) return current;
        return {
          ...current,
          students: current.students.map((item) =>
            item.student.id === targetStudentId
              ? { ...item, student: { ...item.student, userId: result.user.id }, user: result.user }
              : item
          ),
          enrollments: current.enrollments.map((item) =>
            item.student.id === targetStudentId
              ? { ...item, student: { ...item.student, userId: result.user.id }, user: result.user }
              : item
          )
        };
      });

      setError("");
      setCredentials([{ username: result.user.username, temporaryPassword: result.temporaryPassword }]);
      setNotice(t("Student login created and linked to exactly one student record."));
      setStudentAccountId("");
      formElement.reset();

      // The credential creation is already complete. Refresh quietly so a
      // follow-up read failure never turns a successful create into a mixed
      // success/error state or hides the one-time credential.
      await load({ silentFeedback: true });
    } catch (cause) {
      setNotice("");
      if (isDuplicateUsernameError(cause)) {
        setUsernamePopup(t("This username already exists. Please type another username."));
      } else {
        setError(adminErrorText(locale, cause, "Could not create student account."));
      }
    } finally {
      setStudentAccountSubmitting(false);
      setBusy(false);
    }
  }

  async function parentAction(parent: ParentSummary, action: "reset-password" | "suspend" | "reactivate") {
    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    try {
      const result = await request<{ user: User; temporaryPassword?: string }>(
        accessToken,
        `/v1/admin/users/${parent.user.id}/${action}`,
        { method: "POST" }
      );
      if (result.temporaryPassword) {
        setCredentials([{ username: result.user.username, temporaryPassword: result.temporaryPassword }]);
        setNotice(t("A new temporary password was generated. It is shown only in this response."));
      } else {
        setNotice(t(action === "suspend" ? "Parent account suspended." : "Parent account reactivated."));
      }
      await load({ silentFeedback: true });
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Parent account action failed."));
    } finally {
      setBusy(false);
    }
  }

  async function studentAccountAction(item: EnrollmentRow, action: "reset-password" | "suspend" | "reactivate") {
    if (!item.user) return;

    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    try {
      const result = await request<{ user: User; temporaryPassword?: string }>(
        accessToken,
        `/v1/admin/users/${item.user.id}/${action}`,
        { method: "POST" }
      );

      if (result.temporaryPassword) {
        setCredentials([{ username: result.user.username, temporaryPassword: result.temporaryPassword }]);
        setNotice(t("A new temporary password was generated. It is shown only in this response."));
      } else {
        setNotice(t(action === "suspend" ? "Student account suspended." : "Student account reactivated."));
      }

      setOverview((current) => {
        if (!current) return current;
        return {
          ...current,
          students: current.students.map((studentItem) =>
            studentItem.student.id === item.student.id
              ? { ...studentItem, user: result.user }
              : studentItem
          ),
          enrollments: current.enrollments.map((enrollment) =>
            enrollment.student.id === item.student.id
              ? { ...enrollment, user: result.user }
              : enrollment
          )
        };
      });
      await load({ silentFeedback: true });
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Student account action failed."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteStudent(item: EnrollmentRow) {
    if (!window.confirm(t("Delete this student? This action cannot be undone."))) return;

    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    try {
      await request(accessToken, `/v1/admin/families/students/${item.student.id}`, { method: "DELETE" });
      setNotice(t("Student deleted."));
      setOverview((current) => {
        if (!current) return current;
        return {
          ...current,
          students: current.students.filter((studentItem) => studentItem.student.id !== item.student.id),
          enrollments: current.enrollments.filter((enrollment) => enrollment.student.id !== item.student.id)
        };
      });
      await load({ silentFeedback: true });
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not delete student."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteParent(parent: ParentSummary) {
    if (parent.childCount > 0) {
      setError(t("This parent cannot be deleted because students are linked to the account."));
      return;
    }

    if (!window.confirm(t("Delete this parent account? This action cannot be undone."))) return;

    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    try {
      await request(accessToken, `/v1/admin/families/parents/${parent.user.id}`, { method: "DELETE" });
      setNotice(t("Parent account deleted."));
      await load({ silentFeedback: true });
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not delete parent account."));
    } finally {
      setBusy(false);
    }
  }

  function resetImport(nextEntity = importEntity) {
    setImportEntity(nextEntity);
    setPreview(null);
    setMapping({});
    setValidation(null);
    setImportFileName("");
  }

  async function selectImportFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    setValidation(null);
    try {
      const contentBase64 = await toBase64(file);
      const result = await request<Preview>(accessToken, "/v1/admin/families/import/preview", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, contentBase64 })
      });
      const autoMapping: Record<string, string> = {};
      for (const field of importFields[importEntity]) {
        const matching = result.headers.find((header) => field.aliases.includes(normalizeHeader(header)));
        if (matching) autoMapping[field.key] = matching;
      }
      setPreview(result);
      setMapping(autoMapping);
      setImportFileName(file.name);
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Could not preview import file."));
    } finally {
      setBusy(false);
    }
  }

  async function validateImport() {
    if (!preview) return;
    const missing = importFields[importEntity].filter((field) => field.required && !mapping[field.key]);
    if (missing.length > 0) {
      setError(adminFormat(locale, "Map all required fields before validation: {fields}.", { fields: missing.map((item) => t(item.label)).join(", ") }));
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    try {
      const result = await request<Validation>(accessToken, "/v1/admin/families/import/validate", {
        method: "POST",
        body: JSON.stringify({ entityType: importEntity, rows: preview.rows, mapping })
      });
      setValidation(result);
      if (result.valid) setNotice(adminFormat(locale, "{count} rows validated. Review and confirm the import.", { count: result.validRowCount }));
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Import validation failed."));
    } finally {
      setBusy(false);
    }
  }

  async function commitImport() {
    if (!validation?.valid) return;
    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    try {
      const result = await request<{ importedCount: number; credentials: Credential[] }>(
        accessToken,
        "/v1/admin/families/import/commit",
        {
          method: "POST",
          body: JSON.stringify({ entityType: importEntity, rows: validation.normalizedRows })
        }
      );
      setCredentials(result.credentials);
      setNotice(adminFormat(locale, "{count} {entity} row(s) imported successfully.", {
        count: result.importedCount,
        entity: importEntity === "PARENT" ? t("Parents") : t("Students")
      }));
      setPreview(null);
      setValidation(null);
      setMapping({});
      setImportFileName("");
      await load({ silentFeedback: true });
    } catch (cause) {
      setError(adminErrorText(locale, cause, "Import failed."));
    } finally {
      setBusy(false);
    }
  }

  if (!overview || !academics) {
    return (
      <section className="admin-panel family-section admin-loading-card">
        <AdminLoader label={t("Loading Phase 4 data…")} />
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

  return (
    <section className="family-section admin-page-enter">
      {usernamePopup ? (
        <div className="family-username-popup-backdrop" role="presentation">
          <div className="family-username-popup" role="alertdialog" aria-modal="true" aria-labelledby="family-username-popup-title">
            <strong id="family-username-popup-title">{t("Username already exists")}</strong>
            <p>{usernamePopup}</p>
            <button className="admin-primary" type="button" onClick={() => setUsernamePopup("")} data-admin-no-loading="true">
              {t("OK")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="admin-section-header academic-heading">
        <div>
          <span className="eyebrow">{t("Phase 4 · Student & Family System")}</span>
          <h2>{t("Onboard families")}</h2>
          <p>{t("Create school-controlled parent accounts, link each student to exactly one parent, and import validated school data.")}</p>
        </div>
      </div>

      {error ? <div className="admin-error" role="alert">{error}</div> : null}
      {notice ? <div className="admin-success" role="status">{notice}</div> : null}

      {credentials.length > 0 ? (
        <section className="credential-card family-credential">
          <div className="admin-section-header">
            <strong>{t("Temporary credentials — distribute securely")}</strong>
            <button className="admin-secondary" type="button" onClick={() => window.print()}>{t("Print")}</button>
          </div>
          {credentials.map((credential) => (
            <div key={credential.username}>
              <span>{credential.username}</span>
              <code>{credential.temporaryPassword}</code>
            </div>
          ))}
          <p>{t("Temporary passwords are shown after creation/reset/import. Permanent passwords are never retrievable.")}</p>
        </section>
      ) : null}

      <div className="academic-summary-grid family-summary-grid">
        <Summary label={t("Parents")} value={overview.parents.length} />
        <Summary label={t("Students")} value={selectedYearStudents.length} />
        <Summary label={t("Active students")} value={selectedYearStudents.filter((item) => item.student.status === "ACTIVE").length} />
        <Summary label={t("Families with siblings")} value={overview.parents.filter((item) => item.childCount > 1).length} />
      </div>

      <div className="academic-form-grid family-form-grid">
        <article className="admin-panel academic-form-card">
          <div><h2>{t("Create parent account")}</h2><p>{t("Creates a PARENT identity and profile together and generates a one-time temporary password.")}</p></div>
          <form className="admin-form" onSubmit={createParent}>
            <label>
              {t("Username")}
              <input
                name="username"
                placeholder="Ahmad, Haidar23, Fatima2026"
                autoCapitalize="none"
                autoComplete="off"
                pattern="[A-Za-z0-9]+"
                minLength={3}
                maxLength={64}
                title={t("Only English letters and digits are allowed. Spaces and special characters are not allowed.")}
                required
              />
            </label>
            <p className="admin-form-help">{t("Only English letters and digits are allowed. Spaces and special characters are not allowed.")}</p>
            <label>{t("Full name")}<input name="fullName" placeholder={t("Parent full name")} required /></label>
            <label>{t("Phone")}<input name="phone" placeholder="07xxxxxxxx" /></label>
            <button className="admin-primary" disabled={busy}>{t("Create parent & credential")}</button>
          </form>
        </article>

        <article className="admin-panel academic-form-card">
          <div><h2>{t("Add student")}</h2><p>{t("Link the student to one existing parent account. The relationship is singular, not many-to-many.")}</p></div>
          <form className="admin-form" onSubmit={createStudent}>
            <label>
              {t("Student code")}
              <input
                name="studentCode"
                value={studentCode}
                onChange={(event) => setStudentCode(event.target.value.toUpperCase())}
                placeholder="S-0001"
                required
              />
            </label>
            <p className="admin-form-help">{t("The lowest available student code is suggested automatically. You can change it if needed.")}</p>
            <label>{t("Full name")}<input name="fullName" placeholder={t("Student full name")} required /></label>
            <label>
              {t("Search parent username")}
              <input
                value={parentSearch}
                onChange={(event) => {
                  const next = event.target.value;
                  setParentSearch(next);
                  const exact = availableParents.find((parent) => parent.user.username.toLowerCase() === next.trim().toLowerCase());
                  if (exact) setSelectedParentUserId(exact.user.id);
                  else if (selectedParentUserId && !availableParents.some((parent) => parent.user.id === selectedParentUserId && parent.user.username.toLowerCase().includes(next.trim().toLowerCase()))) {
                    setSelectedParentUserId("");
                  }
                }}
                placeholder={t("Type a username to filter parents")}
                autoCapitalize="none"
                autoComplete="off"
              />
            </label>
            <label>
              {t("Parent")}
              <select
                name="parentUserId"
                required
                value={selectedParentUserId}
                onChange={(event) => setSelectedParentUserId(event.target.value)}
              >
                <option value="">{t("Select parent")}</option>
                {filteredParents.map((parent) => (
                  <option key={parent.user.id} value={parent.user.id}>
                    {parent.user.username}
                  </option>
                ))}
              </select>
            </label>
            <label>{t("Academic year")}<select name="academicYearId" required value={studentYearId} onChange={(event) => setStudentYearId(event.target.value)}>
                <option value="">{t("Select year")}</option>
                {selectedAcademicYear && selectedYearMutable ? (
                  <option value={selectedAcademicYear.id}>{selectedAcademicYear.name} · {t(selectedAcademicYear.status)}</option>
                ) : null}
              </select>
            </label>
            <label>{t("Class")}<select name="classId" required defaultValue="" key={studentYearId}>
                <option value="">{t("Select class")}</option>
                {availableClasses.map((classSection) => (
                  <option key={classSection.id} value={classSection.id}>{classSection.name} · {classSection.code}</option>
                ))}
              </select>
            </label>
            <button className="admin-primary" disabled={busy || availableParents.length === 0 || !selectedYearMutable}>{t("Add student")}</button>
          </form>
        </article>

        <article className="admin-panel academic-form-card">
          <div><h2>{t("Create student login")}</h2><p>{t("Creates a school-issued STUDENT account and links it to exactly one existing student record.")}</p></div>
          <form className="admin-form" onSubmit={createStudentAccount}>
            <label>
              {t("Student without login")}
              <select value={studentAccountId} onChange={(event) => setStudentAccountId(event.target.value)} required>
                <option value="">{t("Select student")}</option>
                {overview.students.filter((item) => !item.student.userId && item.student.status === "ACTIVE").map((item) => (
                  <option key={item.student.id} value={item.student.id}>{item.student.fullName} · {item.student.studentCode}</option>
                ))}
              </select>
            </label>
            <label>
              {t("Username")}
              <input
                name="username"
                placeholder="Ahmad, Haidar23, Fatima2026"
                autoCapitalize="none"
                autoComplete="off"
                pattern="[A-Za-z0-9]+"
                minLength={3}
                maxLength={64}
                title={t("Only English letters and digits are allowed. Spaces and special characters are not allowed.")}
                required
              />
            </label>
            <p className="admin-form-help">{t("Only English letters and digits are allowed. Spaces and special characters are not allowed.")}</p>
            <button
              className="admin-primary"
              disabled={busy || !studentAccountId}
              data-admin-no-loading="true"
              data-admin-pending={studentAccountSubmitting ? "true" : undefined}
              aria-busy={studentAccountSubmitting || undefined}
            >
              {t("Create student credential")}
            </button>
          </form>
        </article>
      </div>

      <div className="academic-data-grid">
        <article className="admin-panel academic-list-panel">
          <div className="admin-section-header">
            <div><h2>{t("Parents")}</h2><p>{adminFormat(locale, "{count} school-controlled family account(s)", { count: overview.parents.length })}</p></div>
          </div>
          <div className="academic-rows">
            {overview.parents.map((parent) => (
              <div className="academic-row" key={parent.user.id}>
                <div>
                  <strong>{parent.profile.fullName}</strong>
                  <span>{parent.user.username} · {adminFormat(locale, "{count} child(ren)", { count: parent.childCount })} · {parent.profile.phone || t("No phone")}</span>
                  <span>{t(parent.user.status)}{parent.user.lastLoginAt
  ? ` · ${adminFormat(locale, "last login {date}", { date: formatAdminHijriDateTime(locale, parent.user.lastLoginAt) })}`
  : ` · ${t("never logged in")}`}</span>
                </div>
                <div className="admin-actions">
                  <button disabled={busy || parent.user.status === "ARCHIVED"} onClick={() => void parentAction(parent, "reset-password")}>{t("Reset password")}</button>
                  {parent.user.status === "SUSPENDED" ? (
                    <button disabled={busy} onClick={() => void parentAction(parent, "reactivate")}>{t("Reactivate")}</button>
                  ) : (
                    <button disabled={busy || parent.user.status === "ARCHIVED"} onClick={() => void parentAction(parent, "suspend")}>{t("Suspend")}</button>
                  )}
                  <button
                    className="admin-danger"
                    disabled={busy || parent.childCount > 0}
                    title={parent.childCount > 0 ? t("This parent cannot be deleted because students are linked to the account.") : t("Delete parent")}
                    onClick={() => void deleteParent(parent)}
                  >
                    {t("Delete parent")}
                  </button>
                </div>
              </div>
            ))}
            {overview.parents.length === 0 ? <p className="admin-copy">{t("No parent accounts yet.")}</p> : null}
          </div>
        </article>

        <article className="admin-panel academic-list-panel">
          <div className="admin-section-header">
            <div><h2>{t("Students")}</h2><p>{adminFormat(locale, "{count} student record(s)", { count: selectedYearStudents.length })}</p></div>
          </div>
          <div className="academic-rows">
            {selectedYearStudents.map((item) => {
              const parent = parentMap.get(item.student.parentUserId);
              return (
                <div className="academic-row" key={item.student.id}>
                  <div>
                    <strong>{item.student.fullName}</strong>
                    <span>{item.student.studentCode} · {item.classSection.name} · {item.academicYear.name}</span>
                    <span>{t("Parent")}: {parent?.profile.fullName ?? t("Unknown")} · {t(item.student.status)}</span>
                    <span>
                      {item.user
                        ? `${item.user.username} · ${t(item.user.status)}`
                        : t("No student login yet")}
                    </span>
                  </div>
                  <div className="admin-actions">
                    {item.user ? (
                      <>
                        <button
                          disabled={busy || item.user.status === "ARCHIVED"}
                          onClick={() => void studentAccountAction(item, "reset-password")}
                        >
                          {t("Reset password")}
                        </button>
                        {item.user.status === "SUSPENDED" ? (
                          <button disabled={busy} onClick={() => void studentAccountAction(item, "reactivate")}>
                            {t("Reactivate")}
                          </button>
                        ) : (
                          <button
                            disabled={busy || item.user.status === "ARCHIVED"}
                            onClick={() => void studentAccountAction(item, "suspend")}
                          >
                            {t("Suspend")}
                          </button>
                        )}
                      </>
                    ) : null}
                    <button
                      className="admin-danger"
                      disabled={busy}
                      onClick={() => void deleteStudent(item)}
                    >
                      {t("Delete")}
                    </button>
                  </div>
                </div>
              );
            })}
            {selectedYearStudents.length === 0 ? <p className="admin-copy">{t("No students in the selected academic year.")}</p> : null}
          </div>
        </article>
      </div>

      <article className="admin-panel family-import-panel">
        <div className="admin-section-header">
          <div>
            <h2>{t("Bulk import")}</h2>
            <p>{t("CSV/XLSX · upload → map → validate → preview errors → confirm → import → credentials.")}</p>
          </div>
          <button className="admin-secondary" type="button" onClick={() => resetImport()} disabled={busy}>{t("Reset")}</button>
        </div>

        <div className="family-import-controls">
          <label>
            {t("Import type")}
            <select value={importEntity} onChange={(event) => resetImport(event.target.value as ImportEntity)} disabled={busy}>
              <option value="PARENT">{t("Parents")}</option>
              <option value="STUDENT">{t("Students")}</option>
              <option value="TEACHER">{t("Teachers")}</option>
            </select>
          </label>
          <label>
            {t("CSV or XLSX file")}
            <input
              type="file"
              accept=".csv,.tsv,.xlsx"
              onChange={(event) => void selectImportFile(event.target.files?.[0])}
              disabled={busy}
            />
          </label>
        </div>

        {preview ? (
          <>
            <p className="admin-copy"><strong>{importFileName}</strong> · {adminFormat(locale, "{rows} data row(s) · {columns} column(s)", {
              rows: preview.rows.length,
              columns: preview.headers.length
            })}</p>
            <div className="family-mapping-grid">
              {importFields[importEntity].map((field) => (
                <label key={field.key}>
                  {t(field.label)}{field.required ? " *" : ""}
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(event) => {
                      setMapping((current) => ({ ...current, [field.key]: event.target.value }));
                      setValidation(null);
                    }}
                  >
                    <option value="">{t("Do not map")}</option>
                    {preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>

            <div className="admin-actions family-import-actions">
              <button className="admin-primary" type="button" onClick={() => void validateImport()} disabled={busy}>{t("Validate rows")}</button>
              {validation?.valid ? (
                <button className="admin-secondary" type="button" onClick={() => void commitImport()} disabled={busy}>{t("Confirm import")}</button>
              ) : null}
            </div>
          </>
        ) : null}

        {validation ? (
          <div className={validation.valid ? "admin-success" : "admin-error"}>
            <strong>{t(validation.valid ? "Validation passed." : "Import not committed — fix the errors and validate again.")}</strong>
            <div>{adminFormat(locale, "{valid} of {total} row(s) valid.", {
              valid: validation.validRowCount,
              total: validation.rowCount
            })}</div>
            {validation.errors.length > 0 ? (
              <ul className="family-import-errors">
                {validation.errors.slice(0, 50).map((item, index) => (
                  <li key={`${item.row}-${item.field ?? "row"}-${index}`}>
                    {adminFormat(locale, "Row {row}", { row: item.row })}
                    {item.field ? ` · ${t(item.field)}` : ""}: {adminErrorText(locale, new Error(item.message), "Validation issue")}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </article>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="academic-summary">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
