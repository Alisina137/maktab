"use client";

import { PilotReadinessPanel } from "../../pilot-readiness-panel";
import { useAdminWorkspace } from "../../admin-workspace";

export default function PilotPage() {
  const { stored } = useAdminWorkspace();
  return <PilotReadinessPanel accessToken={stored.session.accessToken} />;
}
