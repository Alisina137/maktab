import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AttendanceStatus } from "@maktablink/contracts";
import type { FoundationDatabase } from "./client.js";
import { notifications, type DailyAttendance, type Student } from "./schema.js";

type AttendanceTransaction = Parameters<Parameters<FoundationDatabase["transaction"]>[0]>[0];

/** Keep correction alerts aligned with the same parent notification lifecycle as admin corrections. */
export async function syncStaffCorrectionAlert(
  tx:AttendanceTransaction,schoolId:string,attendance:DailyAttendance,
  student:Student,status:AttendanceStatus
):Promise<void>{
  const dedupKey=`attendance:${attendance.id}:${student.id}`;
  const [existing]=await tx.select().from(notifications)
    .where(and(eq(notifications.schoolId,schoolId),eq(notifications.dedupKey,dedupKey)))
    .limit(1);
  if(status!=="ABSENT" && status!=="LATE"){
    if(existing && existing.deliveryStatus!=="CANCELLED"){
      await tx.update(notifications).set({deliveryStatus:"CANCELLED",updatedAt:new Date()})
        .where(and(eq(notifications.schoolId,schoolId),eq(notifications.id,existing.id)));
    }
    return;
  }
  const type=status==="ABSENT"?"ATTENDANCE_ABSENT":"ATTENDANCE_LATE";
  if(existing && existing.type===type && existing.deliveryStatus!=="CANCELLED")return;
  const values={
    type,
    title:status==="ABSENT"?"Student absent":"Student late",
    message:`${student.fullName} was marked ${status==="ABSENT"?"absent":"late"} on ${attendance.date}.`,
    deepLink:`/parent/children/${student.id}/attendance`,
    metadata:{studentId:student.id,date:attendance.date,status},
    deliveryStatus:"PENDING" as const,
    readAt:null,
    updatedAt:new Date()
  };
  if(existing)await tx.update(notifications).set(values)
    .where(and(eq(notifications.schoolId,schoolId),eq(notifications.id,existing.id)));
  else await tx.insert(notifications).values({
    id:randomUUID(),schoolId,userId:student.parentUserId,dedupKey,...values
  });
}
