"use client";

import { useEffect, useState, type FormEvent } from "react";
import { adminApi, friendlyAdminError, type User } from "../../admin-client";
import { adminFormat } from "../../admin-i18n";
import { AdminLoader, AdminSkeleton } from "../../admin-loader";
import { useAdminWorkspace } from "../../admin-workspace";

type AccountGroup = "ALL" | "PARENT" | "TEACHER" | "STUDENT" | "STAFF";

type FamilyStudent = {
  student: {
    id: string;
    userId: string | null;
    studentCode: string;
    fullName: string;
    status: "ACTIVE" | "WITHDRAWN";
  };
  classSection: { code: string; name: string };
  academicYear: { name: string };
};

type FamilyOverview = {
  students: FamilyStudent[];
};

export default function AccountsPage() {
  const { stored, locale, t, showToast } = useAdminWorkspace();
  const [users, setUsers] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<User["role"]>("TEACHER");
  const [parentFullName, setParentFullName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [familyStudents, setFamilyStudents] = useState<FamilyStudent[]>([]);
  const [studentRecordId, setStudentRecordId] = useState("");
  const [credential, setCredential] = useState<{ username: string; password: string } | null>(null);
  const [group, setGroup] = useState<AccountGroup>("ALL");
  const [status, setStatus] = useState<"ALL" | User["status"]>("ALL");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    void loadUsers();
  }, [stored.session.accessToken]);

  async function loadUsers() {
    try {
      const [accountsResult, familyResult] = await Promise.all([
        adminApi<{ users: User[] }>("/v1/admin/users", {
          headers: { Authorization: `Bearer ${stored.session.accessToken}` }
        }),
        adminApi<FamilyOverview>("/v1/admin/families", {
          headers: { Authorization: `Bearer ${stored.session.accessToken}` }
        })
      ]);
      setUsers(accountsResult.users);
      setFamilyStudents(familyResult.students);
      setStudentRecordId((current) => {
        const available = familyResult.students.filter(
          (item) => item.student.userId === null && item.student.status === "ACTIVE"
        );
        return available.some((item) => item.student.id === current)
          ? current
          : available[0]?.student.id ?? "";
      });
    } catch (cause) {
      showToast({
        kind: "error",
        title: t("School accounts"),
        message: friendlyAdminError(cause, "Could not load school accounts.", locale)
      });
    } finally {
      setInitialLoading(false);
    }
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setCredential(null);
    try {
      let result: { user: User; temporaryPassword: string };

      if (newRole === "PARENT") {
        result = await adminApi<{ user: User; temporaryPassword: string }>("/v1/admin/families/parents", {
          method: "POST",
          headers: { Authorization: `Bearer ${stored.session.accessToken}` },
          body: JSON.stringify({
            username: newUsername,
            fullName: parentFullName,
            phone: parentPhone.trim() || undefined
          })
        });
      } else if (newRole === "STUDENT") {
        if (!studentRecordId) {
          showToast({
            kind: "error",
            title: t("Create account"),
            message: t("Select a student record before creating the student login.")
          });
          return;
        }
        result = await adminApi<{ user: User; temporaryPassword: string }>(
          `/v1/admin/families/students/${studentRecordId}/account`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${stored.session.accessToken}` },
            body: JSON.stringify({ username: newUsername })
          }
        );
      } else {
        result = await adminApi<{ user: User; temporaryPassword: string }>("/v1/admin/users", {
          method: "POST",
          headers: { Authorization: `Bearer ${stored.session.accessToken}` },
          body: JSON.stringify({ username: newUsername, role: newRole })
        });
      }

      setNewUsername("");
      setParentFullName("");
      setParentPhone("");
      setCredential({ username: result.user.username, password: result.temporaryPassword });
      await loadUsers();
      showToast({
        kind: "success",
        title: t("Temporary credential created"),
        message: adminFormat(locale, "{username} is ready.", { username: result.user.username })
      });
    } catch (cause) {
      showToast({
        kind: "error",
        title: t("Create account"),
        message: friendlyAdminError(cause, "Could not create account.", locale)
      });
    } finally {
      setBusy(false);
    }
  }

  async function action(user: User, action: "reset-password" | "suspend" | "reactivate") {
    if (user.id === stored.session.user.id && (action === "reset-password" || action === "suspend")) return;
    setBusy(true);
    setCredential(null);
    try {
      const result = await adminApi<{ user: User; temporaryPassword?: string }>(
        `/v1/admin/users/${user.id}/${action}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${stored.session.accessToken}` }
        }
      );
      setUsers((current) =>
        current.map((item) => item.id === result.user.id ? { ...item, ...result.user, profile: item.profile } : item)
      );
      if (result.temporaryPassword) {
        setCredential({ username: result.user.username, password: result.temporaryPassword });
      }
      showToast({
        kind: "success",
        title: action === "reset-password" ? t("Reset password") : action === "suspend" ? t("Suspend") : t("Reactivate"),
        message: displayName(user)
      });
    } catch (cause) {
      showToast({
        kind: "error",
        title: t("School accounts"),
        message: friendlyAdminError(cause, "Could not update account.", locale)
      });
    } finally {
      setBusy(false);
    }
  }

  const availableStudentRecords = familyStudents.filter(
    (item) => item.student.userId === null && item.student.status === "ACTIVE"
  );
  const staffCount = users.filter((u) => u.role === "SCHOOL_ADMIN" || u.role === "SCHOOL_STAFF").length;
  const counts: Record<AccountGroup, number> = {
    ALL: users.length,
    PARENT: users.filter((u) => u.role === "PARENT").length,
    TEACHER: users.filter((u) => u.role === "TEACHER").length,
    STUDENT: users.filter((u) => u.role === "STUDENT").length,
    STAFF: staffCount
  };
  const q = query.trim().toLowerCase();
  const filtered = users.filter((user) => {
    const groupMatch =
      group === "ALL" ||
      (group === "STAFF" ? user.role === "SCHOOL_ADMIN" || user.role === "SCHOOL_STAFF" : user.role === group);
    const statusMatch = status === "ALL" || user.status === status;
    const haystack = [
      user.username,
      user.profile?.fullName,
      user.profile?.phone,
      user.profile?.code,
      user.role,
      user.status
    ].filter(Boolean).join(" ").toLowerCase();
    return groupMatch && statusMatch && (!q || haystack.includes(q));
  });

  if (initialLoading) {
    return (
      <section className="admin-panel admin-loading-card">
        <AdminLoader label={t("Loading…")} />
        <AdminSkeleton rows={5} />
      </section>
    );
  }

  return (
    <section className="admin-dashboard-section admin-page-enter">
      {credential ? (
        <section className="credential-card credential-card-premium" aria-live="polite">
          <div className="credential-heading">
            <span className="credential-icon" aria-hidden="true">✓</span>
            <div>
              <strong>{t("Temporary credential created")}</strong>
              <p>{t("Show, copy, or print this once. The user must replace the temporary password after first login.")}</p>
            </div>
          </div>
          <div className="credential-values">
            <div><span>{t("Username")}</span><code>{credential.username}</code></div>
            <div><span>{t("Temporary password")}</span><code>{credential.password}</code></div>
          </div>
        </section>
      ) : null}

      <div className="admin-grid admin-account-grid">
        <article className="admin-panel admin-create-account-card">
          <div className="admin-panel-icon" aria-hidden="true">+</div>
          <h3>{t("Create account")}</h3>
          <p className="admin-copy">{t("Create school accounts here. Parent profiles are created with their login, and student logins are linked to an existing student record.")}</p>
          <form className="admin-form" onSubmit={createUser}>
            <label>
              {t("Role")}
              <select
                value={newRole}
                onChange={(e) => {
                  const role = e.target.value as User["role"];
                  setNewRole(role);
                  setNewUsername("");
                  setCredential(null);
                }}
              >
                <option value="TEACHER">{t("Teacher")}</option>
                <option value="PARENT">{t("Parent")}</option>
                <option value="STUDENT">{t("Student")}</option>
                <option value="SCHOOL_STAFF">{t("School staff")}</option>
                <option value="SCHOOL_ADMIN">{t("School admin")}</option>
              </select>
            </label>

            {newRole === "PARENT" ? (
              <>
                <label>
                  {t("Parent full name")}
                  <input value={parentFullName} onChange={(e) => setParentFullName(e.target.value)} required />
                </label>
                <label>
                  {t("Phone")}
                  <input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="07xxxxxxxx" />
                </label>
              </>
            ) : null}

            {newRole === "STUDENT" ? (
              <label>
                {t("Student record")}
                <select
                  value={studentRecordId}
                  onChange={(e) => setStudentRecordId(e.target.value)}
                  required
                  disabled={availableStudentRecords.length === 0}
                >
                  {availableStudentRecords.length === 0 ? (
                    <option value="">{t("No students without login")}</option>
                  ) : (
                    availableStudentRecords.map((item) => (
                      <option key={item.student.id} value={item.student.id}>
                        {item.student.fullName} · {item.student.studentCode} · {item.classSection.name}
                      </option>
                    ))
                  )}
                </select>
                {availableStudentRecords.length === 0 ? (
                  <span className="admin-field-hint">
                    {t("Create the student record in Families first, then return here to generate the login.")}
                  </span>
                ) : null}
              </label>
            ) : null}

            <label>
              {t("Username")}
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder={newRole === "PARENT" ? "parent.001" : newRole === "STUDENT" ? "student.001" : "teacher.001"}
                required
              />
            </label>

            <button
              className="admin-primary"
              disabled={busy || (newRole === "STUDENT" && !studentRecordId)}
              type="submit"
            >
              {t(busy ? "Working…" : "Generate account")}
            </button>
          </form>
        </article>

        <article className="admin-panel admin-users-panel admin-users-panel-premium">
          <div className="admin-section-header">
            <div>
              <h3>{t("Account directory")}</h3>
              <p>{filtered.length} / {users.length}</p>
            </div>
            <button className="admin-secondary" onClick={() => void loadUsers()} disabled={busy}>{t("Refresh accounts")}</button>
          </div>

          <div className="admin-account-tabs" role="tablist">
            {([
              ["ALL", "All"],
              ["PARENT", "Parents"],
              ["TEACHER", "Teachers"],
              ["STUDENT", "Students"],
              ["STAFF", "Admin & staff"]
            ] as Array<[AccountGroup, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={group === value ? "admin-account-tab admin-account-tab-active" : "admin-account-tab"}
                onClick={() => setGroup(value)}
                aria-selected={group === value}
              >
                <span>{t(label)}</span><strong>{counts[value]}</strong>
              </button>
            ))}
          </div>

          <div className="admin-account-filters">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search name, username, phone, code, role, or status")} />
            <select value={status} onChange={(e) => setStatus(e.target.value as "ALL" | User["status"])}>
              <option value="ALL">{t("All statuses")}</option>
              <option value="ACTIVE">{t("Active")}</option>
              <option value="INVITED">{t("Invited")}</option>
              <option value="SUSPENDED">{t("Suspended")}</option>
              <option value="ARCHIVED">{t("Archived")}</option>
            </select>
            {(query || group !== "ALL" || status !== "ALL") ? (
              <button className="admin-secondary" onClick={() => { setQuery(""); setGroup("ALL"); setStatus("ALL"); }}>
                {t("Clear filters")}
              </button>
            ) : null}
          </div>

          <div className="admin-user-list admin-user-list-premium">
            {filtered.map((user) => {
              const isCurrentAdmin = user.id === stored.session.user.id;
              return (
              <div className="admin-user-row admin-user-row-premium" key={user.id}>
                <div className="admin-user-identity">
                  <span className="admin-user-avatar">{displayName(user).slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{displayName(user)}</strong>
                    <span>@{user.username} · {roleLabel(user, t)}</span>
                    {(user.profile?.code || user.profile?.phone) ? <span>{[user.profile?.code, user.profile?.phone].filter(Boolean).join(" · ")}</span> : null}
                  </div>
                </div>
                <div className="admin-user-meta">
                  <span className={`admin-status-badge admin-status-${user.status.toLowerCase()}`}>{statusLabel(user.status, t)}</span>
                  {user.mustChangePassword ? <span className="admin-password-badge">{t("Password change required")}</span> : null}
                  {isCurrentAdmin ? <span className="admin-current-account-badge">{t("Current administrator")}</span> : null}
                </div>
                <div className="admin-actions">
                  <button
                    onClick={() => void action(user, "reset-password")}
                    disabled={busy || user.status === "ARCHIVED" || isCurrentAdmin}
                    title={isCurrentAdmin ? t("Use Profile to change your own password.") : undefined}
                  >
                    {t("Reset password")}
                  </button>
                  {user.status === "SUSPENDED"
                    ? <button onClick={() => void action(user, "reactivate")} disabled={busy}>{t("Reactivate")}</button>
                    : (
                      <button
                        onClick={() => void action(user, "suspend")}
                        disabled={busy || user.status === "ARCHIVED" || isCurrentAdmin}
                        title={isCurrentAdmin ? t("You cannot suspend the administrator account you are currently using.") : undefined}
                      >
                        {t("Suspend")}
                      </button>
                    )}
                </div>
              </div>
              );
            })}
            {filtered.length === 0 ? (
              <div className="admin-empty-state">
                <strong>{t("No matching accounts")}</strong>
                <span>{t("Try another account group, status, name, username, phone number, or code.")}</span>
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

function displayName(user: User) {
  return user.profile?.fullName?.trim() || user.username;
}

function roleLabel(user: User, t: (value: string) => string) {
  if (user.role === "PARENT") return t("Parents");
  if (user.role === "TEACHER") return t("Teacher");
  if (user.role === "STUDENT") return t("Students");
  if (user.role === "SCHOOL_ADMIN") return t("School admin");
  return t("School staff");
}

function statusLabel(status: User["status"], t: (value: string) => string) {
  if (status === "ACTIVE") return t("Active");
  if (status === "INVITED") return t("Invited");
  if (status === "SUSPENDED") return t("Suspended");
  return t("Archived");
}
