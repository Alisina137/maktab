import {useEffect,useMemo,useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,View} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {tokens} from "@maktablink/design-tokens";
import {formatLocalizedDate,formatLocalizedNumber,getDirection,localizeDigits,translate,
  type SupportedLocale,type TranslationKey} from "@maktablink/localization";
import {api,type ParentAttendanceDay,type AttendanceStatus} from "./api";
import {attendanceMonth,adjacentAttendanceMonth} from "./parent-attendance-model";
import {studentVisibleAttendance,studentAttendanceSummary,studentAttendanceWeekdays,
  studentCalendarOffset,studentAttendanceStatus} from "./student-records-model";
import {studentSchoolClock} from "./student-home-model";

type Direction={textAlign:"left"|"right";writingDirection:"ltr"|"rtl"};
type Load={key:string;status:"loading"|"ready"|"error";days:ParentAttendanceDay[];today:string};
const statusKey:Record<AttendanceStatus,TranslationKey>={
  PRESENT:"attendance.present",ABSENT:"attendance.absent",
  LATE:"attendance.late",EXCUSED:"attendance.excused"
};
const colors:Record<AttendanceStatus,string>={
  PRESENT:tokens.color.success,ABSENT:tokens.color.danger,
  LATE:tokens.color.warning,EXCUSED:tokens.color.brand
};

