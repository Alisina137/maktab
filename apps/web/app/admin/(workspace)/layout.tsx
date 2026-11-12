import "../dashboard-shell.css";
import { Suspense } from "react";
import "../academic-overview.css";
import "../admin-typography.css";
import "../admin-phase4-polish.css";
import { AdminLoader } from "../admin-loader";
import { AdminWorkspaceShell } from "../admin-workspace";

export default function AdminWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <main className="admin-shell admin-shell-premium admin-route-loading">
        <section className="admin-panel admin-route-loading-panel">
          <AdminLoader label="Loading school workspace…" />
        </section>
      </main>
    }>
      <AdminWorkspaceShell>{children}</AdminWorkspaceShell>
    </Suspense>
  );
}
