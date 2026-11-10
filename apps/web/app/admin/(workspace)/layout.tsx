import "../dashboard-shell.css";
import "../academic-overview.css";
import { AdminWorkspaceShell } from "../admin-workspace";

export default function AdminWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AdminWorkspaceShell>{children}</AdminWorkspaceShell>;
}
