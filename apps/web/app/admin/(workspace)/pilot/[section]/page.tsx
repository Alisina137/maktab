"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PilotReadinessPanel, isPilotSection } from "../../../pilot-readiness-panel";
import { useAdminWorkspace } from "../../../admin-workspace";
import { adminText } from "../../../admin-i18n";

export default function PilotSectionPage() {
  const { stored, locale } = useAdminWorkspace();
  const params = useParams<{ section: string }>();
  const section = String(params.section ?? "");
  if (!isPilotSection(section) || section === "overview") {
    return <section className="admin-panel">
      <p>{adminText(locale, "Unknown pilot operations section.")}</p>
      <Link href="/admin/pilot" className="admin-secondary">{adminText(locale, "Back to Pilot Operations")}</Link>
    </section>;
  }
  return <PilotReadinessPanel accessToken={stored.session.accessToken} section={section} />;
}
