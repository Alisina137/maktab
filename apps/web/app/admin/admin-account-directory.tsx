"use client";

import type { User } from "./admin-client";
import { adminFormat, type AdminLocale } from "./admin-i18n";

export type AccountGroup = "ALL" | "PARENT" | "TEACHER" | "STUDENT" | "STAFF";
export type AccountHighlight = "ALL" | "ACTIVE" | "PENDING" | "SUSPENDED";
export type AccountSort = "name" | "username" | "role" | "status" | "createdAt" | "lastLoginAt";
export type AccountOrder = "asc" | "desc";

export type AccountDirectoryResult = {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  counts: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
    parent: number;
    teacher: number;
    student: number;
    staff: number;
  };
};

export const emptyDirectory: AccountDirectoryResult = {
  users: [], total: 0, page: 1, pageSize: 20, pages: 1,
  counts: { total: 0, active: 0, pending: 0, suspended: 0, parent: 0, teacher: 0, student: 0, staff: 0 }
};

type Props = {
  result: AccountDirectoryResult;
  group: AccountGroup;
  status: "ALL" | User["status"];
  highlight: AccountHighlight;
  query: string;
  sortBy: AccountSort;
  order: AccountOrder;
  page: number;
  pageSize: number;
  selectedIds: Set<string>;
  loading: boolean;
  error: string;
  busy: boolean;
  credentialOpen: boolean;
  currentAdminId: string;
  locale: AdminLocale;
  t: (english: string) => string;
  onGroup: (group: AccountGroup) => void;
  onStatus: (status: "ALL" | User["status"]) => void;
  onQuery: (query: string) => void;
  onSortBy: (sort: AccountSort) => void;
  onOrder: (order: AccountOrder) => void;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onSelect: (id: string, selected: boolean) => void;
  onSelectPage: (ids: string[], selected: boolean) => void;
  onClear: () => void;
  onRefresh: () => void;
  onDetails: (user: User) => void;
  onAction: (user: User, action: "reset-password" | "suspend" | "reactivate") => void;
  onBulk: (action: "suspend" | "reactivate") => void;
};

function label(user: User) {
  return user.profile?.fullName?.trim() || user.username;
}
function statusLabel(status: User["status"]) {
  return status === "ACTIVE" ? "Active" : status === "INVITED" ? "Invited" :
    status === "SUSPENDED" ? "Suspended" : "Archived";
}
function roleLabel(role: User["role"]) {
  return role === "PARENT" ? "Parents" : role === "TEACHER" ? "Teacher" :
    role === "STUDENT" ? "Students" : role === "SCHOOL_ADMIN" ? "School admin" : "School staff";
}
function eligible(user: User, currentAdminId: string) {
  return user.id !== currentAdminId && user.role !== "SCHOOL_ADMIN" &&
    (user.status === "ACTIVE" || user.status === "INVITED" || user.status === "SUSPENDED");
}

