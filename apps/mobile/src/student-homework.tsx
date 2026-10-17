import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { shareLearningFile } from "./learning-files";
import { StudentSubmissionPanel } from "./student-submission";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate,
  formatLocalizedNumber,
  getDirection,
  translate,
  type SupportedLocale
} from "@maktablink/localization";
import type { LearnerAcademicPayload, HomeworkSubmissionPayload } from "./api";
import {
  studentHomeworkRows,studentHomeworkFilter,studentHomeworkSubjects,
  studentHomeworkCounts,studentHomeworkDeadlineState,studentHomeworkTabs,
  type HomeworkRow,type HomeworkStudentTab,type HomeworkStudentState
} from "./student-homework-model";

type TextDirectionStyle = {
  textAlign: "right" | "left";
  writingDirection: "rtl" | "ltr";
};

type HomeworkItem = LearnerAcademicPayload["homework"][number];
const stateKeys:Record<HomeworkStudentState,import("@maktablink/localization").TranslationKey>={
  TO_DO:"student.hwToDo",OVERDUE:"student.hwOverdue",
  SUBMITTED:"student.hwSubmitted",REVISION:"student.hwNeedsRevision",
  REVIEWED:"student.hwReviewed",CLOSED:"student.hwClosed"
};
const tabKeys:Record<HomeworkStudentTab,import("@maktablink/localization").TranslationKey>={
  TO_DO:"student.hwToDo",SUBMITTED:"student.hwSubmitted",
  REVISION:"student.hwNeedsRevision",COMPLETED:"student.hwCompleted"
};

function HomeworkCard({
  item,
  locale,
  textDirection,
  accessToken,
  onSubmitted, row, studentId, submissionsVerified, onRefresh
}: {
  item: HomeworkItem;row:HomeworkRow;studentId:string;
  submissionsVerified:boolean;onRefresh?:()=>Promise<boolean>;
  accessToken: string;
  onSubmitted?: (submission:HomeworkSubmissionPayload)=>void;
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
}) {
  const rtl = getDirection(locale) === "rtl";
  const deadlineState=studentHomeworkDeadlineState(item.homework.dueAt);

  async function openAttachment() {
    if (item.homework.attachmentFileId) {
      try { await shareLearningFile(accessToken,item.homework.attachmentFileId); } catch {}
      return;
    }
    const url = item.homework.attachmentUrl?.trim();
    if (!url || !/^https?:\/\//i.test(url)) return;
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      }
    } catch {
      // Attachment access is optional and must not block the homework page.
    }
  }

  return (
    <View style={styles.homeworkCard}>
      <View style={[styles.headingRow, rtl && styles.rowRtl]}>
        <View style={styles.iconShell}>
          <Ionicons name="document-text-outline" size={18} color={tokens.color.brandStrong} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, textDirection]}>{item.homework.title}</Text>
          <Text style={[styles.subject, textDirection]}>
            {item.subjectName} · {item.className}
          </Text>
        </View>
      </View>

      <View style={[styles.dueRow, rtl && styles.rowRtl]}>
        <Ionicons name="calendar-outline" size={15} color={tokens.color.textMuted} />
        <Text style={[styles.dueText, textDirection]}>
          {translate(locale, "learning.due")}{" "}
          {formatLocalizedDate(item.homework.dueAt, locale)}
        </Text>
      </View>

      <View style={[styles.statusRow,rtl&&styles.rowRtl]}>
        <Text style={[styles.statusBadge,row.state==="OVERDUE"&&styles.alertBadge,
          row.state==="REVISION"&&styles.alertBadge]}>
          {translate(locale,stateKeys[row.state])}
        </Text>
        {(deadlineState==="TODAY"||deadlineState==="TOMORROW")&&
          (row.state==="TO_DO"||row.state==="REVISION")?
          <Text style={styles.deadlineBadge}>{translate(locale,deadlineState==="TODAY"?
            "student.hwDueToday":"student.hwDueTomorrow")}</Text>:null}
      </View>
      <Text style={[styles.instructions, textDirection]}>{item.homework.content}</Text>

      {item.homework.attachmentUrl || item.homework.attachmentFileId ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={translate(locale, "student.openAttachment")}
          onPress={() => void openAttachment()}
          style={({ pressed }) => [
            styles.attachmentButton,
            rtl && styles.rowRtl,
            pressed && styles.pressed
          ]}
        >
          <Ionicons name="attach-outline" size={17} color={tokens.color.brandStrong} />
          <Text style={styles.attachmentText}>
            {translate(locale, "student.openAttachment")}
          </Text>
        </Pressable>
      ) : null}
      <StudentSubmissionPanel homework={item.homework} accessToken={accessToken}
        locale={locale} textDirection={textDirection} onSubmitted={onSubmitted}
        studentId={studentId} row={row} submissionsVerified={submissionsVerified}
        onRefresh={onRefresh}/>
    </View>
  );
}

