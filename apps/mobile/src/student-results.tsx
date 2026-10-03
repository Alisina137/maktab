import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate,
  formatLocalizedNumber,
  getDirection,
  translate,
  type SupportedLocale
} from "@maktablink/localization";
import type { LearnerAcademicPayload } from "./api";

type TextDirectionStyle = {
  textAlign: "right" | "left";
  writingDirection: "rtl" | "ltr";
};

type ResultItem = LearnerAcademicPayload["results"][number];

interface ExamGroup {
  examId: string;
  examName: string;
  examType: string;
  publishedAt: string | null;
  results: ResultItem[];
}

function groupPublishedResults(results: ResultItem[]): ExamGroup[] {
  const groups = new Map<string, ExamGroup>();

  for (const result of results) {
    if (result.exam.status !== "PUBLISHED" || result.grade.status !== "PUBLISHED") {
      continue;
    }

    const existing = groups.get(result.exam.id);
    if (existing) {
      existing.results.push(result);
      if (!existing.publishedAt && result.exam.publishedAt) {
        existing.publishedAt = result.exam.publishedAt;
      }
      continue;
    }

    groups.set(result.exam.id, {
      examId: result.exam.id,
      examName: result.exam.name,
      examType: result.exam.type,
      publishedAt: result.exam.publishedAt,
      results: [result]
    });
  }

  return [...groups.values()].sort((a, b) => {
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });
}

function SubjectResultRow({
  result,
  locale,
  textDirection
}: {
  result: ResultItem;
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
}) {
  const rtl = getDirection(locale) === "rtl";

  return (
    <View style={styles.subjectCard}>
      <View style={[styles.subjectHeading, rtl && styles.rowRtl]}>
        <View style={styles.subjectIcon}>
          <Ionicons name="book-outline" size={17} color={tokens.color.brandStrong} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.subjectName, textDirection]}>{result.subjectName}</Text>
          <Text style={[styles.className, textDirection]}>{result.className}</Text>
        </View>
        <View style={styles.scorePill}>
          <Text style={styles.scoreText}>
            {formatLocalizedNumber(result.grade.score, locale)}
            <Text style={styles.scoreDivider}>/</Text>
            {formatLocalizedNumber(result.examSubject.maxScore, locale)}
          </Text>
        </View>
      </View>

      {result.grade.remark ? (
        <View style={[styles.remarkBox, rtl && styles.rowRtl]}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={tokens.color.textMuted} />
          <View style={styles.flex}>
            <Text style={[styles.remarkLabel, textDirection]}>
              {translate(locale, "student.teacherRemark")}
            </Text>
            <Text style={[styles.remarkText, textDirection]}>{result.grade.remark}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function StudentResultsContent({
  learning,
  ready,
  locale,
  textDirection
}: {
  learning: LearnerAcademicPayload | null;
  ready: boolean;
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
}) {
  const rtl = getDirection(locale) === "rtl";

  if (!ready && !learning) {
    return (
      <View style={styles.loadingCard}>
        <View style={styles.loadingLineWide} />
        <View style={styles.loadingLineShort} />
      </View>
    );
  }

  const groups = groupPublishedResults(learning?.results ?? []);

  if (groups.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyIcon}>
          <Ionicons name="ribbon-outline" size={24} color={tokens.color.textMuted} />
        </View>
        <Text style={[styles.emptyText, textDirection]}>
          {translate(locale, "student.noResults")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {groups.map((group) => {
        const totalScore = group.results.reduce((sum, result) => sum + result.grade.score, 0);
        const totalMax = group.results.reduce(
          (sum, result) => sum + result.examSubject.maxScore,
          0
        );

        return (
          <View key={group.examId} style={styles.examCard}>
            <View style={[styles.examHeading, rtl && styles.rowRtl]}>
              <View style={styles.examIcon}>
                <Ionicons name="ribbon-outline" size={21} color={tokens.color.brandStrong} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.examName, textDirection]}>{group.examName}</Text>
                {group.examType ? (
                  <Text style={[styles.examType, textDirection]}>{group.examType}</Text>
                ) : null}
              </View>
            </View>

            <View style={[styles.examMeta, rtl && styles.rowRtl]}>
              <View style={styles.totalPill}>
                <Text style={styles.totalLabel}>
                  {translate(locale, "student.examTotal")}
                </Text>
                <Text style={styles.totalValue}>
                  {formatLocalizedNumber(totalScore, locale)}
                  <Text style={styles.scoreDivider}>/</Text>
                  {formatLocalizedNumber(totalMax, locale)}
                </Text>
              </View>

              {group.publishedAt ? (
                <View style={styles.publishPill}>
                  <Ionicons name="calendar-outline" size={13} color={tokens.color.textMuted} />
                  <Text style={styles.publishText}>
                    {translate(locale, "student.publishedOn")}{" "}
                    {formatLocalizedDate(group.publishedAt, locale)}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.subjectList}>
              {group.results
                .slice()
                .sort((a, b) => a.subjectName.localeCompare(b.subjectName))
                .map((result) => (
                  <SubjectResultRow
                    key={result.grade.id}
                    result={result}
                    locale={locale}
                    textDirection={textDirection}
                  />
                ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  rowRtl: { flexDirection: "row-reverse" },
  flex: { flex: 1, minWidth: 0 },
  examCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e1e7f0",
    backgroundColor: tokens.color.surface,
    gap: 13,
    shadowColor: "#172033",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1
  },
  examHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11
  },
  examIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff"
  },
  examName: {
    color: tokens.color.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900"
  },
  examType: {
    color: tokens.color.textMuted,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 2
  },
  examMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8
  },
  totalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    minHeight: 34,
    borderRadius: 12,
    backgroundColor: "#edf3ff"
  },
  totalLabel: {
    color: tokens.color.textMuted,
    fontSize: 10.5,
    fontWeight: "700"
  },
  totalValue: {
    color: tokens.color.brandStrong,
    fontSize: 13,
    fontWeight: "900"
  },
  publishPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    minHeight: 34,
    borderRadius: 12,
    backgroundColor: "#f3f5f8"
  },
  publishText: {
    color: tokens.color.textMuted,
    fontSize: 10.5,
    fontWeight: "700"
  },
  scoreDivider: { color: tokens.color.textMuted },
  subjectList: { gap: 8 },
  subjectCard: {
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e8edf4",
    backgroundColor: "#f9fbfe",
    gap: 9
  },
  subjectHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  subjectIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#edf3ff"
  },
  subjectName: {
    color: tokens.color.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900"
  },
  className: {
    color: tokens.color.textMuted,
    fontSize: 11.5,
    lineHeight: 16
  },
  scorePill: {
    minWidth: 64,
    minHeight: 34,
    paddingHorizontal: 9,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e9f7ef"
  },
  scoreText: {
    color: "#207a4c",
    fontSize: 12.5,
    fontWeight: "900"
  },
  remarkBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#f2f4f7"
  },
  remarkLabel: {
    color: tokens.color.textMuted,
    fontSize: 10.5,
    fontWeight: "800"
  },
  remarkText: {
    color: tokens.color.text,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2
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
  }
});
