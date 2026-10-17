import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate,formatLocalizedNumber,getDirection,localizeDigits,translate,
  type SupportedLocale,type TranslationKey
} from "@maktablink/localization";
import type { StudentTimetablePayload } from "./api";
import { studentSchoolClock, type StudentPeriod } from "./student-home-model";
import {
  studentPeriodsForDay,studentSchoolWeekdays,studentTeacherDirectory,
  studentTimetablePeriodState,studentTimeRange12,
  type StudentSchoolWeekday,type StudentTimetableView
} from "./student-timetable-model";

type Direction={textAlign:"right"|"left";writingDirection:"rtl"|"ltr"};
type Icon=keyof typeof Ionicons.glyphMap;
const weekdayKeys:Record<StudentSchoolWeekday,TranslationKey>={
  SATURDAY:"weekday.saturday",SUNDAY:"weekday.sunday",MONDAY:"weekday.monday",
  TUESDAY:"weekday.tuesday",WEDNESDAY:"weekday.wednesday",
  THURSDAY:"weekday.thursday",FRIDAY:"weekday.friday"
};

function PeriodCard({item,now,locale,textDirection,rtl,highlightToday}:{
  item:StudentPeriod;now:Date;locale:SupportedLocale;textDirection:Direction;
  rtl:boolean;highlightToday:boolean;
}) {
  const state=highlightToday?studentTimetablePeriodState(item,now):"UPCOMING";
  const active=state==="CURRENT";
  const label:TranslationKey=active?"student.scheduleInProgress":
    state==="FINISHED"?"student.scheduleCompleted":"student.scheduleUpcoming";
  return <View testID={`student-period-${item.period.id}`} style={[
    styles.period,rtl&&styles.rtl,active&&styles.currentPeriod
  ]}>
    <View style={[styles.timeColumn,active&&styles.currentTime]}>
      <Text style={styles.timeValue}>
        {studentTimeRange12(item.period.startsAt,item.period.endsAt,locale)}
      </Text>
      {highlightToday?<Text style={[styles.periodStatus,active&&styles.currentStatus]}>
        {translate(locale,label)}
      </Text>:null}
    </View>
    <View style={styles.flex}>
      <Text style={[styles.subjectName,textDirection]}>{item.subjectName}</Text>
      <Text style={[styles.teacherName,textDirection]}>
        <Ionicons name="person-outline" size={13} color={tokens.color.textMuted}/>
        {" "}{item.teacherName}
      </Text>
    </View>
    {active?<View style={styles.liveDot}/>:null}
  </View>;
}
function Empty({locale,textDirection,message,icon="calendar-clear-outline"}:{
  locale:SupportedLocale;textDirection:Direction;message:TranslationKey;icon?:Icon;
}) {
  return <View style={styles.empty}>
    <Ionicons name={icon} size={25} color={tokens.color.textMuted}/>
    <Text style={[styles.muted,textDirection]}>{translate(locale,message)}</Text>
  </View>;
}

