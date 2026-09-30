"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AcademicPanel, isAcademicSection } from "../../../academic-panel";
import { useAdminWorkspace } from "../../../admin-workspace";

export default function AcademicSectionPage() {
  const { stored } = useAdminWorkspace();
  const params = useParams<{ section: string }>();
  const section = String(params.section ?? "");

  if (!isAcademicSection(section)) {
    return (
      <section className="admin-panel">
        <p>Unknown academic module.</p>
        <Link className="admin-secondary" href="/admin/academics">Back to Academics</Link>
      </section>
    );
  }

  return <AcademicPanel accessToken={stored.session.accessToken} section={section} />;
}
