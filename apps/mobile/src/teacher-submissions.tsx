import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { tokens } from "@maktablink/design-tokens";
import { translate, type SupportedLocale, type TranslationKey } from "@maktablink/localization";
import { api, type HomeworkPayload, type HomeworkSubmissionPayload } from "./api";
import { shareLearningFile } from "./learning-files";
import { appErrorFromCause, type AppErrorKind } from "./error-message";

type Entry = { submission: HomeworkSubmissionPayload; student: {id:string;fullName:string;studentCode:string} };
export function TeacherSubmissionReview({
  homework, accessToken, locale, textDirection, onError, onNotice
}: {
  homework: HomeworkPayload; accessToken: string; locale: SupportedLocale;
  textDirection: {textAlign:"left"|"right";writingDirection:"ltr"|"rtl"};
  onError: (key:TranslationKey|null,kind?:AppErrorKind)=>void;
  onNotice:(text:string|null)=>void;
}) {
  const [shown,setShown]=useState(false);
  const [items,setItems]=useState<Entry[]>([]);
  const [feedback,setFeedback]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  async function load() {
    setBusy(true);
    try {const response=await api.teacherHomeworkSubmissions(accessToken,homework.id);
      setItems(response.submissions);setShown(true);
    }catch(e){const failure=appErrorFromCause(e);onError(failure.key,failure.kind);}
    finally{setBusy(false);}
  }
  async function review(entry:Entry,status:"REVIEWED"|"REVISION_REQUESTED") {
    const message=(feedback[entry.submission.id]??"").trim();
    if(!message){onError("learning.feedbackRequired");return;}
    setBusy(true);
    try {
      await api.reviewHomeworkSubmission(accessToken,homework.id,entry.submission.id,status,message);
      onNotice(translate(locale,"learning.feedbackSaved"));await load();
    }catch(e){const failure=appErrorFromCause(e);onError(failure.key,failure.kind);}
    finally{setBusy(false);}
  }
  async function openFile(id:string){try{await shareLearningFile(accessToken,id);}catch{onError("common.requestFailed");}}
  return (
    <View style={styles.wrap}>
      <Pressable accessibilityRole="button" onPress={()=>shown?setShown(false):void load()} style={styles.action}>
        <Text style={styles.actionText}>{translate(locale,shown?"learning.hideSubmissions":"learning.reviewSubmissions")}</Text>
      </Pressable>
      {busy&&<ActivityIndicator color={tokens.color.brandStrong}/>}
      {shown&&(
        <View style={styles.list}>
          <Text style={[styles.heading,textDirection]}>{translate(locale,"learning.studentSubmissions")} · {items.length}</Text>
          {!items.length&&<Text style={[styles.body,textDirection]}>{translate(locale,"learning.noSubmissions")}</Text>}
          {items.map(entry=>(
            <View key={entry.submission.id} style={styles.item}>
              <Text style={[styles.heading,textDirection]}>{entry.student.fullName}</Text>
              <Text style={[styles.body,textDirection]}>{entry.student.studentCode} · {entry.submission.status}</Text>
              <Text style={[styles.body,textDirection]}>{entry.submission.answer}</Text>
              {entry.submission.attachmentFileId&&(
                <Pressable accessibilityRole="button" onPress={()=>void openFile(entry.submission.attachmentFileId!)}>
                  <Text style={styles.actionText}>{translate(locale,"learning.openAttachment")}</Text>
                </Pressable>
              )}
              {entry.submission.feedback&&<Text style={[styles.body,textDirection]}>{entry.submission.feedback}</Text>}
              {entry.submission.status==="SUBMITTED"&&(
                <>
                  <TextInput multiline value={feedback[entry.submission.id]??""} editable={!busy}
                    onChangeText={value=>setFeedback(prev=>({...prev,[entry.submission.id]:value}))}
                    placeholder={translate(locale,"learning.feedback")} style={[styles.input,textDirection]}/>
                  <View style={styles.actions}>
                    <Pressable accessibilityRole="button" disabled={busy}
                      onPress={()=>void review(entry,"REVIEWED")} style={styles.action}>
                      <Text style={styles.actionText}>{translate(locale,"learning.markReviewed")}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" disabled={busy}
                      onPress={()=>void review(entry,"REVISION_REQUESTED")} style={styles.action}>
                      <Text style={styles.actionText}>{translate(locale,"learning.requestRevision")}</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={()=>void load()}>
            <Text style={styles.actionText}>{translate(locale,"action.retry")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
const styles=StyleSheet.create({
  wrap:{gap:8},list:{gap:10},item:{padding:12,backgroundColor:"#f6f9fe",borderRadius:12,gap:8},
  heading:{fontSize:14,fontWeight:"800",color:tokens.color.text},
  body:{fontSize:12,color:tokens.color.text,lineHeight:18},
  action:{minHeight:42,paddingHorizontal:12,paddingVertical:10,borderRadius:10,backgroundColor:"#e9f2ff",alignItems:"center",justifyContent:"center"},
  actionText:{color:tokens.color.brandStrong,fontSize:12,fontWeight:"800"},
  input:{borderWidth:1,borderColor:"#d9e2ee",backgroundColor:"#fff",minHeight:54,padding:10,borderRadius:10,color:tokens.color.text},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:8}
});