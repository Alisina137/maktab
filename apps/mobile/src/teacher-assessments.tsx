import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate, formatLocalizedNumber, getDirection, translate,
  type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import { api, type ContinuousAssessmentPayload, type ContinuousAssessmentSheetPayload } from "./api";
import { HomeworkDueDatePicker } from "./homework-date-picker";
import { appErrorFromCause, type AppErrorKind } from "./error-message";
import {
  teacherAssessmentChanges, teacherAssessmentDateValid, teacherAssessmentDirectory,
  teacherAssessmentDrafts, teacherAssessmentStudents, teacherAssessmentSummary,
  type AssessmentCategoryFilter, type AssessmentScoreDraft
} from "./teacher-grading-model";

const categories: ContinuousAssessmentPayload["category"][] =
  ["QUIZ","CLASSWORK","HOMEWORK","PARTICIPATION","MONTHLY"];
const categoryLabel=(category:ContinuousAssessmentPayload["category"]):TranslationKey =>
  ("learning.category"+category) as TranslationKey;
type Direction={textAlign:"right"|"left";writingDirection:"rtl"|"ltr"};
type MetricProps={title:string;value:string};
function Metric({title,value}:MetricProps){
  return <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{title}</Text>
  </View>;
}

/** Continuous assessments remain distinct from official exam grades.
 * Only assignment-specific, server-authorized assessments can be edited. */
