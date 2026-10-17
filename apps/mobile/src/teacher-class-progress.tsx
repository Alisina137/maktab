import {useState} from "react";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {tokens} from "@maktablink/design-tokens";
import {formatLocalizedNumber,getDirection,translate,type SupportedLocale} from "@maktablink/localization";
import type {TeacherClassDetailPayload} from "./api";
import {teacherProgressRatio} from "./teacher-classes-model";

type Direction={textAlign:"right"|"left";writingDirection:"rtl"|"ltr"};
type Mode="OVERVIEW"|"STUDENTS";
type Filter="ALL"|"GRADES"|"HOMEWORK";
type Insights=TeacherClassDetailPayload["insights"];
function ratio(n:number,d:number,locale:SupportedLocale) {
  const value=teacherProgressRatio(n,d);
  return value===null?"—":`${formatLocalizedNumber(value,locale)}%`;
}
function Metric({label,value}:{label:string;value:string}){
  return <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>;
}
function Progress({label,n,d,locale,rtl,textDirection}:{
  label:string;n:number;d:number;locale:SupportedLocale;rtl:boolean;textDirection:Direction;
}) {
  const progress=teacherProgressRatio(n,d);
  return <View style={styles.progress}>
    <View style={[styles.row,rtl&&styles.rtl]}>
      <Text style={[styles.label,styles.flex,textDirection]}>{label}</Text>
      <Text style={styles.accent}>{ratio(n,d,locale)}</Text>
    </View>
    <Text style={[styles.muted,textDirection]}>
      {formatLocalizedNumber(n,locale)} / {formatLocalizedNumber(d,locale)}
    </Text>
    <View style={styles.bar}><View style={[styles.fill,{width:`${progress??0}%` as `${number}%`}]}/></View>
  </View>;
}

/** Read-only assignment-scoped progress. Unknown results are displayed as a
 * dash, not a fabricated zero. No parent or whole-school personal data. */
