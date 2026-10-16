import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate, formatLocalizedNumber, getDirection, translate,
  type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import type { TeacherAcademicsPayload, TeacherTodayPayload } from "./api";
import { teacherTime12 } from "./teacher-hub-data";
import { kabulTeacherClock } from "./teacher-today-model";
import {
  TEACHER_SCHOOL_WEEKDAYS, teacherKabulWeekday, teacherPeriodsForDay,
  teacherSchedulePeriodState, teacherShiftWeekday,
  type TeacherSchedulePeriod, type TeacherWeekday
} from "./teacher-schedule-model";

type Direction = { textAlign:"right"|"left"; writingDirection:"rtl"|"ltr" };
export type TeacherScheduleView = "DAY" | "WEEK";
const weekdayKey: Record<TeacherWeekday,TranslationKey> = {
  SATURDAY:"weekday.saturday", SUNDAY:"weekday.sunday",
  MONDAY:"weekday.monday", TUESDAY:"weekday.tuesday",
  WEDNESDAY:"weekday.wednesday", THURSDAY:"weekday.thursday",
  FRIDAY:"weekday.friday"
};

function LessonRow({period, today, now, locale, textDirection, rtl, onOpen}:{
  period:TeacherSchedulePeriod;
  today:TeacherTodayPayload|null;
  now:Date;locale:SupportedLocale;textDirection:Direction;rtl:boolean;
  onOpen:(period:TeacherSchedulePeriod)=>void;
}) {
  const status=teacherSchedulePeriodState(period,today,now);
  const statusKey=status==="CURRENT"?"teacher.scheduleCurrent":
    status==="FINISHED"?"teacher.scheduleFinished":"teacher.scheduleUpcoming";
  return <Pressable accessibilityRole="button" testID={`teacher-schedule-period-${period.id}`}
    accessibilityLabel={`${period.subjectName} · ${period.className} · ${teacherTime12(period.startsAt)}`}
    onPress={()=>onOpen(period)}
    style={({pressed})=>[styles.period,rtl&&styles.rowRtl,
      status==="CURRENT"&&styles.currentPeriod,pressed&&styles.pressed]}>
    <View style={[styles.time, status==="CURRENT"&&styles.currentTime]}>
      <Text style={styles.timeText}>{teacherTime12(period.startsAt)}</Text>
      <Text style={styles.endTime}>{teacherTime12(period.endsAt)}</Text>
    </View>
    <View style={styles.flex}>
      <Text style={[styles.lessonName,textDirection]}>{period.subjectName}</Text>
      <Text style={[styles.subText,textDirection]}>{period.className} · {period.classCode}</Text>
      {status?<Text style={[styles.stateText,
        status==="CURRENT"&&styles.currentState,status==="FINISHED"&&styles.finishedState,
        textDirection]}>{translate(locale,statusKey)}</Text>:null}
    </View>
    <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={19}
      color={tokens.color.brandStrong}/>
  </Pressable>;
}

/** Weekly schedule is a recurring template. Daily exceptions require server
 * support; never label an unsupplied cancellation or substitution. */
