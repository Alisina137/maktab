"use client";

import { AcademicPanel } from "../../academic-panel";
import { useAdminWorkspace } from "../../admin-workspace";

export default function DashboardPage() {
  const { stored } = useAdminWorkspace();
  return <AcademicPanel accessToken={stored.session.accessToken} />;
}
