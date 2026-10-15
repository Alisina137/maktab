"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { adminApi, friendlyAdminError, type User } from "../../admin-client";
import { adminFormat } from "../../admin-i18n";
import { validateAccountCreation } from "../../account-create-rules";
import { AccountTemporaryCredentialPanel } from "../../account-temporary-credential";
import { AdminAccountDetailsDrawer } from "../../admin-account-details-drawer";
import { AdminAccountActionConfirm, type AccountPendingAction, type AccountSecurityAction } from "../../admin-account-action-confirm";
import { AdminAccountBulkConfirm } from "../../admin-account-bulk-confirm";
import { AdminAccountDirectory, emptyDirectory,
  type AccountGroup, type AccountHighlight, type AccountSort, type AccountOrder,
  type AccountDirectoryResult } from "../../admin-account-directory";
import type { AccountFamilyOverview } from "../../account-details-data";
import { shouldAcceptAccountDirectoryResult, updateAccountSelection } from "../../account-directory-safety";
import { AdminLoader, AdminSkeleton } from "../../admin-loader";
import { useAdminWorkspace } from "../../admin-workspace";

type AccountView = "DIRECTORY" | "CREATE";

function roleCreationHelp(role: User["role"]): string {
  switch (role) {
    case "PARENT": return "Create a parent login and parent profile together.";
    case "STUDENT": return "Select an existing active student without a login. Family linking stays in Families.";
    case "TEACHER": return "Create a teacher login here, then complete the teacher profile in Academics.";
    case "SCHOOL_STAFF": return "Create a school staff login with school-scoped access.";
    case "SCHOOL_ADMIN": return "Create another administrator only when school-wide administrative access is necessary.";
  }
}

type FamilyStudent = AccountFamilyOverview["students"][number];

