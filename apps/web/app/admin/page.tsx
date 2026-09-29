"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AcademicPanel } from "./academic-panel";
import { AttendancePanel } from "./attendance-panel";
import { FamilyPanel } from "./family-panel";
import { LearningPanel } from "./learning-panel";
import { CommunicationPanel } from "./communication-panel";
import { PilotReadinessPanel } from "./pilot-readiness-panel";

type School = {
  id: string;
  code: string;
  name: string;
  province: string;
  city: string;
  imageUrl: string | null;
};

type User = {
  id: string;
  username: string;
  role: "SCHOOL_ADMIN" | "SCHOOL_STAFF" | "TEACHER" | "PARENT" | "STUDENT";
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  mustChangePassword: boolean;
  profile?: {
    fullName: string | null;
    phone: string | null;
    code: string | null;
  };
};

type AccountGroup = "ALL" | "PARENT" | "TEACHER" | "STUDENT" | "STAFF";

type AdminToastState = {
  kind: "error" | "success";
  title: string;
  message: string;
};

type Session = {
  accessToken: string;
  refreshToken: string;
  user: User;
  mustChangePassword: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

class AdminApiError extends Error {
  code: string | null;
  status: number;
  requestId: string | null;

  constructor(message: string, status: number, code: string | null, requestId: string | null) {
    super(message);
    this.name = "AdminApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new AdminApiError(
        "MaktabLink could not read the server response.",
        response.status,
        "invalid_response",
        response.headers.get("x-request-id")
      );
    }
  }

  if (!response.ok) {
    const record = body && typeof body === "object" ? body as Record<string, unknown> : null;
    throw new AdminApiError(
      typeof record?.message === "string" ? record.message : "Request failed.",
      response.status,
      typeof record?.error === "string" ? record.error : null,
      response.headers.get("x-request-id")
    );
  }
  return body as T;
}

function friendlyAdminError(cause: unknown, fallback = "Please try again.") {
  if (!(cause instanceof AdminApiError)) return fallback;

  const messages: Record<string, string> = {
    session_invalid: "Your administrator session has expired. Please sign in again.",
    unauthorized: "Please sign in again to continue.",
    self_suspend_blocked: "You cannot suspend the administrator account you are currently using.",
    self_reset_blocked: "For your security, reset another account here. Your current administrator password cannot be reset from its own active session.",
    account_archived: "This account is archived and can no longer be changed.",
    subscription_write_blocked: "Account changes are temporarily unavailable while the school subscription is suspended.",
    not_found: "This account could not be found. Refresh the directory and try again.",
    validation_error: "Some account information is not valid. Please review it and try again.",
    username_conflict: "That username already exists in this school.",
    internal_error: "MaktabLink could not complete this account change. Please try again.",
    invalid_response: "The school service returned an unreadable response. Please try again."
  };

  return cause.code ? messages[cause.code] ?? cause.message : cause.message;
}

