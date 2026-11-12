"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAdminWorkspace } from "../admin-workspace";

/** Generic, localized recovery for errors inside a school-admin route.
 * Never display raw exceptions or server response bodies to school users. */
export default function AdminWorkspaceError({
  error, reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useAdminWorkspace();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("MaktabLink admin route render failed", error);
    }
  }, [error]);

  return (
    <section className="admin-panel ml-admin-route-error" role="alert"
      aria-labelledby="ml-admin-route-error-heading">
      <span className="ml-admin-route-error-mark" aria-hidden="true">!</span>
      <div>
        <h2 id="ml-admin-route-error-heading">{t("We could not load this page.")}</h2>
        <p>{t("Your changes were not confirmed. Retry or return to the dashboard.")}</p>
        <div className="ml-admin-route-error-actions">
          <button className="admin-primary" type="button" onClick={reset}>
            {t("Try again")}
          </button>
          <Link className="admin-secondary" href="/admin/dashboard">
            {t("Return to dashboard")}
          </Link>
        </div>
      </div>
    </section>
  );
}
