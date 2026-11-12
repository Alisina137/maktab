import "../dashboard-shell.css";
import { Suspense } from "react";
import "../academic-overview.css";
import "../admin-typography.css";
import { AdminWorkspaceShell } from "../admin-workspace";

export default function AdminWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}><AdminWorkspaceShell>{children}</AdminWorkspaceShell></Suspense>;
}