export function StudentTimetableAgenda({
  timetable,ready,locale,textDirection
}:{
  timetable:StudentTimetablePayload|null;ready:boolean;
  locale:SupportedLocale;textDirection:Direction;
}) {
  const rtl=getDirection(locale)==="rtl";
  const [view,setView]=useState<StudentTimetableView>("TODAY");
  const [now,setNow]=useState(()=>new Date());
  const [expandedDay,setExpandedDay]=useState<StudentSchoolWeekday|"NONE"|null>(null);
  const [search,setSearch]=useState("");
  useEffect(()=>{
    const refresh=()=>setNow(new Date());
    const timer=setInterval(refresh,60_000);
    const listener=AppState.addEventListener("change",state=>{
      if(state==="active")refresh();
    });
    return ()=>{clearInterval(timer);listener.remove();};
  },[]);
  const clock=studentSchoolClock(now);
  const todayDay=clock?.weekday as StudentSchoolWeekday|undefined;
  const today=clock&&todayDay?studentPeriodsForDay(timetable,todayDay):[];
  const weekDays=studentSchoolWeekdays(locale);
  const selectedDay=expandedDay==="NONE"?null:(expandedDay??(todayDay&&weekDays.includes(todayDay)?
    todayDay:weekDays[0]));
  const teachers=studentTeacherDirectory(timetable);
  const query=search.trim().normalize("NFKC").toLocaleLowerCase();
  const shownTeachers=teachers.filter(teacher=>!query||
    teacher.teacherName.normalize("NFKC").toLocaleLowerCase().includes(query)||
    teacher.subjects.some(subject=>subject.subjectName.normalize("NFKC")
      .toLocaleLowerCase().includes(query)));

  if(!ready&&!timetable)return <View style={styles.loadingCard}>
    <ActivityIndicator color={tokens.color.brandStrong}/>
    <Text style={[styles.muted,textDirection]}>{translate(locale,"common.loading")}</Text>
  </View>;
  return <View style={styles.stack} testID="student-timetable-phase3">
    {timetable?<View style={[styles.context,rtl&&styles.rtl]}>
      <View style={styles.contextIcon}>
        <Ionicons name="school-outline" size={21} color={tokens.color.brandStrong}/>
      </View>
      <View style={styles.flex}>
        <Text style={[styles.contextName,textDirection]}>{timetable.classSection.name}</Text>
        <Text style={[styles.muted,textDirection]}>
          {localizeDigits(timetable.academicYear.name,locale)}
        </Text>
      </View>
    </View>:<Empty locale={locale} textDirection={textDirection}
      message="student.scheduleUnavailable"/>}
    <View style={[styles.tabBar,rtl&&styles.rtl]} accessibilityRole="tablist">
      {(["TODAY","WEEK","TEACHERS"] as StudentTimetableView[]).map(tab=>
        <Pressable key={tab} accessibilityRole="tab"
          accessibilityState={{selected:tab===view}}
          onPress={()=>setView(tab)} testID={`student-timetable-tab-${tab.toLowerCase()}`}
          style={[styles.tab,tab===view&&styles.activeTab]}>
          <Text style={[styles.tabText,tab===view&&styles.activeTabText]}>
            {translate(locale,tab==="TODAY"?"student.scheduleToday":
              tab==="WEEK"?"student.scheduleWeek":"student.scheduleTeachers")}
          </Text>
        </Pressable>)}
    </View>
    {view==="TODAY"?<View style={styles.stack} testID="student-timetable-today">
      <View style={[styles.heading,rtl&&styles.rtl]}>
        <Ionicons name="today-outline" size={20} color={tokens.color.brandStrong}/>
        <View style={styles.flex}>
          <Text style={[styles.title,textDirection]}>
            {translate(locale,"student.scheduleToday")}
            {todayDay&&weekdayKeys[todayDay]?
              ` · ${translate(locale,weekdayKeys[todayDay])}`:""}
          </Text>
          {clock?<Text style={[styles.muted,textDirection]}>{formatLocalizedDate(clock.day,locale)}</Text>:null}
        </View>
        <Text style={styles.count}>{formatLocalizedNumber(today.length,locale)}</Text>
      </View>
      {!timetable||today.length===0?
        <Empty locale={locale} textDirection={textDirection} message="student.noClassesToday"/>:
        <View style={styles.lessonList}>{today.map(item=>
          <PeriodCard key={item.period.id} item={item} now={now} locale={locale}
            rtl={rtl} highlightToday textDirection={textDirection}/>)}</View>}
    </View>:null}
    {view==="WEEK"?<View style={styles.stack} testID="student-timetable-week">
      <View style={[styles.heading,rtl&&styles.rtl]}>
        <Ionicons name="calendar-outline" size={20} color={tokens.color.brandStrong}/>
        <Text style={[styles.title,styles.flex,textDirection]}>
          {translate(locale,"student.scheduleWeek")}
        </Text>
        {todayDay&&weekDays.includes(todayDay)?<Pressable accessibilityRole="button"
          onPress={()=>setExpandedDay(todayDay)}
          style={styles.goToday}>
          <Text style={styles.goTodayText}>{translate(locale,"student.today")}</Text>
        </Pressable>:null}
      </View>
      {weekDays.map(day=>{
        const items=studentPeriodsForDay(timetable,day);
        const isToday=day===todayDay;
        const open=day===selectedDay;
        return <View key={day} style={[styles.dayCard,isToday&&styles.todayCard]}>
          <Pressable accessibilityRole="button"
            accessibilityState={{expanded:open}}
            onPress={()=>setExpandedDay(open?"NONE":day)}
            style={[styles.dayHeading,rtl&&styles.rtl]}
            testID={`student-day-${day.toLowerCase()}`}>
            <Ionicons name={isToday?"today":"calendar-outline"} size={19}
              color={tokens.color.brandStrong}/>
            <Text style={[styles.dayText,styles.flex,textDirection]}>
              {translate(locale,weekdayKeys[day])}
            </Text>
            {isToday?<Text style={styles.todayBadge}>{translate(locale,"student.today")}</Text>:null}
            <Text style={styles.count}>{formatLocalizedNumber(items.length,locale)}</Text>
            <Ionicons name={open?"chevron-up":"chevron-down"} size={18}
              color={tokens.color.textMuted}/>
          </Pressable>
          {open?<View style={styles.lessonList}>
            {items.length?items.map(item=><PeriodCard key={item.period.id} item={item}
              now={now} locale={locale} textDirection={textDirection} rtl={rtl}
              highlightToday={isToday}/>):
              <Empty locale={locale} textDirection={textDirection}
                message="student.noClassesForDay"/>}
          </View>:null}
        </View>;
      })}
    </View>:null}
    {view==="TEACHERS"?<View style={styles.stack} testID="student-timetable-teachers">
      <Text style={[styles.title,textDirection]}>{translate(locale,"student.scheduleTeacherDirectory")}</Text>
      <TextInput testID="student-teachers-search"
        style={[styles.search,textDirection]} value={search}
        onChangeText={setSearch} autoCapitalize="none"
        placeholder={translate(locale,"student.scheduleSearchTeachers")}/>
      <Text style={[styles.muted,textDirection]}>
        {formatLocalizedNumber(shownTeachers.length,locale)}
        {" "}{translate(locale,"student.scheduleTeachers")}
      </Text>
      {shownTeachers.length?shownTeachers.map(teacher=>
        <View key={teacher.teacherUserId} style={styles.teacherCard}>
          <View style={[styles.teacherHeading,rtl&&styles.rtl]}>
            <View style={styles.teacherAvatar}><Ionicons name="person-outline" size={21}
              color={tokens.color.brandStrong}/></View>
            <View style={styles.flex}>
              <Text style={[styles.subjectName,textDirection]}>{teacher.teacherName}</Text>
              <Text style={[styles.muted,textDirection]}>
                {formatLocalizedNumber(teacher.weeklyPeriods,locale)}
                {" "}{translate(locale,"student.scheduleWeeklyLessons")}
              </Text>
            </View>
          </View>
          <View style={[styles.subjectTags,rtl&&styles.rtl]}>
            {teacher.subjects.map(subject=>
              <Text key={subject.subjectId} style={styles.subjectTag}>{subject.subjectName}</Text>)}
          </View>
        </View>):<Empty locale={locale} textDirection={textDirection}
        icon="people-outline" message={query?
          "student.scheduleNoMatchingTeachers":"student.scheduleNoTeachers"}/>}
    </View>:null}
  </View>;
}

