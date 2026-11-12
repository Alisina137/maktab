import type { ReactNode } from "react";
import { AcademicSectionNavigation } from "../../academic-section-navigation";

/** Persistent for /admin/academics and every /admin/academics/[section] page. */
export default function AcademicsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ml-academic-workspace">
      <AcademicSectionNavigation />
      {children}
    </div>
  );
}
