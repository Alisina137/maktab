import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { tokens } from "@maktablink/design-tokens";
import { formatLocalizedDate, formatLocalizedNumber, translate, type SupportedLocale, type TranslationKey } from "@maktablink/localization";
import { api, type HomeworkPayload, type HomeworkSubmissionPayload } from "./api";
import { pickAndUploadLearningFile, shareLearningFile } from "./learning-files";
import {
  readStudentHomeworkDraft,writeStudentHomeworkDraft,clearStudentHomeworkDraft,
  studentDraftKey,STUDENT_DRAFT_MAX_CHARS
} from "./student-homework-draft";
import { studentHomeworkCanSubmit, type HomeworkRow } from "./student-homework-model";

export function StudentSubmissionPanel({
  homework, accessToken, locale, textDirection, onSubmitted, row, studentId, submissionsVerified, onRefresh
}: {
  homework: HomeworkPayload; accessToken: string; locale: SupportedLocale;
  textDirection: {textAlign:"right"|"left";writingDirection:"rtl"|"ltr"};
  onSubmitted?: (submission:HomeworkSubmissionPayload)=>void;
  row:HomeworkRow;studentId:string;submissionsVerified:boolean;
  onRefresh?:()=>Promise<boolean>;
}) {
  const [open,setOpen]=useState(false);
  const submission=row.submission;
  const draftKey=useMemo(()=>studentDraftKey(homework.schoolId,studentId,homework.id),
    [homework.schoolId,studentId,homework.id]);
  const [restored,setRestored]=useState(false);
  const [dirty,setDirty]=useState(false);
  const writeQueue=useRef<Promise<void>>(Promise.resolve());
  const submitting=useRef(false);
  const touched=useRef(false);
  const [answer,setAnswer]=useState("");
  const [fileId,setFileId]=useState<string|null>(null);
  const [fileName,setFileName]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<TranslationKey|null>(null);
  const expired = !row.canSubmit;
  const canSubmit=studentHomeworkCanSubmit(row,submissionsVerified);

  useEffect(()=>{
    let active=true;
    touched.current=false;
    setRestored(false);setDirty(false);
    setAnswer(submission?.status==="REVISION_REQUESTED"?submission.answer:"");
    setFileId(null);setFileName("");
    void readStudentHomeworkDraft(draftKey).then(draft=>{
      if(!active||!draft||!canSubmit||touched.current)return;
      setAnswer(draft.answer);setFileId(draft.fileId);setFileName(draft.fileName);
    }).catch(()=>{if(active)setMessage("student.hwDraftUnavailable");})
      .finally(()=>{if(active)setRestored(true);});
    return ()=>{active=false;};
  },[draftKey]);

  function saveSnapshot() {
    const snapshot={answer,fileId,fileName};
    const run=writeQueue.current.catch(()=>{}).then(()=>
      writeStudentHomeworkDraft(draftKey,snapshot));
    writeQueue.current=run;
    return run;
  }
  useEffect(()=>{
    if(!dirty||!restored||!canSubmit||submitting.current)return;
    const timer=setTimeout(()=>{
      void saveSnapshot().then(()=>{
        setDirty(false);setMessage("student.hwDraftSaved");
      }).catch(()=>setMessage("student.hwDraftUnavailable"));
    },1000);
    return ()=>clearTimeout(timer);
  },[answer,fileId,fileName,dirty,restored,canSubmit,draftKey]);

  async function saveDraft() {
    if(!canSubmit||busy||!restored)return;
    setBusy(true);
    try {await saveSnapshot();setDirty(false);setMessage("student.hwDraftSaved");}
    catch {setMessage("student.hwDraftUnavailable");}
    finally {setBusy(false);}
  }

  async function refresh() {
    if(!onRefresh||busy)return;
    setBusy(true);
    try {
      const ok=await onRefresh();
      setMessage(ok?null:"student.hwCannotVerify");
    }catch{setMessage("student.hwCannotVerify");}
    finally{setBusy(false);}
  }
  async function pick() {
    if(!canSubmit||busy)return;
    setBusy(true);setMessage(null);
    try {
      const result=await pickAndUploadLearningFile(accessToken);
      if(result){touched.current=true;setFileId(result.id);
        setFileName(result.fileName);setDirty(true);}
    }catch{setMessage("learning.fileUploadFailed");}
    finally{setBusy(false);}
  }
  async function submit() {
    if(submitting.current||busy||!restored)return;
    if(!canSubmit){setMessage("student.hwCannotVerify");return;}
    if(!answer.trim()&&!fileId){setMessage("learning.submissionInvalid");return;}
    if(answer.length>STUDENT_DRAFT_MAX_CHARS){
      setMessage("student.hwAnswerTooLong");return;
    }
    submitting.current=true;setBusy(true);setMessage(null);
    try {
      const result=await api.submitStudentHomework(accessToken,homework.id,answer.trim(),fileId);
      await writeQueue.current.catch(()=>{});
      await clearStudentHomeworkDraft(draftKey).catch(()=>{});
      setDirty(false);
      onSubmitted?.(result.submission);
      setMessage("student.hwSubmissionConfirmed");
    } catch {setMessage("learning.submissionFailed");}
    finally{setBusy(false);submitting.current=false;}
  }
  const statusKey:Record<HomeworkSubmissionPayload["status"],TranslationKey>={
    SUBMITTED:"student.hwSubmitted",REVIEWED:"student.hwReviewed",
    REVISION_REQUESTED:"student.hwNeedsRevision"
  };
  return (
    <View style={styles.stack} testID="student-homework-submission">
      <Pressable accessibilityRole="button" onPress={()=>setOpen(value=>!value)}
        style={styles.action}>
        <Text style={styles.actionText}>{translate(locale,open?"learning.hideSubmissions":
          submission?"student.hwViewSubmission":"learning.studentSubmitAction")}</Text>
      </Pressable>
      {busy&&<ActivityIndicator color={tokens.color.brandStrong}/>}
      {open&&<View style={styles.card}>
        {submission?<View style={styles.stack}>
          <Text style={[styles.title,textDirection]}>
            {translate(locale,"learning.submissionStatus")}:
            {" "}{translate(locale,statusKey[submission.status])}
          </Text>
          <Text style={[styles.text,textDirection]}>
            {translate(locale,"student.hwSubmittedOn")}: {formatLocalizedDate(submission.submittedAt,locale)}
          </Text>
          {submission.feedback?<View style={styles.feedback}>
            <Text style={[styles.title,textDirection]}>{translate(locale,"student.hwTeacherFeedback")}</Text>
            <Text style={[styles.text,textDirection]}>{submission.feedback}</Text>
          </View>:null}
          {submission.attachmentFileId?<Pressable accessibilityRole="button"
            onPress={()=>void shareLearningFile(accessToken,submission.attachmentFileId!)
              .catch(()=>setMessage("learning.submissionFailed"))} style={styles.action}>
            <Text style={styles.actionText}>{translate(locale,"learning.openAttachment")}</Text>
          </Pressable>:null}
        </View>:null}
        {!submissionsVerified?<View style={styles.stack}>
          <Text style={[styles.text,textDirection]}>{translate(locale,"student.hwCannotVerify")}</Text>
          <Pressable accessibilityRole="button" disabled={busy}
            onPress={()=>void refresh()} style={styles.action}>
            <Text style={styles.actionText}>{translate(locale,"student.hwRetry")}</Text>
          </Pressable>
        </View>:null}
        {canSubmit?<View style={styles.stack}>
          <Text style={[styles.title,textDirection]}>
            {translate(locale,submission?.status==="REVISION_REQUESTED"?
              "student.hwResubmit":"student.hwWriteAnswer")}
          </Text>
          <TextInput multiline editable={!busy&&restored} value={answer}
            maxLength={STUDENT_DRAFT_MAX_CHARS} testID="student-homework-answer"
            onChangeText={value=>{touched.current=true;setAnswer(value);setDirty(true);}}
            placeholder={translate(locale,"learning.studentAnswer")}
            style={[styles.input,textDirection]}/>
          <Text style={[styles.text,textDirection]}>
            {formatLocalizedNumber(answer.length,locale)} / {formatLocalizedNumber(STUDENT_DRAFT_MAX_CHARS,locale)}
          </Text>
          <View style={styles.buttons}>
            <Pressable accessibilityRole="button" disabled={busy||!restored}
              onPress={()=>void pick()} style={styles.action}>
              <Text style={styles.actionText}>{translate(locale,"learning.selectDeviceFile")}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy||!restored}
              onPress={()=>void saveDraft()} style={styles.action}>
              <Text style={styles.actionText}>{translate(locale,"student.hwSaveDraft")}</Text>
            </Pressable>
          </View>
          {fileName?<View style={styles.buttons}>
            <Text style={[styles.text,textDirection]}>{fileName}</Text>
            <Pressable accessibilityRole="button" onPress={()=>{
              setFileId(null);setFileName("");setDirty(true);
            }}><Text style={styles.actionText}>{translate(locale,"student.hwRemoveFile")}</Text></Pressable>
          </View>:null}
          <Pressable accessibilityRole="button" testID="student-homework-submit"
            disabled={busy||!restored||(!answer.trim()&&!fileId)}
            onPress={()=>void submit()}
            style={[styles.primary,(busy||!restored||(!answer.trim()&&!fileId))&&styles.disabled]}>
            <Text style={styles.primaryText}>{translate(locale,submission?.status==="REVISION_REQUESTED"?
              "student.hwResubmit":"learning.studentSubmitAction")}</Text>
          </Pressable>
        </View>:null}
        {expired&&submissionsVerified&&!submission?
          <Text style={[styles.text,textDirection]}>{translate(locale,"learning.submissionClosed")}</Text>:null}
        {message?<Text accessibilityRole="alert" style={[styles.text,textDirection]}>
          {translate(locale,message)}
        </Text>:null}
      </View>}
    </View>
  );
}
const styles=StyleSheet.create({
 stack:{gap:9},buttons:{flexDirection:"row",flexWrap:"wrap",gap:8,alignItems:"center"},feedback:{padding:10,backgroundColor:"#fff",borderRadius:10,gap:5},disabled:{opacity:0.5},card:{gap:10,padding:12,borderRadius:12,backgroundColor:"#f6f9fe"},
 title:{fontSize:13,fontWeight:"800",color:tokens.color.text},text:{fontSize:12,color:tokens.color.text},
 action:{minHeight:44,padding:10,borderRadius:12,backgroundColor:"#e8f3ff",justifyContent:"center",alignItems:"center"},
 actionText:{fontSize:12,fontWeight:"800",color:tokens.color.brandStrong},
 input:{minHeight:100,borderRadius:10,borderWidth:1,borderColor:"#cbd9ee",padding:12,color:tokens.color.text},
 primary:{minHeight:48,padding:12,borderRadius:12,backgroundColor:tokens.color.brandStrong,alignItems:"center",justifyContent:"center"},
 primaryText:{color:"#fff",fontSize:13,fontWeight:"800"}
});