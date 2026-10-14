"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { adminApi, friendlyAdminError, type User } from "../../admin-client";
import { adminFormat } from "../../admin-i18n";
import { validateAccountCreation } from "../../account-create-rules";
import { AccountTemporaryCredentialPanel } from "../../account-temporary-credential";
import { AdminAccountDetailsDrawer } from "../../admin-account-details-drawer";
import { AdminAccountActionConfirm, type AccountPendingAction, type AccountSecurityAction } from "../../admin-account-action-confirm";
import type { AccountFamilyOverview } from "../../account-details-data";
import { AdminLoader, AdminSkeleton } from "../../admin-loader";
import { useAdminWorkspace } from "../../admin-workspace";

type AccountGroup = "ALL" | "PARENT" | "TEACHER" | "STUDENT" | "STAFF";
type AccountView = "DIRECTORY" | "CREATE";
type AccountHighlight = "ALL" | "ACTIVE" | "PENDING" | "SUSPENDED";

function roleCreationHelp(role: User["role"]): string {
  switch (role) {
    case "PARENT": return "Create a parent login and parent profile together.";
    case "STUDENT": return "Select an existing active student without a login. Family linking stays in Families.";
    case "TEACHER": return "Create a teacher login here, then complete the teacher profile in Academics.";
    case "SCHOOL_STAFF": return "Create a school staff login with school-scoped access.";
    case "SCHOOL_ADMIN": return "Create another administrator only when school-wide administrative access is necessary.";
  }
}

function needsActivation(user: User): boolean {
  return user.status === "INVITED" || (user.status === "ACTIVE" && user.mustChangePassword);
}

type FamilyStudent = AccountFamilyOverview["students"][number];