function HomeworkSection({
  title,
  items,
  locale,
  textDirection,
  accessToken,
  onSubmitted
}: {
  title: string;
  items: HomeworkItem[];
  accessToken: string;
  onSubmitted?: (submission:HomeworkSubmissionPayload)=>void;
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
}) {
  const rtl = getDirection(locale) === "rtl";
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeading, rtl && styles.rowRtl]}>
        <Text style={[styles.sectionTitle, textDirection]}>{title}</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{formatLocalizedNumber(items.length, locale)}</Text>
        </View>
      </View>

      {items.map((item) => (
        <HomeworkCard
          key={item.homework.id}
          item={item}
          onSubmitted={onSubmitted}
          accessToken={accessToken}
          locale={locale}
          textDirection={textDirection}
        />
      ))}
    </View>
  );
}

export function StudentHomeworkContent({
  learning,
  ready,
  locale,
  textDirection,
  accessToken,
  onSubmitted
}: {
  learning: LearnerAcademicPayload | null;
  accessToken: string;
  onSubmitted?: (submission:HomeworkSubmissionPayload)=>void;
  ready: boolean;
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
}) {
  if (!ready && !learning) {
    return (
      <View style={styles.loadingCard}>
        <View style={styles.loadingLineWide} />
        <View style={styles.loadingLineShort} />
      </View>
    );
  }

  const now = Date.now();
  const all = [...(learning?.homework ?? [])].sort(
    (a, b) => new Date(a.homework.dueAt).getTime() - new Date(b.homework.dueAt).getTime()
  );
  const upcoming = all.filter(
    (item) =>
      item.homework.status === "PUBLISHED" &&
      new Date(item.homework.dueAt).getTime() >= now
  );
  const past = all
    .filter(
      (item) =>
        item.homework.status === "CLOSED" ||
        new Date(item.homework.dueAt).getTime() < now
    )
    .sort(
      (a, b) => new Date(b.homework.dueAt).getTime() - new Date(a.homework.dueAt).getTime()
    );

  if (all.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyIcon}>
          <Ionicons name="document-text-outline" size={24} color={tokens.color.textMuted} />
        </View>
        <Text style={[styles.emptyText, textDirection]}>
          {translate(locale, "student.noHomework")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <HomeworkSection
        title={translate(locale, "student.upcomingHomework")}
        items={upcoming}
        onSubmitted={onSubmitted}
        accessToken={accessToken}
        locale={locale}
        textDirection={textDirection}
      />
      <HomeworkSection
        title={translate(locale, "student.pastHomework")}
        items={past}
        onSubmitted={onSubmitted}
        accessToken={accessToken}
        locale={locale}
        textDirection={textDirection}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  section: { gap: 10 },
  rowRtl: { flexDirection: "row-reverse" },
  flex: { flex: 1, minWidth: 0 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sectionTitle: {
    flex: 1,
    color: tokens.color.text,
    fontSize: 16,
    fontWeight: "900"
  },
  countPill: {
    minWidth: 30,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff"
  },
  countText: {
    color: tokens.color.brandStrong,
    fontSize: 11.5,
    fontWeight: "900"
  },
  homeworkCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    backgroundColor: tokens.color.surface,
    gap: 11,
    shadowColor: "#172033",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  iconShell: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff"
  },
  title: {
    color: tokens.color.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900"
  },
  subject: {
    color: tokens.color.textMuted,
    fontSize: 12,
    lineHeight: 17
  },
  dueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f2f4f7"
  },
  dueText: {
    color: tokens.color.textMuted,
    fontSize: 11.5,
    fontWeight: "700"
  },
  instructions: {
    color: tokens.color.text,
    fontSize: 13.5,
    lineHeight: 21
  },
  attachmentButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e4f7",
    backgroundColor: "#f7faff"
  },
  attachmentText: {
    color: tokens.color.brandStrong,
    fontSize: 12,
    fontWeight: "900"
  },
  emptyCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    backgroundColor: tokens.color.surface,
    alignItems: "center",
    gap: 10
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f4f8"
  },
  emptyText: {
    color: tokens.color.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "700"
  },
  loadingCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    backgroundColor: tokens.color.surface,
    gap: 10
  },
  loadingLineWide: {
    height: 12,
    width: "78%",
    borderRadius: 999,
    backgroundColor: "#edf1f6"
  },
  loadingLineShort: {
    height: 11,
    width: "52%",
    borderRadius: 999,
    backgroundColor: "#f0f3f7"
  },
  pressed: { opacity: 0.75 }
});
