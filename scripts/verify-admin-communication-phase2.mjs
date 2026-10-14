import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");
const web = read("apps/web/app/admin/communication-panel.tsx");
const model = read("apps/web/app/admin/communication-announcements-model.ts");
const datePicker = read("apps/web/app/admin/admin-hijri-date-picker.tsx");
const routes = read("apps/api/src/communication/routes.ts");
const store = read("packages/database/src/communication-store.ts");
const tests = read("apps/api/src/app.test.ts");
const css = read("apps/web/app/globals.css");
const locale = read("apps/web/app/admin/admin-i18n.ts");
const roadmap = read("docs/ADMIN-COMMUNICATION-FEES-PHASES.md");
const state = read("docs/PROJECT-STATE.md");

for (const marker of [
  'announcementStatusFilter', 'announcementAudienceFilter',
  'announcementClassFilter', 'announcementSearch', 'findAnnouncements(',
  'pageAnnouncements(', 'setAnnouncementLimit(value=>value+ANNOUNCEMENT_PAGE_SIZE)',
  'announcementPage.rows.map', 'expandedAnnouncementId', 'role="status"',
  'aria-expanded={open}', 'role="tabpanel"',
  'classLabel(item.classId)', 'announcementStatus(item, announcementClock)',
  'formatAdminHijriDateTime(locale, instant, schoolTimezone)',
  'recipientGeneration.current', 'recipientStatus === "ready"',
  'setInterval(() => setAnnouncementClock(Date.now()), 60_000)',
  '"/v1/admin/announcements/recipients/preview"',
  'setRecipientCount(result.recipientCount)', 'setSchoolTimezone(result.schoolTimezone)',
  'scope !== "SCHOOL" && targetRole',
  'schoolLocalTimeToIso(scheduledLocal, schoolTimezone!)',
  'publishMode === "SCHEDULE"', 'setPublishMode("NOW")',
  'Archive this announcement? It will disappear',
  'schoolLocalTimeToIso(', 'schoolTimezone!', 'showAnnouncement(item.id)'
]) assert.ok(web.includes(marker), "Phase 2 announce UI/preview/security guard missing: "+marker);

for (const marker of [
  'AnnouncementStatusFilter', 'AnnouncementAudienceFilter', 'filter',
  'item.classId === filters.classId', 'item.title,item.content',
  'ANNOUNCEMENT_PAGE_SIZE', 'schoolLocalTimeToIso(', 'schoolInstantToLocal(',
  'formatToParts(', 'timeZone:zone',
  'This local time does not exist'
]) assert.ok(model.includes(marker), "Phase 2 filter/paging/school clock guard missing: "+marker);

for (const marker of [
  '"/v1/admin/announcements/recipients/preview"',
  'requireSchoolAdmin(request, reply, accounts)',
  'createAnnouncementSchema.parse({',
  'communication.previewAnnouncementAudience(context.user.schoolId, input)'
]) assert.ok(routes.includes(marker), "Server preview must authorize and validate school role: "+marker);

for (const marker of [
  'previewAnnouncementAudience(schoolId, input)', 'announcementRecipients(announcement, now)',
  'eq(classSections.schoolId, schoolId)', 'new Set(ids).size',
  'schoolSettings.timezone', 'const schoolTimezone = settings?.timezone ?? "Asia/Kabul"'
]) assert.ok(store.includes(marker), "Store preview must reuse tenant audience logic: "+marker);
assert.ok(!web.includes('new Date(value).toISOString()') &&
  !web.includes('datetimeLocalToIso('), "Admin scheduling must never use browser timezone");
assert.ok(datePicker.includes('timeZone?: string') && datePicker.includes('...(timeZone ? {timeZone} : {})'),
  "Localized announcement display must support real school timezone");
for(const marker of [
  'recipientCount:number', 'classId:classA', 'classId:classB',
  'audienceRole:"PARENT"', 'audienceRole:"STUDENT"',
  'statusCode,403', 'statusCode,404', 'statusCode,400',
  'beforePreviewMessages.json'
]) assert.ok(tests.includes(marker),"Authenticated preview integration coverage missing: "+marker);
for(const marker of [
  '.communication-announcement-filters','.communication-announcement-status',
  '.communication-preview','.communication-publish-choices',
  '.communication-announcement-full','.communication-more-button'
]) assert.ok(css.includes(marker),"Phase 2 filter/detail styling missing: "+marker);
for(const key of [
  "Recipient preview", "Calculating recipients…", "School timezone",
  "Publish now", "Schedule publication", "Schedule announcement",
  "Published, scheduled and archived school notices.",
  "Search announcements", "All statuses", "All audiences", "All classes",
  "Showing {shown} of {total} matching announcements",
  "View details", "Hide details", "Load more announcements",
  "Archive this announcement? It will disappear from current recipient views, but already-sent push messages cannot be recalled."
]) assert.equal(locale.split(JSON.stringify(key)+":").length,3,
  "Missing one Dari or Pashto locale key, or duplicated key: "+key);
assert.ok(roadmap.includes("## Phase 2 — Announcements (implemented)"));
assert.ok(state.includes("Admin Communication & Fees — Phase 2"));
console.log("Admin Communication/Fees Phase 2 recipient preview, filters, RTL, safe timezone and integration guards passed.");
