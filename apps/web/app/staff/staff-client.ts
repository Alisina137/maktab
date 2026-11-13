"use client";
import { adminApi, type Session, type School } from "../admin/admin-client";
import { validStoredStaffSession } from "./staff-session-policy";

export type StaffSession={ session:Session; school:School };
const KEY="maktablink.staff.session.v1";
export const staffApi=adminApi;

export function storeStaffSession(value: StaffSession): void {
  if(!validStoredStaffSession(value))
    throw new Error("A verified, active Staff account belonging to this school is required.");
  if(typeof window!=="undefined") window.sessionStorage.setItem(KEY,JSON.stringify(value));
}
export function readStaffSession(): StaffSession|null {
  if(typeof window==="undefined")return null;
  const raw=window.sessionStorage.getItem(KEY);
  if(!raw)return null;
  try {
    const value:unknown=JSON.parse(raw);
    if(!validStoredStaffSession(value)) throw Error("Invalid staff session.");
    return value;
  } catch {
    window.sessionStorage.removeItem(KEY);
    return null;
  }
}
export function clearStaffSession(){
  if(typeof window!=="undefined") window.sessionStorage.removeItem(KEY);
}
