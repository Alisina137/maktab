"use client";

import { useEffect, useState, type FormEvent } from "react";

type School = {
  id: string;
  code: string;
  name: string;
  province: string;
  city: string;
};

type User = {
  id: string;
  username: string;
  role: "SCHOOL_ADMIN" | "SCHOOL_STAFF" | "TEACHER" | "PARENT" | "STUDENT";
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  mustChangePassword: boolean;
};

type Session = {
  accessToken: string;
  refreshToken: string;
  user: User;
  mustChangePassword: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.message ?? "Request failed.");
  return body as T;
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
  const [newRole, setNewRole] = useState<User["role"]>("PARENT");
  const [credential, setCredential] = useState<{ username: string; password: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ schools: School[] }>("/v1/public/schools")
      .then((result) => {
        setSchools(result.schools);
        setSchoolId(result.schools[0]?.id ?? "");
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load schools."));
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
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
      setError(cause instanceof Error ? cause.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function changeTemporaryPassword(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<Session>("/v1/auth/change-temporary-password", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({ newPassword })
      });
      setSession(result);
      setNewPassword("");
      await loadUsers(result.accessToken);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Password change failed.");
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
    setError("");
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  async function accountAction(user: User, action: "reset-password" | "suspend" | "reactivate") {
    if (!session) return;
    setBusy(true);
    setError("");
    setCredential(null);
    try {
      const result = await api<{ user: User; temporaryPassword?: string }>(
        `/v1/admin/users/${user.id}/${action}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.accessToken}` }
        }
      );
      if (result.temporaryPassword) {
        setCredential({ username: result.user.username, password: result.temporaryPassword });
      }
      await loadUsers();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <main className="admin-shell">
        <section className="admin-panel admin-login-panel">
          <span className="eyebrow">Phase 2 · School Administration</span>
          <h1 className="admin-title">School account access</h1>
          <p className="admin-copy">Use the school administrator credentials issued during platform provisioning.</p>
          <form className="admin-form" onSubmit={login}>
            <label>
              School
              <select value={schoolId} onChange={(event) => setSchoolId(event.target.value)} required>
                <option value="">Select a school</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>{school.name} · {school.code}</option>
                ))}
              </select>
            </label>
            <label>
              Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
            </label>
            <label>
              Password
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
            </label>
            <button className="admin-primary" type="submit" disabled={busy || !schoolId}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
          {error ? <div className="admin-error">{error}</div> : null}
        </section>
      </main>
    );
  }

  if (session.mustChangePassword) {
    return (
      <main className="admin-shell">
        <section className="admin-panel admin-login-panel">
          <span className="eyebrow">First login</span>
          <h1 className="admin-title">Create your private password</h1>
          <p className="admin-copy">The temporary password has served its purpose. Your new password is stored only as a secure hash and cannot be viewed by the platform or school.</p>
          <form className="admin-form" onSubmit={changeTemporaryPassword}>
            <label>
              New password
              <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" minLength={10} required />
            </label>
            <button className="admin-primary" type="submit" disabled={busy}>Save password</button>
          </form>
          {error ? <div className="admin-error">{error}</div> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <div className="admin-header">
        <div>
          <span className="eyebrow">School Admin</span>
          <h1 className="admin-title">Account management</h1>
          <p className="admin-copy">Generate school-controlled accounts and manage their access status.</p>
        </div>
        <button className="admin-secondary" onClick={() => { setSession(null); setUsers([]); setCredential(null); }}>Sign out</button>
      </div>

      {error ? <div className="admin-error">{error}</div> : null}

      {credential ? (
        <section className="credential-card">
          <strong>Temporary credential — show or print this once</strong>
          <div><span>Username</span><code>{credential.username}</code></div>
          <div><span>Temporary password</span><code>{credential.password}</code></div>
          <p>After first login, the user must replace this password. The permanent password cannot be retrieved by an administrator.</p>
        </section>
      ) : null}

      <section className="admin-grid">
        <article className="admin-panel">
          <h2>Create account</h2>
          <form className="admin-form" onSubmit={createUser}>
            <label>
              Username
              <input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} placeholder="parent.001" required />
            </label>
            <label>
              Role
              <select value={newRole} onChange={(event) => setNewRole(event.target.value as User["role"])}>
                <option value="PARENT">Parent</option>
                <option value="TEACHER">Teacher</option>
                <option value="STUDENT">Student</option>
                <option value="SCHOOL_STAFF">School staff</option>
                <option value="SCHOOL_ADMIN">School admin</option>
              </select>
            </label>
            <button className="admin-primary" disabled={busy} type="submit">Generate account</button>
          </form>
        </article>

        <article className="admin-panel admin-users-panel">
          <div className="admin-section-header">
            <div>
              <h2>School accounts</h2>
              <p>{users.length} account{users.length === 1 ? "" : "s"}</p>
            </div>
            <button className="admin-secondary" onClick={() => void loadUsers()} disabled={busy}>Refresh</button>
          </div>

          <div className="admin-user-list">
            {users.map((user) => (
              <div className="admin-user-row" key={user.id}>
                <div>
                  <strong>{user.username}</strong>
                  <span>{user.role.replaceAll("_", " ")} · {user.status}{user.mustChangePassword ? " · password change required" : ""}</span>
                </div>
                <div className="admin-actions">
                  <button onClick={() => void accountAction(user, "reset-password")} disabled={busy || user.status === "ARCHIVED"}>Reset password</button>
                  {user.status === "SUSPENDED" ? (
                    <button onClick={() => void accountAction(user, "reactivate")} disabled={busy}>Reactivate</button>
                  ) : (
                    <button onClick={() => void accountAction(user, "suspend")} disabled={busy || user.id === session.user.id || user.status === "ARCHIVED"}>Suspend</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