export function TeacherSchedulePanel({
  academics,today,ready,locale,textDirection,view,onViewChange,
  selectedWeekday,onSelectWeekday,onOpenPeriod,onRetry
}:{
  academics:TeacherAcademicsPayload|null;
  today:TeacherTodayPayload|null;
  ready:boolean;locale:SupportedLocale;textDirection:Direction;
  view:TeacherScheduleView;onViewChange:(view:TeacherScheduleView)=>void;
  selectedWeekday:TeacherWeekday|null;
  onSelectWeekday:(day:TeacherWeekday)=>void;
  onOpenPeriod:(period:TeacherSchedulePeriod)=>void;
  onRetry:()=>void;
}) {
  const rtl=getDirection(locale)==="rtl";
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{
    const timer=setInterval(()=>setNow(new Date()),60_000);
    const sub=AppState.addEventListener("change",state=>{
      if(state==="active")setNow(new Date());
    });
    return ()=>{clearInterval(timer);sub.remove();};
  },[]);
  const liveWeekday=teacherKabulWeekday(now);
  const currentDay=selectedWeekday??liveWeekday??"SATURDAY";
  const clock=kabulTeacherClock(now);
  const isToday=(weekday:TeacherWeekday)=>liveWeekday===weekday&&today?.date===clock?.date;
  const dayItems=teacherPeriodsForDay(academics,currentDay);
  const weekDays:TeacherWeekday[]=[
    ...TEACHER_SCHOOL_WEEKDAYS,
    ...(teacherPeriodsForDay(academics,"FRIDAY").length?["FRIDAY" as const]:[])
  ];
  const toToday=()=>onSelectWeekday(liveWeekday??"SATURDAY");
  const allCount=weekDays.reduce((total,day)=>total+teacherPeriodsForDay(academics,day).length,0);
  return <View style={styles.card} testID="teacher-schedule-panel">
    <View style={[styles.header,rtl&&styles.rowRtl]}>
      <View style={styles.headerIcon}><Ionicons name="calendar-outline" size={21} color={tokens.color.brandStrong}/></View>
      <View style={styles.flex}>
        <Text style={[styles.title,textDirection]}>{translate(locale,"teacher.fullSchedule")}</Text>
        <Text style={[styles.subText,textDirection]}>{translate(locale,"teacher.scheduleTemplateHint")}</Text>
      </View>
    </View>
    <View style={[styles.segmented,rtl&&styles.rowRtl]} accessibilityRole="tablist">
      {(["DAY","WEEK"] as const).map(id=>(
        <Pressable key={id} accessibilityRole="tab" accessibilityState={{selected:view===id}}
          testID={`teacher-schedule-view-${id.toLowerCase()}`}
          onPress={()=>onViewChange(id)}
          style={[styles.segment,view===id&&styles.segmentSelected]}>
          <Ionicons name={id==="DAY"?"today-outline":"calendar-outline"} size={18}
            color={view===id?tokens.color.brandStrong:tokens.color.textMuted}/>
          <Text style={[styles.segmentText,view===id&&styles.segmentTextActive]}>
            {translate(locale,id==="DAY"?"teacher.scheduleDay":"teacher.scheduleWeek")}
          </Text>
        </Pressable>
      ))}
    </View>
    {!ready?<View style={styles.loading}><ActivityIndicator color={tokens.color.brandStrong}/>
      <Text style={[styles.subText,textDirection]}>{translate(locale,"common.loading")}</Text>
    </View>:!academics?<Pressable accessibilityRole="button" style={styles.empty}
      onPress={onRetry}>
      <Text style={[styles.subText,textDirection]}>{translate(locale,"teacher.noSchedule")}</Text>
      <Text style={styles.linkText}>{translate(locale,"action.retry")}</Text>
    </Pressable>:view==="DAY"?(
      <View style={styles.group}>
        <View style={[styles.dayControls,rtl&&styles.rowRtl]}>
          <Pressable accessibilityRole="button" testID="teacher-schedule-previous-day"
            accessibilityLabel={translate(locale,"teacher.schedulePrevious")}
            onPress={()=>onSelectWeekday(teacherShiftWeekday(currentDay,-1))}
            style={styles.dayArrow}>
            <Ionicons name={rtl?"chevron-forward":"chevron-back"} size={23} color={tokens.color.brandStrong}/>
          </Pressable>
          <View style={styles.flex}>
            <Text style={[styles.dayTitle,{textAlign:"center"}]}>
              {translate(locale,weekdayKey[currentDay])}
            </Text>
            {isToday(currentDay)&&clock?
              <Text style={styles.todayDate}>{formatLocalizedDate(clock.date,locale)}</Text>:null}
            <Text style={styles.lessonCount}>
              {formatLocalizedNumber(dayItems.length,locale)} {translate(locale,"teacher.periodCount")}
            </Text>
          </View>
          <Pressable accessibilityRole="button" testID="teacher-schedule-next-day"
            accessibilityLabel={translate(locale,"teacher.scheduleNext")}
            onPress={()=>onSelectWeekday(teacherShiftWeekday(currentDay,1))}
            style={styles.dayArrow}>
            <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={23} color={tokens.color.brandStrong}/>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" testID="teacher-schedule-today"
          style={[styles.todayButton,rtl&&styles.rowRtl]}
          onPress={toToday}>
          <Ionicons name="locate-outline" size={17} color={tokens.color.brandStrong}/>
          <Text style={styles.linkText}>{translate(locale,"student.today")}</Text>
        </Pressable>
        {dayItems.map(period=><LessonRow key={period.id}
          period={period} today={today} now={now} locale={locale}
          textDirection={textDirection} rtl={rtl} onOpen={onOpenPeriod}/>)}
        {!dayItems.length?<Text style={[styles.emptyText,textDirection]}>
          {translate(locale,"teacher.noClassesForDay")}
        </Text>:null}
      </View>
    ):(
      <View style={styles.group} testID="teacher-schedule-week-list">
        <View style={[styles.weekHead,rtl&&styles.rowRtl]}>
          <Text style={[styles.subText,textDirection]}>
            {formatLocalizedNumber(allCount,locale)} {translate(locale,"teacher.periodCount")}
          </Text>
          <Pressable accessibilityRole="button" onPress={()=>{
            toToday();onViewChange("DAY");
          }} style={styles.todayButton}>
            <Text style={styles.linkText}>{translate(locale,"student.today")}</Text>
          </Pressable>
        </View>
        {weekDays.map(weekday=>{
          const items=teacherPeriodsForDay(academics,weekday);
          return <View key={weekday} style={[styles.dayCard,isToday(weekday)&&styles.highlightDay]}>
            <Pressable accessibilityRole="button"
              testID={`teacher-schedule-open-day-${weekday.toLowerCase()}`}
              accessibilityLabel={translate(locale,weekdayKey[weekday])}
              onPress={()=>{onSelectWeekday(weekday);onViewChange("DAY");}}
              style={[styles.dayCardHeader,rtl&&styles.rowRtl]}>
              <Text style={[styles.dayLabel,textDirection]}>{translate(locale,weekdayKey[weekday])}</Text>
              {isToday(weekday)?<Text style={styles.todayBadge}>{translate(locale,"student.today")}</Text>:null}
              <Text style={styles.dayCount}>{formatLocalizedNumber(items.length,locale)}</Text>
              <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={17} color={tokens.color.brandStrong}/>
            </Pressable>
            {items.slice(0,2).map(period=><LessonRow key={period.id}
              period={period} today={today} now={now} locale={locale}
              textDirection={textDirection} rtl={rtl} onOpen={onOpenPeriod}/>)}
            {items.length>2?<Pressable accessibilityRole="button" style={styles.seeDay}
              onPress={()=>{onSelectWeekday(weekday);onViewChange("DAY");}}>
              <Text style={styles.linkText}>{translate(locale,"teacher.scheduleViewDay")} · {
                formatLocalizedNumber(items.length-2,locale)
              }</Text>
              <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={16} color={tokens.color.brandStrong}/>
            </Pressable>:null}
            {!items.length?<Text style={[styles.subText,textDirection]}>
              {translate(locale,"teacher.noClassesForDay")}
            </Text>:null}
          </View>;
        })}
      </View>
    )}
  </View>;
}