export function TeacherContinuousAssessmentPanel({
  accessToken,assignmentId,locale,textDirection,onError,onNotice
}:{
  accessToken:string;assignmentId:string;locale:SupportedLocale;textDirection:Direction;
  onError:(key:TranslationKey|null,kind?:AppErrorKind)=>void;
  onNotice:(text:string|null)=>void;
}){
  const rtl=getDirection(locale)==="rtl";
  const generation=useRef(0);
  const sheetGeneration=useRef(0);
  const [assessments,setAssessments]=useState<ContinuousAssessmentPayload[]>([]);
  const [sheet,setSheet]=useState<ContinuousAssessmentSheetPayload|null>(null);
  const [draft,setDraft]=useState<AssessmentScoreDraft>({scores:{},remarks:{}});
  const [title,setTitle]=useState("");
  const [category,setCategory]=useState<ContinuousAssessmentPayload["category"]>("QUIZ");
  const [maximum,setMaximum]=useState("10");
  const [date,setDate]=useState("");
  const [busy,setBusy]=useState(false);
  const [ready,setReady]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const [search,setSearch]=useState("");
  const [categoryFilter,setCategoryFilter]=useState<AssessmentCategoryFilter>("ALL");
  const [studentSearch,setStudentSearch]=useState("");
  const [missingOnly,setMissingOnly]=useState(false);

  useEffect(()=>{
    const id=++generation.current;
    sheetGeneration.current++;
    setSheet(null);setDraft({scores:{},remarks:{}});
    setAssessments([]);setReady(false);
    setSearch("");setCategoryFilter("ALL");
    setStudentSearch("");setMissingOnly(false);
    setBusy(false);
    if(!assignmentId){setReady(true);return()=>{generation.current++;sheetGeneration.current++;};}
    void api.teacherAssessments(accessToken,assignmentId)
      .then(result=>{if(id===generation.current)
        setAssessments(result.assessments.filter(item=>item.assignmentId===assignmentId));})
      .catch((cause:unknown)=>{if(id===generation.current){
        const failure=appErrorFromCause(cause);onError(failure.key,failure.kind);}})
      .finally(()=>{if(id===generation.current)setReady(true);});
    return()=>{generation.current++;sheetGeneration.current++;};
  },[accessToken,assignmentId,refresh]);

  const filtered=useMemo(()=>teacherAssessmentDirectory(assessments,assignmentId,categoryFilter,search),
    [assessments,assignmentId,categoryFilter,search]);
  const overview=sheet?teacherAssessmentSummary(sheet,draft):null;
  const students=sheet?teacherAssessmentStudents(sheet,studentSearch,missingOnly):[];
  const changed=overview?.pendingChanges??0;
  const hasUnsaved=Boolean(overview&&(overview.invalidDrafts||changed>0));
  const format=(num:number|null)=>num===null?"—":formatLocalizedNumber(num,locale);

  async function create(){
    const max=Number(maximum);
    if(!assignmentId||title.trim().length<2||title.trim().length>160||
      !Number.isSafeInteger(max)||max<1||max>10_000||
      !teacherAssessmentDateValid(date)){
      onError("learning.assessmentInvalid");return;
    }
    if(busy)return;
    setBusy(true);
    const id=generation.current;
    try{
      const created=await api.createTeacherAssessment(accessToken,{
        assignmentId,title:title.trim(),category,maxScore:max,assessedOn:date
      });
      if(id!==generation.current)return;
      if(created.assessment.assignmentId!==assignmentId)throw Error("Assessment scope changed.");
      setTitle("");setDate("");setRefresh(value=>value+1);
      onNotice(translate(locale,"learning.assessmentCreated"));
    }catch(cause){
      if(id!==generation.current)return;
      const failure=appErrorFromCause(cause);onError(failure.key,failure.kind);
    }finally{if(id===generation.current)setBusy(false);}
  }

  function requestSelect(id:string){
    if(busy||sheet?.assessment.id===id)return;
    if(!assessments.some(item=>item.id===id&&item.assignmentId===assignmentId))return;
    if(hasUnsaved){
      Alert.alert(translate(locale,"teacher.gradeUnsavedTitle"),
        translate(locale,"teacher.gradeUnsavedHint"),[
          {text:translate(locale,"attendance.cancel"),style:"cancel"},
          {text:translate(locale,"teacher.gradeDiscard"),style:"destructive",
            onPress:()=>void select(id)}
        ]);
      return;
    }
    void select(id);
  }
  async function select(id:string){
    const request=++sheetGeneration.current;
    const identity=generation.current;
    setBusy(true);setSheet(null);setDraft({scores:{},remarks:{}});
    setStudentSearch("");setMissingOnly(false);
    try{
      const result=await api.teacherAssessmentSheet(accessToken,id);
      if(request!==sheetGeneration.current||identity!==generation.current)return;
      if(result.assessment.id!==id||result.assessment.assignmentId!==assignmentId)
        throw Error("Assessment scope changed.");
      setSheet(result);setDraft(teacherAssessmentDrafts(result));
    }catch(cause){
      if(request!==sheetGeneration.current||identity!==generation.current)return;
      const failure=appErrorFromCause(cause);onError(failure.key,failure.kind);
    }finally{if(request===sheetGeneration.current&&identity===generation.current)setBusy(false);}
  }

  async function save(){
    if(!sheet||busy||sheet.assessment.assignmentId!==assignmentId)return;
    const update=teacherAssessmentChanges(sheet,draft);
    if(update.invalid){onError("learning.validScores");return;}
    if(!update.entries.length){onNotice(translate(locale,"learning.noGradeChanges"));return;}
    setBusy(true);
    const identity=generation.current,request=sheetGeneration.current;
    try{
      const next=await api.saveTeacherAssessmentScores(
        accessToken,sheet.assessment.id,update.entries);
      if(identity!==generation.current||request!==sheetGeneration.current)return;
      if(next.assessment.id!==sheet.assessment.id||
        next.assessment.assignmentId!==assignmentId)throw Error("Assessment scope changed.");
      setSheet(next);setDraft(teacherAssessmentDrafts(next));
      onNotice(translate(locale,"learning.assessmentSaved"));
    }catch(cause){
      if(identity!==generation.current||request!==sheetGeneration.current)return;
      const failure=appErrorFromCause(cause);onError(failure.key,failure.kind);
    }finally{if(identity===generation.current&&request===sheetGeneration.current)setBusy(false);}
  }

  return <View style={styles.stack} testID="teacher-continuous-assessment">
    <View style={styles.card}>
      <View style={[styles.row,rtl&&styles.rtl]}>
        <Ionicons name="school-outline" size={21} color={tokens.color.brandStrong}/>
        <View style={styles.flex}>
          <Text style={[styles.title,textDirection]}>{translate(locale,"learning.continuousAssessments")}</Text>
          <Text style={[styles.hint,textDirection]}>{translate(locale,"learning.assessmentHint")}</Text>
        </View>
      </View>
      {!assignmentId?<Text style={[styles.hint,textDirection]}>{translate(locale,"learning.noAssignments")}</Text>:<>
        <Text style={[styles.heading,textDirection]}>{translate(locale,"learning.createAssessment")}</Text>
        <TextInput testID="teacher-assessment-title" value={title} maxLength={160}
          onChangeText={setTitle} placeholder={translate(locale,"learning.assessmentTitle")}
          style={[styles.input,textDirection]} editable={!busy}/>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chips,rtl&&styles.rtl]}>
          {categories.map(next=><Pressable key={next} accessibilityRole="tab"
            accessibilityState={{selected:category===next}} onPress={()=>setCategory(next)}
            disabled={busy} style={[styles.chip,category===next&&styles.selected]}>
            <Text style={[styles.chipText,category===next&&styles.activeText]}>
              {translate(locale,categoryLabel(next))}
            </Text>
          </Pressable>)}
        </ScrollView>
        <TextInput keyboardType="number-pad" maxLength={5} editable={!busy}
          value={maximum} onChangeText={setMaximum}
          placeholder={translate(locale,"learning.maxScore")} style={[styles.input,textDirection]}/>
        <HomeworkDueDatePicker value={date} onChange={setDate} locale={locale}
          textDirection={textDirection} disabled={busy}/>
        <Pressable accessibilityRole="button" disabled={busy} style={[styles.primary,busy&&styles.dim]}
          onPress={()=>void create()}>
          <Text style={styles.primaryText}>{translate(locale,"learning.createAssessment")}</Text>
        </Pressable>
      </>}
    </View>
    {assignmentId?<View style={styles.card}>
      <View style={[styles.row,rtl&&styles.rtl]}>
        <Text style={[styles.heading,styles.flex,textDirection]}>
          {translate(locale,"learning.assessmentList")} · {formatLocalizedNumber(assessments.length,locale)}
        </Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setRefresh(value=>value+1)}>
          <Ionicons name="refresh-outline" size={22} color={tokens.color.brandStrong}/>
        </Pressable>
      </View>
      <TextInput testID="teacher-assessment-search" value={search} onChangeText={setSearch}
        placeholder={translate(locale,"teacher.gradeSearchAssessments")}
        style={[styles.input,textDirection]} autoCapitalize="none"/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.chips,rtl&&styles.rtl]}>
        {(["ALL",...categories] as AssessmentCategoryFilter[]).map(next=>
          <Pressable key={next} accessibilityRole="tab"
            accessibilityState={{selected:categoryFilter===next}}
            onPress={()=>setCategoryFilter(next)}
            style={[styles.chip,categoryFilter===next&&styles.selected]}>
            <Text style={[styles.chipText,categoryFilter===next&&styles.activeText]}>
              {next==="ALL"?translate(locale,"teacher.classFilterAll"):
                translate(locale,categoryLabel(next))}
            </Text>
          </Pressable>)}
      </ScrollView>
      {!ready?<ActivityIndicator color={tokens.color.brandStrong}/>:null}
      {ready&&!filtered.length?<Text style={[styles.hint,textDirection]}>
        {translate(locale,assessments.length?"teacher.gradeNoAssessmentsMatch":"learning.noAssessments")}
      </Text>:null}
      {filtered.map(item=><Pressable key={item.id} accessibilityRole="button"
        testID={`teacher-assessment-${item.id}`}
        disabled={busy} onPress={()=>requestSelect(item.id)}
        style={[styles.entry,sheet?.assessment.id===item.id&&styles.selected]}>
        <View style={[styles.row,rtl&&styles.rtl]}>
          <View style={styles.flex}>
            <Text style={[styles.entryTitle,textDirection]}>{item.title}</Text>
            <Text style={[styles.hint,textDirection]}>
              {formatLocalizedDate(item.assessedOn,locale)} · {translate(locale,categoryLabel(item.category))}
              {" · "}{translate(locale,"learning.maxScore")} {formatLocalizedNumber(item.maxScore,locale)}
            </Text>
          </View>
          <Ionicons name={sheet?.assessment.id===item.id?"checkmark-circle-outline":"chevron-forward-outline"}
            size={20} color={tokens.color.brandStrong}/>
        </View>
      </Pressable>)}
    </View>:null}
    {sheet?<View style={styles.card} testID="teacher-assessment-sheet">
      <Text style={[styles.title,textDirection]}>{sheet.assessment.title}</Text>
      <Text style={[styles.hint,textDirection]}>{translate(locale,"teacher.gradePrivateDraft")}</Text>
      <View style={[styles.metrics,rtl&&styles.rtl]}>
        <Metric title={translate(locale,"teacher.gradeRecorded")} value={format(overview?.recorded??null)}/>
        <Metric title={translate(locale,"teacher.gradeMissing")} value={format(overview?.missing??null)}/>
        <Metric title={translate(locale,"teacher.gradeAverage")}
          value={overview?.averagePercent==null?"—":`${format(overview.averagePercent)}%`}/>
      </View>
      <View style={[styles.row,rtl&&styles.rtl]}>
        <Text style={[styles.hint,styles.flex,textDirection]}>
          {translate(locale,"teacher.gradeUnsaved")}: {format(overview?.pendingChanges??null)}
        </Text>
        {overview?.invalidDrafts?<Text style={styles.warning}>
          {translate(locale,"teacher.gradeInvalidDraft")}
        </Text>:null}
      </View>
      <TextInput testID="teacher-assessment-student-search"
        value={studentSearch} onChangeText={setStudentSearch}
        placeholder={translate(locale,"learning.searchStudents")}
        style={[styles.input,textDirection]} autoCapitalize="none"/>
      <Pressable accessibilityRole="button" accessibilityState={{selected:missingOnly}}
        style={[styles.chip,missingOnly&&styles.selected,styles.inline]}
        onPress={()=>setMissingOnly(value=>!value)}>
        <Text style={[styles.chipText,missingOnly&&styles.activeText]}>
          {translate(locale,missingOnly?"learning.showAllStudents":"learning.showMissingOnly")}
        </Text>
      </Pressable>
      <Text style={[styles.hint,textDirection]}>
        {formatLocalizedNumber(students.length,locale)} / {format(overview?.total??null)}
      </Text>
      {students.map(row=><View key={row.student.id} style={styles.student}>
        <View style={[styles.row,rtl&&styles.rtl]}>
          <View style={styles.flex}>
            <Text style={[styles.entryTitle,textDirection]}>{row.student.fullName}</Text>
            <Text style={[styles.hint,textDirection]}>{row.student.studentCode}</Text>
          </View>
          <Text style={styles.status}>{translate(locale,row.score?"learning.markRecorded":"learning.markMissing")}</Text>
        </View>
        <View style={[styles.fields,rtl&&styles.rtl]}>
          <TextInput keyboardType="number-pad" maxLength={String(sheet.assessment.maxScore).length}
            editable={!busy} testID={`teacher-assessment-mark-${row.student.id}`}
            value={draft.scores[row.student.id]??""}
            onChangeText={value=>setDraft(current=>({
              ...current,scores:{...current.scores,[row.student.id]:value}
            }))}
            placeholder={translate(locale,"learning.score")} style={[styles.input,styles.flex,textDirection]}/>
          <TextInput maxLength={500} editable={!busy} value={draft.remarks[row.student.id]??""}
            onChangeText={value=>setDraft(current=>({
              ...current,remarks:{...current.remarks,[row.student.id]:value}
            }))}
            placeholder={translate(locale,"learning.remark")} style={[styles.input,styles.flex,textDirection]}/>
        </View>
      </View>)}
      {!students.length?<Text style={[styles.hint,textDirection]}>
        {translate(locale,"learning.noMatchingStudents")}
      </Text>:null}
      <Pressable accessibilityRole="button" disabled={busy||!hasUnsaved}
        style={[styles.primary,(busy||!hasUnsaved)&&styles.dim]} onPress={()=>void save()}>
        <Text style={styles.primaryText}>
          {translate(locale,"learning.saveMarks")}{overview?.pendingChanges
            ?` · ${format(overview.pendingChanges)}`:""}
        </Text>
      </Pressable>
    </View>:null}
    {busy?<ActivityIndicator color={tokens.color.brandStrong}/>:null}
  </View>;
}
const styles=StyleSheet.create({
  stack:{gap:13},card:{padding:15,borderRadius:18,borderWidth:1,
    borderColor:"#e0e8f4",backgroundColor:"#fff",gap:11},
  row:{flexDirection:"row",alignItems:"center",gap:9},rtl:{flexDirection:"row-reverse"},
  flex:{flex:1,minWidth:0},inline:{alignSelf:"flex-start"},dim:{opacity:0.5},
  title:{fontSize:16,fontWeight:"900",color:tokens.color.text},
  heading:{fontSize:14,fontWeight:"850",color:tokens.color.text},
  entryTitle:{fontSize:13.5,fontWeight:"800",color:tokens.color.text},
  hint:{fontSize:12.5,color:tokens.color.textMuted,lineHeight:19},
  input:{backgroundColor:"#f8faff",borderWidth:1,borderColor:"#d9e3f0",
    borderRadius:12,padding:11,minHeight:46,fontSize:13,color:tokens.color.text},
  chips:{flexDirection:"row",gap:7,paddingBottom:3},
  chip:{paddingVertical:9,paddingHorizontal:12,minHeight:40,borderWidth:1,
    borderColor:"#d9e3f0",borderRadius:11,backgroundColor:"#fff",justifyContent:"center"},
  selected:{borderColor:tokens.color.brandStrong,backgroundColor:"#eaf2ff"},
  chipText:{color:tokens.color.text,fontSize:12,fontWeight:"700"},
  activeText:{color:tokens.color.brandStrong,fontWeight:"900"},
  primary:{backgroundColor:tokens.color.brandStrong,borderRadius:12,padding:13,
    minHeight:48,alignItems:"center",justifyContent:"center"},
  primaryText:{color:"#fff",fontSize:13,fontWeight:"900"},
  entry:{padding:12,borderRadius:12,borderWidth:1,borderColor:"#e4ebf5",
    backgroundColor:"#fbfcff",gap:5},
  metrics:{flexDirection:"row",flexWrap:"wrap",gap:7},
  metric:{flexGrow:1,minWidth:"29%",backgroundColor:"#f0f5ff",borderRadius:12,
    padding:9,alignItems:"center",gap:5},
  metricValue:{fontSize:19,fontWeight:"900",color:tokens.color.brandStrong},
  metricLabel:{fontSize:11,color:tokens.color.textMuted,fontWeight:"700",textAlign:"center"},
  student:{gap:8,borderTopWidth:1,borderTopColor:"#edf0f6",paddingTop:10},
  fields:{flexDirection:"row",gap:8},status:{fontSize:11,fontWeight:"800",color:tokens.color.brandStrong},
  warning:{fontSize:11,color:"#ad4033",fontWeight:"800"}
});
