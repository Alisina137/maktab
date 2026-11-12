"use client";

import { AdminLoader } from "../admin-loader";
import { useAdminWorkspace } from "../admin-workspace";

/** Preserve an accessible feedback surface on route navigation and streaming. */
export default function AdminRouteLoading() {
  const { t } = useAdminWorkspace();
  return (
    <section className="admin-panel ml-admin-route-loading-card">
      <AdminLoader label={t("Loading page…")} />
    </section>
  );
}