const styles=StyleSheet.create({
  stack:{gap:12},flex:{flex:1,minWidth:0},rtl:{flexDirection:"row-reverse"},
  context:{flexDirection:"row",alignItems:"center",gap:11,padding:14,
    borderWidth:1,borderColor:"#dce8f8",backgroundColor:"#f4f8ff",borderRadius:17},
  contextIcon:{width:43,height:43,borderRadius:13,alignItems:"center",
    justifyContent:"center",backgroundColor:"#e4efff"},
  contextName:{fontSize:16,fontWeight:"900",color:tokens.color.text},
  muted:{fontSize:12.5,lineHeight:19,color:tokens.color.textMuted},
  loadingCard:{minHeight:110,alignItems:"center",justifyContent:"center",
    borderRadius:18,backgroundColor:"#fff",gap:10,padding:18},
  tabBar:{flexDirection:"row",borderRadius:15,backgroundColor:"#eaf0f8",padding:4,gap:4},
  tab:{flex:1,minHeight:44,alignItems:"center",justifyContent:"center",
    borderRadius:12,paddingHorizontal:5},
  activeTab:{backgroundColor:"#fff",borderWidth:1,borderColor:"#c9d8f0"},
  tabText:{fontSize:12,fontWeight:"800",color:tokens.color.textMuted,textAlign:"center"},
  activeTabText:{color:tokens.color.brandStrong},
  heading:{flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:4},
  title:{fontSize:16,fontWeight:"900",color:tokens.color.text},
  count:{fontSize:12,fontWeight:"900",color:tokens.color.brandStrong,
    backgroundColor:"#eaf2ff",paddingHorizontal:10,paddingVertical:7,borderRadius:12},
  lessonList:{gap:8},
  period:{flexDirection:"row",alignItems:"center",gap:11,padding:11,
    borderRadius:14,backgroundColor:"#fff",borderWidth:1,borderColor:"#e0e7f1"},
  currentPeriod:{backgroundColor:"#eff7ff",borderColor:tokens.color.brandStrong,borderWidth:2},
  timeColumn:{width:123,gap:4,justifyContent:"center",paddingHorizontal:7,
    paddingVertical:9,backgroundColor:"#f3f6fb",borderRadius:10},
  currentTime:{backgroundColor:"#dfedff"},
  timeValue:{fontSize:11,fontWeight:"900",color:tokens.color.text,textAlign:"center"},
  periodStatus:{fontSize:10,fontWeight:"700",color:tokens.color.textMuted,textAlign:"center"},
  currentStatus:{color:tokens.color.brandStrong,fontWeight:"900"},
  subjectName:{fontSize:14,fontWeight:"900",color:tokens.color.text},
  teacherName:{fontSize:12,lineHeight:19,color:tokens.color.textMuted},
  liveDot:{width:9,height:9,borderRadius:5,backgroundColor:tokens.color.brandStrong},
  empty:{minHeight:90,alignItems:"center",justifyContent:"center",gap:8,
    padding:18,backgroundColor:"#fff",borderRadius:15,borderColor:"#e1e7f0",borderWidth:1},
  dayCard:{backgroundColor:"#fff",borderWidth:1,borderColor:"#e1e7f0",
    borderRadius:16,padding:10,gap:9},
  todayCard:{borderColor:tokens.color.brandStrong,backgroundColor:"#f4f8ff"},
  dayHeading:{minHeight:46,flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:5},
  dayText:{fontSize:14,fontWeight:"900",color:tokens.color.text},
  todayBadge:{paddingHorizontal:7,paddingVertical:5,backgroundColor:"#e1edff",
    borderRadius:9,fontSize:10,color:tokens.color.brandStrong,fontWeight:"900"},
  goToday:{minHeight:42,paddingHorizontal:10,justifyContent:"center",borderRadius:10,
    borderWidth:1,borderColor:"#c7d8f0",backgroundColor:"#fff"},
  goTodayText:{fontSize:12,color:tokens.color.brandStrong,fontWeight:"800"},
  search:{minHeight:46,borderRadius:13,borderWidth:1,borderColor:"#cbd9ed",
    paddingHorizontal:13,backgroundColor:"#fff",color:tokens.color.text},
  teacherCard:{padding:14,gap:12,backgroundColor:"#fff",borderWidth:1,
    borderColor:"#e1e7f0",borderRadius:16},
  teacherHeading:{flexDirection:"row",alignItems:"center",gap:10},
  teacherAvatar:{width:44,height:44,borderRadius:14,backgroundColor:"#e9f1ff",
    alignItems:"center",justifyContent:"center"},
  subjectTags:{flexDirection:"row",gap:7,flexWrap:"wrap"},
  subjectTag:{fontSize:12,color:tokens.color.brandStrong,fontWeight:"800",
    paddingHorizontal:10,paddingVertical:7,backgroundColor:"#eff5ff",borderRadius:10}
});