export default function AdminPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<User["role"]>("TEACHER");
  const [credential, setCredential] = useState<{ username: string; password: string } | null>(null);
  const [toast, setToast] = useState<AdminToastState | null>(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const [accountGroup, setAccountGroup] = useState<AccountGroup>("ALL");
  const [accountStatus, setAccountStatus] = useState<"ALL" | User["status"]>("ALL");
  const [accountQuery, setAccountQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function dismissToast() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (toastExitTimer.current) clearTimeout(toastExitTimer.current);
    setToastLeaving(true);
    toastExitTimer.current = setTimeout(() => {
      setToast(null);
      setToastLeaving(false);
    }, 220);
  }

  function showToast(next: AdminToastState) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (toastExitTimer.current) clearTimeout(toastExitTimer.current);
    setToastLeaving(false);
    setToast(next);

    if (next.kind === "success") {
      toastTimer.current = setTimeout(() => dismissToast(), 5000);
    }
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (toastExitTimer.current) clearTimeout(toastExitTimer.current);
    };
  }, []);

  useEffect(() => {
    void api<{ schools: School[] }>("/v1/public/schools")
      .then((result) => {
        setSchools(result.schools);
        setSchoolId(result.schools[0]?.id ?? "");
      })
      .catch((cause) =>
        showToast({
          kind: "error",
          title: "School list unavailable",
          message: friendlyAdminError(cause, "Could not load schools. Please try again.")
        })
      );
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<Session>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          schoolId,
          expectedRole: "SCHOOL_ADMIN",
          username,
          password
        })
      });
      setSession(result);
      setPassword("");
      if (!result.mustChangePassword) await loadUsers(result.accessToken);
    } catch (cause) {
      showToast({
        kind: "error",
        title: "Sign in was not completed",
        message: friendlyAdminError(cause, "Please check your school, username, and password, then try again.")
      });
    } finally {
      setBusy(false);
    }
  }

  async function changeTemporaryPassword(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    try {
      const result = await api<Session>("/v1/auth/change-temporary-password", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({ newPassword })
      });
      setSession(result);
      setNewPassword("");
      await loadUsers(result.accessToken);
      showToast({
        kind: "success",
        title: "Password updated",
        message: "Your private administrator password is ready."
      });
    } catch (cause) {
      showToast({
        kind: "error",
        title: "Password was not changed",
        message: friendlyAdminError(cause, "Please review the new password and try again.")
      });
    } finally {
      setBusy(false);
    }
  }

  async function loadUsers(accessToken = session?.accessToken) {
    if (!accessToken) return;
    const result = await api<{ users: User[] }>("/v1/admin/users", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    setUsers(result.users);
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setCredential(null);
    try {
      const result = await api<{ user: User; temporaryPassword: string }>("/v1/admin/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({ username: newUsername, role: newRole })
      });
      setCredential({ username: result.user.username, password: result.temporaryPassword });
      setNewUsername("");
      await loadUsers();
      showToast({
        kind: "success",
        title: "Account created",
        message: `${result.user.username} is ready. Share the temporary credential securely.`
      });
    } catch (cause) {
      showToast({
        kind: "error",
        title: "Account was not created",
        message: friendlyAdminError(cause, "Please review the account information and try again.")
      });
    } finally {
      setBusy(false);
    }
  }

  async function accountAction(user: User, action: "reset-password" | "suspend" | "reactivate") {
    if (!session) return;
    if (user.id === session.user.id && (action === "reset-password" || action === "suspend")) {
      showToast({
        kind: "error",
        title: "Current administrator protected",
        message:
          action === "reset-password"
            ? "For your security, you cannot reset the password of the administrator account you are currently using."
            : "You cannot suspend the administrator account you are currently using."
      });
      return;
    }

    setBusy(true);
    setCredential(null);
    try {
      const result = await api<{ user: User; temporaryPassword?: string }>(
        `/v1/admin/users/${user.id}/${action}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.accessToken}` }
        }
      );

      setUsers((current) =>
        current.map((item) =>
          item.id === result.user.id
            ? { ...item, ...result.user, profile: item.profile }
            : item
        )
      );

      if (result.temporaryPassword) {
        setCredential({ username: result.user.username, password: result.temporaryPassword });
      }

      const success =
        action === "reset-password"
          ? {
              title: "Temporary password created",
              message: `A new temporary password is ready for ${displayUserName(user)}. Their existing sessions have been signed out.`
            }
          : action === "suspend"
            ? {
                title: "Account suspended",
                message: `${displayUserName(user)} can no longer sign in until the account is reactivated.`
              }
            : {
                title: "Account reactivated",
                message: `${displayUserName(user)} can use the account again.`
              };

      showToast({ kind: "success", ...success });
    } catch (cause) {
      showToast({
        kind: "error",
        title:
          action === "reset-password"
            ? "Password reset was not completed"
            : action === "suspend"
              ? "Account was not suspended"
              : "Account was not reactivated",
        message: friendlyAdminError(cause, "MaktabLink could not update this account. Please try again.")
      });
    } finally {
      setBusy(false);
    }
  }

  const selectedSchool = schools.find((item) => item.id === schoolId) ?? null;
  const activeAccounts = users.filter((user) => user.status === "ACTIVE").length;
  const invitedAccounts = users.filter((user) => user.status === "INVITED").length;
  const suspendedAccounts = users.filter((user) => user.status === "SUSPENDED").length;
  const teacherAccounts = users.filter((user) => user.role === "TEACHER").length;
  const staffAccounts = users.filter((user) => user.role === "SCHOOL_STAFF" || user.role === "SCHOOL_ADMIN").length;
  const groupCounts: Record<AccountGroup, number> = {
    ALL: users.length,
    PARENT: users.filter((user) => user.role === "PARENT").length,
    TEACHER: users.filter((user) => user.role === "TEACHER").length,
    STUDENT: users.filter((user) => user.role === "STUDENT").length,
    STAFF: staffAccounts
  };
  const normalizedQuery = accountQuery.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    const inGroup =
      accountGroup === "ALL" ||
      (accountGroup === "STAFF"
        ? user.role === "SCHOOL_ADMIN" || user.role === "SCHOOL_STAFF"
        : user.role === accountGroup);
    const inStatus = accountStatus === "ALL" || user.status === accountStatus;
    const haystack = [
      user.username,
      formatRole(user.role),
      user.status,
      user.profile?.fullName,
      user.profile?.phone,
      user.profile?.code,
      user.mustChangePassword ? "password change required invited temporary password" : "password ready"
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return inGroup && inStatus && (!normalizedQuery || haystack.includes(normalizedQuery));
  });

  if (!session) {
    return (
      <main className="admin-shell admin-shell-premium admin-auth-shell">
        <section className="admin-auth-hero">
          <div className="admin-auth-brand">
            <span className="admin-brand-mark" aria-hidden="true">M</span>
            <div>
              <strong>MaktabLink</strong>
              <span>School Administration</span>
            </div>
          </div>
          <div className="admin-auth-copy">
            <span className="admin-kicker">Private school workspace</span>
            <h1>Run the school day from one calm, secure workspace.</h1>
            <p>
              Accounts, academics, families, attendance, learning, communication, fees, and pilot
              operations stay organized in one school-scoped dashboard.
            </p>
          </div>
          <div className="admin-auth-feature-grid" aria-label="Administration capabilities">
            <div><strong>Tenant-safe</strong><span>School-scoped access and data</span></div>
            <div><strong>Role-based</strong><span>Admin, staff, teacher, parent, student</span></div>
            <div><strong>Audit-ready</strong><span>Sensitive changes remain reviewable</span></div>
          </div>
        </section>

        <section className="admin-panel admin-login-panel admin-login-premium">
          <div className="admin-login-heading">
            <span className="admin-kicker">Administrator access</span>
            <h2>Welcome back</h2>
            <p>Select your school and sign in with the administrator credentials issued during provisioning.</p>
          </div>

          <form className="admin-form admin-form-premium" onSubmit={login}>
            <label>
              School
              <select value={schoolId} onChange={(event) => setSchoolId(event.target.value)} required>
                <option value="">Select a school</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>{school.name} · {school.code}</option>
                ))}
              </select>
            </label>

            {selectedSchool ? (
              <div className="admin-login-school">
                <SchoolAvatar school={selectedSchool} compact />
                <div>
                  <strong>{selectedSchool.name}</strong>
                  <span>{selectedSchool.province} · {selectedSchool.code}</span>
                </div>
              </div>
            ) : null}

            <label>
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="admin.username"
                required
              />
            </label>
            <label>
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
            </label>
            <button className="admin-primary admin-primary-large" type="submit" disabled={busy || !schoolId}>
              {busy ? "Signing in…" : "Sign in to dashboard"}
            </button>
          </form>
          {toast ? <AdminToast toast={toast} leaving={toastLeaving} onDismiss={dismissToast} /> : null}
          <p className="admin-login-footnote">Access is restricted to your selected school and authenticated role.</p>
        </section>
      </main>
    );
  }

  if (session.mustChangePassword) {
    return (
      <main className="admin-shell admin-shell-premium admin-auth-shell">
        <section className="admin-auth-hero admin-auth-hero-compact">
          <div className="admin-auth-brand">
            <span className="admin-brand-mark" aria-hidden="true">M</span>
            <div>
              <strong>MaktabLink</strong>
              <span>Secure first login</span>
            </div>
          </div>
          <div className="admin-auth-copy">
            <span className="admin-kicker">One-time setup</span>
            <h1>Create your private administrator password.</h1>
            <p>The temporary credential has served its purpose. Your permanent password is stored only as a secure hash.</p>
          </div>
        </section>

        <section className="admin-panel admin-login-panel admin-login-premium">
          <div className="admin-login-heading">
            <span className="admin-kicker">Secure your account</span>
            <h2>Choose a new password</h2>
            <p>Use at least 10 characters with letters and numbers.</p>
          </div>
          <form className="admin-form admin-form-premium" onSubmit={changeTemporaryPassword}>
            <label>
              New password
              <input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                type="password"
                minLength={10}
                autoComplete="new-password"
                required
              />
            </label>
            <button className="admin-primary admin-primary-large" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save private password"}
            </button>
          </form>
          {toast ? <AdminToast toast={toast} leaving={toastLeaving} onDismiss={dismissToast} /> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell admin-shell-premium">
      <header className="admin-premium-header">
        <div className="admin-premium-brand-row">
          <div className="admin-auth-brand admin-auth-brand-dark">
            <span className="admin-brand-mark" aria-hidden="true">M</span>
            <div>
              <strong>MaktabLink</strong>
              <span>School Administration</span>
            </div>
          </div>
          <div className="admin-header-actions">
            <span className="admin-session-pill">
              <span className="admin-live-dot" aria-hidden="true" />
              Signed in as {session.user.username}
            </span>
            <button
              className="admin-secondary"
              onClick={() => {
                setSession(null);
                setUsers([]);
                setCredential(null);
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="admin-school-hero">
          <div className="admin-school-identity">
            {selectedSchool ? <SchoolAvatar school={selectedSchool} /> : <span className="admin-school-fallback">S</span>}
            <div>
              <span className="admin-kicker">School workspace</span>
              <h1>{selectedSchool?.name ?? "School administration"}</h1>
              <p>
                {selectedSchool
                  ? `${selectedSchool.province} · ${selectedSchool.city} · School code ${selectedSchool.code}`
                  : "Manage your school operations from one workspace."}
              </p>
            </div>
          </div>
          <div className="admin-school-status">
            <span>Workspace status</span>
            <strong><span className="admin-live-dot" aria-hidden="true" /> Active</strong>
          </div>
        </div>
      </header>

      <section className="admin-metrics-grid" aria-label="Account overview">
        <MetricCard label="Total accounts" value={users.length} helper="School-issued identities" tone="brand" />
        <MetricCard label="Active" value={activeAccounts} helper={`${invitedAccounts} invited`} tone="success" />
        <MetricCard label="Teachers" value={teacherAccounts} helper={`${staffAccounts} admin / staff`} tone="violet" />
        <MetricCard label="Needs attention" value={suspendedAccounts} helper="Suspended accounts" tone={suspendedAccounts ? "danger" : "neutral"} />
      </section>

      <nav className="admin-quick-nav" aria-label="Administration sections">
        <a href="#accounts">Accounts</a>
        <a href="#pilot">Pilot operations</a>
        <a href="#communication">Communication & fees</a>
        <a href="#learning">Learning</a>
        <a href="#attendance">Attendance</a>
        <a href="#families">Families</a>
        <a href="#academics">Academics</a>
      </nav>

      {toast ? <AdminToast toast={toast} leaving={toastLeaving} onDismiss={dismissToast} /> : null}

      {credential ? (
        <section className="credential-card credential-card-premium" aria-live="polite">
          <div className="credential-heading">
            <span className="credential-icon" aria-hidden="true">✓</span>
            <div>
              <strong>Temporary credential created</strong>
              <p>Show, copy, or print this once. The user must replace the temporary password after first login.</p>
            </div>
          </div>
          <div className="credential-values">
            <div><span>Username</span><code>{credential.username}</code></div>
            <div><span>Temporary password</span><code>{credential.password}</code></div>
          </div>
        </section>
      ) : null}

      <section id="accounts" className="admin-dashboard-section">
        <div className="admin-dashboard-heading">
          <div>
            <span className="admin-kicker">Identity & access</span>
            <h2>School accounts</h2>
            <p>Create school staff identities, review account status, reset temporary credentials, and manage access.</p>
          </div>
          <button className="admin-secondary" onClick={() => void loadUsers()} disabled={busy}>Refresh accounts</button>
        </div>

        <div className="admin-grid admin-account-grid">
          <article className="admin-panel admin-create-account-card">
            <div className="admin-panel-icon" aria-hidden="true">+</div>
            <h3>Create account</h3>
            <p className="admin-copy">Create teacher, staff, and administrator identities. Parent and student accounts stay linked through Students & Families.</p>
            <form className="admin-form" onSubmit={createUser}>
              <label>
                Username
                <input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} placeholder="teacher.001" required />
              </label>
              <label>
                Role
                <select value={newRole} onChange={(event) => setNewRole(event.target.value as User["role"])}>
                  <option value="TEACHER">Teacher</option>
                  <option value="SCHOOL_STAFF">School staff</option>
                  <option value="SCHOOL_ADMIN">School admin</option>
                </select>
              </label>
              <button className="admin-primary" disabled={busy} type="submit">
                {busy ? "Working…" : "Generate account"}
              </button>
            </form>
          </article>

          <article className="admin-panel admin-users-panel admin-users-panel-premium">
            <div className="admin-section-header">
              <div>
                <h3>Account directory</h3>
                <p>{filteredUsers.length} shown · {users.length} total school account{users.length === 1 ? "" : "s"}</p>
              </div>
            </div>

            <div className="admin-account-tabs" role="tablist" aria-label="Account groups">
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
                  className={accountGroup === value ? "admin-account-tab admin-account-tab-active" : "admin-account-tab"}
                  onClick={() => setAccountGroup(value)}
                  role="tab"
                  aria-selected={accountGroup === value}
                >
                  <span>{label}</span>
                  <strong>{groupCounts[value]}</strong>
                </button>
              ))}
            </div>

            <div className="admin-account-filters">
              <label className="admin-account-search">
                <span className="sr-only">Search accounts</span>
                <input
                  value={accountQuery}
                  onChange={(event) => setAccountQuery(event.target.value)}
                  placeholder="Search name, username, phone, code, role, or status"
                />
              </label>
              <label>
                <span className="sr-only">Filter by account status</span>
                <select
                  value={accountStatus}
                  onChange={(event) => setAccountStatus(event.target.value as "ALL" | User["status"])}
                >
                  <option value="ALL">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INVITED">Invited</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
              {(accountQuery || accountGroup !== "ALL" || accountStatus !== "ALL") ? (
                <button
                  className="admin-secondary"
                  type="button"
                  onClick={() => {
                    setAccountQuery("");
                    setAccountGroup("ALL");
                    setAccountStatus("ALL");
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>

            <div className="admin-user-list admin-user-list-premium">
              {filteredUsers.map((user) => (
                <div className="admin-user-row admin-user-row-premium" key={user.id}>
                  <div className="admin-user-identity">
                    <span className="admin-user-avatar">{displayUserName(user).slice(0, 1).toUpperCase()}</span>
                    <div>
                      <strong>{displayUserName(user)}</strong>
                      <span>@{user.username} · {formatRole(user.role)}</span>
                      {(user.profile?.code || user.profile?.phone) ? (
                        <span>
                          {[user.profile?.code, user.profile?.phone].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="admin-user-meta">
                    <span className={`admin-status-badge admin-status-${user.status.toLowerCase()}`}>
                      {user.status}
                    </span>
                    {user.mustChangePassword ? <span className="admin-password-badge">Password change required</span> : null}
                  </div>

                  <div className="admin-actions">
                    <button
                      onClick={() => void accountAction(user, "reset-password")}
                      disabled={busy || user.status === "ARCHIVED" || user.id === session.user.id}
                      title={user.id === session.user.id ? "Your active administrator account cannot reset itself." : undefined}
                    >
                      Reset password
                    </button>
                    {user.status === "SUSPENDED" ? (
                      <button onClick={() => void accountAction(user, "reactivate")} disabled={busy}>Reactivate</button>
                    ) : (
                      <button onClick={() => void accountAction(user, "suspend")} disabled={busy || user.id === session.user.id || user.status === "ARCHIVED"}>
                        Suspend
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 ? (
                <div className="admin-empty-state">
                  <strong>No matching accounts</strong>
                  <span>Try another account group, status, name, username, phone number, or code.</span>
                </div>
              ) : null}
            </div>
          </article>
        </div>
      </section>

      <div id="pilot" className="admin-section-anchor"><PilotReadinessPanel accessToken={session.accessToken} /></div>
      <div id="communication" className="admin-section-anchor"><CommunicationPanel accessToken={session.accessToken} /></div>
      <div id="learning" className="admin-section-anchor"><LearningPanel accessToken={session.accessToken} /></div>
      <div id="attendance" className="admin-section-anchor"><AttendancePanel accessToken={session.accessToken} /></div>
      <div id="families" className="admin-section-anchor"><FamilyPanel accessToken={session.accessToken} /></div>
      <div id="academics" className="admin-section-anchor"><AcademicPanel accessToken={session.accessToken} /></div>
    </main>
  );

}

function AdminToast({
  toast,
  leaving,
  onDismiss
}: {
  toast: AdminToastState;
  leaving: boolean;
  onDismiss: () => void;
}) {
  return (
    <div
      className={`admin-toast admin-toast-${toast.kind} ${leaving ? "admin-toast-leaving" : ""}`}
      role={toast.kind === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <span className="admin-toast-icon" aria-hidden="true">{toast.kind === "success" ? "✓" : "!"}</span>
      <div>
        <strong>{toast.title}</strong>
        <p>{toast.message}</p>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss message">×</button>
    </div>
  );
}

function displayUserName(user: User) {
  return user.profile?.fullName?.trim() || user.username;
}

function MetricCard({
  label,
  value,
  helper,
  tone
}: {
  label: string;
  value: number;
  helper: string;
  tone: "brand" | "success" | "violet" | "danger" | "neutral";
}) {
  return (
    <article className={`admin-metric-card admin-metric-${tone}`}>
      <div className="admin-metric-topline">
        <span>{label}</span>
        <span className="admin-metric-dot" aria-hidden="true" />
      </div>
      <strong>{value.toLocaleString()}</strong>
      <small>{helper}</small>
    </article>
  );
}

function SchoolAvatar({ school, compact = false }: { school: School; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const className = compact ? "admin-school-avatar admin-school-avatar-compact" : "admin-school-avatar";

  if (school.imageUrl && !failed) {
    return <img className={className} src={school.imageUrl} alt="" onError={() => setFailed(true)} />;
  }

  return <span className={`${className} admin-school-avatar-fallback`} aria-hidden="true">{school.name.slice(0, 1).toUpperCase()}</span>;
}

function formatRole(role: User["role"]) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
