"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

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
  classSection: { id: string; code: string; name: string; academicYearId: string };
  academicYear: { id: string; name: string; status: string };
};

type FamilyOverview = { parents: ParentSummary[]; students: StudentRow[] };
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
  const [overview, setOverview] = useState<FamilyOverview | null>(null);
  const [academics, setAcademics] = useState<AcademicOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [credentials, setCredentials] = useState<Credential[]>([]);

  const [studentYearId, setStudentYearId] = useState("");
  const [studentAccountId, setStudentAccountId] = useState("");
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

  useEffect(() => {
    void load();
  }, [accessToken]);

  async function load() {
    setError("");
    try {
      const [familyData, academicData] = await Promise.all([
        request<FamilyOverview>(accessToken, "/v1/admin/families"),
        request<AcademicOverview>(accessToken, "/v1/admin/academics")
      ]);
      setOverview(familyData);
      setAcademics(academicData);
      setStudentYearId((current) => current || academicData.academicYears.find((year) => year.status === "ACTIVE")?.id || academicData.academicYears[0]?.id || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load family data.");
    }
  }

  async function createParent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    const form = new FormData(event.currentTarget);
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
      setNotice("Parent account created. Give the temporary credential to the parent securely.");
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create parent.");
    } finally {
      setBusy(false);
    }
  }

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      await request(accessToken, "/v1/admin/families/students", {
        method: "POST",
        body: JSON.stringify({
          studentCode: String(form.get("studentCode") ?? "").trim(),
          fullName: String(form.get("fullName") ?? "").trim(),
          parentUserId: String(form.get("parentUserId") ?? ""),
          academicYearId: String(form.get("academicYearId") ?? ""),
          classId: String(form.get("classId") ?? "")
        })
      });
      setNotice("Student created and linked to the selected parent.");
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create student.");
    } finally {
      setBusy(false);
    }
  }

  async function createStudentAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentAccountId) return;
    setBusy(true);
    setError("");
    setNotice("");
    setCredentials([]);
    const form = new FormData(event.currentTarget);
    try {
      const result = await request<{ user: User; temporaryPassword: string }>(
        accessToken,
        `/v1/admin/families/students/${studentAccountId}/account`,
        {
          method: "POST",
          body: JSON.stringify({ username: String(form.get("username") ?? "").trim() })
        }
      );
      setCredentials([{ username: result.user.username, temporaryPassword: result.temporaryPassword }]);
      setNotice("Student login created and linked to exactly one student record.");
      setStudentAccountId("");
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create student account.");
    } finally {
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
        setNotice("A new temporary password was generated. It is shown only in this response.");
      } else {
        setNotice(action === "suspend" ? "Parent account suspended." : "Parent account reactivated.");
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Parent account action failed.");
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
      setError(cause instanceof Error ? cause.message : "Could not preview import file.");
    } finally {
      setBusy(false);
    }
  }

  async function validateImport() {
    if (!preview) return;
    const missing = importFields[importEntity].filter((field) => field.required && !mapping[field.key]);
    if (missing.length > 0) {
      setError(`Map all required fields before validation: ${missing.map((item) => item.label).join(", ")}.`);
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
      if (result.valid) setNotice(`${result.validRowCount} rows validated. Review and confirm the import.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import validation failed.");
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
      setNotice(`${result.importedCount} ${importEntity.toLowerCase()} row(s) imported successfully.`);
      setPreview(null);
      setValidation(null);
      setMapping({});
      setImportFileName("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!overview || !academics) {
    return (
      <section className="admin-panel family-section">
        <div className="admin-section-header">
          <div><h2>Students & families</h2><p>Loading Phase 4 data…</p></div>
          <button className="admin-secondary" onClick={() => void load()}>Retry</button>
        </div>
        {error ? <div className="admin-error" role="alert">{error}</div> : null}
      </section>
    );
  }

  const availableParents = overview.parents.filter(
    (parent) => parent.user.status !== "SUSPENDED" && parent.user.status !== "ARCHIVED"
  );

  return (
    <section className="family-section">
      <div className="admin-section-header academic-heading">
        <div>
          <span className="eyebrow">Phase 4 · Student & Family System</span>
          <h2>Onboard families</h2>
          <p>Create school-controlled parent accounts, link each student to exactly one parent, and import validated school data.</p>
        </div>
        <button className="admin-secondary" onClick={() => void load()} disabled={busy}>Refresh</button>
      </div>

      {error ? <div className="admin-error" role="alert">{error}</div> : null}
      {notice ? <div className="admin-success" role="status">{notice}</div> : null}

      {credentials.length > 0 ? (
        <section className="credential-card family-credential">
          <div className="admin-section-header">
            <strong>Temporary credentials — distribute securely</strong>
            <button className="admin-secondary" type="button" onClick={() => window.print()}>Print</button>
          </div>
          {credentials.map((credential) => (
            <div key={credential.username}>
              <span>{credential.username}</span>
              <code>{credential.temporaryPassword}</code>
            </div>
          ))}
          <p>Temporary passwords are shown after creation/reset/import. Permanent passwords are never retrievable.</p>
        </section>
      ) : null}

      <div className="academic-summary-grid family-summary-grid">
        <Summary label="Parents" value={overview.parents.length} />
        <Summary label="Students" value={overview.students.length} />
        <Summary label="Active students" value={overview.students.filter((item) => item.student.status === "ACTIVE").length} />
        <Summary label="Families with siblings" value={overview.parents.filter((item) => item.childCount > 1).length} />
      </div>

      <div className="academic-form-grid">
        <article className="admin-panel academic-form-card">
          <div><h2>Create parent account</h2><p>Creates a PARENT identity and profile together and generates a one-time temporary password.</p></div>
          <form className="admin-form" onSubmit={createParent}>
            <label>Username<input name="username" placeholder="parent.001" autoCapitalize="none" required /></label>
            <label>Full name<input name="fullName" placeholder="Parent full name" required /></label>
            <label>Phone<input name="phone" placeholder="07xxxxxxxx" /></label>
            <button className="admin-primary" disabled={busy}>Create parent & credential</button>
          </form>
        </article>

        <article className="admin-panel academic-form-card">
          <div><h2>Add student</h2><p>Link the student to one existing parent account. The relationship is singular, not many-to-many.</p></div>
          <form className="admin-form" onSubmit={createStudent}>
            <label>Student code<input name="studentCode" placeholder="S-001" required /></label>
            <label>Full name<input name="fullName" placeholder="Student full name" required /></label>
            <label>
              Parent
              <select name="parentUserId" required defaultValue="">
                <option value="">Select parent</option>
                {availableParents.map((parent) => (
                  <option key={parent.user.id} value={parent.user.id}>
                    {parent.profile.fullName} · {parent.user.username}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Academic year
              <select name="academicYearId" required value={studentYearId} onChange={(event) => setStudentYearId(event.target.value)}>
                <option value="">Select year</option>
                {academics.academicYears.filter((year) => year.status !== "CLOSED" && year.status !== "ARCHIVED").map((year) => (
                  <option key={year.id} value={year.id}>{year.name} · {year.status}</option>
                ))}
              </select>
            </label>
            <label>
              Class
              <select name="classId" required defaultValue="" key={studentYearId}>
                <option value="">Select class</option>
                {availableClasses.map((classSection) => (
                  <option key={classSection.id} value={classSection.id}>{classSection.name} · {classSection.code}</option>
                ))}
              </select>
            </label>
            <button className="admin-primary" disabled={busy || availableParents.length === 0}>Add student</button>
          </form>
        </article>

        <article className="admin-panel academic-form-card">
          <div><h2>Create student login</h2><p>Creates a school-issued STUDENT account and links it to exactly one existing student record.</p></div>
          <form className="admin-form" onSubmit={createStudentAccount}>
            <label>
              Student without login
              <select value={studentAccountId} onChange={(event) => setStudentAccountId(event.target.value)} required>
                <option value="">Select student</option>
                {overview.students.filter((item) => !item.student.userId && item.student.status === "ACTIVE").map((item) => (
                  <option key={item.student.id} value={item.student.id}>{item.student.fullName} · {item.student.studentCode}</option>
                ))}
              </select>
            </label>
            <label>Username<input name="username" placeholder="student.001" autoCapitalize="none" required /></label>
            <button className="admin-primary" disabled={busy || !studentAccountId}>Create student credential</button>
          </form>
        </article>
      </div>

      <div className="academic-data-grid">
        <article className="admin-panel academic-list-panel">
          <div className="admin-section-header">
            <div><h2>Parents</h2><p>{overview.parents.length} school-controlled family account(s)</p></div>
          </div>
          <div className="academic-rows">
            {overview.parents.map((parent) => (
              <div className="academic-row" key={parent.user.id}>
                <div>
                  <strong>{parent.profile.fullName}</strong>
                  <span>{parent.user.username} · {parent.childCount} child{parent.childCount === 1 ? "" : "ren"} · {parent.profile.phone || "No phone"}</span>
                  <span>{parent.user.status}{parent.user.lastLoginAt ? ` · last login ${new Date(parent.user.lastLoginAt).toLocaleDateString()}` : " · never logged in"}</span>
                </div>
                <div className="admin-actions">
                  <button disabled={busy || parent.user.status === "ARCHIVED"} onClick={() => void parentAction(parent, "reset-password")}>Reset password</button>
                  {parent.user.status === "SUSPENDED" ? (
                    <button disabled={busy} onClick={() => void parentAction(parent, "reactivate")}>Reactivate</button>
                  ) : (
                    <button disabled={busy || parent.user.status === "ARCHIVED"} onClick={() => void parentAction(parent, "suspend")}>Suspend</button>
                  )}
                </div>
              </div>
            ))}
            {overview.parents.length === 0 ? <p className="admin-copy">No parent accounts yet.</p> : null}
          </div>
        </article>

        <article className="admin-panel academic-list-panel">
          <div className="admin-section-header">
            <div><h2>Students</h2><p>{overview.students.length} student record(s)</p></div>
          </div>
          <div className="academic-rows">
            {overview.students.map((item) => {
              const parent = parentMap.get(item.student.parentUserId);
              return (
                <div className="academic-row" key={item.student.id}>
                  <div>
                    <strong>{item.student.fullName}</strong>
                    <span>{item.student.studentCode} · {item.classSection.name} · {item.academicYear.name}</span>
                    <span>Parent: {parent?.profile.fullName ?? "Unknown"} · {item.student.status}</span>
                    <span>{item.student.userId ? "Student login linked" : "No student login yet"}</span>
                  </div>
                </div>
              );
            })}
            {overview.students.length === 0 ? <p className="admin-copy">No students yet.</p> : null}
          </div>
        </article>
      </div>

      <article className="admin-panel family-import-panel">
        <div className="admin-section-header">
          <div>
            <h2>Bulk import</h2>
            <p>CSV/XLSX · upload → map → validate → preview errors → confirm → import → credentials.</p>
          </div>
          <button className="admin-secondary" type="button" onClick={() => resetImport()} disabled={busy}>Reset</button>
        </div>

        <div className="family-import-controls">
          <label>
            Import type
            <select value={importEntity} onChange={(event) => resetImport(event.target.value as ImportEntity)} disabled={busy}>
              <option value="PARENT">Parents</option>
              <option value="STUDENT">Students</option>
              <option value="TEACHER">Teachers</option>
            </select>
          </label>
          <label>
            CSV or XLSX file
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
            <p className="admin-copy"><strong>{importFileName}</strong> · {preview.rows.length} data row(s) · {preview.headers.length} column(s)</p>
            <div className="family-mapping-grid">
              {importFields[importEntity].map((field) => (
                <label key={field.key}>
                  {field.label}{field.required ? " *" : ""}
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(event) => {
                      setMapping((current) => ({ ...current, [field.key]: event.target.value }));
                      setValidation(null);
                    }}
                  >
                    <option value="">Do not map</option>
                    {preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>

            <div className="admin-actions family-import-actions">
              <button className="admin-primary" type="button" onClick={() => void validateImport()} disabled={busy}>Validate rows</button>
              {validation?.valid ? (
                <button className="admin-secondary" type="button" onClick={() => void commitImport()} disabled={busy}>Confirm import</button>
              ) : null}
            </div>
          </>
        ) : null}

        {validation ? (
          <div className={validation.valid ? "admin-success" : "admin-error"}>
            <strong>{validation.valid ? "Validation passed." : "Import not committed — fix the errors and validate again."}</strong>
            <div>{validation.validRowCount} of {validation.rowCount} row(s) valid.</div>
            {validation.errors.length > 0 ? (
              <ul className="family-import-errors">
                {validation.errors.slice(0, 50).map((item, index) => (
                  <li key={`${item.row}-${item.field ?? "row"}-${index}`}>
                    Row {item.row}{item.field ? ` · ${item.field}` : ""}: {item.message}
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
