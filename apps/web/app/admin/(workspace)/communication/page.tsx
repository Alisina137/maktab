"use client";

import { CommunicationPanel } from "../../communication-panel";
import { useAdminWorkspace } from "../../admin-workspace";

export default function CommunicationPage() {
  const { stored } = useAdminWorkspace();
  return <CommunicationPanel accessToken={stored.session.accessToken} />;
}