const styles=StyleSheet.create({
  card:{padding:15,borderWidth:1,borderColor:"#e1e7f0",borderRadius:21,
    backgroundColor:tokens.color.surface,gap:13},
  flex:{flex:1,minWidth:0},
  rowRtl:{flexDirection:"row-reverse"},
  header:{flexDirection:"row",alignItems:"center",gap:10},
  headerIcon:{width:40,height:40,borderRadius:13,backgroundColor:"#edf3ff",
    alignItems:"center",justifyContent:"center"},
  title:{fontSize:16,fontWeight:"900",color:tokens.color.text},
  subText:{fontSize:12,lineHeight:19,color:tokens.color.textMuted},
  segmented:{flexDirection:"row",gap:5,padding:4,borderRadius:14,backgroundColor:"#f0f4fa"},
  segment:{flex:1,minHeight:46,alignItems:"center",justifyContent:"center",flexDirection:"row",
    gap:7,borderRadius:11},
  segmentSelected:{backgroundColor:"#fff",borderWidth:1,borderColor:"#b8cef0"},
  segmentText:{color:tokens.color.textMuted,fontWeight:"700",fontSize:13},
  segmentTextActive:{color:tokens.color.brandStrong,fontWeight:"900"},
  group:{gap:10},
  loading:{minHeight:100,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:12},
  dayControls:{flexDirection:"row",alignItems:"center",gap:8,backgroundColor:"#f7faff",
    borderRadius:14,padding:8},
  dayArrow:{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center",
    borderRadius:12,backgroundColor:"#e9f1fd"},
  dayTitle:{fontSize:17,fontWeight:"900",color:tokens.color.text},
  lessonCount:{fontSize:12,fontWeight:"700",color:tokens.color.textMuted,textAlign:"center",marginTop:3},
  todayDate:{fontSize:11,fontWeight:"800",color:tokens.color.brandStrong,textAlign:"center",marginTop:2},
  todayButton:{alignSelf:"flex-start",flexDirection:"row",alignItems:"center",gap:6,
    minHeight:40,borderRadius:10,backgroundColor:"#e9f2ff",paddingHorizontal:13},
  linkText:{fontSize:12.5,fontWeight:"800",color:tokens.color.brandStrong},
  period:{flexDirection:"row",alignItems:"center",gap:11,padding:10,
    backgroundColor:"#f7faff",borderRadius:13,minHeight:67},
  currentPeriod:{backgroundColor:"#e9f8ee",borderWidth:1,borderColor:"#82cb9c"},
  time:{minWidth:78,alignItems:"center",justifyContent:"center",borderRadius:11,
    backgroundColor:"#e8f1fc",paddingVertical:9,paddingHorizontal:6},
  currentTime:{backgroundColor:"#dbf4e3"},
  timeText:{fontSize:12,fontWeight:"900",color:tokens.color.brandStrong},
  endTime:{fontSize:10,marginTop:2,color:tokens.color.textMuted},
  lessonName:{fontSize:14,fontWeight:"800",color:tokens.color.text},
  stateText:{fontSize:11,fontWeight:"700",marginTop:5,color:tokens.color.textMuted},
  currentState:{color:"#267a45",fontWeight:"900"},
  finishedState:{color:tokens.color.textMuted},
  empty:{padding:14,borderRadius:13,gap:8,backgroundColor:"#f7faff"},
  emptyText:{padding:15,color:tokens.color.textMuted,fontSize:13},
  weekHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},
  dayCard:{padding:11,borderWidth:1,borderColor:"#e1e8f2",borderRadius:15,gap:8},
  highlightDay:{borderColor:"#8bbaf8",backgroundColor:"#f6faff"},
  dayCardHeader:{flexDirection:"row",alignItems:"center",gap:8,minHeight:45},
  dayLabel:{flex:1,minWidth:0,fontSize:14,fontWeight:"900",color:tokens.color.text},
  todayBadge:{fontSize:10.5,fontWeight:"800",color:tokens.color.brandStrong},
  dayCount:{minWidth:26,textAlign:"center",fontWeight:"800",color:tokens.color.brandStrong},
  seeDay:{alignSelf:"flex-start",minHeight:38,paddingHorizontal:9,flexDirection:"row",
    alignItems:"center",gap:7,backgroundColor:"#edf4ff",borderRadius:10},
  pressed:{opacity:0.75}
});