export function AdminAccountDirectory({
  result, group, status, highlight, query, sortBy, order, page, pageSize, selectedIds,
  loading, error, busy, credentialOpen, currentAdminId, locale, t,
  onGroup, onStatus, onQuery, onSortBy, onOrder, onPage, onPageSize,
  onSelect, onSelectPage, onClear, onRefresh, onDetails, onAction, onBulk
}: Props) {
  const count = result.counts;
  const groupCounts: Record<AccountGroup, number> = {
    ALL: count.total, PARENT: count.parent, TEACHER: count.teacher, STUDENT: count.student, STAFF: count.staff
  };
  const users = result.users;
  const eligiblePage = users.filter((user) => eligible(user, currentAdminId));
  const pageSelected = eligiblePage.length > 0 && eligiblePage.every((user) => selectedIds.has(user.id));
  const partial = eligiblePage.some((user) => selectedIds.has(user.id)) && !pageSelected;
  const selected = users.filter((user) => selectedIds.has(user.id));
  const canSuspend = selected.length > 0 && selected.length <= 20 && selected.every((user) => user.status === "ACTIVE" || user.status === "INVITED");
  const canReactivate = selected.length > 0 && selected.length <= 20 && selected.every((user) => user.status === "SUSPENDED");
  const start = result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const end = result.total ? start + users.length - 1 : 0;

  return (
    <article className="admin-panel admin-users-panel admin-users-panel-premium account-directory-scaled" id="account-directory-panel">
      <div className="admin-section-header">
        <div>
          <h3>{t("Account directory")}</h3>
          <p role="status" aria-live="polite">
            {adminFormat(locale, "Showing {start}–{end} of {total} accounts",
              { start, end, total: result.total })}
          </p>
        </div>
        <button type="button" className="admin-secondary" onClick={onRefresh} disabled={busy || loading}>
          {t("Refresh accounts")}
        </button>
      </div>
      <div className="admin-account-tabs" role="group" aria-label={t("Account role")}>
        {([
          ["ALL", "All"], ["PARENT", "Parents"], ["TEACHER", "Teachers"],
          ["STUDENT", "Students"], ["STAFF", "Admin & staff"]
        ] as Array<[AccountGroup, string]>).map(([value, text]) => (
          <button key={value} type="button" className={group === value
            ? "admin-account-tab admin-account-tab-active" : "admin-account-tab"}
            onClick={() => onGroup(value)} aria-pressed={group === value}>
            <span>{t(text)}</span><strong>{groupCounts[value]}</strong>
          </button>
        ))}
      </div>

      <div className="admin-account-filters account-directory-filters">
        <input aria-label={t("Search accounts")} type="search" value={query}
          onChange={(event) => onQuery(event.target.value)} maxLength={120}
          placeholder={t("Search name, username, phone, code, role, or status")} />
        <select aria-label={t("Filter by status")} value={status}
          onChange={(event) => onStatus(event.target.value as "ALL" | User["status"])}>
          <option value="ALL">{t("All statuses")}</option>
          <option value="ACTIVE">{t("Active")}</option>
          <option value="INVITED">{t("Invited")}</option>
          <option value="SUSPENDED">{t("Suspended")}</option>
          <option value="ARCHIVED">{t("Archived")}</option>
        </select>
        <select aria-label={t("Sort accounts by")} value={sortBy}
          onChange={(event) => onSortBy(event.target.value as AccountSort)}>
          <option value="username">{t("Username")}</option>
          <option value="name">{t("Name")}</option>
          <option value="role">{t("Role")}</option>
          <option value="status">{t("Status")}</option>
          <option value="createdAt">{t("Created on")}</option>
          <option value="lastLoginAt">{t("Last login")}</option>
        </select>
        <select aria-label={t("Sort direction")} value={order}
          onChange={(event) => onOrder(event.target.value as AccountOrder)}>
          <option value="asc">{t("Ascending")}</option>
          <option value="desc">{t("Descending")}</option>
        </select>
        {query || group !== "ALL" || status !== "ALL" || highlight !== "ALL" ? (
          <button type="button" className="admin-secondary" onClick={onClear}>{t("Clear filters")}</button>
        ) : null}
      </div>

      {selectedIds.size > 0 ? (
        <div className="account-directory-bulk-toolbar" role="region" aria-label={t("Bulk account actions")}>
          <strong>{adminFormat(locale, "{count} selected on this page", { count: selectedIds.size })}</strong>
          <button className="admin-secondary" type="button" disabled={busy || loading || credentialOpen || !canSuspend}
            onClick={() => onBulk("suspend")}>{t("Suspend selected")}</button>
          <button className="admin-secondary" type="button" disabled={busy || loading || credentialOpen || !canReactivate}
            onClick={() => onBulk("reactivate")}>{t("Reactivate selected")}</button>
          <button className="admin-secondary" type="button" onClick={() => onSelectPage([...selectedIds], false)}>
            {t("Clear selection")}
          </button>
          <span>{t("Bulk changes exclude school administrators and archived accounts.")} {t("Bulk actions are limited to 20 accounts.")}</span>
        </div>
      ) : null}

      <div className="account-directory-select-row">
        <label>
          <input
            type="checkbox" checked={pageSelected}
            aria-label={t("Select all eligible accounts on this page")}
            ref={(node) => { if (node) node.indeterminate = partial; }}
            disabled={busy || loading || eligiblePage.length === 0 || credentialOpen}
            onChange={(event) => onSelectPage(eligiblePage.map((user) => user.id), event.target.checked)}
          />
          <span>{t("Select current page")}</span>
        </label>
        <span>{t("Selection is limited to the current page.")}</span>
      </div>

      {error ? (
        <div className="admin-error" role="alert">{error}{" "}
          <button type="button" className="admin-secondary" onClick={onRefresh}>{t("Retry")}</button>
        </div>
      ) : null}
      {loading ? <p className="admin-copy" role="status">{t("Loading…")}</p> : null}

      <div className="admin-user-list admin-user-list-premium" aria-busy={loading}>
        {!loading && !error && users.map((user) => {
          const self = user.id === currentAdminId;
          const canSelect = eligible(user, currentAdminId);
          return (
            <div className="admin-user-row admin-user-row-premium" key={user.id}>
              <label className="account-directory-check">
                <input type="checkbox" checked={selectedIds.has(user.id)}
                  disabled={!canSelect || busy || credentialOpen}
                  aria-label={adminFormat(locale, "Select {username}", { username: user.username })}
                  onChange={(event) => onSelect(user.id, event.target.checked)} />
              </label>
              <div className="admin-user-identity">
                <span className={`admin-user-avatar admin-user-avatar-${user.role.toLowerCase()}`} aria-hidden="true">
                  {label(user).slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{label(user)}</strong>
                  <span><bdi dir="ltr">@{user.username}</bdi> · {t(roleLabel(user.role))}</span>
                  {(user.profile?.code || user.profile?.phone) ?
                    <span>{[user.profile?.code, user.profile?.phone].filter(Boolean).join(" · ")}</span> : null}
                </div>
              </div>
              <div className="admin-user-meta">
                <span className={`admin-status-badge admin-status-${user.status.toLowerCase()}`}>
                  {t(statusLabel(user.status))}
                </span>
                {user.mustChangePassword ? <span className="admin-password-badge">{t("Password change required")}</span> : null}
                {self ? <span className="admin-current-account-badge">{t("Current administrator")}</span> : null}
              </div>
              <div className="admin-actions">
                <button type="button" className="admin-account-view-details" disabled={busy}
                  onClick={() => onDetails(user)}>{t("View details")}</button>
                <button type="button" disabled={busy || user.status === "ARCHIVED" || self || credentialOpen}
                  onClick={() => onAction(user, "reset-password")}>{t("Reset password")}</button>
                {user.status === "SUSPENDED"
                  ? <button type="button" disabled={busy || credentialOpen} onClick={() => onAction(user, "reactivate")}>
                      {t("Reactivate")}
                    </button>
                  : <button type="button" disabled={busy || user.status === "ARCHIVED" || self || credentialOpen}
                      onClick={() => onAction(user, "suspend")}>{t("Suspend")}</button>}
              </div>
            </div>
          );
        })}
        {!loading && !error && users.length === 0 ? (
          <div className="admin-empty-state" role="status">
            <strong>{t("No matching accounts")}</strong>
            <span>{t("Try another account group, status, name, username, phone number, or code.")}</span>
          </div>
        ) : null}
      </div>

      <div className="account-directory-pagination">
        <label>{t("Accounts per page")}
          <select value={pageSize} aria-label={t("Accounts per page")}
            onChange={(event) => onPageSize(Number(event.target.value))} disabled={busy || loading}>
            {[10, 20, 50].map((size) => <option value={size} key={size}>{size}</option>)}
          </select>
        </label>
        <div role="group" aria-label={t("Account pagination")}>
          <button type="button" className="admin-secondary" disabled={loading || busy || page <= 1}
            onClick={() => onPage(page - 1)}>{t("Previous")}</button>
          <span>{adminFormat(locale, "Page {page} of {pages}", { page: result.page, pages: result.pages })}</span>
          <button type="button" className="admin-secondary" disabled={loading || busy || page >= result.pages}
            onClick={() => onPage(page + 1)}>{t("Next")}</button>
        </div>
      </div>
    </article>
  );
}