export function StudentAttendanceContent({
  accessToken,studentId,locale,textDirection,onSensitiveError
}:{
  accessToken:string;studentId:string;locale:SupportedLocale;textDirection:Direction;
  onSensitiveError:(cause:unknown)=>void;
}) {
  const rtl=getDirection(locale)==="rtl";
  const clock=studentSchoolClock(new Date());
  const todayLocal=clock?.day??new Date().toISOString().slice(0,10);
  const [anchor,setAnchor]=useState(todayLocal);
  const [selected,setSelected]=useState(todayLocal);
  const [retry,setRetry]=useState(0);
  const month=useMemo(()=>attendanceMonth(anchor,locale),[anchor,locale]);
  const key=`${studentId}:${accessToken}:${month.from}:${month.to}`;
  const [load,setLoad]=useState<Load>({key:"",status:"loading",days:[],today:todayLocal});
  useEffect(()=>{
    let active=true;
    setLoad({key,status:"loading",days:[],today:todayLocal});
    void api.studentAttendance(accessToken,month.from,month.to).then(data=>{
      if(!active)return;
      setLoad({key,status:"ready",days:data.days,today:data.today});
    }).catch(cause=>{
      if(!active)return;
      setLoad({key,status:"error",days:[],today:todayLocal});
      onSensitiveError(cause);
    });
    return ()=>{active=false;};
  },[key,retry]);
  const current=load.key===key;
  const status=current?load.status:"loading";
  const today=current?load.today:todayLocal;
  const days=studentVisibleAttendance(status==="ready"?load.days:[],
    month.from,month.to,today);
  const summary=studentAttendanceSummary(days,month.from,month.to,today);
  const recorded=new Map(days.map(day=>[day.date,day]));
  const selectedDay=selected>=month.from&&selected<=month.to?selected:
    (today>=month.from&&today<=month.to?today:month.from);
  const selectedMark=recorded.get(selectedDay);
  function go(direction:-1|1) {
    const next=adjacentAttendanceMonth(anchor,locale,direction);
    if(next>today)return;
    setAnchor(next);setSelected("");
  }
  return <View style={styles.stack} testID="student-attendance-phase6">
    <View style={styles.card}>
      <View style={[styles.row,rtl&&styles.rtl]}>
        <Ionicons name="calendar-outline" size={22} color={tokens.color.brandStrong}/>
        <Text style={[styles.heading,styles.flex,textDirection]}>
          {translate(locale,"student.attendanceCalendar")}
        </Text>
      </View>
      <Text style={[styles.muted,textDirection]}>
        {translate(locale,"student.attendanceExplanation")}
      </Text>
      <View style={[styles.monthRow,rtl&&styles.rtl]}>
        <Pressable accessibilityRole="button" onPress={()=>go(-1)}
          style={styles.arrow} accessibilityLabel={translate(locale,"parent.attendancePrevious")}>
          <Ionicons name={rtl?"chevron-forward":"chevron-back"} size={21}
            color={tokens.color.brandStrong}/>
        </Pressable>
        <Text style={styles.monthTitle}>{month.title}</Text>
        <Pressable accessibilityRole="button" onPress={()=>go(1)}
          disabled={month.to>=today} style={[styles.arrow,month.to>=today&&styles.disabled]}
          accessibilityLabel={translate(locale,"parent.attendanceNext")}>
          <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={21}
            color={tokens.color.brandStrong}/>
        </Pressable>
      </View>
      <View style={[styles.calendar,rtl&&styles.rtl]}>
        {studentAttendanceWeekdays(locale).map((name,index)=>
          <View key={index} style={styles.cell}><Text style={styles.weekday} numberOfLines={1}>
            {name}</Text></View>)}
        {Array.from({length:studentCalendarOffset(month.from,locale)},(_,i)=>
          <View key={`gap-${i}`} style={styles.cell}/>)}
        {month.dates.map(({iso,day})=>{
          const mark=recorded.get(iso);
          const future=iso>today;
          const active=selectedDay===iso;
          return <View key={iso} style={styles.cell}>
            <Pressable accessibilityRole="button" disabled={future}
              onPress={()=>setSelected(iso)}
              accessibilityState={{selected:active,disabled:future}}
              accessibilityLabel={formatLocalizedDate(iso,locale)+": "+translate(locale,
                mark?statusKey[mark.status]:"attendance.notRecorded")}
              style={[styles.day,active&&styles.activeDay,future&&styles.disabled]}>
              <Text style={[styles.dayNumber,active&&styles.activeDayNumber]}>
                {localizeDigits(day,locale)}</Text>
              {mark?<View style={[styles.dot,{backgroundColor:colors[mark.status]}]}/>:
                <View style={styles.dotPlaceholder}/>}
            </Pressable>
          </View>;
        })}
      </View>
      <View style={[styles.legend,rtl&&styles.rtl]}>
        {studentAttendanceStatus.map(value=><View key={value} style={styles.legendEntry}>
          <View style={[styles.dot,{backgroundColor:colors[value]}]}/>
          <Text style={styles.legendText}>{translate(locale,statusKey[value])}</Text>
        </View>)}
      </View>
      {status==="loading"?<ActivityIndicator color={tokens.color.brandStrong}/>:
        status==="error"?<View style={styles.failure}>
          <Text style={[styles.muted,textDirection]}>
            {translate(locale,"student.recordsLoadError")}</Text>
          <Pressable accessibilityRole="button" onPress={()=>setRetry(x=>x+1)}
            style={styles.refresh}><Text style={styles.refreshText}>
              {translate(locale,"student.recordsRetry")}</Text></Pressable>
        </View>:null}
    </View>
    {status==="ready"?<>
      <View style={styles.card}>
        <Text style={[styles.heading,textDirection]}>
          {translate(locale,"student.attendanceSummary")}</Text>
        <View style={[styles.grid,rtl&&styles.rtl]}>
          {studentAttendanceStatus.map(value=><View key={value} style={styles.stat}>
            <Text style={[styles.statNumber,{color:colors[value]}]}>
              {formatLocalizedNumber(summary.counts[value],locale)}</Text>
            <Text style={styles.legendText}>{translate(locale,statusKey[value])}</Text>
          </View>)}
        </View>
        <View style={[styles.row,rtl&&styles.rtl]}>
          <Text style={[styles.muted,styles.flex,textDirection]}>
            {translate(locale,"student.attendanceRate")}</Text>
          <Text style={styles.strong}>
            {summary.rate===null?"—":formatLocalizedNumber(summary.rate,locale)+"%"}</Text>
        </View>
        <Text style={[styles.muted,textDirection]}>
          {translate(locale,"student.attendanceRateHelp")}</Text>
      </View>
      <View style={styles.card}>
        <Text style={[styles.heading,textDirection]}>
          {translate(locale,"student.attendanceSelected")}</Text>
        <Text style={[styles.muted,textDirection]}>{formatLocalizedDate(selectedDay,locale)}</Text>
        <Text style={[styles.strong,textDirection]}>
          {selectedMark?translate(locale,statusKey[selectedMark.status]):
            translate(locale,"attendance.notRecorded")}</Text>
        {selectedMark?.note?<Text style={[styles.muted,textDirection]}>{selectedMark.note}</Text>:null}
      </View>
      <View style={styles.card}>
        <Text style={[styles.heading,textDirection]}>
          {translate(locale,"student.attendanceHistory")}</Text>
        {days.length?days.map(day=><Pressable key={day.date} accessibilityRole="button"
          onPress={()=>setSelected(day.date)} style={[styles.historyRow,rtl&&styles.rtl]}>
          <View style={[styles.dot,{backgroundColor:colors[day.status]}]}/>
          <View style={styles.flex}>
            <Text style={[styles.strong,textDirection]}>{formatLocalizedDate(day.date,locale)}</Text>
            <Text style={[styles.muted,textDirection]}>{day.className}</Text>
          </View>
          <Text style={styles.muted}>{translate(locale,statusKey[day.status])}</Text>
        </Pressable>):<Text style={[styles.muted,textDirection]}>
          {translate(locale,"student.attendanceNoRecords")}</Text>}
      </View>
    </>:null}
  </View>;
}
const styles=StyleSheet.create({
  stack:{gap:14},flex:{flex:1,minWidth:0},rtl:{flexDirection:"row-reverse"},
  card:{backgroundColor:"#fff",borderRadius:17,borderWidth:1,
    borderColor:"#e1e8f1",padding:14,gap:12},
  row:{flexDirection:"row",alignItems:"center",gap:8},
  heading:{fontSize:16,fontWeight:"900",color:tokens.color.text},
  muted:{fontSize:12,lineHeight:18,color:tokens.color.textMuted},
  strong:{fontSize:14,fontWeight:"800",color:tokens.color.text},
  monthRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},
  monthTitle:{fontSize:14,fontWeight:"900",color:tokens.color.text,textAlign:"center",flex:1},
  arrow:{height:42,width:42,borderRadius:12,alignItems:"center",justifyContent:"center",
    backgroundColor:"#f0f6ff"},
  disabled:{opacity:0.3},
  calendar:{flexDirection:"row",flexWrap:"wrap",rowGap:3},
  cell:{width:"14.2857%",padding:2,alignItems:"center"},
  weekday:{fontSize:10,fontWeight:"800",color:tokens.color.textMuted,textAlign:"center"},
  day:{minHeight:45,minWidth:36,paddingVertical:5,alignItems:"center",
    justifyContent:"center",gap:4,borderRadius:10},
  activeDay:{backgroundColor:"#e4efff",borderWidth:1,borderColor:tokens.color.brandStrong},
  dayNumber:{fontSize:12,fontWeight:"800",color:tokens.color.text},
  activeDayNumber:{color:tokens.color.brandStrong},
  dot:{height:8,width:8,borderRadius:4},
  dotPlaceholder:{height:8},
  legend:{flexDirection:"row",flexWrap:"wrap",gap:12},
  legendEntry:{flexDirection:"row",gap:5,alignItems:"center"},
  legendText:{fontSize:11,color:tokens.color.textMuted},
  grid:{flexDirection:"row",gap:7,flexWrap:"wrap"},
  stat:{minWidth:"21%",flexGrow:1,borderRadius:11,backgroundColor:"#f5f8ff",
    alignItems:"center",padding:10,gap:5},
  statNumber:{fontSize:19,fontWeight:"900"},
  historyRow:{flexDirection:"row",alignItems:"center",gap:12,paddingVertical:12,
    borderBottomWidth:1,borderBottomColor:"#eef1f6"},
  failure:{gap:9,alignItems:"flex-start"},
  refresh:{minHeight:42,borderRadius:10,paddingHorizontal:15,
    justifyContent:"center",backgroundColor:"#e9f2ff"},
  refreshText:{fontWeight:"800",fontSize:12,color:tokens.color.brandStrong}
});
