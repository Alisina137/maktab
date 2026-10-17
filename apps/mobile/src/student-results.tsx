import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate,formatLocalizedNumber,getDirection,
  translate,type SupportedLocale,type TranslationKey
} from "@maktablink/localization";
import type { LearnerAcademicPayload } from "./api";
import {
  studentVisibleResults,studentResultsSubjects,studentResultsTypes,
  studentFilterResults,studentExamGroups,studentSubjectPerformance,
  studentResultHistory,studentPublishedAverage,studentResultsTabs,
  type StudentResultsTab,type StudentSubjectPerformance
} from "./student-results-model";

type Direction={textAlign:"left"|"right";writingDirection:"ltr"|"rtl"};
const tabLabel:Record<StudentResultsTab,TranslationKey>={
  EXAMS:"student.resExams",PERFORMANCE:"student.resPerformance",
  HISTORY:"student.resHistory"
};
function Empty({locale,textDirection,label}:{
  locale:SupportedLocale;textDirection:Direction;label:TranslationKey
}){
  return <View style={styles.empty}>
    <Ionicons name="ribbon-outline" size={25} color={tokens.color.textMuted}/>
    <Text style={[styles.muted,textDirection]}>{translate(locale,label)}</Text>
  </View>;
}
function Score({score,max,locale}:{
  score:number;max:number;locale:SupportedLocale
}){
  return <Text style={styles.score}>
    {formatLocalizedNumber(score,locale)}
    <Text style={styles.scoreDivider}> / </Text>
    {formatLocalizedNumber(max,locale)}
  </Text>;
}
function Progress({value}:{value:number}){
  return <View style={styles.track} accessibilityLabel={`${value}%`}>
    <View style={[styles.fill,{width:`${Math.max(0,Math.min(100,value))}%` as `${number}%`}]}/>
  </View>;
}
function Trend({item,locale,textDirection}:{
  item:StudentSubjectPerformance;locale:SupportedLocale;textDirection:Direction
}){
  const key:TranslationKey=item.trend==="UP"?"student.resImproving":
    item.trend==="DOWN"?"student.resDeclining":
    item.trend==="SAME"?"student.resStable":"student.resFirstMark";
  const icon=item.trend==="UP"?"trending-up-outline":
    item.trend==="DOWN"?"trending-down-outline":"remove-outline";
  return <View style={styles.trend}>
    <Ionicons name={icon} size={17} color={tokens.color.brandStrong}/>
    <Text style={[styles.trendText,textDirection]}>{translate(locale,key)}</Text>
  </View>;
}
export function StudentResultsContent({
  learning,ready,locale,textDirection
}:{
  learning:LearnerAcademicPayload|null;ready:boolean;
  locale:SupportedLocale;textDirection:Direction;
}) {
  const rtl=getDirection(locale)==="rtl";
  const [tab,setTab]=useState<StudentResultsTab>("EXAMS");
  const [subject,setSubject]=useState<string|null>(null);
  const [examType,setExamType]=useState<string|null>(null);
  const [query,setQuery]=useState("");
  const [expandedExam,setExpandedExam]=useState<string|null>(null);
  if(!ready&&!learning)return <View style={styles.loadingCard}>
    <View style={styles.loadingLineWide}/><View style={styles.loadingLineShort}/>
  </View>;
  if(!learning)return <Empty locale={locale} textDirection={textDirection}
    label="student.homeDataUnavailable"/>;
  const all=studentVisibleResults(learning);
  const subjects=studentResultsSubjects(all);
  const types=studentResultsTypes(all);
  const filtered=studentFilterResults(all,{subject,examType,query});
  const groups=studentExamGroups(filtered);
  const performance=studentSubjectPerformance(filtered);
  const history=studentResultHistory(filtered);
  const average=studentPublishedAverage(filtered);
  const count=(n:number)=>formatLocalizedNumber(n,locale);
  const percent=(n:number)=>`${count(n)}%`;
  return <View style={styles.stack} testID="student-results-phase5">
    <View style={[styles.tabBar,rtl&&styles.rtl]} accessibilityRole="tablist">
      {studentResultsTabs.map(next=><Pressable key={next}
        testID={`student-results-tab-${next.toLowerCase()}`}
        accessibilityRole="tab" accessibilityState={{selected:tab===next}}
        onPress={()=>setTab(next)}
        style={[styles.tab,tab===next&&styles.tabSelected]}>
        <Text style={[styles.tabText,tab===next&&styles.tabTextSelected]}>
          {translate(locale,tabLabel[next])}
        </Text>
      </Pressable>)}
    </View>
    <View style={[styles.summaryRow,rtl&&styles.rtl]}>
      <View style={styles.summaryCell}>
        <Text style={styles.summaryNumber}>{average===null?"—":percent(average)}</Text>
        <Text style={styles.summaryLabel}>{translate(locale,"student.resPublishedAverage")}</Text>
      </View>
      <View style={styles.summaryCell}>
        <Text style={styles.summaryNumber}>{count(filtered.length)}</Text>
        <Text style={styles.summaryLabel}>{translate(locale,"student.resPublishedMarks")}</Text>
      </View>
    </View>
    <TextInput testID="student-results-search" value={query} onChangeText={setQuery}
      autoCapitalize="none" style={[styles.search,textDirection]}
      placeholder={translate(locale,"student.resSearch")}/>
    <View style={styles.filterStack}>
      <Text style={[styles.filterTitle,textDirection]}>
        {translate(locale,"student.resSubjectFilter")}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.chips,rtl&&styles.rtl]}>
        {[null,...subjects].map(next=><Pressable key={next??"ALL"}
          accessibilityRole="button" accessibilityState={{selected:subject===next}}
          onPress={()=>setSubject(next)}
          style={[styles.chip,subject===next&&styles.chipSelected]}>
          <Text style={[styles.chipText,subject===next&&styles.chipTextSelected]}>
            {next??translate(locale,"student.resAllSubjects")}
          </Text>
        </Pressable>)}
      </ScrollView>
      <Text style={[styles.filterTitle,textDirection]}>
        {translate(locale,"student.resExamTypeFilter")}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.chips,rtl&&styles.rtl]}>
        {[null,...types].map(next=><Pressable key={next??"ALL"}
          accessibilityRole="button" accessibilityState={{selected:examType===next}}
          onPress={()=>setExamType(next)}
          style={[styles.chip,examType===next&&styles.chipSelected]}>
          <Text style={[styles.chipText,examType===next&&styles.chipTextSelected]}>
            {next??translate(locale,"student.resAllTypes")}
          </Text>
        </Pressable>)}
      </ScrollView>
    </View>
    {all.length===0?<Empty locale={locale} textDirection={textDirection}
      label="student.noResults"/>:filtered.length===0?
      <Empty locale={locale} textDirection={textDirection}
        label="student.resNoMatching"/>:null}
    {filtered.length>0&&tab==="EXAMS"?<View style={styles.stack}
      testID="student-results-exams">
      <Text style={[styles.sectionTitle,textDirection]}>
        {translate(locale,"student.resExams")} · {count(groups.length)}
      </Text>
      {groups.map(group=>{
        const expanded=expandedExam===null||expandedExam===group.id;
        return <View key={group.id} style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityState={{expanded}}
            onPress={()=>setExpandedExam(expanded? "NONE":group.id)}
            style={[styles.row,rtl&&styles.rtl]}>
            <View style={styles.flex}>
              <Text style={[styles.name,textDirection]}>{group.name}</Text>
              <Text style={[styles.muted,textDirection]}>
                {group.type||translate(locale,"student.resExams")}
              </Text>
              {group.publishedAt?<Text style={[styles.muted,textDirection]}>
                {translate(locale,"student.publishedOn")}:
                {" "}{formatLocalizedDate(group.publishedAt,locale)}
              </Text>:null}
            </View>
            <Text style={styles.percent}>{percent(group.percent)}</Text>
            <Ionicons name={expanded?"chevron-up":"chevron-down"} size={18}
              color={tokens.color.textMuted}/>
          </Pressable>
          <View style={[styles.metaRow,rtl&&styles.rtl]}>
            <Text style={styles.muted}>{translate(locale,"student.examTotal")}</Text>
            <Score score={group.score} max={group.maxScore} locale={locale}/>
          </View>
          <Progress value={group.percent}/>
          {expanded?<View style={styles.innerStack}>
            {group.results.map(result=><View key={result.grade.id} style={styles.subjectRow}>
              <View style={[styles.row,rtl&&styles.rtl]}>
                <View style={styles.flex}>
                  <Text style={[styles.name,textDirection]}>{result.subjectName}</Text>
                  {result.examSubject.examDate?<Text style={[styles.muted,textDirection]}>
                    {formatLocalizedDate(result.examSubject.examDate,locale)}
                  </Text>:null}
                </View>
                <Score score={result.grade.score}
                  max={result.examSubject.maxScore} locale={locale}/>
              </View>
              {result.grade.remark?<View style={styles.remark}>
                <Text style={[styles.muted,textDirection]}>
                  {translate(locale,"student.teacherRemark")}: {result.grade.remark}
                </Text>
              </View>:null}
            </View>)}
          </View>:null}
        </View>;
      })}
    </View>:null}
    {filtered.length>0&&tab==="PERFORMANCE"?<View style={styles.stack}
      testID="student-results-performance">
      <Text style={[styles.sectionTitle,textDirection]}>
        {translate(locale,"student.resSubjectBreakdown")}
      </Text>
      <Text style={[styles.muted,textDirection]}>
        {translate(locale,"student.resWeightedExplanation")}
      </Text>
      {performance.map(item=><View key={item.subjectId} style={styles.card}>
        <View style={[styles.row,rtl&&styles.rtl]}>
          <View style={styles.flex}>
            <Text style={[styles.name,textDirection]}>{item.name}</Text>
            <Text style={[styles.muted,textDirection]}>
              {count(item.publishedMarks)} {" "}{translate(locale,"student.resPublishedMarks")}
            </Text>
          </View>
          <Text style={styles.percent}>{percent(item.percent)}</Text>
        </View>
        <Progress value={item.percent}/>
        <Trend item={item} locale={locale} textDirection={textDirection}/>
        <View style={[styles.metaRow,rtl&&styles.rtl]}>
          <Text style={styles.muted}>{translate(locale,"student.resLatestMark")}</Text>
          <Text style={styles.score}>{percent(item.latestPercent)}</Text>
        </View>
        {item.previousPercent!==null?<View style={[styles.metaRow,rtl&&styles.rtl]}>
          <Text style={styles.muted}>{translate(locale,"student.resPreviousMark")}</Text>
          <Text style={styles.score}>{percent(item.previousPercent)}</Text>
        </View>:null}
        <View style={styles.innerStack}>
          {item.timeline.map(entry=><View key={entry.id}
            style={[styles.metaRow,rtl&&styles.rtl]}>
            <Text style={[styles.muted,styles.flex,textDirection]}>
              {entry.exam}{entry.date?` · ${formatLocalizedDate(entry.date,locale)}`:""}
            </Text>
            <Text style={styles.score}>{percent(entry.percent)}</Text>
          </View>)}
        </View>
      </View>)}
    </View>:null}
    {filtered.length>0&&tab==="HISTORY"?<View style={styles.stack}
      testID="student-results-history">
      <Text style={[styles.sectionTitle,textDirection]}>
        {translate(locale,"student.resHistory")}
      </Text>
      <Text style={[styles.muted,textDirection]}>
        {translate(locale,"student.resHistoryScope")}
      </Text>
      {history.map(entry=><View key={entry.id} style={styles.card}>
        <View style={[styles.row,rtl&&styles.rtl]}>
          <View style={styles.flex}>
            <Text style={[styles.name,textDirection]}>{entry.subjectName}</Text>
            <Text style={[styles.muted,textDirection]}>
              {entry.examName} · {entry.examType}
            </Text>
          </View>
          <Score score={entry.score} max={entry.maxScore} locale={locale}/>
        </View>
        <View style={[styles.metaRow,rtl&&styles.rtl]}>
          <Text style={styles.muted}>{translate(locale,"student.resScorePercent")}</Text>
          <Text style={styles.percent}>{percent(entry.percent)}</Text>
        </View>
        {entry.publishedAt?<Text style={[styles.muted,textDirection]}>
          {translate(locale,"student.publishedOn")}:
          {" "}{formatLocalizedDate(entry.publishedAt,locale)}
        </Text>:null}
        {entry.remark?<Text style={[styles.muted,textDirection]}>
          {translate(locale,"student.teacherRemark")}: {entry.remark}
        </Text>:null}
      </View>)}
    </View>:null}
  </View>;
}
const styles=StyleSheet.create({
  stack:{gap:13},rtl:{flexDirection:"row-reverse"},flex:{flex:1,minWidth:0},
  tabBar:{flexDirection:"row",backgroundColor:"#edf2f9",padding:4,gap:4,borderRadius:15},
  tab:{flex:1,minHeight:44,alignItems:"center",justifyContent:"center",borderRadius:12},
  tabSelected:{backgroundColor:"#fff",borderWidth:1,borderColor:"#c9d9ee"},
  tabText:{fontSize:12,fontWeight:"800",color:tokens.color.textMuted,textAlign:"center"},
  tabTextSelected:{color:tokens.color.brandStrong},
  summaryRow:{flexDirection:"row",gap:10},
  summaryCell:{flex:1,padding:14,borderRadius:16,gap:6,alignItems:"center",
    backgroundColor:"#eef5ff",borderColor:"#dce7f7",borderWidth:1},
  summaryNumber:{fontSize:23,fontWeight:"900",color:tokens.color.brandStrong},
  summaryLabel:{fontSize:11.5,textAlign:"center",color:tokens.color.textMuted},
  search:{minHeight:47,paddingHorizontal:13,borderRadius:12,borderWidth:1,
    borderColor:"#cdd9e9",backgroundColor:"#fff",color:tokens.color.text},
  filterStack:{gap:8},
  filterTitle:{fontSize:12,fontWeight:"800",color:tokens.color.text},
  chips:{flexDirection:"row",gap:7,paddingVertical:2},
  chip:{minHeight:40,paddingHorizontal:12,borderRadius:11,borderColor:"#dce5f0",
    borderWidth:1,backgroundColor:"#fff",justifyContent:"center"},
  chipSelected:{backgroundColor:"#e7f0ff",borderColor:tokens.color.brandStrong},
  chipText:{fontSize:12,fontWeight:"800",color:tokens.color.textMuted},
  chipTextSelected:{color:tokens.color.brandStrong},
  sectionTitle:{fontSize:16,fontWeight:"900",color:tokens.color.text},
  card:{padding:15,borderWidth:1,borderColor:"#e1e8f2",borderRadius:18,
    gap:11,backgroundColor:"#fff"},
  row:{flexDirection:"row",alignItems:"center",gap:10},
  name:{fontSize:14,fontWeight:"900",color:tokens.color.text},
  muted:{fontSize:12,lineHeight:18,color:tokens.color.textMuted},
  percent:{fontSize:18,fontWeight:"900",color:tokens.color.brandStrong},
  score:{fontSize:13,fontWeight:"900",color:tokens.color.brandStrong},
  scoreDivider:{color:tokens.color.textMuted},
  metaRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:9},
  track:{height:8,borderRadius:8,overflow:"hidden",backgroundColor:"#e5edf7"},
  fill:{height:8,backgroundColor:tokens.color.brandStrong},
  innerStack:{gap:9},subjectRow:{padding:10,gap:8,borderRadius:12,backgroundColor:"#f7faff"},
  remark:{backgroundColor:"#f0f3f8",padding:9,borderRadius:9},
  trend:{flexDirection:"row",alignItems:"center",gap:6},
  trendText:{fontSize:12,fontWeight:"800",color:tokens.color.brandStrong},
  empty:{minHeight:150,padding:20,borderRadius:17,backgroundColor:"#fff",
    borderWidth:1,borderColor:"#e1e7f0",alignItems:"center",justifyContent:"center",gap:10},
  loadingCard:{padding:18,borderRadius:18,borderWidth:1,borderColor:"#e1e7f0",
    backgroundColor:"#fff",gap:12},
  loadingLineWide:{height:12,width:"78%",borderRadius:999,backgroundColor:"#edf1f6"},
  loadingLineShort:{height:11,width:"52%",borderRadius:999,backgroundColor:"#f0f3f7"}
});
