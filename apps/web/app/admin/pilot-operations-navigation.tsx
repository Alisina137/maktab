"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminText, type AdminLocale } from "./admin-i18n";

// Single source of truth for routes, headings and the mobile switcher.
// Keep legacy direct URLs intact for bookmarks and links from other dashboards.
export const PILOT_TABS = [
  { section: "overview", label: "Overview", href: "/admin/pilot", group: "START" },
  { section: "readiness", label: "School readiness", href: "/admin/pilot/readiness", group: "START" },
  { section: "onboarding", label: "Data onboarding", href: "/admin/pilot/onboarding", group: "START" },
  { section: "adoption", label: "Usage & adoption", href: "/admin/pilot/adoption", group: "MONITOR" },
  { section: "service", label: "Service health", href: "/admin/pilot/service", group: "MONITOR" },
  { section: "oversight", label: "Operations oversight", href: "/admin/pilot/oversight", group: "MONITOR" },
  { section: "subscription", label: "Subscription", href: "/admin/pilot/subscription", group: "MANAGE" },
  { section: "audit", label: "Audit & exports", href: "/admin/pilot/audit", group: "MANAGE" },
  { section: "launch", label: "Launch & support", href: "/admin/pilot/launch", group: "MANAGE" }
] as const;
export type PilotSection = (typeof PILOT_TABS)[number]["section"];
export function isPilotSection(value: string): value is PilotSection {
  return PILOT_TABS.some((tab) => tab.section === value);
}
const groups = [
  { id: "START", label: "Get started" },
  { id: "MONITOR", label: "Monitor" },
  { id: "MANAGE", label: "Manage" }
] as const;

export function PilotOperationsNavigation({ section, locale }: {
  section: PilotSection; locale: AdminLocale;
}) {
  const router = useRouter();
  const navRef = useRef<HTMLElement | null>(null);
  const t = (text: string) => adminText(locale, text);

  // Scroll only the horizontal navigation container, not the whole page.
  // A new route must reveal its active tab without shifting vertical scroll.
  useEffect(() => {
    const nav = navRef.current;
    const selected = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !selected) return;
    const area = nav.getBoundingClientRect();
    const item = selected.getBoundingClientRect();
    if (item.left < area.left + 8) {
      nav.scrollBy({ left: item.left - area.left - 12, behavior: "auto" });
    } else if (item.right > area.right - 8) {
      nav.scrollBy({ left: item.right - area.right + 12, behavior: "auto" });
    }
  }, [section, locale]);

  return (
    <div className="pilot-nav-layout">
      <label className="pilot-nav-mobile" htmlFor="pilot-section-switcher">
        <span>{t("Pilot operations section")}</span>
        <select id="pilot-section-switcher" value={section}
          onChange={(event) => {
            const selected = PILOT_TABS.find((tab) => tab.section === event.target.value);
            if (selected) router.push(selected.href);
          }}>
          {groups.map((group) => (
            <optgroup key={group.id} label={t(group.label)}>
              {PILOT_TABS.filter((tab) => tab.group === group.id).map((tab) => (
                <option key={tab.section} value={tab.section}>{t(tab.label)}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <nav className="pilot-section-nav pilot-nav-desktop"
        aria-label={t("Pilot operations sections")} ref={navRef}>
        {groups.map((group) => (
          <div key={group.id} className="pilot-nav-group"
            role="group" aria-label={t(group.label)}>
            <span className="pilot-nav-group-heading" aria-hidden="true">{t(group.label)}</span>
            <div className="pilot-nav-group-links">
              {PILOT_TABS.filter((tab) => tab.group === group.id).map((tab) => (
                <Link key={tab.section} href={tab.href}
                  aria-current={section === tab.section ? "page" : undefined}
                  className={section === tab.section ?
                    "pilot-section-link pilot-section-link-active" : "pilot-section-link"}>
                  {t(tab.label)}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
