import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { tokens } from "@maktablink/design-tokens";
import { translate, type SupportedLocale, type TranslationKey } from "@maktablink/localization";
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

  async function load() {
    setBusy(true);
    try {
      const result=await api.studentHomeworkSubmissions(accessToken);
      const existing=result.submissions.find(row=>row.submission.homeworkId===homework.id)?.submission??null;
      setSubmission(existing);
      setAnswer(existing?.answer??"");
      setFileId(null);
      setMessage(null);
      setOpen(true);
    } catch {setMessage("learning.submissionFailed");setOpen(true);}
    finally{setBusy(false);}
  }
  async function pick() {
    setBusy(true);
    try {
      const result=await pickAndUploadLearningFile(accessToken);
      if(result){setFileId(result.id);setFileName(result.fileName);}
    }catch{setMessage("learning.fileUploadFailed");}
    finally{setBusy(false);}
  }
  async function submit() {
    if(expired || !answer.trim()&&!fileId){setMessage("learning.submissionInvalid");return;}
    setBusy(true);
    try {
      const result=await api.submitStudentHomework(accessToken,homework.id,answer.trim(),fileId);
      setSubmission(result.submission);
      onSubmitted?.(result.submission);
      setMessage("learning.submissionSaved");
    } catch {setMessage("learning.submissionFailed");}
    finally{setBusy(false);}
  }
  const canSubmit=!expired&&(!submission||submission.status==="REVISION_REQUESTED");
  return (
    <View style={styles.stack} testID="student-homework-submission">
      <Pressable accessibilityRole="button" onPress={()=>open?setOpen(false):void load()} style={styles.action}>
        <Text style={styles.actionText}>{translate(locale,open?"learning.hideSubmissions":"learning.studentSubmitAction")}</Text>
      </Pressable>
      {busy&&<ActivityIndicator color={tokens.color.brandStrong}/>}
      {open&&(
        <View style={styles.card}>
          {submission&&(
            <>
              <Text style={[styles.title,textDirection]}>{translate(locale,"learning.submissionStatus")}: {submission.status}</Text>
              {!!submission.feedback&&<Text style={[styles.text,textDirection]}>{submission.feedback}</Text>}
              {!!submission.attachmentFileId&&(
                <Pressable accessibilityRole="button" onPress={()=>
                  void shareLearningFile(accessToken,submission.attachmentFileId!).catch(()=>setMessage("learning.submissionFailed"))}>
                  <Text style={styles.actionText}>{translate(locale,"learning.openAttachment")}</Text>
                </Pressable>
              )}
            </>
          )}
          {canSubmit&&(
            <>
              <TextInput multiline editable={!busy} value={answer} onChangeText={setAnswer}
                placeholder={translate(locale,"learning.studentAnswer")}
                style={[styles.input,textDirection]}/>
              <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void pick()} style={styles.action}>
                <Text style={styles.actionText}>{translate(locale,"learning.selectDeviceFile")}</Text>
              </Pressable>
              {fileName?<Text style={[styles.text,textDirection]}>{fileName}</Text>:null}
              <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void submit()} style={styles.primary}>
                <Text style={styles.primaryText}>{translate(locale,"learning.studentSubmitAction")}</Text>
              </Pressable>
            </>
          )}
          {expired&&!submission&&<Text style={[styles.text,textDirection]}>{translate(locale,"learning.submissionClosed")}</Text>}
          {message&&<Text style={[styles.text,textDirection]}>{translate(locale,message)}</Text>}
        </View>
      )}
    </View>
  );
}
const styles=StyleSheet.create({
 stack:{gap:9},card:{gap:10,padding:12,borderRadius:12,backgroundColor:"#f6f9fe"},
 title:{fontSize:13,fontWeight:"800",color:tokens.color.text},text:{fontSize:12,color:tokens.color.text},
 action:{minHeight:44,padding:10,borderRadius:12,backgroundColor:"#e8f3ff",justifyContent:"center",alignItems:"center"},
 actionText:{fontSize:12,fontWeight:"800",color:tokens.color.brandStrong},
 input:{minHeight:100,borderRadius:10,borderWidth:1,borderColor:"#cbd9ee",padding:12,color:tokens.color.text},
 primary:{minHeight:48,padding:12,borderRadius:12,backgroundColor:tokens.color.brandStrong,alignItems:"center",justifyContent:"center"},
 primaryText:{color:"#fff",fontSize:13,fontWeight:"800"}
});