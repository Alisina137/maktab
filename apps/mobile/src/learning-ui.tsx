import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  getDirection,
  formatLocalizedDate,
  formatLocalizedNumber,
  translate,
  type SupportedLocale,
  type TranslationKey
} from "@maktablink/localization";
import {
  ApiRequestError,
  api,
  type GradeSheetPayload,
  type HomeworkPayload,
  type HomeworkStatus,
  type LearnerAcademicPayload,
  type TeacherLearningPayload
} from "./api";
import { appErrorFromCause, type AppErrorKind } from "./error-message";
import { HomeworkDueDatePicker } from "./homework-date-picker";
import { pickAndUploadLearningFile, shareLearningFile } from "./learning-files";
import { TeacherSubmissionReview } from "./teacher-submissions";
import { homeworkDeadline, teacherHomeworkList, teacherHomeworkOverview,
  type HomeworkDeadlineFilter } from "./teacher-homework-model";
import { teacherTime12 } from "./teacher-hub-data";
import { TeacherContinuousAssessmentPanel } from "./teacher-assessments";
import { gradeDraftsFromSheet, gradeProgress, homeworkDueAt, homeworkDueFields, pendingGradeEntries } from "./learning-workflow";

type TextDirectionStyle = {
  textAlign: "right" | "left";
  writingDirection: "rtl" | "ltr";
};

type CommonProps = {
  accessToken: string;
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
  onError: (key: TranslationKey | null, kind?: AppErrorKind) => void;
  onNotice: (message: string | null) => void;
};

