"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminWorkspace } from "./admin-workspace";
import { adminSidebarSections } from "./admin-sidebar-sections";
import { AcademicSectionIcon } from "./academic-section-icons";

/**
 * Academics shares one route-backed navigation bar for every screen.
 * It is mounted by the Academics nested layout, so it remains visible
 * while switching to any academic module and preserves its selected state.
 */
export function AcademicSectionNavigation() {
  const pathname = usePathname();
  const { t } = useAdminWorkspace();
  const items = adminSidebarSections["/admin/academics"] ?? [];

  return (
    <nav className="ml-academic-tabbar" aria-label={t("Academic sections")}>
      {items.map((item) => {
        const selected = pathname === item.href;
        return (
          <Link key={item.href} href={item.href}
            className={"ml-academic-tab" + (selected ? " ml-academic-tab-active" : "")}
            aria-current={selected ? "page" : undefined}
          >
            <AcademicSectionIcon href={item.href} size={16} />
            <span>{t(item.label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
