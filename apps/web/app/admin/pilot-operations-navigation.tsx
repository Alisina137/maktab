// Canonical Pilot Operations route registry for sidebar, deep links and section headings.
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
export const PILOT_SECTION_DESCRIPTIONS: Record<PilotSection, string> = {
  overview: "Current school signals and safe next checks before launch.",
  readiness: "Review setup checks and outstanding school configuration gaps.",
  onboarding: "Validate imports, prepare accounts and review school-only import history.",
  adoption: "Compare eligible accounts with recorded recent sign-ins.",
  service: "Review recorded notification, support and import issues.",
  oversight: "Inspect a privacy-safe timeline of school operations.",
  subscription: "Review subscription access and renewal details.",
  audit: "Review administrative activity and school-scoped exports.",
  launch: "Manage support tickets, launch evidence and independent release checks."
};
export const PILOT_GROUP_LABELS: Record<(typeof PILOT_TABS)[number]["group"], string> = {
  START: "Get started",
  MONITOR: "Monitor",
  MANAGE: "Manage"
};
