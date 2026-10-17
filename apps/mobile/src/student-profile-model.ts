import type {SchoolOption,SessionPayload} from "./api";
import {sameSessionEpoch} from "./parent-session-guard";

/** Sensitive student settings are restricted to an active enrolled account. */
export function studentPasswordChangeAllowed(
  session:SessionPayload|null, school:SchoolOption|null,
  screen:string, enrollmentUnavailable:boolean
):boolean {
  return !!session&&!!school&&screen==="student-more"&&
    session.user.role==="STUDENT"&&session.user.status==="ACTIVE"&&
    !session.mustChangePassword&&!enrollmentUnavailable&&
    session.user.schoolId===school.id;
}

/** Guard against a late password response after logout, role switch or refresh. */
export function studentPasswordResultBelongsToSession(
  current:SessionPayload|null, started:SessionPayload,
  currentSchool:SchoolOption|null, startedSchool:SchoolOption,
  returned:SessionPayload
):boolean {
  return sameSessionEpoch(current,started,currentSchool,startedSchool)&&
    returned.user.id===started.user.id&&
    returned.user.schoolId===started.user.schoolId&&
    returned.user.role==="STUDENT"&&returned.user.status==="ACTIVE"&&
    !returned.mustChangePassword;
}
