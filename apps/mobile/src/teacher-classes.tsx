import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedNumber, getDirection, translate,
  type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import type { TeacherAcademicsPayload, TeacherLearningPayload, TeacherTodayPayload } from "./api";
import {
  teacherClassesOverview, type TeacherClassesFilter, type TeacherAssignment
} from "./teacher-classes-model";

type Direction={textAlign:"right"|"left";writingDirection:"rtl"|"ltr"};
const filters:readonly {id:TeacherClassesFilter;title:TranslationKey}[]=[
  {id:"ALL",title:"teacher.classFilterAll"},
  {id:"HOMEWORK",title:"teacher.classFilterDrafts"},
  {id:"GRADING",title:"teacher.classFilterExams"}
];

export function TeacherClassesPanel({
  academics,academicsReady,learning,learningReady,today,todayReady,
  query,onQuery,filter,onFilter,locale,textDirection,onOpenAssignment,
  onOpenAttendance,onRetry
}:{
  academics:TeacherAcademicsPayload|null;academicsReady:boolean;
  learning:TeacherLearningPayload|null;learningReady:boolean;
  today:TeacherTodayPayload|null;todayReady:boolean;
  query:string;onQuery:(value:string)=>void;
  filter:TeacherClassesFilter;onFilter:(next:TeacherClassesFilter)=>void;
  locale:SupportedLocale;textDirection:Direction;
  onOpenAssignment:(item:TeacherAssignment)=>void;
  onOpenAttendance:(classId:string,date:string)=>void;
  onRetry:()=>void;
}) {
  const rtl=getDirection(locale)==="rtl";
  const data=teacherClassesOverview(academics,learning,query,filter);
  const supervised=today?.supervisedClasses??[];
  return <View style={styles.stack} testID="teacher-classes-overview">
    <View style={styles.card}>
      <View style={[styles.heading,rtl&&styles.rtl]}>
        <View style={styles.icon}><Ionicons name="school-outline" size={22} color={tokens.color.brandStrong}/></View>
        <View style={styles.flex}>
          <Text style={[styles.title,textDirection]}>{translate(locale,"teacher.myAssignments")}</Text>
          <Text style={[styles.muted,textDirection]}>{translate(locale,"teacher.classesIntro")}</Text>
        </View>
      </View>
      <View style={[styles.metrics,rtl&&styles.rtl]}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{academicsReady&&academics?formatLocalizedNumber(data.totalClasses,locale):"—"}</Text>
          <Text style={styles.metricLabel}>{translate(locale,"teacher.classesCount")}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{academicsReady&&academics?formatLocalizedNumber(data.totalSubjects,locale):"—"}</Text>
          <Text style={styles.metricLabel}>{translate(locale,"teacher.subjectsCount")}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{learningReady&&learning?formatLocalizedNumber(data.homeworkDrafts,locale):"—"}</Text>
          <Text style={styles.metricLabel}>{translate(locale,"teacher.classFilterDrafts")}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{learningReady&&learning?formatLocalizedNumber(data.openExams,locale):"—"}</Text>
          <Text style={styles.metricLabel}>{translate(locale,"teacher.classFilterExams")}</Text>
        </View>
      </View>
      <View style={[styles.searchRow,rtl&&styles.rtl]}>
        <Ionicons name="search-outline" size={20} color={tokens.color.textMuted}/>
        <TextInput testID="teacher-classes-search" value={query} onChangeText={onQuery}
          placeholder={translate(locale,"teacher.classSearch")}
          accessibilityLabel={translate(locale,"teacher.classSearch")}
          style={[styles.search,textDirection]} autoCapitalize="none"/>
        {query.length?<Pressable accessibilityRole="button"
          accessibilityLabel={translate(locale,"teacher.classClearSearch")}
          onPress={()=>onQuery("")} style={styles.clear}>
          <Ionicons name="close-circle" size={20} color={tokens.color.textMuted}/>
        </Pressable>:null}
      </View>
      <View style={[styles.filters,rtl&&styles.rtl]} accessibilityRole="tablist">
        {filters.map(item=>{
          const disabled=item.id!=="ALL"&&(!learningReady||!learning);
          return <Pressable key={item.id} accessibilityRole="tab"
            accessibilityLabel={translate(locale,item.title)}
            accessibilityState={{selected:filter===item.id,disabled}}
            disabled={disabled} testID={`teacher-classes-filter-${item.id.toLowerCase()}`}
            onPress={()=>onFilter(item.id)}
            style={[styles.filter,filter===item.id&&styles.filterActive,disabled&&styles.disabled]}>
            <Text numberOfLines={2} style={[styles.filterLabel,filter===item.id&&styles.filterLabelActive]}>
              {translate(locale,item.title)}
            </Text>
          </Pressable>;
        })}
      </View>
    </View>
    {!academicsReady?<View style={styles.card}><Text style={[styles.muted,textDirection]}>
      {translate(locale,"common.loading")}</Text></View>
    :!academics?<Pressable accessibilityRole="button" style={styles.card} onPress={onRetry}>
      <Text style={[styles.muted,textDirection]}>{translate(locale,"teacher.noAssignments")}</Text>
      <Text style={styles.link}>{translate(locale,"action.retry")}</Text>
    </Pressable>
    :data.classes.length===0?<View style={styles.card}>
      <Text style={[styles.muted,textDirection]}>{academics.assignmentDetails.length
        ?translate(locale,"teacher.classNoMatch"):translate(locale,"teacher.noAssignments")}</Text>
      {query||filter!=="ALL"?<Pressable accessibilityRole="button"
        style={styles.reset} onPress={()=>{onQuery("");onFilter("ALL");}}>
        <Text style={styles.link}>{translate(locale,"teacher.classResetFilters")}</Text>
      </Pressable>:null}
    </View>:data.classes.map(group=><View key={group.classId} style={styles.classCard}>
      <View style={[styles.classHeading,rtl&&styles.rtl]}>
        <View style={styles.classIcon}><Ionicons name="people-outline" size={20} color={tokens.color.brandStrong}/></View>
        <View style={styles.flex}>
          <Text style={[styles.classTitle,textDirection]}>{group.className}</Text>
          <Text style={[styles.muted,textDirection]}>{group.classCode} · {
            formatLocalizedNumber(group.subjects.length,locale)} {translate(locale,"teacher.subjectsCount")}</Text>
        </View>
      </View>
      {group.subjects.map(item=><Pressable accessibilityRole="button"
        key={item.assignment.assignmentId}
        testID={`teacher-open-assignment-${item.assignment.assignmentId}`}
        accessibilityLabel={`${group.className} · ${item.assignment.subjectName}`}
        onPress={()=>onOpenAssignment(item.assignment)}
        style={({pressed})=>[styles.subject,rtl&&styles.rtl,pressed&&styles.pressed]}>
        <View style={styles.flex}>
          <Text style={[styles.subjectName,textDirection]}>{item.assignment.subjectName}</Text>
          {learningReady&&learning&&(item.homeworkDrafts||item.openExams)?
            <View style={[styles.badges,rtl&&styles.rtl]}>
              {item.homeworkDrafts>0?<Text style={styles.chip}>
                {translate(locale,"teacher.classDraftShort")} {formatLocalizedNumber(item.homeworkDrafts,locale)}
              </Text>:null}
              {item.openExams>0?<Text style={styles.chip}>
                {translate(locale,"teacher.classExamShort")} {formatLocalizedNumber(item.openExams,locale)}
              </Text>:null}
            </View>:null}
        </View>
        <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={19} color={tokens.color.brandStrong}/>
      </Pressable>)}
    </View>)}
    {supervised.length>0?<View style={styles.card}>
      <View style={[styles.heading,rtl&&styles.rtl]}>
        <Ionicons name="shield-checkmark-outline" size={20} color={tokens.color.brandStrong}/>
        <Text style={[styles.title,styles.flex,textDirection]}>{translate(locale,"teacher.supervisedClass")}</Text>
      </View>
      <Text style={[styles.muted,textDirection]}>{translate(locale,"teacher.negaranHint")}</Text>
      {!todayReady?<Text style={[styles.muted,textDirection]}>{translate(locale,"common.loading")}</Text>
      :supervised.map(item=><Pressable key={item.classId} accessibilityRole="button"
        onPress={()=>today&&onOpenAttendance(item.classId,today.date)}
        style={[styles.subject,rtl&&styles.rtl]}>
        <View style={styles.flex}>
          <Text style={[styles.subjectName,textDirection]}>{item.className} · {item.classCode}</Text>
          <Text style={[styles.muted,textDirection]}>{translate(locale,
            item.attendanceStatus==="PENDING"?"attendance.pending":"attendance.submitted")}</Text>
        </View>
        <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={18} color={tokens.color.brandStrong}/>
      </Pressable>)}
    </View>:null}
  </View>;
}
const styles=StyleSheet.create({
  stack:{gap:13},flex:{flex:1,minWidth:0},rtl:{flexDirection:"row-reverse"},
  card:{padding:15,borderWidth:1,borderColor:"#e1e7f0",borderRadius:19,backgroundColor:"#fff",gap:12},
  heading:{flexDirection:"row",alignItems:"center",gap:10},
  icon:{width:42,height:42,backgroundColor:"#eaf2ff",borderRadius:13,alignItems:"center",justifyContent:"center"},
  title:{color:tokens.color.text,fontWeight:"900",fontSize:16},
  muted:{color:tokens.color.textMuted,fontSize:12,lineHeight:18},
  link:{color:tokens.color.brandStrong,fontSize:13,fontWeight:"800"},
  metrics:{flexDirection:"row",gap:6},
  metric:{flex:1,minWidth:0,alignItems:"center",paddingVertical:10,paddingHorizontal:3,
    borderRadius:11,backgroundColor:"#f4f7fc",gap:4},
  metricValue:{fontSize:20,fontWeight:"900",color:tokens.color.brandStrong},
  metricLabel:{fontSize:10,lineHeight:14,textAlign:"center",color:tokens.color.textMuted},
  searchRow:{flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:12,minHeight:49,
    borderRadius:13,borderWidth:1,borderColor:"#dae5f4",backgroundColor:"#fbfdff"},
  search:{flex:1,minWidth:0,fontSize:14,color:tokens.color.text,paddingVertical:7},
  clear:{minWidth:32,minHeight:36,justifyContent:"center",alignItems:"center"},
  filters:{flexDirection:"row",gap:6},
  filter:{flex:1,minHeight:43,justifyContent:"center",alignItems:"center",
    backgroundColor:"#f6f9fe",borderColor:"#e1e8f3",borderWidth:1,borderRadius:11,padding:5},
  filterActive:{backgroundColor:"#e8f1ff",borderColor:"#a6c3f3"},
  disabled:{opacity:0.42},
  filterLabel:{textAlign:"center",fontSize:11,fontWeight:"700",color:tokens.color.textMuted},
  filterLabelActive:{color:tokens.color.brandStrong,fontWeight:"900"},
  classCard:{padding:12,borderWidth:1,borderColor:"#dfe8f5",borderRadius:18,
    backgroundColor:"#fff",gap:9},
  classHeading:{flexDirection:"row",alignItems:"center",gap:9,padding:4},
  classIcon:{height:39,width:39,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:"#eaf2ff"},
  classTitle:{fontSize:15,fontWeight:"900",color:tokens.color.text},
  subject:{flexDirection:"row",alignItems:"center",gap:10,minHeight:62,
    padding:12,borderRadius:12,backgroundColor:"#f7faff"},
  subjectName:{fontSize:14,fontWeight:"800",color:tokens.color.text},
  badges:{flexDirection:"row",gap:5,flexWrap:"wrap",marginTop:5},
  chip:{color:tokens.color.brandStrong,backgroundColor:"#e6f0ff",overflow:"hidden",
    borderRadius:7,fontSize:11,fontWeight:"700",paddingVertical:4,paddingHorizontal:7},
  reset:{alignSelf:"flex-start",minHeight:40,justifyContent:"center",paddingHorizontal:10,
    backgroundColor:"#e9f2ff",borderRadius:10},
  pressed:{opacity:0.75}
});
