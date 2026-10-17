import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate, formatLocalizedNumber, getDirection, translate,
  type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import { api, type HomeworkPayload } from "./api";
import {
  teacherSubmissionOverview, type HomeworkSubmissionEntry, type StudentIdentity,
  type SubmissionFilter
} from "./teacher-homework-model";
import { shareLearningFile } from "./learning-files";
import { appErrorFromCause, type AppErrorKind } from "./error-message";

type Direction = {textAlign:"left"|"right";writingDirection:"ltr"|"rtl"};
const filters: Array<{id:SubmissionFilter;label:TranslationKey}> = [
  {id:"ALL",label:"learning.submissionAll"},
  {id:"SUBMITTED",label:"learning.submissionPending"},
  {id:"REVIEWED",label:"learning.submissionReviewed"},
  {id:"REVISION_REQUESTED",label:"learning.submissionRevision"},
  {id:"MISSING",label:"learning.submissionMissing"}
];
const statusText:Record<"SUBMITTED"|"REVIEWED"|"REVISION_REQUESTED",TranslationKey> = {
  SUBMITTED:"learning.submissionPending",
  REVIEWED:"learning.submissionReviewed",
  REVISION_REQUESTED:"learning.submissionRevision"
};

/** The roster is loaded only after opening a homework's review queue.
 * A missing/failed roster must never be interpreted as zero non-submitters. */
