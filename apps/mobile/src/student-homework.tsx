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

export function StudentHomeworkContent({
  learning,ready,locale,textDirection,accessToken,onSubmitted,
  submissions,submissionsReady,onRefresh
}:{
  learning:LearnerAcademicPayload|null;accessToken:string;ready:boolean;
  locale:SupportedLocale;textDirection:TextDirectionStyle;
  onSubmitted?:(submission:HomeworkSubmissionPayload)=>void;
  submissions:HomeworkSubmissionPayload[]|null;submissionsReady:boolean;
  onRefresh?:()=>Promise<boolean>;
}) {
  const rtl=getDirection(locale)==="rtl";
  const [tab,setTab]=useState<HomeworkStudentTab>("TO_DO");
  const [subject,setSubject]=useState<string|null>(null);
  const [search,setSearch]=useState("");
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{
    const timer=setInterval(()=>setNow(new Date()),60_000);
    return ()=>clearInterval(timer);
  },[]);
  const rows=studentHomeworkRows(learning?.homework??[],submissions,now);
  const subjects=studentHomeworkSubjects(rows);
  const counts=studentHomeworkCounts(rows);
  const filtered=studentHomeworkFilter(rows,{tab,subject,query:search});
  const verified=submissionsReady&&submissions!==null;
  const [refreshing,setRefreshing]=useState(false);

  function handleSubmitted(submission:HomeworkSubmissionPayload){
    setTab("SUBMITTED");
    onSubmitted?.(submission);
  }
  async function refresh() {
    if(refreshing||!onRefresh)return false;
    setRefreshing(true);
    try{return await onRefresh();}
    finally{setRefreshing(false);}
  }
  if(!ready&&!learning)return <View style={styles.loadingCard}>
    <View style={styles.loadingLineWide}/>
    <View style={styles.loadingLineShort}/>
  </View>;
  if(!learning)return <View style={styles.emptyCard}>
    <Ionicons name="cloud-offline-outline" size={26} color={tokens.color.textMuted}/>
    <Text style={[styles.emptyText,textDirection]}>{translate(locale,"student.homeDataUnavailable")}</Text>
  </View>;
  return <View style={styles.stack} testID="student-homework-phase4">
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.tabScroll,rtl&&styles.rowRtl]}>
      {studentHomeworkTabs.map(next=>
        <Pressable key={next} accessibilityRole="tab"
          testID={`student-homework-tab-${next.toLowerCase()}`}
          accessibilityState={{selected:tab===next}}
          onPress={()=>setTab(next)}
          style={[styles.tab,tab===next&&styles.selectedTab]}>
          <Text style={[styles.tabText,tab===next&&styles.selectedTabText]}>
            {translate(locale,tabKeys[next])}
          </Text>
          <View style={[styles.countPill,tab===next&&styles.countPillSelected]}>
            <Text style={styles.countText}>{formatLocalizedNumber(counts[next],locale)}</Text>
          </View>
        </Pressable>)}
    </ScrollView>
    {!verified?<View style={styles.warningBanner}>
      <Text style={[styles.emptyText,textDirection]}>
        {translate(locale,"student.hwCannotVerify")}
      </Text>
      <Pressable accessibilityRole="button" disabled={refreshing}
        onPress={()=>void refresh()} style={styles.refreshButton}>
        <Text style={styles.attachmentText}>{translate(locale,"student.hwRetry")}</Text>
      </Pressable>
    </View>:null}
    <TextInput value={search} onChangeText={setSearch}
      testID="student-homework-search" autoCapitalize="none"
      placeholder={translate(locale,"student.hwSearch")}
      style={[styles.searchInput,textDirection]}/>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.subjectScroll,rtl&&styles.rowRtl]}>
      <Pressable accessibilityRole="button"
        accessibilityState={{selected:subject===null}}
        onPress={()=>setSubject(null)}
        style={[styles.subjectChip,subject===null&&styles.subjectSelected]}>
        <Text style={[styles.subjectChipText,subject===null&&styles.subjectSelectedText]}>
          {translate(locale,"student.hwAllSubjects")}
        </Text>
      </Pressable>
      {subjects.map(name=><Pressable key={name} accessibilityRole="button"
        accessibilityState={{selected:subject===name}}
        onPress={()=>setSubject(name)}
        style={[styles.subjectChip,subject===name&&styles.subjectSelected]}>
        <Text style={[styles.subjectChipText,subject===name&&styles.subjectSelectedText]}>
          {name}
        </Text>
      </Pressable>)}
    </ScrollView>
    <View style={[styles.sectionHeading,rtl&&styles.rowRtl]}>
      <Text style={[styles.sectionTitle,textDirection]}>{translate(locale,tabKeys[tab])}</Text>
      <Text style={styles.countText}>{formatLocalizedNumber(filtered.length,locale)}</Text>
      <Pressable accessibilityRole="button" disabled={refreshing}
        onPress={()=>void refresh()} style={styles.refreshButton}>
        <Text style={styles.attachmentText}>{translate(locale,"student.hwRetry")}</Text>
      </Pressable>
    </View>
    {filtered.length?filtered.map(row=><HomeworkCard key={row.item.homework.id}
      item={row.item} row={row} accessToken={accessToken} studentId={learning.student.id}
      locale={locale} textDirection={textDirection}
      submissionsVerified={verified} onRefresh={refresh} onSubmitted={handleSubmitted}/>):
      <View style={styles.emptyCard}>
        <Ionicons name="document-text-outline" size={24} color={tokens.color.textMuted}/>
        <Text style={[styles.emptyText,textDirection]}>
          {rows.length===0?translate(locale,"student.noHomework"):
            translate(locale,"student.hwNoMatching")}
        </Text>
      </View>}
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  statusRow:{flexDirection:"row",gap:7,flexWrap:"wrap"},
  statusBadge:{backgroundColor:"#e8f3ff",color:tokens.color.brandStrong,
    fontWeight:"800",fontSize:11,paddingHorizontal:10,paddingVertical:6,borderRadius:10},
  alertBadge:{backgroundColor:"#fff0e6",color:"#924e23"},
  deadlineBadge:{fontSize:11,fontWeight:"800",color:"#924e23",
    borderRadius:10,paddingHorizontal:10,paddingVertical:6,backgroundColor:"#fff5e9"},
  tabScroll:{flexDirection:"row",gap:8,paddingVertical:4},
  tab:{minHeight:45,flexDirection:"row",alignItems:"center",gap:7,
    borderWidth:1,borderColor:"#dce4f1",backgroundColor:"#fff",
    paddingHorizontal:12,borderRadius:12},
  selectedTab:{backgroundColor:"#e7f0ff",borderColor:tokens.color.brandStrong},
  tabText:{color:tokens.color.textMuted,fontSize:12,fontWeight:"800"},
  selectedTabText:{color:tokens.color.brandStrong},
  countPillSelected:{backgroundColor:"#d1e5ff"},
  warningBanner:{padding:14,gap:9,borderRadius:13,
    backgroundColor:"#fff6e8",borderWidth:1,borderColor:"#f0d9b8"},
  refreshButton:{alignSelf:"flex-start",minHeight:42,justifyContent:"center",
    paddingHorizontal:13,borderRadius:11,backgroundColor:"#fff"},
  searchInput:{minHeight:48,borderWidth:1,borderColor:"#cbd9e9",
    borderRadius:13,paddingHorizontal:12,color:tokens.color.text,backgroundColor:"#fff"},
  subjectScroll:{flexDirection:"row",gap:8,paddingBottom:4},
  subjectChip:{minHeight:41,justifyContent:"center",
    paddingHorizontal:13,backgroundColor:"#fff",borderRadius:11,
    borderWidth:1,borderColor:"#dce4f1"},
  subjectSelected:{backgroundColor:"#e7f0ff",borderColor:tokens.color.brandStrong},
  subjectChipText:{fontSize:12,fontWeight:"800",color:tokens.color.textMuted},
  subjectSelectedText:{color:tokens.color.brandStrong},
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
