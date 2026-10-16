"use client";
import { adminApi, type Session, type School } from "../admin/admin-client";

export type StaffSession={ session:Session; school:School };
const KEY="maktablink.staff.session.v1";
export const staffApi=adminApi;

export function storeStaffSession(value: StaffSession): void {
  if(value.session.user.role!=="SCHOOL_STAFF" ||
      value.session.user.status==="ARCHIVED" || value.session.user.status==="SUSPENDED" ||
      value.session.mustChangePassword)
    throw new Error("A verified staff account is required.");
  if(typeof window!=="undefined") window.sessionStorage.setItem(KEY,JSON.stringify(value));
}
export function readStaffSession(): StaffSession|null {
  if(typeof window==="undefined")return null;
  const raw=window.sessionStorage.getItem(KEY);
  if(!raw)return null;
  try {
    const value=JSON.parse(raw) as StaffSession;
    if(!value || value.session?.user?.role!=="SCHOOL_STAFF" ||
      value.session.user.status!=="ACTIVE" || value.session.mustChangePassword ||
      !value.session.accessToken || !value.session.refreshToken ||
      !value.school?.id) throw Error("Invalid staff session.");
    return value;
  } catch {
    window.sessionStorage.removeItem(KEY);
    return null;
  }
}
export function clearStaffSession(){
  if(typeof window!=="undefined") window.sessionStorage.removeItem(KEY);
}
