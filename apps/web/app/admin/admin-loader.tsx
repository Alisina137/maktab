"use client";

export function AdminLoader({
  label = "Loading…",
  compact = false
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={compact ? "admin-loader admin-loader-compact" : "admin-loader"}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="admin-loader-mark" aria-hidden="true">
        <span className="admin-loader-ring admin-loader-ring-one" />
        <span className="admin-loader-ring admin-loader-ring-two" />
        <span className="admin-loader-core">M</span>
      </div>
      <div className="admin-loader-copy">
        <strong>{label}</strong>
        {!compact ? (
          <div className="admin-loader-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AdminSkeleton({
  rows = 4
}: {
  rows?: number;
}) {
  return (
    <div className="admin-skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="admin-skeleton-row" key={index}>
          <span className="admin-skeleton-avatar" />
          <span className="admin-skeleton-lines">
            <span />
            <span />
          </span>
        </div>
      ))}
    </div>
  );
}