export type TeacherAssignmentContext = {
  assignmentId: string;
  academicYearId: string;
  classId: string;
  subjectId: string;
};
export function TeacherLearningPanel(props: CommonProps & {
  section?: "HOMEWORK" | "GRADES" | "BOTH";
  assignmentContext?: TeacherAssignmentContext;
  onScrollTop?: () => void;
}) {
  const { accessToken, locale, textDirection, onError, onNotice, section = "BOTH", assignmentContext, onScrollTop } = props;
  const rtl = getDirection(locale) === "rtl";
  const [view, setView] = useState<TeacherLearningPayload | null>(null);
  const loadRequestId = useRef(0);
  const [gradeSheet, setGradeSheet] = useState<GradeSheetPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [assignmentId, setAssignmentId] = useState("");
  const [editingHomeworkId, setEditingHomeworkId] = useState<string | null>(null);
  const [homeworkTitle, setHomeworkTitle] = useState("");
  const [homeworkContent, setHomeworkContent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentFileId, setAttachmentFileId] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [homeworkQuery, setHomeworkQuery] = useState("");
  const [homeworkStatus, setHomeworkStatus] = useState<HomeworkStatus | "ALL">("ALL");
  const [homeworkAssignmentFilter,setHomeworkAssignmentFilter] = useState("ALL");
  const [homeworkDeadlineFilter,setHomeworkDeadlineFilter] = useState<HomeworkDeadlineFilter>("ALL");
  const [gradeQuery, setGradeQuery] = useState("");
  const [missingMarksOnly, setMissingMarksOnly] = useState(false);
  const [scoreDraft, setScoreDraft] = useState<Record<string, string>>({});
  const [remarkDraft, setRemarkDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const requestId = ++loadRequestId.current;
    setView(null);
    setGradeSheet(null);
    void load(requestId);
    return () => {
      loadRequestId.current++;
    };
  }, [accessToken, assignmentContext?.assignmentId, assignmentContext?.classId, assignmentContext?.subjectId]);

  async function load(requestId = ++loadRequestId.current, fresh = false) {
    setBusy(true);
    try {
      const result = await api.teacherLearning(accessToken, fresh);
      if (requestId !== loadRequestId.current) return;
      setView(result);
      const visible = assignmentContext
        ? result.assignments.filter((item) =>
            item.assignmentId === assignmentContext.assignmentId &&
            item.academicYearId === assignmentContext.academicYearId &&
            item.classId === assignmentContext.classId &&
            item.subjectId === assignmentContext.subjectId
          )
        : result.assignments;
      setAssignmentId((current) =>
        visible.some((item) => item.assignmentId === current)
          ? current : visible[0]?.assignmentId ?? ""
      );
    } catch (cause) {
      if (requestId !== loadRequestId.current) return;
      const failure = appErrorFromCause(cause);
      onError(failure.key, failure.kind);
    } finally {
      if (requestId === loadRequestId.current) setBusy(false);
    }
  }

  function startHomework(assignment: TeacherLearningPayload["assignments"][number]) {
    setAssignmentId(assignment.assignmentId);
    setEditingHomeworkId(null);
    setHomeworkTitle("");
    setHomeworkContent("");
    setDueDate("");
    setDueTime("");
    setAttachmentUrl("");
    setAttachmentFileId(null);
    setAttachmentName("");
    setScheduleDate("");
    setScheduleTime("");
    onError(null);
    onNotice(null);
  }

  function editHomework(homework: HomeworkPayload) {
    const due = homeworkDueFields(homework.dueAt);
    setAssignmentId(homework.assignmentId);
    setEditingHomeworkId(homework.id);
    setHomeworkTitle(homework.title);
    setHomeworkContent(homework.content);
    setDueDate(due.date);
    setDueTime(due.time);
    setAttachmentUrl(homework.attachmentUrl ?? "");
    setAttachmentFileId(homework.attachmentFileId ?? null);
    setAttachmentName(homework.attachmentFileId ? translate(locale,"learning.fileAttached") : "");
    const schedule = homework.scheduledAt ? homeworkDueFields(homework.scheduledAt) : null;
    setScheduleDate(schedule?.date ?? "");
    setScheduleTime(schedule?.time ?? "");
    onError(null);
    onNotice(null);
  }

  function useHomeworkTemplate(homework: HomeworkPayload) {
    const selected = visibleAssignments.find((item) => item.assignmentId === homework.assignmentId)
      ?? visibleAssignments[0];
    if (!selected) {
      onError("learning.noAssignments");
      return;
    }
    setAssignmentId(selected.assignmentId);
    setEditingHomeworkId(null);
    setHomeworkTitle(homework.title);
    setHomeworkContent(homework.content);
    setAttachmentUrl(homework.attachmentUrl ?? "");
    setAttachmentFileId(homework.attachmentFileId ?? null);
    setAttachmentName(homework.attachmentFileId ? translate(locale,"learning.fileAttached") : "");
    setScheduleDate("");
    setScheduleTime("");
    setDueDate("");
    setDueTime("");
    onError(null);
    onNotice(translate(locale, "learning.templateReady"));
    onScrollTop?.();
  }

  async function openHomeworkAttachment(url: string) {
    if (!/^https:\/\//i.test(url)) {
      onError("learning.validAttachment");
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      onError("common.requestFailed");
    }
  }

  async function pickHomeworkFile() {
    setBusy(true);
    try {
      const file = await pickAndUploadLearningFile(accessToken);
      if (file) {
        setAttachmentFileId(file.id);
        setAttachmentName(file.fileName);
        onNotice(translate(locale,"learning.fileReady"));
      }
    } catch {
      onError("learning.fileUploadFailed");
    } finally { setBusy(false); }
  }

  async function saveHomework() {
    if (!assignmentId || homeworkTitle.trim().length < 2 || !homeworkContent.trim()) {
      onError("learning.completeHomework");
      return;
    }
    const dueAt = homeworkDueAt(dueDate, dueTime);
    if (!dueAt || new Date(dueAt).getTime() <= Date.now()) {
      onError("learning.invalidDueDate");
      return;
    }
    if (attachmentUrl.trim() && (!/^https:\/\//i.test(attachmentUrl.trim()) || attachmentUrl.trim().length > 500)) {
      onError("learning.validAttachment");
      return;
    }

    const schedule = scheduleDate || scheduleTime ? homeworkDueAt(scheduleDate, scheduleTime) : null;
    if ((scheduleDate || scheduleTime) && (!schedule || new Date(schedule) <= new Date() || schedule >= dueAt)) {
      onError("learning.invalidSchedule"); return;
    }
    setBusy(true);
    onError(null);
    onNotice(null);
    try {
      let savedId: string;
      if (editingHomeworkId) {
        savedId = editingHomeworkId;
        await api.updateHomework(accessToken, editingHomeworkId, {
          title: homeworkTitle.trim(),
          content: homeworkContent.trim(),
          dueAt,
          attachmentUrl: attachmentUrl.trim() || null
        });
      } else {
        const created = await api.createHomework(accessToken, {
          assignmentId,
          title: homeworkTitle.trim(),
          content: homeworkContent.trim(),
          dueAt,
          attachmentUrl: attachmentUrl.trim() || undefined
        });
        savedId = created.homework.id;
        // Retain the newly created draft ID before linking a file or adding a
        // schedule. If the next network operation fails, retry EDITS this same
        // draft rather than creating duplicates over an unstable tunnel.
        setEditingHomeworkId(savedId);
      }
      // Never silently ignore a failed file link or scheduled publication.
      if (attachmentFileId) await api.attachHomeworkFile(accessToken, savedId, attachmentFileId);
      else if (editingHomeworkId) await api.attachHomeworkFile(accessToken, savedId, null);
      await api.scheduleHomework(accessToken, savedId, schedule);
      onNotice(translate(locale, "learning.homeworkSaved"));
      setEditingHomeworkId(null);
      setHomeworkTitle("");
      setHomeworkContent("");
      setDueDate("");
      setDueTime("");
      setAttachmentUrl("");
      setAttachmentFileId(null);setAttachmentName("");
      setScheduleDate("");setScheduleTime("");
      await load(undefined,true);
    } catch (cause) {
      const failure = appErrorFromCause(cause);
      onError(failure.key, failure.kind);
    } finally {
      setBusy(false);
    }
  }

  async function performHomeworkAction(homework: HomeworkPayload) {
    const action =
      homework.status === "DRAFT" ? "publish" :
      homework.status === "PUBLISHED" ? "close" :
      homework.status === "CLOSED" ? "archive" : null;
    if (!action) return;
    setBusy(true);
    onError(null);
    onNotice(null);
    try {
      await api.homeworkAction(accessToken, homework.id, action);
      onNotice(
        action === "publish"
          ? translate(locale, "learning.homeworkPublished")
          : translate(locale, "learning.homeworkUpdated")
      );
      await load(undefined,true);
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.code === "learning_conflict") {
        // Another session or scheduled publisher may have advanced this item.
        // Refresh the canonical state instead of encouraging repeated stale taps.
        await load(undefined,true);
        onError("learning.statusChanged");
      } else {
        const failure = appErrorFromCause(cause);
        onError(failure.key, failure.kind);
      }
    } finally {
      setBusy(false);
    }
  }

  function confirmHomeworkAction(homework: HomeworkPayload) {
    if (busy) return;
    const action = homework.status === "DRAFT" ? "learning.publish"
      : homework.status === "PUBLISHED" ? "learning.close"
      : homework.status === "CLOSED" ? "learning.archive" : null;
    const message = homework.status === "DRAFT" ? "learning.confirmPublish"
      : homework.status === "PUBLISHED" ? "learning.confirmClose"
      : homework.status === "CLOSED" ? "learning.confirmArchive" : null;
    if (!action || !message) return;
    Alert.alert(translate(locale, action), translate(locale, message), [
      { text: translate(locale, "attendance.cancel"), style: "cancel" },
      { text: translate(locale, action),
        onPress: () => { void performHomeworkAction(homework); } }
    ], { cancelable: true });
  }

  async function openGrades(examSubjectId: string) {
    setBusy(true);
    onError(null);
    onNotice(null);
    try {
      const sheet = await api.gradeSheet(accessToken, examSubjectId);
      setGradeSheet(sheet);
      const drafts = gradeDraftsFromSheet(sheet);
      setScoreDraft(drafts.scores);
      setRemarkDraft(drafts.remarks);
      setGradeQuery("");
      setMissingMarksOnly(false);
    } catch (cause) {
      const failure = appErrorFromCause(cause);
      onError(failure.key, failure.kind);
    } finally {
      setBusy(false);
    }
  }

  async function saveGrades() {
    if (!gradeSheet) return;
    const { entries, invalid } = pendingGradeEntries(gradeSheet, { scores: scoreDraft, remarks: remarkDraft });
    if (invalid) {
      onError("learning.validScores");
      return;
    }
    if (!entries.length) {
      onNotice(translate(locale, "learning.noGradeChanges"));
      return;
    }

    setBusy(true);
    onError(null);
    onNotice(null);
    try {
      const result = await api.saveDraftGrades(accessToken, gradeSheet.examSubject.id, entries);
      setGradeSheet(result.sheet);
      const saved = gradeDraftsFromSheet(result.sheet);
      setScoreDraft(saved.scores);
      setRemarkDraft(saved.remarks);
      onNotice(translate(locale, "learning.marksSaved"));
      await load(undefined,true);
    } catch (cause) {
      const failure = appErrorFromCause(cause);
      onError(failure.key, failure.kind);
    } finally {
      setBusy(false);
    }
  }

  const visibleAssignments = useMemo(() => {
    if (!view) return [];
    return assignmentContext ? view.assignments.filter((item) =>
      item.assignmentId === assignmentContext.assignmentId &&
      item.academicYearId === assignmentContext.academicYearId &&
      item.classId === assignmentContext.classId &&
      item.subjectId === assignmentContext.subjectId
    ) : view.assignments;
  }, [view, assignmentContext?.assignmentId, assignmentContext?.academicYearId,
      assignmentContext?.classId, assignmentContext?.subjectId]);
  const selectedAssignment = visibleAssignments.find((item) => item.assignmentId === assignmentId) ?? null;
  const visibleHomeworks = useMemo(() =>
    !view ? [] : assignmentContext
      ? view.homeworks.filter((item) => item.assignmentId === assignmentContext.assignmentId &&
          item.classId === assignmentContext.classId && item.subjectId === assignmentContext.subjectId &&
          item.academicYearId === assignmentContext.academicYearId)
      : view.homeworks, [view, assignmentContext?.assignmentId, assignmentContext?.classId]);
  const visibleExamSubjects = useMemo(() =>
    !view ? [] : assignmentContext
      ? view.examSubjects.filter((item) =>
          item.exam.academicYearId === assignmentContext.academicYearId &&
          item.examSubject.classId === assignmentContext.classId &&
          item.examSubject.subjectId === assignmentContext.subjectId)
      : view.examSubjects, [view, assignmentContext?.academicYearId,
          assignmentContext?.classId, assignmentContext?.subjectId]);

  const homeworkNow=Date.now();
  const assignedHomeworks=teacherHomeworkList(visibleHomeworks,visibleAssignments,
    "","ALL","ALL","ALL",homeworkNow);
  const homeworkStats=teacherHomeworkOverview(assignedHomeworks,homeworkNow);
  const listedHomeworks=teacherHomeworkList(assignedHomeworks,visibleAssignments,
    homeworkQuery,homeworkStatus,homeworkAssignmentFilter,homeworkDeadlineFilter,homeworkNow);
  const gradeCounts = gradeSheet ? gradeProgress(gradeSheet) : null;
  const visibleGradeStudents = gradeSheet?.students.filter((item) =>
    (!missingMarksOnly || !item.grade) &&
    (!gradeQuery.trim() || [item.student.fullName, item.student.studentCode].some((value) =>
      value.toLocaleLowerCase().includes(gradeQuery.trim().toLocaleLowerCase())))
  ) ?? [];
  const pendingGrades = gradeSheet ? pendingGradeEntries(gradeSheet, { scores: scoreDraft, remarks: remarkDraft }) : null;

  if (busy && !view) {
    return (
      <View style={[styles.card, styles.headingRow]}>
        <ActivityIndicator color={tokens.color.brand} />
        <Text style={[styles.muted, textDirection]}>{translate(locale, "common.loading")}</Text>
      </View>
    );
  }
  if (!view) {
    return (
      <Pressable accessibilityRole="button" onPress={() => void load(undefined,true)}
        style={styles.card}>
        <Ionicons name="refresh-outline" size={22} color={tokens.color.brandStrong} />
        <Text style={[styles.muted, textDirection]}>{translate(locale, "action.retry")}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.stack}>
      {section !== "GRADES" ? (
      <View style={styles.card}>
        <View style={[styles.headingRow, rtl && styles.rowRtl]}>
          <View style={styles.iconShell}>
            <Ionicons name="document-text-outline" size={20} color={tokens.color.brandStrong} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.sectionTitle, textDirection]}>{translate(locale, "learning.homework")}</Text>
            <Text style={[styles.muted, textDirection]}>{translate(locale, "learning.homeworkHint")}</Text>
          </View>
        </View>

        <Text style={[styles.label, textDirection]}>{translate(locale, "learning.assignments")}</Text>
        <View style={[styles.chips, rtl && styles.rowRtl]}>
          {visibleAssignments.map((assignment) => (
            <Pressable
              key={assignment.assignmentId}
              onPress={() => {
                if (editingHomeworkId) startHomework(assignment);
                else setAssignmentId(assignment.assignmentId);
              }}
              style={[
                styles.chip,
                assignment.assignmentId === assignmentId && styles.chipActive
              ]}
            >
              <Text style={assignment.assignmentId === assignmentId ? styles.chipTextActive : styles.chipText}>
                {assignment.subjectName} · {assignment.classCode}
              </Text>
            </Pressable>
          ))}
        </View>

        {selectedAssignment ? (
          <View style={styles.editor}>
            <Text style={[styles.editorTitle, textDirection]}>
              {editingHomeworkId ? translate(locale, "learning.editHomework") : translate(locale, "learning.createHomework")}
            </Text>
            <Text style={[styles.muted, textDirection]}>
              {selectedAssignment.subjectName} · {selectedAssignment.className}
            </Text>
            {editingHomeworkId ? (
              <Pressable accessibilityRole="button" style={styles.smallButton}
                onPress={() => startHomework(selectedAssignment)}>
                <Text style={styles.smallButtonText}>{translate(locale, "learning.newHomework")}</Text>
              </Pressable>
            ) : null}
            <TextInput
              value={homeworkTitle}
              onChangeText={setHomeworkTitle}
              placeholder={translate(locale, "learning.homeworkTitle")}
              style={[styles.input, textDirection]}
            />
            <TextInput
              multiline
              value={homeworkContent}
              onChangeText={setHomeworkContent}
              placeholder={translate(locale, "learning.instructions")}
              style={[styles.input, styles.multiline, textDirection]}
            />
            <View style={[styles.twoColumns, rtl && styles.rowRtl]}>
              <HomeworkDueDatePicker
                value={dueDate}
                onChange={setDueDate}
                locale={locale}
                textDirection={textDirection}
                disabled={busy}
              />
              <TextInput
                value={dueTime}
                onChangeText={setDueTime}
                placeholder={translate(locale, "learning.dueTime")}
                style={[styles.input, styles.flexInput, textDirection]}
              />
            </View>
            <TextInput
              autoCapitalize="none"
              value={attachmentUrl}
              onChangeText={setAttachmentUrl}
              placeholder={translate(locale, "learning.attachmentUrl")}
              style={[styles.input, textDirection]}
            />
            <Text style={[styles.muted, textDirection]}>{translate(locale, "learning.attachmentHint")}</Text>
            <Pressable accessibilityRole="button" disabled={busy} style={styles.smallButton}
              onPress={() => void pickHomeworkFile()}>
              <Text style={styles.smallButtonText}>{translate(locale,"learning.selectDeviceFile")}</Text>
            </Pressable>
            {attachmentFileId ? (
              <View style={styles.actions}>
                <Text style={[styles.muted, textDirection]}>{attachmentName || translate(locale,"learning.fileAttached")}</Text>
                <Pressable accessibilityRole="button" onPress={() => setAttachmentFileId(null)}>
                  <Text style={styles.linkText}>{translate(locale,"learning.removeFile")}</Text>
                </Pressable>
              </View>
            ) : null}
            <Text style={[styles.label,textDirection]}>{translate(locale,"learning.schedulePublication")}</Text>
            <View style={[styles.twoColumns, rtl && styles.rowRtl]}>
              <HomeworkDueDatePicker value={scheduleDate} onChange={setScheduleDate}
                locale={locale} textDirection={textDirection} disabled={busy}/>
              <TextInput value={scheduleTime} onChangeText={setScheduleTime}
                placeholder={translate(locale,"learning.publicationTime")}
                style={[styles.input,styles.flexInput,textDirection]}/>
            </View>
            <Text style={[styles.muted,textDirection]}>{translate(locale,"learning.scheduleHint")}</Text>
            <Pressable
              disabled={busy}
              onPress={() => void saveHomework()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}
            >
              <Text style={styles.primaryText}>{translate(locale, "learning.saveDraft")}</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={[styles.muted, textDirection]}>{translate(locale, "learning.noAssignments")}</Text>
        )}

        <View style={styles.list} testID="teacher-homework-workload">
          <View style={[styles.headingRow,rtl&&styles.rowRtl]}>
            <Text style={[styles.editorTitle,styles.flex,textDirection]}>{translate(locale,"teacher.homeworkRecords")}</Text>
            <Pressable accessibilityRole="button" disabled={busy} style={styles.smallButton}
              onPress={()=>void load(undefined,true)}>
              <Text style={styles.smallButtonText}>{translate(locale,"learning.submissionRefresh")}</Text>
            </Pressable>
          </View>
          <View style={[styles.workload,rtl&&styles.rowRtl]}>
            {([
              ["learning.homework",homeworkStats.total],
              ["teacher.statusDraft",homeworkStats.drafts],
              ["teacher.statusPublished",homeworkStats.published],
              ["teacher.homeworkDueSoon",homeworkStats.dueSoon],
              ["teacher.homeworkPastDue",homeworkStats.overdue]
            ] as Array<[TranslationKey,number]>).map(([label,total])=>
              <View key={label} style={styles.workloadCell}>
                <Text style={styles.workloadNumber}>{formatLocalizedNumber(total,locale)}</Text>
                <Text style={styles.workloadLabel}>{translate(locale,label)}</Text>
              </View>)}
          </View>
          <Text style={[styles.muted,textDirection]}>{translate(locale,"teacher.homeworkSubmissionHint")}</Text>
          {!assignmentContext&&visibleAssignments.length>1?<View style={styles.filterGroup}>
            <Text style={[styles.label,textDirection]}>{translate(locale,"teacher.homeworkChooseClass")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.horizontalChips,rtl&&styles.rowRtl]}>
              {[{assignmentId:"ALL",subjectName:translate(locale,"teacher.homeworkAllClasses"),classCode:""},
                ...visibleAssignments].map(assignment=><Pressable key={assignment.assignmentId}
                accessibilityRole="button" accessibilityState={{selected:homeworkAssignmentFilter===assignment.assignmentId}}
                onPress={()=>setHomeworkAssignmentFilter(assignment.assignmentId)}
                style={[styles.chip,homeworkAssignmentFilter===assignment.assignmentId&&styles.chipActive]}>
                <Text style={homeworkAssignmentFilter===assignment.assignmentId?styles.chipTextActive:styles.chipText}>
                  {assignment.subjectName}{assignment.classCode?" · "+assignment.classCode:""}
                </Text>
              </Pressable>)}
            </ScrollView>
          </View>:null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.horizontalChips,rtl&&styles.rowRtl]}>
            {(["ALL","DUE_SOON","OVERDUE"] as const).map(next=>
              <Pressable key={next} accessibilityRole="button"
                accessibilityState={{selected:homeworkDeadlineFilter===next}}
                onPress={()=>setHomeworkDeadlineFilter(next)}
                style={[styles.chip,homeworkDeadlineFilter===next&&styles.chipActive]}>
                <Text style={homeworkDeadlineFilter===next?styles.chipTextActive:styles.chipText}>
                  {translate(locale,next==="ALL"?"teacher.homeworkDeadlineAll":
                    next==="DUE_SOON"?"teacher.homeworkDueSoon":"teacher.homeworkPastDue")}
                </Text>
              </Pressable>)}
          </ScrollView>
          {(homeworkQuery||homeworkStatus!=="ALL"||homeworkAssignmentFilter!=="ALL"||homeworkDeadlineFilter!=="ALL")?
            <Pressable accessibilityRole="button" onPress={()=>{
              setHomeworkQuery("");setHomeworkStatus("ALL");
              setHomeworkAssignmentFilter("ALL");setHomeworkDeadlineFilter("ALL");
            }}><Text style={styles.linkText}>{translate(locale,"teacher.homeworkClearFilters")}</Text></Pressable>:null}
          <TextInput testID="teacher-homework-search"
            value={homeworkQuery} onChangeText={setHomeworkQuery}
            placeholder={translate(locale, "learning.searchHomework")}
            style={[styles.input, textDirection]} autoCapitalize="none"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.horizontalChips,rtl&&styles.rowRtl]}>
            {(["ALL", "DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"] as const).map((status) => (
              <Pressable key={status} accessibilityRole="button"
                accessibilityState={{ selected: homeworkStatus === status }}
                onPress={() => setHomeworkStatus(status)}
                style={[styles.chip, homeworkStatus === status && styles.chipActive]}>
                <Text style={homeworkStatus === status ? styles.chipTextActive : styles.chipText}>
                  {translate(locale, status === "ALL" ? "learning.allStatuses"
                    : status === "DRAFT" ? "teacher.statusDraft"
                    : status === "PUBLISHED" ? "teacher.statusPublished"
                    : status === "CLOSED" ? "teacher.statusClosed" : "teacher.statusArchived")}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={[styles.muted, textDirection]}>
            {formatLocalizedNumber(listedHomeworks.length, locale)} / {formatLocalizedNumber(assignedHomeworks.length, locale)}
          </Text>
          {listedHomeworks.map((homework) => (
            <View key={homework.id} style={styles.listItem}>
              <View style={[styles.headingRow, rtl && styles.rowRtl]}>
                <View style={styles.flex}>
                  <Text style={[styles.itemTitle, textDirection]}>{homework.title}</Text>
                  <Text style={[styles.muted, textDirection]}>
                    {translate(locale, homework.status === "DRAFT" ? "teacher.statusDraft" : homework.status === "PUBLISHED" ? "teacher.statusPublished" : homework.status === "CLOSED" ? "teacher.statusClosed" : "teacher.statusArchived")} · {translate(locale, "learning.due")} {formatLocalizedDate(homework.dueAt, locale)} · {teacherTime12(homeworkDueFields(homework.dueAt).time)}
                  </Text>
                </View>
                <View style={styles.actions}>
                  {homework.status === "DRAFT" ? (
                    <Pressable style={styles.smallButton} disabled={busy} onPress={() => editHomework(homework)}>
                      <Text style={styles.smallButtonText}>{translate(locale, "learning.edit")}</Text>
                    </Pressable>
                  ) : null}
                  {homework.status !== "ARCHIVED" ? (
                    <Pressable style={styles.smallButton} disabled={busy} onPress={() => confirmHomeworkAction(homework)}>
                      <Text style={styles.smallButtonText}>
                        {homework.status === "DRAFT"
                          ? translate(locale, "learning.publish")
                          : homework.status === "PUBLISHED"
                            ? translate(locale, "learning.close")
                            : translate(locale, "learning.archive")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <Text style={[styles.muted,textDirection]}>
                {visibleAssignments.find(a=>a.assignmentId===homework.assignmentId)?.subjectName ?? ""} · {
                  visibleAssignments.find(a=>a.assignmentId===homework.assignmentId)?.classCode ?? ""}
              </Text>
              {homeworkDeadline(homework,homeworkNow)!=="ALL"?<Text
                style={[styles.urgency,homeworkDeadline(homework,homeworkNow)==="OVERDUE"&&styles.urgencyOverdue,textDirection]}>
                {translate(locale,homeworkDeadline(homework,homeworkNow)==="OVERDUE"?
                  "teacher.homeworkPastDue":"teacher.homeworkDueSoon")}
              </Text>:null}
              <Text style={[styles.body, textDirection]}>{homework.content}</Text>
              {homework.scheduledAt ? (
                <Text style={[styles.muted,textDirection]}>
                  {translate(locale,"learning.schedulePublication")}: {formatLocalizedDate(homework.scheduledAt,locale)} · {teacherTime12(homeworkDueFields(homework.scheduledAt).time)}
                </Text>
              ) : null}
              {homework.attachmentFileId ? (
                <Pressable accessibilityRole="button" onPress={() =>
                  void shareLearningFile(accessToken, homework.attachmentFileId!).catch(() => onError("common.requestFailed"))}>
                  <Text style={styles.linkText}>{translate(locale,"learning.openAttachment")}</Text>
                </Pressable>
              ) : null}
              {homework.attachmentUrl ? (
                <Pressable accessibilityRole="link" onPress={() => void openHomeworkAttachment(homework.attachmentUrl!)}>
                  <Text style={[styles.linkText, textDirection]}>{translate(locale, "learning.openAttachment")}</Text>
                </Pressable>
              ) : null}
              {homework.status !== "DRAFT" ? (
                <TeacherSubmissionReview homework={homework} accessToken={accessToken}
                  locale={locale} textDirection={textDirection} onError={onError} onNotice={onNotice}/>
              ) : null}
              {visibleAssignments.length ? (
                <Pressable accessibilityRole="button" onPress={() => useHomeworkTemplate(homework)}
                  style={[styles.smallButton, styles.templateButton]}>
                  <Ionicons name="copy-outline" size={15} color={tokens.color.brandStrong} />
                  <Text style={styles.smallButtonText}>{translate(locale, "learning.useTemplate")}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {listedHomeworks.length === 0 ? (
            <Text style={[styles.muted, textDirection]}>{translate(locale, "learning.noMatchingHomework")}</Text>
          ) : null}
        </View>
      </View>
      ) : null}

      {section !== "HOMEWORK" ? (
      <View style={styles.card}>
        <View style={[styles.headingRow, rtl && styles.rowRtl]}>
          <View style={styles.iconShell}>
            <Ionicons name="stats-chart-outline" size={20} color={tokens.color.brandStrong} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.sectionTitle, textDirection]}>{translate(locale, "learning.marks")}</Text>
            <Text style={[styles.muted, textDirection]}>{translate(locale, "learning.marksHint")}</Text>
          </View>
        </View>

        <Text style={[styles.label,textDirection]}>{translate(locale,"learning.assignments")}</Text>
        <View style={[styles.chips,rtl&&styles.rowRtl]}>
          {visibleAssignments.map(assignment=>(
            <Pressable key={assignment.assignmentId} accessibilityRole="button"
              accessibilityState={{selected:assignmentId===assignment.assignmentId}}
              onPress={()=>{setAssignmentId(assignment.assignmentId);setGradeSheet(null);}}
              style={[styles.chip,assignmentId===assignment.assignmentId&&styles.chipActive]}>
              <Text style={assignmentId===assignment.assignmentId?styles.chipTextActive:styles.chipText}>
                {assignment.subjectName} · {assignment.classCode}
              </Text>
            </Pressable>
          ))}
        </View>
        {visibleExamSubjects.map((item) => (
          <Pressable
            key={item.examSubject.id}
            onPress={() => void openGrades(item.examSubject.id)}
            style={({ pressed }) => [styles.examRow, rtl && styles.rowRtl, pressed && styles.pressed]}
          >
            <View style={styles.flex}>
              <Text style={[styles.itemTitle, textDirection]}>{item.exam.name} · {item.subjectName}</Text>
              <Text style={[styles.muted, textDirection]}>
                {item.className} · {item.examSubject.examDate ? `${formatLocalizedDate(item.examSubject.examDate, locale)} · ` : ""}{translate(locale, "learning.maxScore")} {formatLocalizedNumber(item.examSubject.maxScore, locale)}
              </Text>
            </View>
            <Ionicons name={rtl ? "chevron-back" : "chevron-forward"} size={18} color={tokens.color.textMuted} />
          </Pressable>
        ))}
        {visibleExamSubjects.length === 0 ? (
          <Text style={[styles.muted, textDirection]}>{translate(locale, "learning.noExamSubjects")}</Text>
        ) : null}

        {gradeSheet ? (
          <View style={styles.editor}>
            <Text style={[styles.editorTitle, textDirection]}>
              {gradeSheet.exam.name} · {gradeSheet.subject.name}
            </Text>
            <Text style={[styles.muted, textDirection]}>
              {gradeSheet.classSection.name} · {gradeSheet.examSubject.examDate ? `${formatLocalizedDate(gradeSheet.examSubject.examDate, locale)} · ` : ""}{translate(locale, "learning.maxScore")} {formatLocalizedNumber(gradeSheet.examSubject.maxScore, locale)}
            </Text>
            <View style={[styles.progressRow, rtl && styles.rowRtl]}>
              <Text style={[styles.progressText, textDirection]}>
                {translate(locale, "learning.marksEntered")}: {formatLocalizedNumber(gradeCounts?.recorded ?? 0, locale)}
              </Text>
              <Text style={[styles.progressText, textDirection]}>
                {translate(locale, "learning.marksMissing")}: {formatLocalizedNumber(gradeCounts?.missing ?? 0, locale)}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: gradeCounts?.total
                ? (`${100 * gradeCounts.recorded / gradeCounts.total}%` as `${number}%`) : "0%" }]} />
            </View>
            <TextInput testID="teacher-grade-search" value={gradeQuery} onChangeText={setGradeQuery}
              placeholder={translate(locale, "learning.searchStudents")}
              style={[styles.input, textDirection]} autoCapitalize="none" />
            <Pressable accessibilityRole="button" accessibilityState={{ selected: missingMarksOnly }}
              style={[styles.chip, missingMarksOnly && styles.chipActive, styles.gradeFilter]}
              onPress={() => setMissingMarksOnly((current) => !current)}>
              <Text style={missingMarksOnly ? styles.chipTextActive : styles.chipText}>
                {translate(locale, missingMarksOnly ? "learning.showAllStudents" : "learning.showMissingOnly")}
              </Text>
            </Pressable>
            <Text style={[styles.muted, textDirection]}>
              {formatLocalizedNumber(visibleGradeStudents.length, locale)} / {formatLocalizedNumber(gradeCounts?.total ?? 0, locale)}
            </Text>
            {visibleGradeStudents.map((item) => (
              <View key={item.student.id} style={styles.gradeRow}>
                <View style={[styles.headingRow, rtl && styles.rowRtl]}>
                  <View style={styles.flex}>
                    <Text style={[styles.itemTitle, textDirection]}>{item.student.fullName}</Text>
                    <Text style={[styles.muted, textDirection]}>{item.student.studentCode}</Text>
                  </View>
                  <Text style={styles.gradeStatus}>
                    {translate(locale, item.grade ? "learning.markRecorded" : "learning.markMissing")}
                  </Text>
                </View>
                <View style={[styles.twoColumns, rtl && styles.rowRtl]}>
                  <TextInput
                    editable={gradeSheet.canEdit}
                    keyboardType="number-pad"
                    value={scoreDraft[item.student.id] ?? ""}
                    onChangeText={(value) => setScoreDraft((current) => ({ ...current, [item.student.id]: value }))}
                    placeholder={translate(locale, "learning.score")}
                    style={[styles.input, styles.flexInput, textDirection]}
                  />
                  <TextInput
                    editable={gradeSheet.canEdit}
                    value={remarkDraft[item.student.id] ?? ""}
                    onChangeText={(value) => setRemarkDraft((current) => ({ ...current, [item.student.id]: value }))}
                    placeholder={translate(locale, "learning.remark")}
                    style={[styles.input, styles.flexInput, textDirection]}
                  />
                </View>
              </View>
            ))}
            {!visibleGradeStudents.length ? (
              <Text style={[styles.muted, textDirection]}>{translate(locale, "learning.noMatchingStudents")}</Text>
            ) : null}
            {gradeSheet.canEdit ? (
              <Pressable
                disabled={busy}
                onPress={() => void saveGrades()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}
              >
                <Text style={styles.primaryText}>
                  {translate(locale, "learning.saveMarks")}
                  {pendingGrades && !pendingGrades.invalid ? ` · ${formatLocalizedNumber(pendingGrades.entries.length, locale)}` : ""}
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.muted, textDirection]}>{translate(locale, "learning.marksReadOnly")}</Text>
            )}
          </View>
        ) : null}
      </View>
      ) : null}
      {section !== "HOMEWORK" && selectedAssignment ? (
        <TeacherContinuousAssessmentPanel accessToken={accessToken}
          assignmentId={selectedAssignment.assignmentId} locale={locale}
          textDirection={textDirection} onError={onError} onNotice={onNotice}/>
      ) : null}
    </View>
  );
}

