import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  getDirection,
  translate,
  type SupportedLocale,
  type TranslationKey
} from "@maktablink/localization";
import {
  api,
  type GradeSheetPayload,
  type HomeworkPayload,
  type LearnerAcademicPayload,
  type TeacherLearningPayload
} from "./api";
import { appErrorFromCause, type AppErrorKind } from "./error-message";

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

function localDateParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };
  const pad = (part: number) => String(part).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
  };
}

function dueAtFromFields(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return null;
  }
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

export function TeacherLearningPanel(props: CommonProps) {
  const { accessToken, locale, textDirection, onError, onNotice } = props;
  const rtl = getDirection(locale) === "rtl";
  const [view, setView] = useState<TeacherLearningPayload | null>(null);
  const [gradeSheet, setGradeSheet] = useState<GradeSheetPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [assignmentId, setAssignmentId] = useState("");
  const [editingHomeworkId, setEditingHomeworkId] = useState<string | null>(null);
  const [homeworkTitle, setHomeworkTitle] = useState("");
  const [homeworkContent, setHomeworkContent] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [scoreDraft, setScoreDraft] = useState<Record<string, string>>({});
  const [remarkDraft, setRemarkDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    void load();
  }, [accessToken]);

  async function load() {
    setBusy(true);
    try {
      const result = await api.teacherLearning(accessToken);
      setView(result);
      setAssignmentId((current) => current || result.assignments[0]?.assignmentId || "");
    } catch (cause) {
      const failure = appErrorFromCause(cause);
      onError(failure.key, failure.kind);
    } finally {
      setBusy(false);
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
    onError(null);
    onNotice(null);
  }

  function editHomework(homework: HomeworkPayload) {
    const due = localDateParts(homework.dueAt);
    setAssignmentId(homework.assignmentId);
    setEditingHomeworkId(homework.id);
    setHomeworkTitle(homework.title);
    setHomeworkContent(homework.content);
    setDueDate(due.date);
    setDueTime(due.time);
    setAttachmentUrl(homework.attachmentUrl ?? "");
    onError(null);
    onNotice(null);
  }

  async function saveHomework() {
    if (!assignmentId || !homeworkTitle.trim() || !homeworkContent.trim()) {
      onError("learning.completeHomework");
      return;
    }
    const dueAt = dueAtFromFields(dueDate, dueTime);
    if (!dueAt) {
      onError("learning.invalidDueDate");
      return;
    }

    setBusy(true);
    onError(null);
    onNotice(null);
    try {
      if (editingHomeworkId) {
        await api.updateHomework(accessToken, editingHomeworkId, {
          title: homeworkTitle.trim(),
          content: homeworkContent.trim(),
          dueAt,
          attachmentUrl: attachmentUrl.trim() || null
        });
      } else {
        await api.createHomework(accessToken, {
          assignmentId,
          title: homeworkTitle.trim(),
          content: homeworkContent.trim(),
          dueAt,
          attachmentUrl: attachmentUrl.trim() || undefined
        });
      }
      onNotice(translate(locale, "learning.homeworkSaved"));
      setEditingHomeworkId(null);
      setHomeworkTitle("");
      setHomeworkContent("");
      setDueDate("");
      setDueTime("");
      setAttachmentUrl("");
      await load();
    } catch (cause) {
      const failure = appErrorFromCause(cause);
      onError(failure.key, failure.kind);
    } finally {
      setBusy(false);
    }
  }

  async function homeworkAction(homework: HomeworkPayload) {
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
      await load();
    } catch (cause) {
      const failure = appErrorFromCause(cause);
      onError(failure.key, failure.kind);
    } finally {
      setBusy(false);
    }
  }

  async function openGrades(examSubjectId: string) {
    setBusy(true);
    onError(null);
    onNotice(null);
    try {
      const sheet = await api.gradeSheet(accessToken, examSubjectId);
      setGradeSheet(sheet);
      setScoreDraft(
        Object.fromEntries(
          sheet.students.map((item) => [item.student.id, item.grade ? String(item.grade.score) : ""])
        )
      );
      setRemarkDraft(
        Object.fromEntries(
          sheet.students.map((item) => [item.student.id, item.grade?.remark ?? ""])
        )
      );
    } catch (cause) {
      const failure = appErrorFromCause(cause);
      onError(failure.key, failure.kind);
    } finally {
      setBusy(false);
    }
  }

  async function saveGrades() {
    if (!gradeSheet) return;
    const entries = gradeSheet.students
      .filter((item) => scoreDraft[item.student.id]?.trim())
      .map((item) => ({
        studentId: item.student.id,
        score: Number(scoreDraft[item.student.id]),
        remark: remarkDraft[item.student.id]?.trim() || undefined
      }));
    if (entries.length === 0 || entries.some((entry) => !Number.isInteger(entry.score))) {
      onError("learning.validScores");
      return;
    }

    setBusy(true);
    onError(null);
    onNotice(null);
    try {
      const result = await api.saveDraftGrades(accessToken, gradeSheet.examSubject.id, entries);
      setGradeSheet(result.sheet);
      onNotice(translate(locale, "learning.marksSaved"));
      await load();
    } catch (cause) {
      const failure = appErrorFromCause(cause);
      onError(failure.key, failure.kind);
    } finally {
      setBusy(false);
    }
  }

  const selectedAssignment = useMemo(
    () => view?.assignments.find((item) => item.assignmentId === assignmentId) ?? null,
    [view, assignmentId]
  );

  if (busy && !view) {
    return <ActivityIndicator color={tokens.color.brand} />;
  }
  if (!view) return null;

  return (
    <View style={styles.stack}>
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
          {view.assignments.map((assignment) => (
            <Pressable
              key={assignment.assignmentId}
              onPress={() => startHomework(assignment)}
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
              <TextInput
                value={dueDate}
                onChangeText={setDueDate}
                placeholder={translate(locale, "learning.dueDate")}
                style={[styles.input, styles.flexInput, textDirection]}
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

        <View style={styles.list}>
          {view.homeworks.map((homework) => (
            <View key={homework.id} style={styles.listItem}>
              <View style={[styles.headingRow, rtl && styles.rowRtl]}>
                <View style={styles.flex}>
                  <Text style={[styles.itemTitle, textDirection]}>{homework.title}</Text>
                  <Text style={[styles.muted, textDirection]}>
                    {homework.status} · {translate(locale, "learning.due")} {homework.dueAt.slice(0, 10)}
                  </Text>
                </View>
                <View style={styles.actions}>
                  {homework.status === "DRAFT" ? (
                    <Pressable style={styles.smallButton} onPress={() => editHomework(homework)}>
                      <Text style={styles.smallButtonText}>{translate(locale, "learning.edit")}</Text>
                    </Pressable>
                  ) : null}
                  {homework.status !== "ARCHIVED" ? (
                    <Pressable style={styles.smallButton} disabled={busy} onPress={() => void homeworkAction(homework)}>
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
              <Text style={[styles.body, textDirection]}>{homework.content}</Text>
            </View>
          ))}
          {view.homeworks.length === 0 ? (
            <Text style={[styles.muted, textDirection]}>{translate(locale, "learning.noHomework")}</Text>
          ) : null}
        </View>
      </View>

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

        {view.examSubjects.map((item) => (
          <Pressable
            key={item.examSubject.id}
            onPress={() => void openGrades(item.examSubject.id)}
            style={({ pressed }) => [styles.examRow, rtl && styles.rowRtl, pressed && styles.pressed]}
          >
            <View style={styles.flex}>
              <Text style={[styles.itemTitle, textDirection]}>{item.exam.name} · {item.subjectName}</Text>
              <Text style={[styles.muted, textDirection]}>
                {item.className} · {translate(locale, "learning.maxScore")} {item.examSubject.maxScore}
              </Text>
            </View>
            <Ionicons name={rtl ? "chevron-back" : "chevron-forward"} size={18} color={tokens.color.textMuted} />
          </Pressable>
        ))}
        {view.examSubjects.length === 0 ? (
          <Text style={[styles.muted, textDirection]}>{translate(locale, "learning.noExamSubjects")}</Text>
        ) : null}

        {gradeSheet ? (
          <View style={styles.editor}>
            <Text style={[styles.editorTitle, textDirection]}>
              {gradeSheet.exam.name} · {gradeSheet.subject.name}
            </Text>
            <Text style={[styles.muted, textDirection]}>
              {gradeSheet.classSection.name} · {translate(locale, "learning.maxScore")} {gradeSheet.examSubject.maxScore}
            </Text>
            {gradeSheet.students.map((item) => (
              <View key={item.student.id} style={styles.gradeRow}>
                <Text style={[styles.itemTitle, textDirection]}>{item.student.fullName}</Text>
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
            {gradeSheet.canEdit ? (
              <Pressable
                disabled={busy}
                onPress={() => void saveGrades()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, busy && styles.disabled]}
              >
                <Text style={styles.primaryText}>{translate(locale, "learning.saveMarks")}</Text>
              </Pressable>
            ) : (
              <Text style={[styles.muted, textDirection]}>{translate(locale, "learning.marksReadOnly")}</Text>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function LearnerLearningPanel({
  accessToken,
  studentId,
  mode,
  locale,
  textDirection,
  onError
}: CommonProps & { studentId?: string; mode: "PARENT" | "STUDENT" }) {
  const [view, setView] = useState<LearnerAcademicPayload | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode === "PARENT" && !studentId) {
      setView(null);
      return;
    }
    void load();
  }, [accessToken, studentId, mode]);

  async function load() {
    setBusy(true);
    try {
      const result =
        mode === "PARENT" && studentId
          ? await api.parentLearning(accessToken, studentId)
          : await api.studentHome(accessToken);
      setView(result);
    } catch (cause) {
      const failure = appErrorFromCause(cause);
      onError(failure.key, failure.kind);
    } finally {
      setBusy(false);
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
  disabled: { opacity: 0.45 }
});
