"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PilotReadinessPanel, isPilotSection } from "../../../pilot-readiness-panel";
import { useAdminWorkspace } from "../../../admin-workspace";

export default function PilotSectionPage() {
  const { stored } = useAdminWorkspace();
  const params = useParams<{ section: string }>();
  const section = String(params.section ?? "");
  if (!isPilotSection(section) || section === "overview") {
    return <section className="admin-panel">
      <p>Unknown pilot operations section.</p>
      <Link href="/admin/pilot" className="admin-secondary">Back to Pilot Operations</Link>
    </section>;
  }
  return <PilotReadinessPanel accessToken={stored.session.accessToken} section={section} />;
}