export default function AccountsPage() {
  const { stored, locale, t, showToast } = useAdminWorkspace();
  const [directory, setDirectory] = useState<AccountDirectoryResult>(emptyDirectory);
  const [directoryToken, setDirectoryToken] = useState<string | null>(null);
  const sessionToken = stored.session.accessToken;
  const tokenRef = useRef(sessionToken);
  tokenRef.current = sessionToken;
  const [familyToken, setFamilyToken] = useState<string | null>(null);
  const visibleDirectory = directoryToken === sessionToken ? directory : emptyDirectory;
  const users = visibleDirectory.users;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<AccountSort>("username");
  const [order, setOrder] = useState<AccountOrder>("asc");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [directoryError, setDirectoryError] = useState("");
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState<{ action: "suspend" | "reactivate"; ids: string[]; names: string[] } | null>(null);
  const closeBulkPending = useCallback(() => setBulkPending(null), []);
  const [usernameAvailability, setUsernameAvailability] = useState<{ username: string; available: boolean } | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<User["role"]>("TEACHER");
  const [parentFullName, setParentFullName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [familyOverview, setFamilyOverview] = useState<AccountFamilyOverview | null>(null);
  const familyData = familyToken === sessionToken ? familyOverview : null;
  const familyStudents: FamilyStudent[] = familyData?.students ?? [];
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyError, setFamilyError] = useState("");
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
  const queryIntentRef = useRef("");
  const isQueryPending = query.trim() !== debouncedQuery;
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<AccountPendingAction | null>(null);
  const [returnToAccountId, setReturnToAccountId] = useState<string | null>(null);
  const cancelPendingAction = useCallback(() => {
    setPendingAction(null);
    setSelectedAccountId(returnToAccountId);
    setReturnToAccountId(null);
  }, [returnToAccountId]);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const requestedToken = sessionToken;
    const requestedQuery = debouncedQuery;
    const accepts = () => shouldAcceptAccountDirectoryResult(
      requestedToken, requestedQuery, tokenRef.current, queryIntentRef.current, controller.signal.aborted
    );
    setDirectoryLoading(true);
    setDirectoryError("");
    const params = new URLSearchParams({
      query: debouncedQuery, group, status, highlight, sortBy, order,
      page: String(page), pageSize: String(pageSize)
    });
    void adminApi<AccountDirectoryResult>(`/v1/admin/users/directory?${params}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
      signal: controller.signal
    }).then((result) => {
      if (!accepts()) return;
      setDirectory(result);
      setDirectoryToken(requestedToken);
      if (page > result.pages) setPage(result.pages);
    }).catch((error) => {
      if (!accepts()) return;
      setDirectoryToken(requestedToken);
      setDirectoryError(friendlyAdminError(error, "Could not load school accounts.", locale));
      setDirectory((previous) => ({ ...previous, users: [] }));
    }).finally(() => {
      if (accepts()) {
        setDirectoryLoading(false);
        setInitialLoading(false);
      }
    });
    return () => controller.abort();
  }, [sessionToken, debouncedQuery, group, status, highlight, sortBy, order, page, pageSize, refreshNonce]);

  // Reset sensitive screen state whenever the authenticated school/session changes.
  useEffect(() => {
    setSelectedAccountId(null);
    setPendingAction(null);
    setReturnToAccountId(null);
    setBulkPending(null);
    setCredential(null);
    setSelectedIds(new Set());
    setFamilyOverview(null);
    setFamilyToken(null);
    setPage(1);
  }, [sessionToken]);

  const selectedRole = users.find((user) => user.id === selectedAccountId)?.role;
  const needsFamily = (view === "CREATE" && newRole === "STUDENT") ||
    (selectedAccountId !== null && (selectedRole === "PARENT" || selectedRole === "STUDENT"));
  useEffect(() => {
    if (!needsFamily || familyData) return;
    let cancelled = false;
    const requestedToken = sessionToken;
    setFamilyLoading(true);
    setFamilyError("");
    void adminApi<AccountFamilyOverview>("/v1/admin/families", {
      headers: { Authorization: `Bearer ${requestedToken}` }
    }).then((result) => {
      if (cancelled || tokenRef.current !== requestedToken) return;
      setFamilyOverview(result);
      setFamilyToken(requestedToken);
      setStudentRecordId((current) =>
        result.students.some((row) =>
          row.student.id === current && !row.student.userId && row.student.status === "ACTIVE"
        ) ? current : ""
      );
    }).catch((error) => {
      if (!cancelled && tokenRef.current === requestedToken) setFamilyError(friendlyAdminError(error, "Could not load school accounts.", locale));
    }).finally(() => {
      if (!cancelled && tokenRef.current === requestedToken) setFamilyLoading(false);
    });
    return () => { cancelled = true; };
  }, [needsFamily, familyData, sessionToken]);

  useEffect(() => {
    const value = newUsername.trim();
    setUsernameAvailability(null);
    const valid = value.length >= 3 && value.length <= 64 &&
      ((newRole === "PARENT" || newRole === "STUDENT")
        ? /^[A-Za-z0-9]+$/.test(value) : /^[A-Za-z0-9._@+-]+$/.test(value));
    if (!valid) { setUsernameChecking(false); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      setUsernameChecking(true);
      void adminApi<{ available: boolean }>(
        `/v1/admin/users/username-check?username=${encodeURIComponent(value)}`, {
          headers: { Authorization: `Bearer ${stored.session.accessToken}` }
        }
      ).then((response) => {
        if (!cancelled) setUsernameAvailability({ username: value, available: response.available });
      }).catch(() => {
        if (!cancelled) setUsernameAvailability(null);
      }).finally(() => {
        if (!cancelled) setUsernameChecking(false);
      });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [newUsername, newRole, stored.session.accessToken]);

  function refreshDirectory() { resetSelection(); setRefreshNonce((current) => current + 1); }
  function resetSelection() { setSelectedIds(new Set()); }
  function updateGroup(next: AccountGroup) { setGroup(next); setPage(1); resetSelection(); setSelectedAccountId(null); }
  function updateStatus(next: "ALL" | User["status"]) { setStatus(next); setHighlight("ALL"); setPage(1); resetSelection(); setSelectedAccountId(null); }
  function updateQuery(next: string) { queryIntentRef.current = next.trim(); setQuery(next); setPage(1); resetSelection(); setSelectedAccountId(null); }
  function updateSort(next: AccountSort) { setSortBy(next); setPage(1); resetSelection(); setSelectedAccountId(null); }
  function updateOrder(next: AccountOrder) { setOrder(next); setPage(1); resetSelection(); setSelectedAccountId(null); }
  function updatePage(next: number) { setPage(next); resetSelection(); setSelectedAccountId(null); }
  function updatePageSize(next: number) { setPageSize(next); setPage(1); resetSelection(); setSelectedAccountId(null); }
  function setSelection(ids: string[], selected: boolean) {
    setSelectedIds((old) => updateAccountSelection(old, ids, selected, users, stored.session.user.id));
  }
  function requestBulk(action: "suspend" | "reactivate") {
    if (busy || credential || directoryLoading) return;
    const entries = users.filter((user) => selectedIds.has(user.id));
    if (!entries.length || entries.length > 20 || entries.some((user) =>
      user.id === stored.session.user.id || user.role === "SCHOOL_ADMIN" ||
      (action === "suspend" ? !["ACTIVE", "INVITED"].includes(user.status) : user.status !== "SUSPENDED")
    )) return;
    setBulkPending({ action, ids: entries.map((entry) => entry.id),
      names: entries.map((entry) => entry.profile?.fullName || entry.username) });
  }
  async function executeBulk(reason?: string) {
    if (!bulkPending || busy) return;
    setBusy(true);
    try {
      const result = await adminApi<{ updated: number }>("/v1/admin/users/bulk-status", {
        method: "POST", headers: { Authorization: `Bearer ${stored.session.accessToken}` },
        body: JSON.stringify({
          action: bulkPending.action, userIds: bulkPending.ids,
          ...(bulkPending.action === "suspend" && reason ? { reason } : {})
        })
      });
      setBulkPending(null);
      resetSelection();
      refreshDirectory();
      showToast({ kind: "success", title: t("Bulk account actions"),
        message: adminFormat(locale, "{count} accounts updated.", { count: result.updated }) });
    } catch (error) {
      showToast({ kind: "error", title: t("Bulk account actions"),
        message: friendlyAdminError(error, "Could not update accounts.", locale) });
      refreshDirectory();
    } finally { setBusy(false); }
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
      const availability = await adminApi<{ available: boolean }>(
        `/v1/admin/users/username-check?username=${encodeURIComponent(newUsername.trim())}`, {
          headers: { Authorization: `Bearer ${stored.session.accessToken}` }
        }
      );
      if (!availability.available) {
        setUsernameAvailability({ username: newUsername.trim(), available: false });
        return;
      }
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
      setFamilyOverview(null);
      setFamilyToken(null);
      setCreationAttempted(false);
      setCredential({ username: result.user.username, password: result.temporaryPassword });
      setView("DIRECTORY");
      refreshDirectory();
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
    setReturnToAccountId(selectedAccountId);
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
      setDirectory((current) => ({
        ...current,
        users: current.users.map((item) =>
          item.id === result.user.id ? { ...item, ...result.user, profile: item.profile } : item
        )
      }));
      setPendingAction(null);
      setReturnToAccountId(null);
      resetSelection();
      refreshDirectory();
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
  const usernameUnavailable =
    usernameAvailability?.username === newUsername.trim() && !usernameAvailability.available;
  const showNameIssue = creationAttempted || parentFullName.trim().length > 0;
  const showPhoneIssue = creationAttempted || parentPhone.length > 0;

  const selectedAccount = selectedAccountId ? users.find((user) => user.id === selectedAccountId) ?? null : null;
  const summaryCounts = visibleDirectory.counts;
  const summaries = [
    { id: "ALL", label: "Total accounts", value: summaryCounts.total, symbol: "▦" },
    { id: "ACTIVE", label: "Active accounts", value: summaryCounts.active, symbol: "✓" },
    { id: "PENDING", label: "Pending activation", value: summaryCounts.pending, symbol: "◷" },
    { id: "SUSPENDED", label: "Suspended accounts", value: summaryCounts.suspended, symbol: "!" }
  ] as const;
  function selectSummary(next: AccountHighlight) {
    setHighlight(next);
    setGroup("ALL");
    setStatus("ALL");
    queryIntentRef.current = "";
    setQuery("");
    setPage(1);
    resetSelection();
    setView("DIRECTORY");
    setSelectedAccountId(null);
  }
  function clearFilters() {
    queryIntentRef.current = "";
    setQuery(""); setGroup("ALL"); setStatus("ALL"); setHighlight("ALL");
    setPage(1); resetSelection(); setSelectedAccountId(null);
  }

  if (initialLoading || directoryToken !== sessionToken) {
    return (
      <section className="admin-panel admin-loading-card">
        <AdminLoader label={t("Loading accounts data…")} />
        <AdminSkeleton rows={5} />
      </section>
    );
  }

  return (
    <section className="admin-dashboard-section admin-page-enter">
      {bulkPending ? (
        <AdminAccountBulkConfirm
          key={bulkPending.ids.join(",") + bulkPending.action}
          action={bulkPending.action}
          names={bulkPending.names}
          locale={locale}
          t={t}
          busy={busy}
          onCancel={closeBulkPending}
          onConfirm={(reason) => void executeBulk(reason)}
        />
      ) : null}

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
          families={familyData}
          locale={locale}
          t={t}
          busy={busy}
          onClose={closeAccountDetails}
          onAction={requestAction}
          directoryUsers={users}
          familiesLoading={familyLoading}
          familiesError={familyError}
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
                    disabled={busy || familyLoading || availableStudentRecords.length === 0}
                  >
                    <option value="">{t(availableStudentRecords.length === 0 ? "No students without login" : "Select an eligible student")}</option>
                    {matchingStudentRecords.map((item) => (
                      <option key={item.student.id} value={item.student.id}>
                        {item.student.fullName} · {item.student.studentCode} · {item.classSection.name}
                      </option>
                    ))}
                  </select>
                  {familyLoading ? (
                    <span className="admin-field-hint">{t("Loading student records…")}</span>
                  ) : familyError ? (
                    <span className="account-create-field-error" role="alert">{familyError}</span>
                  ) : availableStudentRecords.length === 0 ? (
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
                aria-invalid={(showUsernameIssue && Boolean(creationIssues.username)) || usernameUnavailable}
                aria-describedby={showUsernameIssue && creationIssues.username
                  ? "account-create-username-error"
                  : usernameUnavailable ? "account-create-username-unavailable" : "account-create-username-help"}
                required
              />
              {showUsernameIssue && creationIssues.username ? (
                <span id="account-create-username-error" className="account-create-field-error" role="alert">{t(creationIssues.username)}</span>
              ) : (
                <span id="account-create-username-help" className="admin-field-hint">{t(newRole === "PARENT" || newRole === "STUDENT" ? "Use English letters and numbers only." : "Use English letters, numbers, dots, underscores, @, + or hyphens.")}</span>
              )}
              {usernameChecking ? <span className="admin-field-hint" role="status">{t("Checking username…")}</span> : null}
              {usernameUnavailable && !creationIssues.username ? (
                <span id="account-create-username-unavailable" className="account-create-field-error" role="alert">
                  {t("That username already exists in this school.")}
                </span>
              ) : null}
            </label>
            <div className="account-create-notice">{t("A temporary password will be generated. The account holder must change it on first login.")}</div>
            <button
              className="admin-primary"
              disabled={busy || (newRole === "STUDENT" && (familyLoading || availableStudentRecords.length === 0))}
              type="submit"
            >
              {t(busy ? "Working…" : "Generate account")}
            </button>
          </form>
        </article>
        ) : null}

        <AdminAccountDirectory
          result={visibleDirectory}
          group={group}
          status={status}
          highlight={highlight}
          query={query}
          sortBy={sortBy}
          order={order}
          page={page}
          pageSize={pageSize}
          selectedIds={selectedIds}
          loading={directoryLoading || isQueryPending}
          error={isQueryPending ? "" : directoryError}
          busy={busy}
          credentialOpen={Boolean(credential)}
          currentAdminId={stored.session.user.id}
          locale={locale}
          t={t}
          onGroup={updateGroup}
          onStatus={updateStatus}
          onQuery={updateQuery}
          onSortBy={updateSort}
          onOrder={updateOrder}
          onPage={updatePage}
          onPageSize={updatePageSize}
          onSelect={(id, selected) => setSelection([id], selected)}
          onSelectPage={setSelection}
          onClear={clearFilters}
          onRefresh={refreshDirectory}
          onDetails={(user) => {
            if (credential) {
              showToast({
                kind: "error", title: t("Account details"),
                message: t("Close the temporary credential panel before continuing.")
              });
              return;
            }
            setSelectedAccountId(user.id);
          }}
          onAction={requestAction}
          onBulk={requestBulk}
        />
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