export default function AccountsPage() {
  const { stored, locale, t, showToast } = useAdminWorkspace();
  const [users, setUsers] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<User["role"]>("TEACHER");
  const [parentFullName, setParentFullName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [familyStudents, setFamilyStudents] = useState<FamilyStudent[]>([]);
  const [familyOverview, setFamilyOverview] = useState<AccountFamilyOverview | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const closeAccountDetails = useCallback(() => setSelectedAccountId(null), []);
  const [studentRecordId, setStudentRecordId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [creationAttempted, setCreationAttempted] = useState(false);
  const [credential, setCredential] = useState<{ username: string; password: string } | null>(null);
  const [group, setGroup] = useState<AccountGroup>("ALL");
  const [view, setView] = useState<AccountView>("DIRECTORY");
  const [highlight, setHighlight] = useState<AccountHighlight>("ALL");
  const [status, setStatus] = useState<"ALL" | User["status"]>("ALL");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<AccountPendingAction | null>(null);
  const cancelPendingAction = useCallback(() => setPendingAction(null), []);
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
        adminApi<AccountFamilyOverview>("/v1/admin/families", {
          headers: { Authorization: `Bearer ${stored.session.accessToken}` }
        })
      ]);
      setUsers(accountsResult.users);
      setFamilyOverview(familyResult);
      setFamilyStudents(familyResult.students);
      setStudentRecordId((current) => {
        const available = familyResult.students.filter(
          (item) => item.student.userId === null && item.student.status === "ACTIVE"
        );
        return available.some((item) => item.student.id === current) ? current : "";
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
    setCreationAttempted(true);
    if (Object.keys(creationIssues).length > 0) return;
    if (credential) {
      showToast({
        kind: "error",
        title: t("Create account"),
        message: t("Close the temporary credential panel before creating another account.")
      });
      return;
    }
    setBusy(true);
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
      setStudentSearch("");
      setCreationAttempted(false);
      setCredential({ username: result.user.username, password: result.temporaryPassword });
      setView("DIRECTORY");
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

  function requestAction(user: User, action: AccountSecurityAction) {
    if (busy || user.status === "ARCHIVED") return;
    if (user.id === stored.session.user.id && (action === "reset-password" || action === "suspend")) return;
    if (credential) {
      showToast({
        kind: "error",
        title: t("School accounts"),
        message: t("Close the temporary credential panel before continuing.")
      });
      return;
    }
    setSelectedAccountId(null);
    setPendingAction({ user, action });
  }

  async function executeAction(reason?: string) {
    if (!pendingAction || busy) return;
    const { user, action } = pendingAction;
    setBusy(true);
    try {
      const result = await adminApi<{ user: User; temporaryPassword?: string }>(
        `/v1/admin/users/${user.id}/${action}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${stored.session.accessToken}` },
          ...(action === "suspend" ? { body: JSON.stringify(reason ? { reason } : {}) } : {})
        }
      );
      setUsers((current) =>
        current.map((item) => item.id === result.user.id ? { ...item, ...result.user, profile: item.profile } : item)
      );
      setPendingAction(null);
      if (result.temporaryPassword) {
        setSelectedAccountId(null);
        setCredential({ username: result.user.username, password: result.temporaryPassword });
        setView("DIRECTORY");
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
  const studentSearchTerm = studentSearch.trim().toLowerCase();
  const matchingStudentRecords = availableStudentRecords.filter((item) =>
    [item.student.fullName, item.student.studentCode, item.classSection.name]
      .some((value) => value.toLowerCase().includes(studentSearchTerm))
  );
  const creationIssues = validateAccountCreation({
    role: newRole,
    username: newUsername,
    parentFullName,
    parentPhone,
    studentRecordId
  }, users.map((user) => user.username), availableStudentRecords.map((item) => item.student.id));
  const showUsernameIssue = creationAttempted || newUsername.trim().length > 0;
  const showNameIssue = creationAttempted || parentFullName.trim().length > 0;
  const showPhoneIssue = creationAttempted || parentPhone.length > 0;

  const selectedAccount = selectedAccountId ? users.find((user) => user.id === selectedAccountId) ?? null : null;
  const staffCount = users.filter((u) => u.role === "SCHOOL_ADMIN" || u.role === "SCHOOL_STAFF").length;
  const counts: Record<AccountGroup, number> = {
    ALL: users.length,
    PARENT: users.filter((u) => u.role === "PARENT").length,
    TEACHER: users.filter((u) => u.role === "TEACHER").length,
    STUDENT: users.filter((u) => u.role === "STUDENT").length,
    STAFF: staffCount
  };
  const summaries = [
    { id: "ALL", label: "Total accounts", value: users.length, symbol: "▦" },
    { id: "ACTIVE", label: "Active accounts", value: users.filter((user) => user.status === "ACTIVE").length, symbol: "✓" },
    { id: "PENDING", label: "Pending activation", value: users.filter(needsActivation).length, symbol: "◷" },
    { id: "SUSPENDED", label: "Suspended accounts", value: users.filter((user) => user.status === "SUSPENDED").length, symbol: "!" }
  ] as const;

  function selectSummary(next: AccountHighlight) {
    setHighlight(next);
    setGroup("ALL");
    setStatus("ALL");
    setQuery("");
    setView("DIRECTORY");
  }

  function clearFilters() {
    setQuery("");
    setGroup("ALL");
    setStatus("ALL");
    setHighlight("ALL");
  }

  const q = query.trim().toLowerCase();
  const filtered = users.filter((user) => {
    const groupMatch =
      group === "ALL" ||
      (group === "STAFF" ? user.role === "SCHOOL_ADMIN" || user.role === "SCHOOL_STAFF" : user.role === group);
    const statusMatch = status === "ALL" || user.status === status;
    const summaryMatch =
      highlight === "ALL" ||
      (highlight === "PENDING" ? needsActivation(user) : user.status === highlight);
    const haystack = [
      user.username,
      user.profile?.fullName,
      user.profile?.phone,
      user.profile?.code,
      user.role,
      user.status
    ].filter(Boolean).join(" ").toLowerCase();
    return groupMatch && statusMatch && summaryMatch && (!q || haystack.includes(q));
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
      {pendingAction ? (
        <AdminAccountActionConfirm
          key={pendingAction.user.id + pendingAction.action}
          pending={pendingAction}
          busy={busy}
          locale={locale}
          t={t}
          onCancel={cancelPendingAction}
          onConfirm={(reason) => void executeAction(reason)}
        />
      ) : null}

      {selectedAccount && !credential && !pendingAction ? (
        <AdminAccountDetailsDrawer
          key={selectedAccount.id}
          user={selectedAccount}
          currentAdminId={stored.session.user.id}
          accessToken={stored.session.accessToken}
          families={familyOverview}
          locale={locale}
          t={t}
          busy={busy}
          onClose={closeAccountDetails}
          onAction={requestAction}
          directoryUsers={users}
        />
      ) : null}

      {credential ? (
        <AccountTemporaryCredentialPanel
          key={credential.username}
          credential={credential}
          t={t}
          onClose={() => setCredential(null)}
          onCopyError={() => showToast({
            kind: "error",
            title: t("Temporary credential created"),
            message: t("Clipboard access is unavailable. Reveal the password and copy it manually.")
          })}
        />
      ) : null}

      <div className="admin-account-overview">
        <div className="admin-account-overview-heading">
          <div>
            <span className="eyebrow">{t("Account overview")}</span>
            <h3>{t("Manage school accounts")}</h3>
            <p>{t("Review account access and create new school logins.")}</p>
          </div>
          <div className="admin-account-view-switch" role="group" aria-label={t("Accounts page view")}>
            <button
              type="button"
              className={view === "DIRECTORY" ? "admin-account-view-button admin-account-view-active" : "admin-account-view-button"}
              aria-pressed={view === "DIRECTORY"}
              onClick={() => setView("DIRECTORY")}
            >{t("Account directory")}</button>
            <button
              type="button"
              className={view === "CREATE" ? "admin-account-view-button admin-account-view-active" : "admin-account-view-button"}
              aria-pressed={view === "CREATE"}
              onClick={() => setView("CREATE")}
            >{t("Create account")}</button>
          </div>
        </div>
        <div className="admin-account-stats" role="group" aria-label={t("Account overview")}>
          {summaries.map((summary) => (
            <button
              key={summary.id}
              type="button"
              className={`admin-account-stat admin-account-stat-${summary.id.toLowerCase()} ${highlight === summary.id ? "admin-account-stat-selected" : ""}`}
              aria-pressed={highlight === summary.id}
              onClick={() => selectSummary(summary.id)}
            >
              <span className="admin-account-stat-top">
                <span className="admin-account-stat-symbol" aria-hidden="true">{summary.symbol}</span>
                <span className="admin-account-stat-label">{t(summary.label)}</span>
              </span>
              <strong>{summary.value.toLocaleString()}</strong>
            </button>
          ))}
        </div>
      </div>

      <div className={`admin-grid admin-account-grid ${view === "CREATE" ? "admin-account-grid-creating" : "admin-account-grid-directory"}`}>
        {view === "CREATE" ? (
        <article className="admin-panel admin-create-account-card" id="account-create-panel">
          <div className="admin-panel-icon" aria-hidden="true">+</div>
          <h3>{t("Create account")}</h3>
          <p className="admin-copy">{t("Create school accounts here. Parent profiles are created with their login, and student logins are linked to an existing student record.")}</p>
          <form className="admin-form account-create-form" noValidate onSubmit={createUser}>
            <div className="account-form-kicker">{t("Step 1 · Account role")}</div>
            <label>
              {t("Role")}
              <select
                value={newRole}
                disabled={busy}
                onChange={(e) => {
                  const role = e.target.value as User["role"];
                  setNewRole(role);
                  setNewUsername("");
                  setParentFullName("");
                  setParentPhone("");
                  setStudentRecordId("");
                  setStudentSearch("");
                  setCreationAttempted(false);
                }}
                aria-describedby="account-create-role-help"
              >
                <option value="TEACHER">{t("Teacher")}</option>
                <option value="PARENT">{t("Parent")}</option>
                <option value="STUDENT">{t("Student")}</option>
                <option value="SCHOOL_STAFF">{t("School staff")}</option>
                <option value="SCHOOL_ADMIN">{t("School admin")}</option>
              </select>
            </label>
            <p id="account-create-role-help" className="account-create-role-help">{t(roleCreationHelp(newRole))}</p>
            <div className="account-form-kicker">{t("Step 2 · Account information")}</div>

            {newRole === "PARENT" ? (
              <>
                <label>
                  {t("Parent full name")}
                  <input
                    value={parentFullName}
                    disabled={busy}
                    onChange={(e) => setParentFullName(e.target.value)}
                    aria-invalid={showNameIssue && Boolean(creationIssues.parentFullName)}
                    aria-describedby={creationIssues.parentFullName && showNameIssue ? "account-create-parent-name-error" : undefined}
                    maxLength={160}
                    autoComplete="name"
                    required
                  />
                  {creationIssues.parentFullName && showNameIssue ? <span id="account-create-parent-name-error" className="account-create-field-error" role="alert">{t(creationIssues.parentFullName)}</span> : null}
                </label>
                <label>
                  {t("Phone")}
                  <input
                    value={parentPhone}
                    disabled={busy}
                    onChange={(e) => setParentPhone(e.target.value)}
                    aria-invalid={showPhoneIssue && Boolean(creationIssues.parentPhone)}
                    aria-describedby={creationIssues.parentPhone && showPhoneIssue ? "account-create-parent-phone-error" : undefined}
                    type="tel"
                    autoComplete="tel"
                    placeholder="07xxxxxxxx"
                  />
                  {creationIssues.parentPhone && showPhoneIssue ? <span id="account-create-parent-phone-error" className="account-create-field-error" role="alert">{t(creationIssues.parentPhone)}</span> : null}
                </label>
              </>
            ) : null}

            {newRole === "STUDENT" ? (
              <>
                <label>
                  {t("Search student records")}
                  <input
                    value={studentSearch}
                    disabled={busy}
                    onChange={(e) => { setStudentSearch(e.target.value); setStudentRecordId(""); }}
                    type="search"
                    placeholder={t("Search by student name, code or class")}
                    autoComplete="off"
                  />
                </label>
                <label>
                  {t("Student record")}
                  <select
                    value={studentRecordId}
                    onChange={(e) => setStudentRecordId(e.target.value)}
                    required
                    aria-invalid={creationAttempted && Boolean(creationIssues.studentRecordId)}
                    aria-describedby={creationAttempted && creationIssues.studentRecordId ? "account-create-student-error" : undefined}
                    disabled={busy || availableStudentRecords.length === 0}
                  >
                    <option value="">{t(availableStudentRecords.length === 0 ? "No students without login" : "Select an eligible student")}</option>
                    {matchingStudentRecords.map((item) => (
                      <option key={item.student.id} value={item.student.id}>
                        {item.student.fullName} · {item.student.studentCode} · {item.classSection.name}
                      </option>
                    ))}
                  </select>
                  {availableStudentRecords.length === 0 ? (
                    <span className="admin-field-hint">
                      {t("Create the student record in Families first, then return here to generate the login.")}
                    </span>
                  ) : matchingStudentRecords.length === 0 ? (
                    <span className="admin-field-hint">{t("No eligible students match your search.")}</span>
                  ) : null}
                  {creationAttempted && creationIssues.studentRecordId ? (
                    <span id="account-create-student-error" className="account-create-field-error" role="alert">{t(creationIssues.studentRecordId)}</span>
                  ) : null}
                </label>
              </>
            ) : null}

            <label>
              {t("Username")}
              <input
                value={newUsername}
                disabled={busy}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder={newRole === "PARENT" ? "parent001" : newRole === "STUDENT" ? "student001" : "teacher001"}
                minLength={3}
                maxLength={64}
                dir="ltr"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={showUsernameIssue && Boolean(creationIssues.username)}
                aria-describedby={showUsernameIssue && creationIssues.username ? "account-create-username-error" : "account-create-username-help"}
                required
              />
              {showUsernameIssue && creationIssues.username ? (
                <span id="account-create-username-error" className="account-create-field-error" role="alert">{t(creationIssues.username)}</span>
              ) : (
                <span id="account-create-username-help" className="admin-field-hint">{t(newRole === "PARENT" || newRole === "STUDENT" ? "Use English letters and numbers only." : "Use English letters, numbers, dots, underscores, @, + or hyphens.")}</span>
              )}
            </label>
            <div className="account-create-notice">{t("A temporary password will be generated. The account holder must change it on first login.")}</div>
            <button
              className="admin-primary"
              disabled={busy || (newRole === "STUDENT" && availableStudentRecords.length === 0)}
              type="submit"
            >
              {t(busy ? "Working…" : "Generate account")}
            </button>
          </form>
        </article>
        ) : null}

        <article className="admin-panel admin-users-panel admin-users-panel-premium" id="account-directory-panel">
          <div className="admin-section-header">
            <div>
              <h3>{t("Account directory")}</h3>
              <p>{adminFormat(locale, "Showing {visible} of {total} accounts", { visible: filtered.length, total: users.length })}</p>
            </div>
            <button type="button" className="admin-secondary" onClick={() => void loadUsers()} disabled={busy}>{t("Refresh accounts")}</button>
          </div>

          <div className="admin-account-tabs" role="group" aria-label={t("Account role")}>
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
                aria-pressed={group === value}
              >
                <span>{t(label)}</span><strong>{counts[value]}</strong>
              </button>
            ))}
          </div>

          <div className="admin-account-filters">
            <input aria-label={t("Search accounts")} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search name, username, phone, code, role, or status")} />
            <select aria-label={t("Filter by status")} value={status} onChange={(e) => { setStatus(e.target.value as "ALL" | User["status"]); setHighlight("ALL"); }}>
              <option value="ALL">{t("All statuses")}</option>
              <option value="ACTIVE">{t("Active")}</option>
              <option value="INVITED">{t("Invited")}</option>
              <option value="SUSPENDED">{t("Suspended")}</option>
              <option value="ARCHIVED">{t("Archived")}</option>
            </select>
            {(query || group !== "ALL" || status !== "ALL" || highlight !== "ALL") ? (
              <button type="button" className="admin-secondary" onClick={clearFilters}>
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
                  <span className={`admin-user-avatar admin-user-avatar-${user.role.toLowerCase()}`} aria-hidden="true">{displayName(user).slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{displayName(user)}</strong>
                    <span><bdi dir="ltr">@{user.username}</bdi> · {roleLabel(user, t)}</span>
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
                    type="button"
                    className="admin-account-view-details"
                    onClick={() => {
                      if (credential) {
                        showToast({
                          kind: "error",
                          title: t("Account details"),
                          message: t("Close the temporary credential panel before continuing.")
                        });
                        return;
                      }
                      setSelectedAccountId(user.id);
                    }}
                  >
                    {t("View details")}
                  </button>
                  <button
                    type="button"
                    onClick={() => requestAction(user, "reset-password")}
                    disabled={busy || user.status === "ARCHIVED" || isCurrentAdmin}
                    title={isCurrentAdmin ? t("Use Profile to change your own password.") : undefined}
                  >
                    {t("Reset password")}
                  </button>
                  {user.status === "SUSPENDED"
                    ? <button type="button" onClick={() => requestAction(user, "reactivate")} disabled={busy}>{t("Reactivate")}</button>
                    : (
                      <button
                        type="button"
                        onClick={() => requestAction(user, "suspend")}
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
              <div className="admin-empty-state" role="status">
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
