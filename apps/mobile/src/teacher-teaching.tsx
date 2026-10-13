import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate, formatLocalizedNumber, getDirection, translate,
  type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import {
  api, type TeacherTeachingPayload, type TeacherTeachingReport,
  type TeachingLesson, type LessonState, type UnitState, type TeachingSummary
} from "./api";
import { HomeworkDueDatePicker } from "./homework-date-picker";
import { appErrorFromCause, type AppErrorKind } from "./error-message";

type Direction = { textAlign: "right" | "left"; writingDirection: "rtl" | "ltr" };
type Section = "LESSONS" | "CURRICULUM" | "REPORT";
type Icon = keyof typeof Ionicons.glyphMap;
const menus: Array<[Section, TranslationKey, Icon]> = [
  ["LESSONS", "teaching.lessons", "book-outline"],
  ["CURRICULUM", "teaching.curriculum", "library-outline"],
  ["REPORT", "teaching.report", "stats-chart-outline"]
];
const lessonStates: LessonState[] = ["PLANNED", "COMPLETED", "POSTPONED"];
const unitStates: UnitState[] = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"];
const lessonKey: Record<LessonState, TranslationKey> = {
  PLANNED: "teaching.planned", COMPLETED: "teaching.completed",
  POSTPONED: "teaching.postponed"
};
const unitKey: Record<UnitState, TranslationKey> = {
  NOT_STARTED: "teaching.notStarted", IN_PROGRESS: "teaching.inProgress",
  COMPLETED: "teaching.completed"
};

function todayInKabul() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kabul", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((x) => x.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function monthStart(day: string) { return day.slice(0, 7) + "-01"; }
function Metric({ label, value, locale }: { label: string; value: number; locale: SupportedLocale }) {
  return <View style={styles.metric}>
    <Text style={styles.metricValue}>{formatLocalizedNumber(value, locale)}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>;
}

