import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { tokens } from "@maktablink/design-tokens";
import { getDirection, translate, type SupportedLocale } from "@maktablink/localization";
import { api, type ContinuousAssessmentPayload, type ContinuousAssessmentSheetPayload } from "./api";
import { HomeworkDueDatePicker } from "./homework-date-picker";
import { appErrorFromCause, type AppErrorKind } from "./error-message";
import type { TranslationKey } from "@maktablink/localization";

const categories: ContinuousAssessmentPayload["category"][] =
  ["QUIZ", "CLASSWORK", "HOMEWORK", "PARTICIPATION", "MONTHLY"];
type Direction = { textAlign: "right" | "left"; writingDirection: "rtl" | "ltr" };
export function TeacherContinuousAssessmentPanel({
  accessToken, assignmentId, locale, textDirection, onError, onNotice
}: {
  accessToken: string; assignmentId: string; locale: SupportedLocale;
  textDirection: Direction;
  onError: (key: TranslationKey | null, kind?: AppErrorKind) => void;
  onNotice: (text: string | null) => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const [assessments, setAssessments] = useState<ContinuousAssessmentPayload[]>([]);
  const [sheet, setSheet] = useState<ContinuousAssessmentSheetPayload | null>(null);
  const [marks, setMarks] = useState<Record<string,string>>({});
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ContinuousAssessmentPayload["category"]>("QUIZ");
  const [maximum, setMaximum] = useState("10");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setSheet(null);
    if (!assignmentId) { setAssessments([]); return; }
    void api.teacherAssessments(accessToken, assignmentId).then(result => {
      if (active) setAssessments(result.assessments);
    }).catch((err: unknown) => {
      if (active) { const failure = appErrorFromCause(err); onError(failure.key, failure.kind); }
    });
    return () => { active = false; };
  }, [accessToken, assignmentId, refresh]);

  async function create() {
    if (!title.trim() || !date || !Number.isInteger(Number(maximum)) ||
      Number(maximum) < 1 || Number(maximum) > 10_000) {
      onError("learning.assessmentInvalid"); return;
    }
    setBusy(true);
    try {
      await api.createTeacherAssessment(accessToken, {
        assignmentId, title: title.trim(), category,
        maxScore: Number(maximum), assessedOn: date
      });
      setTitle("");setDate("");setRefresh(i=>i+1);
      onNotice(translate(locale,"learning.assessmentCreated"));
    } catch(e) {
      const failure=appErrorFromCause(e);onError(failure.key,failure.kind);
    } finally { setBusy(false); }
  }
  async function select(id: string) {
    setBusy(true);
    try {
      const result = await api.teacherAssessmentSheet(accessToken, id);
      setSheet(result);
      setMarks(Object.fromEntries(result.students.map(row => [row.student.id,
        row.score ? String(row.score.score) : ""])));
    } catch(e) {const failure=appErrorFromCause(e);onError(failure.key,failure.kind);}
    finally{setBusy(false);}
  }
  async function save() {
    if (!sheet) return;
    const entries: Array<{studentId:string;score:number}> = [];
    for (const row of sheet.students) {
      const raw=(marks[row.student.id]??"").trim();
      if (!raw) continue;
      if (!/^\d+$/.test(raw) || Number(raw) > sheet.assessment.maxScore) {
        onError("learning.validScores");return;
      }
      if (row.score?.score !== Number(raw)) entries.push({studentId:row.student.id,score:Number(raw)});
    }
    if(!entries.length){onNotice(translate(locale,"learning.noGradeChanges"));return;}
    setBusy(true);
    try {
      const result=await api.saveTeacherAssessmentScores(accessToken,sheet.assessment.id,entries);
      setSheet(result);
      onNotice(translate(locale,"learning.assessmentSaved"));
    }catch(e){const failure=appErrorFromCause(e);onError(failure.key,failure.kind);}
    finally{setBusy(false);}
  }
  return (
    <View style={styles.card} testID="teacher-continuous-assessment">
      <Text style={[styles.title,textDirection]}>{translate(locale,"learning.continuousAssessments")}</Text>
      <Text style={[styles.muted,textDirection]}>{translate(locale,"learning.assessmentHint")}</Text>
      {!assignmentId ? <Text style={[styles.muted,textDirection]}>{translate(locale,"learning.noAssignments")}</Text> : (
        <>
          <TextInput value={title} onChangeText={setTitle} placeholder={translate(locale,"learning.assessmentTitle")}
            style={[styles.input,textDirection]} editable={!busy} />
          <View style={[styles.chips,rtl&&styles.rowRtl]}>
            {categories.map(key => (
              <Pressable accessibilityRole="button" accessibilityState={{selected:category===key}}
                onPress={()=>setCategory(key)} key={key} style={[styles.chip,category===key&&styles.selected]}>
                <Text style={styles.chipText}>{translate(locale,("learning.category"+key) as TranslationKey)}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput keyboardType="number-pad" value={maximum} onChangeText={setMaximum}
            placeholder={translate(locale,"learning.maxScore")} style={[styles.input,textDirection]} />
          <HomeworkDueDatePicker value={date} onChange={setDate} locale={locale} textDirection={textDirection} disabled={busy}/>
          <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={()=>void create()}>
            <Text style={styles.buttonText}>{translate(locale,"learning.createAssessment")}</Text>
          </Pressable>
          <Text style={[styles.title,textDirection]}>{translate(locale,"learning.assessmentList")}</Text>
          {assessments.map(item=>(
            <Pressable key={item.id} accessibilityRole="button" onPress={()=>void select(item.id)}
              style={[styles.entry,sheet?.assessment.id===item.id&&styles.selected]}>
              <Text style={[styles.entryTitle,textDirection]}>{item.title}</Text>
              <Text style={[styles.muted,textDirection]}>{item.assessedOn} · {item.category} · {item.maxScore}</Text>
            </Pressable>
          ))}
          {!assessments.length && <Text style={[styles.muted,textDirection]}>{translate(locale,"learning.noAssessments")}</Text>}
          {busy && <ActivityIndicator color={tokens.color.brandStrong}/>}
          {sheet && (
            <View style={styles.stack}>
              <Text style={[styles.title,textDirection]}>{sheet.assessment.title}</Text>
              {sheet.students.map(row=>(
                <View key={row.student.id} style={[styles.student,rtl&&styles.rowRtl]}>
                  <View style={styles.flex}>
                    <Text style={[styles.entryTitle,textDirection]}>{row.student.fullName}</Text>
                    <Text style={[styles.muted,textDirection]}>{row.student.studentCode}</Text>
                  </View>
                  <TextInput keyboardType="number-pad" editable={!busy}
                    value={marks[row.student.id]??""}
                    onChangeText={value=>setMarks(current=>({...current,[row.student.id]:value}))}
                    style={styles.score} placeholder={"0–"+sheet.assessment.maxScore}/>
                </View>
              ))}
              <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={()=>void save()}>
                <Text style={styles.buttonText}>{translate(locale,"learning.saveMarks")}</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}
const styles=StyleSheet.create({
  card:{padding:16,borderRadius:18,borderWidth:1,borderColor:"#dfe6f0",backgroundColor:"#fff",gap:12},
  stack:{gap:10},title:{fontSize:16,fontWeight:"800",color:tokens.color.text},
  muted:{fontSize:12,color:tokens.color.textMuted,lineHeight:18},
  input:{backgroundColor:"#f8faff",borderWidth:1,borderColor:"#d9e3f0",borderRadius:12,padding:12,minHeight:48,color:tokens.color.text},
  chips:{flexDirection:"row",flexWrap:"wrap",gap:6},rowRtl:{flexDirection:"row-reverse"},
  chip:{padding:9,minHeight:43,borderWidth:1,borderColor:"#d9e3f0",borderRadius:12},
  selected:{borderColor:tokens.color.brandStrong,backgroundColor:"#eaf2ff"},
  chipText:{color:tokens.color.text,fontSize:12,fontWeight:"700"},
  button:{backgroundColor:tokens.color.brandStrong,borderRadius:12,padding:14,minHeight:48,alignItems:"center",justifyContent:"center"},
  buttonText:{color:"#fff",fontSize:13,fontWeight:"800"},
  entry:{padding:10,borderRadius:12,borderWidth:1,borderColor:"#edf1f6",gap:5},
  entryTitle:{fontSize:13,fontWeight:"700",color:tokens.color.text},
  student:{flexDirection:"row",alignItems:"center",gap:10},flex:{flex:1},score:{width:82,padding:8,minHeight:46,
    borderColor:"#cdd9e9",borderWidth:1,borderRadius:10,textAlign:"center",color:tokens.color.text}
});