export function TeacherClassProgressPanel({
  mode,detail,locale,textDirection,onGrades,onStudents
}:{
  mode:Mode;detail:TeacherClassDetailPayload;locale:SupportedLocale;textDirection:Direction;
  onGrades:()=>void;onStudents:()=>void;
}){
  const rtl=getDirection(locale)==="rtl";
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<Filter>("ALL");
  const [expanded,setExpanded]=useState<string|null>(null);
  const insights:Insights|undefined=detail.insights;
  const progressById=new Map(insights?.studentProgress.map(p=>[p.studentId,p])??[]);
  const normalized=query.trim().normalize("NFKC").toLocaleLowerCase();
  const students=detail.students.filter(student=>{
    const progress=progressById.get(student.id);
    const match=!normalized||[student.fullName,student.studentCode]
      .some(value=>value.normalize("NFKC").toLocaleLowerCase().includes(normalized));
    return match&&(filter==="ALL"||
      (filter==="GRADES"&&!!progress&&progress.examsRecorded<progress.examsAvailable)||
      (filter==="HOMEWORK"&&!!progress&&progress.homeworkSubmitted<progress.homeworkAvailable));
  });
  if(mode==="OVERVIEW")return <View style={styles.card} testID="teacher-class-progress-overview">
    <View style={[styles.row,rtl&&styles.rtl]}>
      <Ionicons name="analytics-outline" size={23} color={tokens.color.brandStrong}/>
      <Text style={[styles.title,styles.flex,textDirection]}>{translate(locale,"teacher.classPerformance")}</Text>
    </View>
    <Text style={[styles.muted,textDirection]}>{translate(locale,"teacher.classStatsHint")}</Text>
    <View style={[styles.grid,rtl&&styles.rtl]}>
      <Metric label={translate(locale,"teacher.classGradeSheets")}
        value={insights?formatLocalizedNumber(insights.examSheets,locale):"—"}/>
      <Metric label={translate(locale,"teacher.classPublishedHomework")}
        value={insights?formatLocalizedNumber(insights.homeworkPublished,locale):"—"}/>
      <Metric label={translate(locale,"teacher.classFilterDrafts")}
        value={insights?formatLocalizedNumber(insights.homeworkDrafts,locale):"—"}/>
    </View>
    <Progress label={translate(locale,"teacher.classGradeCoverage")}
      n={insights?.examGradesRecorded??0} d={insights?.examGradesExpected??0}
      locale={locale} rtl={rtl} textDirection={textDirection}/>
    <Progress label={translate(locale,"teacher.classSubmissionCoverage")}
      n={insights?.homeworkSubmitted??0} d={insights?.homeworkExpected??0}
      locale={locale} rtl={rtl} textDirection={textDirection}/>
    <Pressable accessibilityRole="button" style={[styles.linkButton,rtl&&styles.rtl]}
      onPress={onStudents}>
      <Text style={styles.linkText}>{translate(locale,"teacher.classStudentProgress")}</Text>
      <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={16} color={tokens.color.brandStrong}/>
    </Pressable>
  </View>;
  return <View style={styles.card} testID="teacher-class-student-progress">
    <Text style={[styles.title,textDirection]}>{translate(locale,"teacher.classStudents")}</Text>
    <Text style={[styles.muted,textDirection]}>{translate(locale,"teacher.classPerformanceHint")}</Text>
    <View style={[styles.search,rtl&&styles.rtl]}>
      <Ionicons name="search-outline" size={21} color={tokens.color.textMuted}/>
      <TextInput testID="teacher-class-student-search" value={query}
        onChangeText={setQuery} autoCapitalize="none"
        placeholder={translate(locale,"teacher.studentSearch")}
        accessibilityLabel={translate(locale,"teacher.studentSearch")}
        style={[styles.input,textDirection]}/>
      {query?<Pressable accessibilityRole="button" onPress={()=>setQuery("")}
        accessibilityLabel={translate(locale,"teacher.classClearSearch")}>
        <Ionicons name="close-circle" size={21} color={tokens.color.textMuted}/>
      </Pressable>:null}
    </View>
    <View style={[styles.filterRow,rtl&&styles.rtl]} accessibilityRole="tablist">
      {(["ALL","GRADES","HOMEWORK"] as const).map(next=>(
        <Pressable key={next} accessibilityRole="tab"
          accessibilityState={{selected:filter===next}}
          onPress={()=>setFilter(next)}
          style={[styles.filter,filter===next&&styles.selected]}>
          <Text numberOfLines={2} style={[styles.filterText,filter===next&&styles.selectedText]}>
            {translate(locale,next==="ALL"?"teacher.studentFilterAll":
              next==="GRADES"?"teacher.studentFilterMissingGrades":"teacher.studentFilterMissingHomework")}
          </Text>
        </Pressable>
      ))}
    </View>
    <Text style={[styles.muted,textDirection]}>
      {formatLocalizedNumber(students.length,locale)} / {formatLocalizedNumber(detail.students.length,locale)}
    </Text>
    {students.map(student=>{
      const item=progressById.get(student.id);
      return <View key={student.id} style={styles.student}>
        <Pressable accessibilityRole="button" accessibilityLabel={student.fullName}
          onPress={()=>setExpanded(expanded===student.id?null:student.id)}
          style={[styles.row,rtl&&styles.rtl]}>
          <Ionicons name="person-circle-outline" size={28} color={tokens.color.brandStrong}/>
          <View style={styles.flex}>
            <Text style={[styles.label,textDirection]}>{student.fullName}</Text>
            <Text style={[styles.muted,textDirection]}>{student.studentCode}</Text>
          </View>
          <Ionicons name={expanded===student.id?"chevron-up":"chevron-down"} size={18}
            color={tokens.color.textMuted}/>
        </Pressable>
        {expanded===student.id?<View style={styles.expanded}>
          <Text style={[styles.muted,textDirection]}>{translate(locale,"teacher.studentReadOnly")}</Text>
          <View style={[styles.grid,rtl&&styles.rtl]}>
            <Metric label={translate(locale,"teacher.studentExamAverage")}
              value={item?.averageExamPercent==null?"—":
                `${formatLocalizedNumber(item.averageExamPercent,locale)}%`}/>
            <Metric label={translate(locale,"teacher.studentGradeProgress")}
              value={item?`${formatLocalizedNumber(item.examsRecorded,locale)} / ${formatLocalizedNumber(item.examsAvailable,locale)}`:"—"}/>
            <Metric label={translate(locale,"teacher.studentHomeworkProgress")}
              value={item?`${formatLocalizedNumber(item.homeworkSubmitted,locale)} / ${formatLocalizedNumber(item.homeworkAvailable,locale)}`:"—"}/>
          </View>
          <Pressable accessibilityRole="button" style={styles.linkButton} onPress={onGrades}>
            <Text style={styles.linkText}>{translate(locale,"teacher.workflowGrades")}</Text>
          </Pressable>
        </View>:null}
      </View>;
    })}
    {!students.length?<Text style={[styles.muted,textDirection]}>
      {detail.students.length?translate(locale,"teacher.classNoStudentMatch"):
        translate(locale,"teacher.noActiveStudents")}
    </Text>:null}
  </View>;
}
const styles=StyleSheet.create({
  card:{padding:16,backgroundColor:"#fff",borderWidth:1,borderColor:"#e1e7f0",
    borderRadius:19,gap:12},
  row:{flexDirection:"row",gap:10,alignItems:"center"},
  rtl:{flexDirection:"row-reverse"},
  flex:{flex:1,minWidth:0},
  title:{fontSize:16,fontWeight:"900",color:tokens.color.text},
  label:{fontSize:13.5,fontWeight:"800",color:tokens.color.text},
  muted:{fontSize:12,color:tokens.color.textMuted,lineHeight:18},
  grid:{flexDirection:"row",gap:7,flexWrap:"wrap"},
  metric:{minWidth:"28%",flexGrow:1,backgroundColor:"#edf4ff",borderRadius:12,
    padding:10,alignItems:"center",gap:5},
  metricValue:{fontSize:17,fontWeight:"900",color:tokens.color.brandStrong},
  metricLabel:{fontSize:10.5,lineHeight:15,textAlign:"center",color:tokens.color.textMuted},
  progress:{gap:6,backgroundColor:"#f9fbff",padding:10,borderRadius:12},
  accent:{fontSize:13,fontWeight:"900",color:tokens.color.brandStrong},
  bar:{height:9,borderRadius:7,overflow:"hidden",backgroundColor:"#e7edf6"},
  fill:{height:9,borderRadius:7,backgroundColor:tokens.color.brand},
  linkButton:{alignSelf:"flex-start",minHeight:42,flexDirection:"row",
    paddingHorizontal:12,alignItems:"center",gap:7,backgroundColor:"#e9f2ff",borderRadius:11},
  linkText:{fontSize:12.5,fontWeight:"800",color:tokens.color.brandStrong},
  search:{flexDirection:"row",alignItems:"center",gap:8,borderRadius:12,
    minHeight:48,backgroundColor:"#fafcff",borderWidth:1,borderColor:"#dae5f3",
    paddingHorizontal:12},
  input:{flex:1,minWidth:0,fontSize:14,paddingVertical:8,color:tokens.color.text},
  filterRow:{flexDirection:"row",gap:6},
  filter:{flex:1,borderWidth:1,borderColor:"#e1e8f3",backgroundColor:"#f7faff",
    padding:5,minHeight:46,alignItems:"center",justifyContent:"center",borderRadius:10},
  selected:{borderColor:"#a7c1f3",backgroundColor:"#eaf2ff"},
  filterText:{fontSize:11,textAlign:"center",fontWeight:"700",color:tokens.color.textMuted},
  selectedText:{fontWeight:"900",color:tokens.color.brandStrong},
  student:{borderTopWidth:1,borderTopColor:"#e9eef6",paddingTop:9,gap:9},
  expanded:{backgroundColor:"#f9fbff",padding:11,borderRadius:12,gap:10}
});
