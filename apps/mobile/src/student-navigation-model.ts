import type { StudentTab } from "./student-navigation";

/** Student primary destinations are always five stable tabs. Child pages (such
 * as announcements/notifications) are deliberately excluded from the tab bar. */
export type StudentPrimaryScreen =
  | "home" | "student-timetable" | "student-homework"
  | "student-results" | "student-more";

const destinations: Record<StudentTab, StudentPrimaryScreen> = {
  HOME:"home", TIMETABLE:"student-timetable",
  HOMEWORK:"student-homework", RESULTS:"student-results", MORE:"student-more"
};

export const studentTabOrder:readonly StudentTab[] =
  ["HOME","TIMETABLE","HOMEWORK","RESULTS","MORE"];

export function studentDestination(tab:StudentTab):StudentPrimaryScreen {
  return destinations[tab];
}
export function studentTabForScreen(screen:string):StudentTab|null {
  return studentTabOrder.find(tab=>destinations[tab]===screen)??null;
}
export function studentIsPrimaryScreen(screen:string):screen is StudentPrimaryScreen {
  return studentTabForScreen(screen)!==null;
}
/** A notification opened from a primary tab must return to that same tab.
 * Unknown or non-student screens fall back to Home rather than leaking navigation. */
export function studentReturnScreen(screen:string):StudentPrimaryScreen {
  return studentIsPrimaryScreen(screen)?screen:"home";
}