export function TeacherSubmissionReview({
  homework, accessToken, locale, textDirection, onError, onNotice
}: {
  homework: HomeworkPayload; accessToken: string; locale: SupportedLocale;
  textDirection: Direction;
  onError: (key:TranslationKey|null,kind?:AppErrorKind)=>void;
  onNotice:(text:string|null)=>void;
}) {
  const rtl = getDirection(locale)==="rtl";
  const generation=useRef(0);
  const pending=useRef(false);
  const [shown,setShown]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [roster,setRoster]=useState<StudentIdentity[]|null>(null);
  const [items,setItems]=useState<HomeworkSubmissionEntry[]>([]);
  const [feedback,setFeedback]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [filter,setFilter]=useState<SubmissionFilter>("SUBMITTED");
  const [query,setQuery]=useState("");

  useEffect(()=>{
    generation.current += 1;
    pending.current=false;
    setShown(false);setLoaded(false);setRoster(null);setItems([]);
    setFeedback({});setFilter("SUBMITTED");setQuery("");setBusy(false);
    return ()=>{generation.current += 1;};
  },[accessToken,homework.id]);

  async function load(){
    if(pending.current)return;
    pending.current=true;
    const request=++generation.current;
    setBusy(true);
    try{
      const response=await api.teacherHomeworkSubmissions(accessToken,homework.id);
      if(request!==generation.current)return;
      setItems(response.submissions);
      // TeacherClassDetail is assignment- and school-scoped on the server.
      // If it cannot be verified, retain the submitted queue but hide missing counts.
      let activeRoster:StudentIdentity[]|null=null;
      try{
        const detail=await api.teacherClassDetail(accessToken,homework.assignmentId);
        if(detail.assignment.assignmentId===homework.assignmentId &&
          detail.assignment.classId===homework.classId &&
          detail.assignment.subjectId===homework.subjectId &&
          detail.assignment.academicYearId===homework.academicYearId){
          activeRoster=detail.students;
        }
      }catch{ /* Roster is unknown; review of existing submissions remains available. */ }
      if(request!==generation.current)return;
      setRoster(activeRoster);
      setLoaded(true);
      setShown(true);
    }catch(cause){
      if(request!==generation.current)return;
      setLoaded(false);setRoster(null);setItems([]);
      const failure=appErrorFromCause(cause);onError(failure.key,failure.kind);
    }finally{
      if(request===generation.current){pending.current=false;setBusy(false);}
    }
  }

  async function review(entry:HomeworkSubmissionEntry,status:"REVIEWED"|"REVISION_REQUESTED"){
    if(pending.current || homework.status==="ARCHIVED" ||
      entry.submission.status!=="SUBMITTED")return;
    const message=(feedback[entry.submission.id]??"").trim();
    if(!message||message.length>500){onError("learning.feedbackRequired");return;}
    pending.current=true;
    const request=generation.current;
    setBusy(true);
    try{
      const response=await api.reviewHomeworkSubmission(
        accessToken,homework.id,entry.submission.id,status,message
      );
      if(request!==generation.current)return;
      setItems(current=>current.map(item=>
        item.submission.id===entry.submission.id
          ? {...item,submission:response.submission} : item));
      setFeedback(current=>({...current,[entry.submission.id]:""}));
      onNotice(translate(locale,"learning.feedbackSaved"));
    }catch(cause){
      if(request!==generation.current)return;
      const failure=appErrorFromCause(cause);onError(failure.key,failure.kind);
      // Avoid stale review state after a rejected concurrent update.
      if(loaded)void loadAfterFailure();
    }finally{
      if(request===generation.current){pending.current=false;setBusy(false);}
    }
  }

  async function loadAfterFailure(){
    // Refresh only after the current review lock is released.
    setTimeout(()=>{if(!pending.current)void load();},0);
  }
  async function openFile(id:string){
    try{await shareLearningFile(accessToken,id);}
    catch{onError("common.requestFailed");}
  }
  const overview=teacherSubmissionOverview(items,roster,query,filter);
  const count= (value:number|null)=>value===null?"—":formatLocalizedNumber(value,locale);

  return <View style={styles.wrap} testID={`teacher-homework-review-${homework.id}`}>
    <Pressable accessibilityRole="button" disabled={busy}
      onPress={()=>shown?setShown(false):loaded?setShown(true):void load()}
      style={[styles.action,busy&&styles.disabled]}>
      <Text style={styles.actionText}>
        {translate(locale,shown?"learning.hideSubmissions":"learning.reviewSubmissions")}
      </Text>
    </Pressable>
    {busy&&<ActivityIndicator color={tokens.color.brandStrong}/>}
    {shown&&loaded&&<View style={styles.list}>
      <View style={[styles.row,rtl&&styles.rtl]}>
        <Text style={[styles.heading,styles.flex,textDirection]}>
          {translate(locale,"learning.reviewQueue")}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={translate(locale,"learning.submissionRefresh")}
          disabled={busy} onPress={()=>void load()} style={styles.refresh}>
          <Text style={styles.actionText}>{translate(locale,"learning.submissionRefresh")}</Text>
        </Pressable>
      </View>
      <View style={[styles.metrics,rtl&&styles.rtl]}>
        {([
          ["learning.submissionSubmitted",overview.counts.submitted],
          ["learning.submissionPending",overview.counts.pending],
          ["learning.submissionReviewed",overview.counts.reviewed],
          ["learning.submissionRevision",overview.counts.revision],
          ["learning.submissionMissing",overview.counts.missing]
        ] as Array<[TranslationKey,number|null]>).map(([label,value])=>
          <View key={label} style={styles.metric}>
            <Text style={styles.metricNumber}>{count(value)}</Text>
            <Text style={styles.metricLabel}>{translate(locale,label)}</Text>
          </View>)}
      </View>
      {roster===null?<Text style={[styles.hint,textDirection]}>
        {translate(locale,"learning.submissionMissingUnknown")}
      </Text>:null}
      <TextInput testID="teacher-submission-search"
        value={query} onChangeText={setQuery} autoCapitalize="none"
        placeholder={translate(locale,"learning.submissionSearch")}
        accessibilityLabel={translate(locale,"learning.submissionSearch")}
        style={[styles.input,textDirection]}/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.filters,rtl&&styles.rtl]}>
        {filters.map(({id,label})=><Pressable key={id} accessibilityRole="tab"
          accessibilityState={{selected:filter===id,disabled:id==="MISSING"&&roster===null}}
          disabled={id==="MISSING"&&roster===null} onPress={()=>setFilter(id)}
          style={[styles.chip,filter===id&&styles.selected,id==="MISSING"&&roster===null&&styles.disabled]}>
          <Text style={[styles.chipText,filter===id&&styles.selectedText]}>
            {translate(locale,label)}
          </Text>
        </Pressable>)}
      </ScrollView>
      <Text style={[styles.hint,textDirection]}>
        {count(overview.rows.length)} {translate(locale,"learning.studentSubmissions")}
      </Text>
      {!overview.rows.length&&<Text style={[styles.hint,textDirection]}>
        {translate(locale,"learning.submissionNoMatch")}
      </Text>}
      {overview.rows.map(row=><View key={row.student.id} style={styles.item}>
        <View style={[styles.row,rtl&&styles.rtl]}>
          <View style={styles.flex}>
            <Text style={[styles.heading,textDirection]}>{row.student.fullName}</Text>
            <Text style={[styles.hint,textDirection]}>{row.student.studentCode}</Text>
          </View>
          <Text style={styles.status}>
            {translate(locale,row.submission
              ? statusText[row.submission.status]:"learning.submissionMissing")}
          </Text>
        </View>
        {row.submission?<View style={styles.detail}>
          <Text style={[styles.hint,textDirection]}>
            {translate(locale,"learning.submissionSubmitted")}: {formatLocalizedDate(row.submission.submittedAt,locale)}
          </Text>
          <Text style={[styles.body,textDirection]}>{row.submission.answer}</Text>
          {row.submission.attachmentFileId&&<Pressable accessibilityRole="button"
            onPress={()=>void openFile(row.submission!.attachmentFileId!)}>
            <Text style={styles.actionText}>{translate(locale,"learning.openAttachment")}</Text>
          </Pressable>}
          {row.submission.feedback&&<Text style={[styles.body,textDirection]}>
            {translate(locale,"learning.feedback")}: {row.submission.feedback}
          </Text>}
          {homework.status!=="ARCHIVED"&&row.submission.status==="SUBMITTED"&&<View style={styles.detail}>
            <TextInput multiline maxLength={500} editable={!busy}
              value={feedback[row.submission.id]??""}
              onChangeText={value=>setFeedback(prev=>({...prev,[row.submission!.id]:value}))}
              placeholder={translate(locale,"learning.feedback")}
              accessibilityLabel={translate(locale,"learning.feedback")}
              style={[styles.input,styles.feedbackInput,textDirection]}/>
            <View style={[styles.actions,rtl&&styles.rtl]}>
              <Pressable accessibilityRole="button" disabled={busy}
                onPress={()=>void review({submission:row.submission!,student:row.student},"REVIEWED")}
                style={[styles.action,styles.primary,busy&&styles.disabled]}>
                <Text style={styles.primaryText}>{translate(locale,"learning.markReviewed")}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy}
                onPress={()=>void review({submission:row.submission!,student:row.student},"REVISION_REQUESTED")}
                style={[styles.action,busy&&styles.disabled]}>
                <Text style={styles.actionText}>{translate(locale,"learning.requestRevision")}</Text>
              </Pressable>
            </View>
          </View>}
        </View>:<Text style={[styles.hint,textDirection]}>
          {translate(locale,"learning.submissionNotSubmitted")}
        </Text>}
      </View>)}
    </View>}
  </View>;
}
const styles=StyleSheet.create({
  wrap:{gap:8},list:{gap:12,paddingTop:6},detail:{gap:9},
  row:{flexDirection:"row",alignItems:"center",gap:8},rtl:{flexDirection:"row-reverse"},
  flex:{flex:1,minWidth:0},disabled:{opacity:0.45},
  heading:{fontSize:14,fontWeight:"800",color:tokens.color.text},
  body:{fontSize:12.5,color:tokens.color.text,lineHeight:20},
  hint:{fontSize:12,color:tokens.color.textMuted,lineHeight:19},
  action:{minHeight:42,paddingHorizontal:12,paddingVertical:10,borderRadius:11,
    backgroundColor:"#e9f2ff",alignItems:"center",justifyContent:"center"},
  actionText:{color:tokens.color.brandStrong,fontSize:12,fontWeight:"800"},
  primary:{backgroundColor:tokens.color.brand},
  primaryText:{color:"#fff",fontSize:12,fontWeight:"900"},
  refresh:{paddingVertical:8,paddingHorizontal:6},
  input:{borderWidth:1,borderColor:"#d9e2ee",backgroundColor:"#fff",
    minHeight:45,padding:10,borderRadius:11,color:tokens.color.text,fontSize:13},
  feedbackInput:{minHeight:75,textAlignVertical:"top"},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:8},
  item:{padding:13,backgroundColor:"#f6f9fe",borderWidth:1,borderColor:"#e3eaf4",
    borderRadius:14,gap:9},
  status:{fontSize:11,color:tokens.color.brandStrong,fontWeight:"800",maxWidth:"37%"},
  metrics:{flexDirection:"row",flexWrap:"wrap",gap:7},
  metric:{flexGrow:1,minWidth:"30%",backgroundColor:"#f1f6ff",borderRadius:10,
    padding:9,alignItems:"center",gap:4},
  metricNumber:{fontSize:17,fontWeight:"900",color:tokens.color.brandStrong},
  metricLabel:{fontSize:11,color:tokens.color.textMuted,fontWeight:"700",textAlign:"center"},
  filters:{flexDirection:"row",gap:7,paddingBottom:2},
  chip:{minHeight:40,borderRadius:10,paddingHorizontal:11,justifyContent:"center",
    borderWidth:1,borderColor:"#dde6f2",backgroundColor:"#fff"},
  selected:{borderColor:"#9ab9ed",backgroundColor:"#eaf2ff"},
  chipText:{fontSize:12,fontWeight:"700",color:tokens.color.textMuted},
  selectedText:{color:tokens.color.brandStrong,fontWeight:"900"}
});
