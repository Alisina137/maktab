import { academicSectionIconPaths } from "./academic-section-icons";

/** Route-based tab icon registry shared by the admin sidebar and section navigation.
 * Keep the Academics icon set as the single source of truth for academic routes.
 * Keys with ?tab= are intentionally exact to match sidebar URLs. */
const glyphs = {
  grid: "M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z",
  directory: "M3 5h18v14H3zM7 9h4M7 13h3M14 10h4M14 14h4",
  add: "M12 5v14M5 12h14M4 3h16v18H4z",
  family: "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-2a7 7 0 0 1 14 0v2H2zM17 8h5M19.5 5.5v5",
  student: "M12 3 2 8l10 5 10-5-10-5zM5 12v5c4 3 10 3 14 0v-5M22 8v6",
  import: "M12 3v12M7 10l5 5 5-5M4 16v5h16v-5",
  tasks: "M4 4h16v16H4zM8 9h8M8 13h5M8 17h7",
  drafts: "M3 5h18v14H3zM5 8l7 6 7-6M15 15h4",
  calendar: "M8 3v3M16 3v3M4 9h16M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2zM8 14h3M8 17h7",
  students: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-2a8 8 0 0 1 16 0v2H4z",
  followups: "M4 5h16v14H4zM8 9h8M8 13h4M15 17l2 2 4-5",
  chart: "M4 20V10M9 20V5M14 20v-9M19 20v-6M2 20h20",
  audit: "M5 3h14v18H5zM8 8h8M8 12h8M8 16h4M15 17l2 2 4-4",
  requests: "M5 3h14v18H5zM8 8h8M8 12h6M8 16h4M16 16h5M18.5 13.5v5",
  book: "M4 19.5C4 18 5 17 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2zM9 7h7",
  homework: "M7 3h10l4 4v14H3V3h4zM13 3v5h8M7 13l2 2 4-5",
  exams: "M5 3h14v18H5zM8 8h8M8 12h8M8 16h4M14 17l2 2 4-4",
  results: "M4 19h16M5 16l4-5 4 3 6-8M16 6h3v3",
  teaching: "M3 5l9-3 9 3v14l-9 3-9-3V5zM12 2v20M7 9h2M15 9h2",
  messages: "M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4 8.5 8.5 0 0 1 8.5-8.5c4.7 0 8.5 3.8 8.5 8.5zM8 10.5h8",
  payment: "M4 6h16v14H4zM4 10h16M8 15h4M15 15h2",
  shield: "M12 2l8 4v6c0 4.7-3 8-8 10-5-2-8-5.3-8-10V6l8-4zM8 12l3 3 5-6",
  adoption: "M3 16l6-6 4 4 7-8M16 6h4v4M3 21h18",
  health: "M3 12h4l3-7 4 14 3-7h4M3 4h18v16H3z",
  time: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l4 2",
  launch: "M9.5 15.5 8 22l-4-4 6.5-1.5M14.5 9.5 21 8l-4-4-1.5 6.5M12 16l-4-4 4.5-6.5C15 2.5 18 2 22 2c0 4-.5 7-3.5 9.5L12 16",
  invoice: "M7 3h10l3 3v15H4V3h3zM8 10h8M8 14h8M8 18h5"
} as const;

const otherSectionIcons: Record<string, keyof typeof glyphs> = {
  "/admin/accounts": "directory",
  "/admin/accounts?tab=create": "add",
  "/admin/families": "students",
  "/admin/families?tab=parent-account": "family",
  "/admin/families?tab=student-account": "student",
  "/admin/families?tab=bulk-import": "import",
  "/admin/staff-work": "tasks",
  "/admin/staff-work?tab=drafts": "drafts",
  "/admin/attendance": "grid",
  "/admin/attendance?tab=registers": "calendar",
  "/admin/attendance?tab=students": "students",
  "/admin/attendance?tab=followups": "followups",
  "/admin/attendance?tab=reports": "chart",
  "/admin/attendance?tab=audit": "audit",
  "/admin/attendance?tab=staff_requests": "requests",
  "/admin/learning": "book",
  "/admin/learning?tab=homework": "homework",
  "/admin/learning?tab=exams": "exams",
  "/admin/learning?tab=results": "results",
  "/admin/learning?tab=teaching": "teaching",
  "/admin/learning?tab=reports": "chart",
  "/admin/communication": "grid",
  "/admin/communication?tab=communication": "messages",
  "/admin/communication?tab=fees": "payment",
  "/admin/pilot": "grid",
  "/admin/pilot/readiness": "shield",
  "/admin/pilot/onboarding": "import",
  "/admin/pilot/adoption": "adoption",
  "/admin/pilot/service": "health",
  "/admin/pilot/oversight": "time",
  "/admin/pilot/subscription": "payment",
  "/admin/pilot/audit": "audit",
  "/admin/pilot/launch": "launch",
  "/admin/communication#invoices": "invoice",
  "/admin/communication#payments": "payment",
  "/admin/communication#balances": "directory",
  "/admin/communication#reports": "chart"
};

export const adminSubnavIconPaths: Readonly<Record<string, string>> = {
  ...academicSectionIconPaths,
  ...Object.fromEntries(Object.entries(otherSectionIcons).map(([href, name]) => [href, glyphs[name]]))
};

export function AdminSubnavIcon({ href, size = 16 }: { href: string; size?: number }) {
  const d = adminSubnavIconPaths[href];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}
