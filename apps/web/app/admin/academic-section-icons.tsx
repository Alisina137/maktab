import type { ReactElement } from "react";

/** Shared icons for all Academics submenu links and overview quick tabs. */
export const academicSectionIconPaths: Record<string, string> = {
  "/admin/academics": "M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z",
  "/admin/academics/years": "M7 3v4M17 3v4M4 9h16M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 14h3M8 17h6",
  "/admin/academics/grades": "M12 3 2 8l10 5 10-5-10-5zM2 12l10 5 10-5M2 16l10 5 10-5",
  "/admin/academics/classes": "M4 3h16v13H4zM2 20h20M8 20v-4M16 20v-4M7 7h10M7 11h6",
  "/admin/academics/subjects": "M4 19.5C4 18 5 17 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2zM9 7h7M9 11h5",
  "/admin/academics/teachers": "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-2a7 7 0 0 1 14 0v2H2zM17 4h5v9h-5zM18.5 7h2M18.5 10h2",
  "/admin/academics/assignments": "M9 4h6M10 2h4a2 2 0 0 1 2 2h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2-2zM8 13l3 3 5-6",
  "/admin/academics/negaran": "M12 2l8 4v6c0 4.7-3 8-8 10-5-2-8-5.3-8-10V6l8-4zM8 12l3 3 5-6",
  "/admin/academics/timetable": "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM12 13v4l3 1",
  "/admin/academics/curriculum": "M12 6c-2.5-2-6-2-9-1v14c3-1 6.5-1 9 1 2.5-2 6-2 9-1V5c-3-1-6.5-1-9 1zM12 6v14"
};

export function AcademicSectionIcon({ href, size = 18 }: {
  href: string;
  size?: number;
}): ReactElement | null {
  const d = academicSectionIconPaths[href];
  if (!d) return null;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false"><path d={d} /></svg>;
}
