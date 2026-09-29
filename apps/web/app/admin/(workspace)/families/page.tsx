"use client";

import { FamilyPanel } from "../../family-panel";
import { useAdminWorkspace } from "../../admin-workspace";

export default function FamiliesPage() {
  const { stored } = useAdminWorkspace();
  return <FamilyPanel accessToken={stored.session.accessToken} />;
}