export function TeacherTeachingPanel({
  accessToken, assignmentId, locale, textDirection, reconnectEpoch, onError, onNotice
}: {
  accessToken: string; assignmentId: string;
  locale: SupportedLocale; textDirection: Direction; reconnectEpoch: number;
  onError: (key: TranslationKey | null, kind?: AppErrorKind) => void;
  onNotice: (message: string | null) => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const [section, setSection] = useState<Section>("LESSONS");
  const [view, setView] = useState<TeacherTeachingPayload | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [lessonDate, setLessonDate] = useState("");
  const [topic, setTopic] = useState("");
  const [objective, setObjective] = useState("");
  const [materials, setMaterials] = useState("");
  const [notes, setNotes] = useState("");
  const [unitId, setUnitId] = useState<string | null>(null);
  const [from, setFrom] = useState(() => monthStart(todayInKabul()));
  const [to, setTo] = useState(todayInKabul);
  const [report, setReport] = useState<TeacherTeachingReport | null>(null);
  const [reportBusy, setReportBusy] = useState(false);

  useEffect(() => {
    const id = ++generation.current;
    setReady(false);
    setView(null);
    setReport(null);
    void api.teacherTeaching(accessToken, assignmentId)
      .then((result) => { if (generation.current === id) setView(result); })
      .catch((error: unknown) => {
        if (generation.current !== id) return;
        const failure = appErrorFromCause(error);
        onError(failure.key, failure.kind);
      }).finally(() => { if (generation.current === id) setReady(true); });
    return () => { generation.current += 1; };
  }, [accessToken, assignmentId, reconnectEpoch, refresh]);

  function clearForm() {
    setEditId(null); setLessonDate(""); setTopic(""); setObjective("");
    setMaterials(""); setNotes(""); setUnitId(null);
  }
  function editLesson(lesson: TeachingLesson) {
    setEditId(lesson.id); setLessonDate(lesson.lessonDate);
    setTopic(lesson.topic); setObjective(lesson.objective);
    setMaterials(lesson.materials); setNotes(lesson.notes); setUnitId(lesson.unitId);
    setSection("LESSONS");
  }
  async function saveLesson() {
    if (!topic.trim() || !objective.trim() || !lessonDate ||
      topic.trim().length > 160 || objective.trim().length > 4000 ||
      materials.trim().length > 500 || notes.trim().length > 4000) {
      onError("teaching.invalidLesson"); return;
    }
    setBusy(true);
    try {
      const input = {
        lessonDate, topic: topic.trim(), objective: objective.trim(),
        materials: materials.trim(), notes: notes.trim(), unitId
      };
      if (editId) await api.updateTeachingLesson(accessToken, assignmentId, editId, input);
      else await api.createTeachingLesson(accessToken, assignmentId, input);
      clearForm(); setRefresh((value) => value + 1);
      onNotice(translate(locale, "teaching.lessonSaved"));
    } catch (cause) {
      const failure = appErrorFromCause(cause); onError(failure.key, failure.kind);
    } finally { setBusy(false); }
  }
  async function setLessonState(lesson: TeachingLesson, status: LessonState) {
    if (lesson.status === status) return;
    setBusy(true);
    try {
      await api.updateTeachingLesson(accessToken, assignmentId, lesson.id, { status });
      setRefresh((value) => value + 1);
      onNotice(translate(locale, "teaching.lessonSaved"));
    } catch (cause) {
      const failure = appErrorFromCause(cause); onError(failure.key, failure.kind);
    } finally { setBusy(false); }
  }
  async function setUnitState(id: string, status: UnitState) {
    setBusy(true);
    try {
      await api.setTeachingUnit(accessToken, assignmentId, id, status);
      setRefresh((value) => value + 1);
      onNotice(translate(locale, "teaching.progressSaved"));
    } catch (cause) {
      const failure = appErrorFromCause(cause); onError(failure.key, failure.kind);
    } finally { setBusy(false); }
  }
  async function loadReport() {
    if (from > to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      onError("teaching.invalidRange"); return;
    }
    setReportBusy(true); setReport(null);
    try {
      setReport(await api.teacherTeachingReport(accessToken, assignmentId, from, to));
    } catch (cause) {
      const failure = appErrorFromCause(cause); onError(failure.key, failure.kind);
    } finally { setReportBusy(false); }
  }
  function statistics(summary: TeachingSummary) {
    return <View style={[styles.metrics, rtl && styles.rtl]}>
      <Metric label={translate(locale, "teaching.completed")} value={summary.lessonCompleted} locale={locale}/>
      <Metric label={translate(locale, "teaching.planned")} value={summary.lessonPlanned} locale={locale}/>
      <Metric label={translate(locale, "teaching.postponed")} value={summary.lessonPostponed} locale={locale}/>
    </View>;
  }
  return (
    <View style={styles.stack} testID="teacher-teaching-workspace">
      <View style={[styles.tabs, rtl && styles.rtl]} accessibilityRole="tablist">
        {menus.map(([id, label, icon]) => (
          <Pressable key={id} accessibilityRole="tab" accessibilityLabel={translate(locale, label)}
            accessibilityState={{ selected: section === id }} onPress={() => setSection(id)}
            style={[styles.tab, section === id && styles.activeTab]}>
            <Ionicons name={icon} size={19} color={section === id ? tokens.color.brandStrong : tokens.color.textMuted}/>
            <Text style={[styles.tabText, section === id && styles.tabTextActive]}>{translate(locale, label)}</Text>
          </Pressable>
        ))}
      </View>
      {!ready ? <ActivityIndicator color={tokens.color.brand} /> :
      !view ? <Pressable accessibilityRole="button" onPress={() => setRefresh((x) => x + 1)} style={styles.card}>
        <Text style={styles.actionText}>{translate(locale, "action.retry")}</Text>
      </Pressable> : (
        <>
          {section === "LESSONS" ? (
            <>
              <View style={styles.card}>
                <Text style={[styles.title, textDirection]}>
                  {translate(locale, editId ? "teaching.editLesson" : "teaching.newLesson")}
                </Text>
                <HomeworkDueDatePicker value={lessonDate} onChange={setLessonDate}
                  locale={locale} textDirection={textDirection} disabled={busy} />
                <TextInput value={topic} onChangeText={setTopic} style={[styles.input, textDirection]}
                  placeholder={translate(locale, "teaching.topic")} editable={!busy} maxLength={160}/>
                <TextInput value={objective} onChangeText={setObjective} multiline
                  style={[styles.input, styles.multi, textDirection]}
                  placeholder={translate(locale, "teaching.objective")} editable={!busy} maxLength={4000}/>
                <TextInput value={materials} onChangeText={setMaterials}
                  style={[styles.input, textDirection]} editable={!busy} maxLength={500}
                  placeholder={translate(locale, "teaching.materials")} />
                <TextInput value={notes} onChangeText={setNotes} multiline
                  style={[styles.input, styles.multi, textDirection]} editable={!busy} maxLength={4000}
                  placeholder={translate(locale, "teaching.notes")} />
                {view.units.length > 0 ? (
                  <>
                    <Text style={[styles.label, textDirection]}>{translate(locale, "teaching.relatedUnit")}</Text>
                    <View style={[styles.chips, rtl && styles.rtl]}>
                      <Pressable style={[styles.chip, !unitId && styles.selected]} onPress={() => setUnitId(null)}>
                        <Text style={styles.chipText}>{translate(locale, "teaching.noUnit")}</Text>
                      </Pressable>
                      {view.units.map(({unit})=>(
                        <Pressable key={unit.id} style={[styles.chip, unitId === unit.id && styles.selected]}
                          onPress={()=>setUnitId(unit.id)}>
                          <Text style={styles.chipText}>{unit.sortOrder}. {unit.title}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}
                <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary, busy && styles.dim]}
                  onPress={() => void saveLesson()}>
                  <Text style={styles.primaryText}>{translate(locale, "teaching.saveLesson")}</Text>
                </Pressable>
                {editId ? <Pressable accessibilityRole="button" onPress={clearForm}>
                  <Text style={styles.actionText}>{translate(locale, "teaching.cancelEdit")}</Text>
                </Pressable> : null}
              </View>
              <View style={styles.card}>
                <Text style={[styles.title, textDirection]}>{translate(locale, "teaching.lessons")}</Text>
                {statistics(view.summary)}
                {view.lessons.map((lesson) => (
                  <View key={lesson.id} style={styles.item}>
                    <Text style={[styles.itemTitle, textDirection]}>{lesson.topic}</Text>
                    <Text style={[styles.muted, textDirection]}>{formatLocalizedDate(lesson.lessonDate, locale)}</Text>
                    <Text style={[styles.body, textDirection]}>{lesson.objective}</Text>
                    {lesson.notes ? <Text style={[styles.muted, textDirection]}>{lesson.notes}</Text> : null}
                    <View style={[styles.chips, rtl && styles.rtl]}>
                      {lessonStates.map(status => (
                        <Pressable key={status} accessibilityRole="button"
                          accessibilityState={{selected:lesson.status===status}} disabled={busy}
                          onPress={() => void setLessonState(lesson, status)}
                          style={[styles.chip, lesson.status === status && styles.selected]}>
                          <Text style={styles.chipText}>{translate(locale, lessonKey[status])}</Text>
                        </Pressable>
                      ))}
                      <Pressable accessibilityRole="button" onPress={() => editLesson(lesson)} style={styles.chip}>
                        <Text style={styles.actionText}>{translate(locale, "teaching.editLesson")}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
                {!view.lessons.length ? <Text style={[styles.muted, textDirection]}>
                  {translate(locale, "teaching.noLessons")}
                </Text> : null}
              </View>
            </>
          ) : null}
          {section === "CURRICULUM" ? (
            <View style={styles.card}>
              <Text style={[styles.title, textDirection]}>{translate(locale, "teaching.curriculum")}</Text>
              <Text style={[styles.muted, textDirection]}>{translate(locale, "teaching.curriculumHint")}</Text>
              <Text style={[styles.label, textDirection]}>
                {formatLocalizedNumber(view.summary.unitsCompleted,locale)} / {formatLocalizedNumber(view.summary.unitsTotal,locale)}
                {" "}{translate(locale,"teaching.unitsComplete")}
              </Text>
              {view.units.map(({ unit, status })=> (
                <View style={styles.item} key={unit.id}>
                  <Text style={[styles.itemTitle, textDirection]}>{unit.sortOrder}. {unit.title}</Text>
                  <View style={[styles.chips, rtl && styles.rtl]}>
                    {unitStates.map(next=>(
                      <Pressable accessibilityRole="button" key={next} disabled={busy}
                        accessibilityState={{selected:next===status}} onPress={()=>void setUnitState(unit.id,next)}
                        style={[styles.chip, status===next && styles.selected]}>
                        <Text style={styles.chipText}>{translate(locale,unitKey[next])}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
              {!view.units.length ? <Text style={[styles.muted, textDirection]}>
                {translate(locale, "teaching.noUnits")}
              </Text> : null}
            </View>
          ) : null}
          {section === "REPORT" ? (
            <View style={styles.card}>
              <Text style={[styles.title, textDirection]}>{translate(locale, "teaching.report")}</Text>
              <Text style={[styles.muted, textDirection]}>{translate(locale, "teaching.reportHint")}</Text>
              <Text style={[styles.label, textDirection]}>{translate(locale, "teaching.from")}</Text>
              <HomeworkDueDatePicker value={from} onChange={setFrom} locale={locale} textDirection={textDirection} />
              <Text style={[styles.label, textDirection]}>{translate(locale, "teaching.to")}</Text>
              <HomeworkDueDatePicker value={to} onChange={setTo} locale={locale} textDirection={textDirection} />
              <Pressable accessibilityRole="button" disabled={reportBusy} onPress={() => void loadReport()}
                style={[styles.primary, reportBusy && styles.dim]}>
                <Text style={styles.primaryText}>{translate(locale, "teaching.generateReport")}</Text>
              </Pressable>
              {reportBusy ? <ActivityIndicator color={tokens.color.brand} /> : null}
              {report ? (
                <>
                  {statistics(report.summary)}
                  <View style={[styles.metrics,rtl&&styles.rtl]}>
                    <Metric label={translate(locale,"teaching.unitsComplete")} value={report.summary.unitsCompleted} locale={locale}/>
                    <Metric label={translate(locale,"teaching.homeworkPublished")} value={report.summary.homeworksPublished} locale={locale}/>
                    <Metric label={translate(locale,"teaching.assessments")} value={report.summary.assessmentCount} locale={locale}/>
                  </View>
                  <Text style={[styles.muted,textDirection]}>{translate(locale,"teaching.progressAsOfToday")}</Text>
                  {report.lessons.map(lesson=>(
                    <View style={styles.item} key={lesson.id}>
                      <Text style={[styles.itemTitle,textDirection]}>{lesson.topic}</Text>
                      <Text style={[styles.muted,textDirection]}>
                        {formatLocalizedDate(lesson.lessonDate,locale)} · {translate(locale,lessonKey[lesson.status])}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles=StyleSheet.create({
  stack:{gap:13}, rtl:{flexDirection:"row-reverse"},
  tabs:{flexDirection:"row",gap:7},
  tab:{flex:1,minHeight:56,borderWidth:1,borderColor:"#dfe7f2",borderRadius:13,
    backgroundColor:"#fff",alignItems:"center",justifyContent:"center",gap:5,padding:7},
  activeTab:{backgroundColor:"#eaf2ff",borderColor:"#9cbdf0"},
  tabText:{fontSize:11,color:tokens.color.textMuted,fontWeight:"800",textAlign:"center"},
  tabTextActive:{color:tokens.color.brandStrong},
  card:{backgroundColor:"#fff",padding:15,borderRadius:18,borderWidth:1,borderColor:"#e0e7f0",gap:12},
  title:{color:tokens.color.text,fontSize:16,fontWeight:"900"},
  label:{color:tokens.color.text,fontSize:13,fontWeight:"800"},
  input:{minHeight:48,borderColor:"#dbe3ee",borderWidth:1,borderRadius:12,
    paddingHorizontal:12,paddingVertical:10,fontSize:14,color:tokens.color.text,backgroundColor:"#fbfcff"},
  multi:{minHeight:86,textAlignVertical:"top"},
  muted:{color:tokens.color.textMuted,fontSize:12.5,lineHeight:19},
  body:{color:tokens.color.text,fontSize:13.5,lineHeight:20},
  item:{paddingTop:13,borderTopWidth:1,borderTopColor:"#edf1f6",gap:8},
  itemTitle:{color:tokens.color.text,fontSize:15,fontWeight:"900"},
  chips:{flexDirection:"row",flexWrap:"wrap",gap:7},
  chip:{minHeight:42,paddingHorizontal:11,paddingVertical:9,borderRadius:11,
    borderWidth:1,borderColor:"#dce6f2",backgroundColor:"#f8fafc",justifyContent:"center"},
  selected:{borderColor:"#94bbe7",backgroundColor:"#e1f0ff"},
  chipText:{color:tokens.color.text,fontSize:12,fontWeight:"700"},
  primary:{borderRadius:12,backgroundColor:tokens.color.brand,minHeight:48,
    alignItems:"center",justifyContent:"center",paddingHorizontal:13},
  primaryText:{color:"#fff",fontWeight:"900",fontSize:14},
  dim:{opacity:0.55},actionText:{color:tokens.color.brandStrong,fontWeight:"800",fontSize:13},
  metrics:{flexDirection:"row",gap:7},
  metric:{flex:1,backgroundColor:"#eff5ff",borderRadius:12,padding:10,alignItems:"center",gap:4},
  metricValue:{fontSize:19,fontWeight:"900",color:tokens.color.brandStrong},
  metricLabel:{fontSize:10.5,fontWeight:"700",color:tokens.color.textMuted,textAlign:"center"}
});
