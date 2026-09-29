"use client";

import { LearningPanel } from "../../learning-panel";
import { useAdminWorkspace } from "../../admin-workspace";

export default function LearningPage() {
  const { stored } = useAdminWorkspace();
  return <LearningPanel accessToken={stored.session.accessToken} />;
}
