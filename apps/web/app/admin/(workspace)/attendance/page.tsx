"use client";

import { AttendancePanel } from "../../attendance-panel";
import { useAdminWorkspace } from "../../admin-workspace";

export default function AttendancePage() {
  const { stored } = useAdminWorkspace();
  return <AttendancePanel accessToken={stored.session.accessToken} />;
}