export function LearnerLearningPanel({
  accessToken,
  studentId,
  mode,
  locale,
  textDirection,
  onError,
  onLoaded
}: CommonProps & {
  studentId?: string;
  mode: "PARENT" | "STUDENT";
  onLoaded?: (view: LearnerAcademicPayload) => void;
}) {
  const [view, setView] = useState<LearnerAcademicPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const loadRequestId = useRef(0);

  useEffect(() => {
    const requestId = ++loadRequestId.current;
    if (mode === "PARENT" && !studentId) {
      setView(null);
      setBusy(false);
      return;
    }
    void load(requestId);
    return () => {
      if (loadRequestId.current === requestId) loadRequestId.current += 1;
    };
  }, [accessToken, studentId, mode]);

  async function load(requestId: number) {
    setBusy(true);
    try {
      const result =
        mode === "PARENT" && studentId
          ? await api.parentLearning(accessToken, studentId)
          : await api.studentHome(accessToken);
      if (requestId !== loadRequestId.current) return;
      setView(result);
      onLoaded?.(result);
    } catch (cause) {
      if (requestId !== loadRequestId.current) return;
      const failure = appErrorFromCause(cause);
      onError(failure.key, failure.kind);
    } finally {
      if (requestId === loadRequestId.current) setBusy(false);
    }
  }

  if (busy && !view) return <ActivityIndicator color={tokens.color.brand} />;
  if (!view) return null;

  return (
    <View style={styles.stack}>
      {mode === "STUDENT" ? (
        <View style={styles.studentHero}>
          <View style={styles.studentAvatar}>
            <Text style={styles.studentAvatarText}>{view.student.fullName.slice(0, 1)}</Text>
          </View>
          <Text style={[styles.studentName, textDirection]}>{view.student.fullName}</Text>
          <Text style={[styles.muted, textDirection]}>{view.student.studentCode}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.headingRow}>
          <View style={styles.iconShell}>
            <Ionicons name="document-text-outline" size={20} color={tokens.color.brandStrong} />
          </View>
          <Text style={[styles.sectionTitle, textDirection]}>{translate(locale, "learning.publishedHomework")}</Text>
        </View>
        {view.homework.map((item) => (
          <View key={item.homework.id} style={styles.listItem}>
            <Text style={[styles.itemTitle, textDirection]}>{item.homework.title}</Text>
            <Text style={[styles.muted, textDirection]}>
              {item.subjectName} · {translate(locale, "learning.due")} {item.homework.dueAt.slice(0, 10)}
            </Text>
            <Text style={[styles.body, textDirection]}>{item.homework.content}</Text>
            {item.homework.attachmentUrl ? (
              <Text style={[styles.linkText, textDirection]}>{item.homework.attachmentUrl}</Text>
            ) : null}
          </View>
        ))}
        {view.homework.length === 0 ? (
          <Text style={[styles.muted, textDirection]}>{translate(locale, "learning.noPublishedHomework")}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.headingRow}>
          <View style={styles.iconShell}>
            <Ionicons name="ribbon-outline" size={20} color={tokens.color.brandStrong} />
          </View>
          <Text style={[styles.sectionTitle, textDirection]}>{translate(locale, "learning.publishedResults")}</Text>
        </View>
        {view.results.map((item) => (
          <View key={item.grade.id} style={styles.resultRow}>
            <View style={styles.flex}>
              <Text style={[styles.itemTitle, textDirection]}>{item.exam.name} · {item.subjectName}</Text>
              <Text style={[styles.muted, textDirection]}>{item.className}</Text>
              {item.grade.remark ? <Text style={[styles.body, textDirection]}>{item.grade.remark}</Text> : null}
            </View>
            <View style={styles.scoreBadge}>
              <Text style={styles.scoreText}>{item.grade.score}/{item.examSubject.maxScore}</Text>
            </View>
          </View>
        ))}
        {view.results.length === 0 ? (
          <Text style={[styles.muted, textDirection]}>{translate(locale, "learning.noPublishedResults")}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  card: { padding: 16, borderRadius: 19, backgroundColor: tokens.color.surface, borderWidth: 1, borderColor: "#e1e7f0", gap: 12 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowRtl: { flexDirection: "row-reverse" },
  flex: { flex: 1, gap: 3 },
  iconShell: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#edf3ff" },
  sectionTitle: { color: tokens.color.text, fontSize: 16, fontWeight: "900" },
  editorTitle: { color: tokens.color.text, fontSize: 15, fontWeight: "900" },
  itemTitle: { color: tokens.color.text, fontSize: 14.5, fontWeight: "800" },
  label: { color: tokens.color.textMuted, fontSize: 12, fontWeight: "800" },
  muted: { color: tokens.color.textMuted, fontSize: 12.5, lineHeight: 18 },
  body: { color: tokens.color.text, fontSize: 13.5, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#f8fafc" },
  chipActive: { backgroundColor: tokens.color.brand, borderColor: tokens.color.brand },
  chipText: { color: tokens.color.text, fontSize: 11.5, fontWeight: "800" },
  chipTextActive: { color: "#fff", fontSize: 11.5, fontWeight: "900" },
  editor: { paddingTop: 10, borderTopWidth: 1, borderTopColor: "#edf0f5", gap: 10 },
  input: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fbfcfe", color: tokens.color.text },
  multiline: { minHeight: 92, textAlignVertical: "top" },
  twoColumns: { flexDirection: "row", gap: 8 },
  flexInput: { flex: 1 },
  primaryButton: { minHeight: 46, borderRadius: 13, backgroundColor: tokens.color.brand, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  primaryText: { color: "#fff", fontWeight: "900" },
  smallButton: { minHeight: 34, justifyContent: "center", paddingHorizontal: 9, borderRadius: 9, borderWidth: 1, borderColor: "#dbe3ee", backgroundColor: "#fff" },
  smallButtonText: { color: tokens.color.brandStrong, fontSize: 11.5, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  list: { gap: 10 },
  filterGroup:{gap:6},
  horizontalChips:{flexDirection:"row",gap:7,paddingBottom:4},
  workload:{flexDirection:"row",flexWrap:"wrap",gap:7},
  workloadCell:{flexGrow:1,minWidth:"29%",backgroundColor:"#f0f5ff",borderRadius:12,
    alignItems:"center",padding:9,gap:4},
  workloadNumber:{fontSize:19,color:tokens.color.brandStrong,fontWeight:"900"},
  workloadLabel:{fontSize:11,color:tokens.color.textMuted,fontWeight:"700",textAlign:"center"},
  urgency:{fontSize:12,fontWeight:"800",color:tokens.color.brandStrong},
  urgencyOverdue:{color:"#b44432"},
  listItem: { borderTopWidth: 1, borderTopColor: "#edf0f5", paddingTop: 10, gap: 5 },
  examRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#edf0f5" },
  gradeRow: { gap: 7, paddingTop: 9, borderTopWidth: 1, borderTopColor: "#edf0f5" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#edf0f5" },
  scoreBadge: { minWidth: 65, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: "#edf3ff", alignItems: "center" },
  scoreText: { color: tokens.color.brandStrong, fontWeight: "900", fontSize: 13 },
  studentHero: { padding: 17, borderRadius: 19, backgroundColor: "#edf3ff", gap: 5 },
  studentAvatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: tokens.color.brand, alignItems: "center", justifyContent: "center" },
  studentAvatarText: { color: "#fff", fontSize: 19, fontWeight: "900" },
  studentName: { color: tokens.color.text, fontSize: 21, fontWeight: "900" },
  linkText: { color: tokens.color.brandStrong, fontSize: 12, fontWeight: "700" },
  pressed: { opacity: 0.75 },
  templateButton: { alignSelf: "flex-start", flexDirection: "row", gap: 6, alignItems: "center" },
  gradeFilter: { alignSelf: "flex-start" },
  gradeStatus: { fontSize: 11, color: tokens.color.brandStrong, fontWeight: "700" },
  progressRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  progressText: { fontSize: 12, fontWeight: "800", color: tokens.color.text },
  progressTrack: { height: 8, borderRadius: 6, backgroundColor: "#edf1f7", overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 6, backgroundColor: tokens.color.brand },
  disabled: { opacity: 0.45 }
});
