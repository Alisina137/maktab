import type { AdminAcademicReport, AdminLearningAudit } from "@maktablink/database";
import { csvCell } from "../communication/fee-report-csv.js";

function line(values: Array<string | number | null | undefined>): string {
  return values.map(csvCell).join(",");
}
export function academicReportCsv(report: AdminAcademicReport): string {
  const records = [
    line(["class","subject","teacher","exam_subjects","published_exam_subjects",
      "published_grades","published_homework","submissions_awaiting_review",
      "curriculum_chapters","completed_chapters","completed_lessons"]),
    ...report.rows.map(item => line([
      item.className,item.subjectName,item.teacherName,
      item.examSubjects,item.publishedExamSubjects,item.publishedGrades,
      item.publishedHomework,item.submissionsAwaitingReview,
      item.curriculumUnits,item.completedUnits,item.completedLessons
    ]))
  ];
  return "\uFEFF"+records.join("\r\n")+"\r\n";
}
export function learningAuditCsv(audit: AdminLearningAudit): string {
  const records = [
    line(["event_id","timestamp_utc","action","entity_type","actor_username"]),
    ...audit.rows.map(item => line([
      item.id,new Date(item.createdAt).toISOString(),item.action,item.entityType,item.actorUsername
    ]))
  ];
  return "\uFEFF"+records.join("\r\n")+"\r\n";
}
