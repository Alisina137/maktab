import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate, formatLocalizedNumber,
  getDirection, localizeDigits, translate, type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import type {
  AnnouncementPayload, HomeworkSubmissionPayload, LearnerAcademicPayload,
  ParentNotification, StudentTimetablePayload
} from "./api";
import {
  studentAcademicOverview, studentHomeworkOverview, studentLatestAnnouncement,
  studentLessonFocus, studentSchoolClock, studentTodayLessons
} from "./student-home-model";
import {studentTimeRange12} from "./student-timetable-model";
import {studentVisibleResults} from "./student-results-model";

type Direction={textAlign:"left"|"right";writingDirection:"ltr"|"rtl"};
type Icon=keyof typeof Ionicons.glyphMap;

function Stat({label,value,icon,onPress,rtl,textDirection}:{
  label:string;value:string;icon:Icon;onPress:()=>void;rtl:boolean;textDirection:Direction;
}){
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}
    onPress={onPress} style={({pressed})=>[styles.stat,pressed&&styles.pressed]}>
    <View style={[styles.statHeading,rtl&&styles.rtl]}>
      <View style={styles.statIcon}><Ionicons name={icon} size={17} color={tokens.color.brandStrong}/></View>
      <Ionicons name="arrow-up-outline" size={14} color={tokens.color.textMuted}/>
    </View>
    <Text style={[styles.statValue,textDirection]}>{value}</Text>
    <Text style={[styles.statLabel,textDirection]}>{label}</Text>
  </Pressable>;
}
function Section({title,icon,rtl,textDirection,onOpen,actionKey,locale,children}:{
  title:string;icon:Icon;rtl:boolean;textDirection:Direction;
  onOpen?:()=>void;actionKey?:TranslationKey;locale:SupportedLocale;
  children:ReactNode;
}){
  return <View style={styles.sectionCard}>
    <View style={[styles.sectionHeading,rtl&&styles.rtl]}>
      <View style={styles.sectionIcon}><Ionicons name={icon} size={19} color={tokens.color.brandStrong}/></View>
      <Text style={[styles.sectionTitle,styles.flex,textDirection]}>{title}</Text>
      {onOpen&&actionKey?<Pressable accessibilityRole="button"
        accessibilityLabel={translate(locale,actionKey)}
        onPress={onOpen} style={styles.seeAll}>
        <Text style={styles.seeAllText}>{translate(locale,actionKey)}</Text>
        <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={16} color={tokens.color.brandStrong}/>
      </Pressable>:null}
    </View>
    {children}
  </View>;
}
function Loading({locale}:{locale:SupportedLocale}){
  return <View style={styles.loading}><ActivityIndicator color={tokens.color.brandStrong}/>
    <Text style={styles.muted}>{translate(locale,"common.loading")}</Text></View>;
}

export function StudentDashboard({
  timetable,timetableReady,learning,learningReady,submissions,submissionsReady,
  announcements,notifications,communicationReady,locale,textDirection,
  onOpenTimetable,onOpenHomework,onOpenResults,onOpenAnnouncements,onOpenNotifications
}:{
  timetable:StudentTimetablePayload|null;timetableReady:boolean;
  learning:LearnerAcademicPayload|null;learningReady:boolean;
  submissions:HomeworkSubmissionPayload[]|null;submissionsReady:boolean;
  announcements:AnnouncementPayload[];notifications:ParentNotification[];
  communicationReady:boolean;locale:SupportedLocale;textDirection:Direction;
  onOpenTimetable:()=>void;onOpenHomework:()=>void;onOpenResults:()=>void;
  onOpenAnnouncements:()=>void;onOpenNotifications:()=>void;
}){
  const rtl=getDirection(locale)==="rtl";
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{
    const interval=setInterval(()=>setNow(new Date()),60_000);
    const listener=AppState.addEventListener("change",state=>{
      if(state==="active")setNow(new Date());
    });
    return ()=>{clearInterval(interval);listener.remove();};
  },[]);
  const student=timetable?.student??learning?.student??null;
  const clock=studentSchoolClock(now);
  const today=studentTodayLessons(timetable,now);
  const focus=studentLessonFocus(timetable,now);
  const homeworks=studentHomeworkOverview(learning?.homework??[],submissions,now);
  const academic=studentAcademicOverview(studentVisibleResults(learning));
  const latest=academic.latest;
  const schoolUpdate=studentLatestAnnouncement(announcements,student?.classId??null);
  const unread=notifications.filter(item=>!item.readAt).length;
  const loadingTimetable=!timetableReady&&!timetable;
  const loadingAcademic=!learningReady&&!learning;
  const unknownHomework=loadingAcademic||!submissionsReady||submissions===null;
  const n=(value:number|null)=>value===null?"—":formatLocalizedNumber(value,locale);
  const lesson=focus.period;
  const lessonLabel=focus.state==="CURRENT"?"student.homeCurrentLesson":
    focus.state==="NEXT"?"student.homeNextLesson":
    focus.state==="DONE"?"student.homeLessonsFinished":"student.noClassesToday";
  return <View style={styles.stack} testID="student-home-dashboard-phase2">
    <View style={styles.identity}>
      <View style={[styles.identityRow,rtl&&styles.rtl]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{student?.fullName?.slice(0,1)??"•"}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.studentName,textDirection]}>{student?.fullName??
            translate(locale,"student.homeTitle")}</Text>
          <Text style={[styles.meta,textDirection]}>
            {timetable?.classSection.name??"—"} · {student?.studentCode?
              localizeDigits(student.studentCode,locale):"—"}
          </Text>
          <Text style={[styles.meta,textDirection]}>{timetable?
            localizeDigits(timetable.academicYear.name,locale):""}</Text>
        </View>
      </View>
    </View>

    <View style={[styles.sectionHeading,rtl&&styles.rtl]}>
      <View style={styles.sectionIcon}><Ionicons name="sunny-outline" size={19} color={tokens.color.brandStrong}/></View>
      <View style={styles.flex}>
        <Text style={[styles.sectionTitle,textDirection]}>
          {translate(locale,"student.homeAtGlance")}
        </Text>
        {clock?<Text style={[styles.meta,textDirection]}>
          {formatLocalizedDate(clock.day,locale)}
        </Text>:null}
      </View>
    </View>
    <View style={styles.stats}>
      <Stat icon="calendar-outline" rtl={rtl} textDirection={textDirection}
        label={translate(locale,"student.homeClassesToday")}
        value={loadingTimetable?"—":n(focus.state==="UNKNOWN"?null:focus.todayCount)}
        onPress={onOpenTimetable}/>
      <Stat icon="document-text-outline" rtl={rtl} textDirection={textDirection}
        label={translate(locale,"student.homePendingHomework")}
        value={unknownHomework?"—":n(homeworks.pending)} onPress={onOpenHomework}/>
      <Stat icon="alert-circle-outline" rtl={rtl} textDirection={textDirection}
        label={translate(locale,"student.homeDueToday")}
        value={unknownHomework?"—":n(homeworks.dueToday)} onPress={onOpenHomework}/>
      <Stat icon="notifications-outline" rtl={rtl} textDirection={textDirection}
        label={translate(locale,"student.unreadNotifications")}
        value={!communicationReady?"—":n(unread)} onPress={onOpenNotifications}/>
    </View>
    {unknownHomework&&learningReady?<Text style={[styles.dataHint,textDirection]}>
      {translate(locale,"student.homeSubmissionUnknown")}
    </Text>:null}

    <Section title={translate(locale,"student.homeSchedule")} icon="time-outline"
      rtl={rtl} textDirection={textDirection} locale={locale}
      actionKey="student.viewTimetable" onOpen={onOpenTimetable}>
      {loadingTimetable?<Loading locale={locale}/>:!timetable?
        <Text style={[styles.muted,textDirection]}>{translate(locale,"student.homeDataUnavailable")}</Text>:
        <Pressable testID="student-home-featured-lesson"
          accessibilityRole="button" onPress={onOpenTimetable}
          style={({pressed})=>[styles.highlight,rtl&&styles.rtl,pressed&&styles.pressed]}>
          <View style={styles.highlightIcon}>
            <Ionicons name={focus.state==="CURRENT"?"play-circle-outline":"book-outline"}
              size={22} color={tokens.color.brandStrong}/>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.eyebrow,textDirection]}>{translate(locale,lessonLabel)}</Text>
            <Text style={[styles.rowTitle,textDirection]}>{lesson?.subjectName??
              translate(locale,focus.state==="DONE"?"student.homeLessonsFinished":
                "student.noClassesToday")}</Text>
            {lesson?<Text style={[styles.muted,textDirection]}>
              {studentTimeRange12(lesson.period.startsAt,lesson.period.endsAt,locale)}
              {" · "}{lesson.teacherName}
            </Text>:null}
            {today.length>0?<Text style={[styles.meta,textDirection]}>
              {formatLocalizedNumber(focus.completed,locale)} / {formatLocalizedNumber(today.length,locale)}
              {" "}{translate(locale,"student.homeLessonsDone")}
            </Text>:null}
          </View>
          <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={20} color={tokens.color.brandStrong}/>
        </Pressable>}
    </Section>

    <Section title={translate(locale,"student.homeUpcomingTasks")} icon="checkbox-outline"
      rtl={rtl} textDirection={textDirection} locale={locale}
      actionKey="student.viewHomework" onOpen={onOpenHomework}>
      {loadingAcademic?<Loading locale={locale}/>:!learning?
        <Text style={[styles.muted,textDirection]}>{translate(locale,"student.homeDataUnavailable")}</Text>:
        <View style={styles.innerStack}>
          {homeworks.upcoming?<Pressable testID="student-home-urgent-homework"
            accessibilityRole="button" onPress={onOpenHomework}
            style={({pressed})=>[styles.highlight,rtl&&styles.rtl,pressed&&styles.pressed]}>
            <View style={styles.highlightIcon}>
              <Ionicons name="document-text-outline" size={22} color={tokens.color.brandStrong}/>
            </View>
            <View style={styles.flex}>
              <Text style={[styles.eyebrow,textDirection]}>
                {translate(locale,"student.homeNearestDeadline")}
              </Text>
              <Text style={[styles.rowTitle,textDirection]}>{homeworks.upcoming.homework.title}</Text>
              <Text style={[styles.muted,textDirection]}>
                {homeworks.upcoming.subjectName} · {formatLocalizedDate(homeworks.upcoming.homework.dueAt,locale)}
              </Text>
            </View>
            <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={20} color={tokens.color.brandStrong}/>
          </Pressable>:
          <Text style={[styles.muted,textDirection]}>{translate(locale,"student.noHomeworkDue")}</Text>}
          {!unknownHomework&&((homeworks.overdue??0)>0||(homeworks.revision??0)>0)?
            <View style={[styles.flags,rtl&&styles.rtl]}>
              {(homeworks.overdue??0)>0?<Text style={styles.warning}>
                {translate(locale,"student.homeOverdue")} · {n(homeworks.overdue)}
              </Text>:null}
              {(homeworks.revision??0)>0?<Text style={styles.warning}>
                {translate(locale,"student.homeRevisions")} · {n(homeworks.revision)}
              </Text>:null}
            </View>:null}
          {!unknownHomework&&homeworks.completionPercent!==null?
            <View style={styles.progressBlock}>
              <View style={[styles.progressHeading,rtl&&styles.rtl]}>
                <Text style={[styles.muted,styles.flex,textDirection]}>
                  {translate(locale,"student.homeReviewedWork")}
                </Text>
                <Text style={styles.progressValue}>{n(homeworks.completionPercent)}%</Text>
              </View>
              <View style={styles.progressTrack}><View style={[styles.progressFill,{
                width:`${homeworks.completionPercent}%` as `${number}%`
              }]}/></View>
            </View>:null}
        </View>}
    </Section>

    <Section title={translate(locale,"student.homeAcademicProgress")} icon="ribbon-outline"
      rtl={rtl} textDirection={textDirection} locale={locale}
      actionKey="student.viewResults" onOpen={onOpenResults}>
      {loadingAcademic?<Loading locale={locale}/>:!learning?
        <Text style={[styles.muted,textDirection]}>{translate(locale,"student.homeDataUnavailable")}</Text>:
        academic.publishedCount===0?
        <Text style={[styles.muted,textDirection]}>{translate(locale,"student.noPublishedResult")}</Text>:
        <View style={styles.innerStack}>
          <View style={[styles.academicRow,rtl&&styles.rtl]}>
            <View style={styles.academicMetric}>
              <Text style={styles.academicValue}>{n(academic.percent)}%</Text>
              <Text style={styles.academicLabel}>{translate(locale,"student.homePublishedAverage")}</Text>
            </View>
            <View style={styles.academicMetric}>
              <Text style={styles.academicValue}>{n(academic.publishedCount)}</Text>
              <Text style={styles.academicLabel}>{translate(locale,"student.homePublishedMarks")}</Text>
            </View>
          </View>
          {latest?<Pressable accessibilityRole="button"
            onPress={onOpenResults} style={[styles.latestRow,rtl&&styles.rtl]}>
            <View style={styles.flex}>
              <Text style={[styles.eyebrow,textDirection]}>{translate(locale,"student.latestResult")}</Text>
              <Text style={[styles.rowTitle,textDirection]}>{latest.exam.name} · {latest.subjectName}</Text>
            </View>
            <Text style={styles.latestMark}>
              {formatLocalizedNumber(latest.grade.score,locale)}
              {" / "}{formatLocalizedNumber(latest.examSubject.maxScore,locale)}
            </Text>
          </Pressable>:null}
          {academic.focusSubject?<Text style={[styles.dataHint,textDirection]}>
            {translate(locale,"student.homeFocusSubject")}: {academic.focusSubject}
            {" · "}{n(academic.focusPercent)}%
          </Text>:null}
        </View>}
    </Section>

    <Section title={translate(locale,"student.homeSchoolUpdates")} icon="megaphone-outline"
      rtl={rtl} textDirection={textDirection} locale={locale}
      actionKey="student.viewAnnouncements" onOpen={onOpenAnnouncements}>
      {!communicationReady?<Loading locale={locale}/>:schoolUpdate?
        <Pressable accessibilityRole="button" onPress={onOpenAnnouncements}
          style={[styles.highlight,rtl&&styles.rtl]}>
          <View style={styles.highlightIcon}>
            <Ionicons name="megaphone-outline" size={21} color={tokens.color.brandStrong}/>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.rowTitle,textDirection]} numberOfLines={2}>{schoolUpdate.title}</Text>
            <Text style={[styles.muted,textDirection]} numberOfLines={2}>{schoolUpdate.content}</Text>
            <Text style={[styles.meta,textDirection]}>{formatLocalizedDate(schoolUpdate.publishAt,locale)}</Text>
          </View>
        </Pressable>:
        <Text style={[styles.muted,textDirection]}>{translate(locale,"student.noAnnouncements")}</Text>}
    </Section>
  </View>;
}
const styles=StyleSheet.create({
  stack:{gap:13},flex:{flex:1,minWidth:0},rtl:{flexDirection:"row-reverse"},
  identity:{padding:15,borderRadius:19,backgroundColor:"#f4f8ff",
    borderColor:"#e0e9f7",borderWidth:1},
  identityRow:{flexDirection:"row",alignItems:"center",gap:12},
  avatar:{width:48,height:48,borderRadius:15,backgroundColor:tokens.color.brandStrong,
    alignItems:"center",justifyContent:"center"},
  avatarText:{color:"#fff",fontSize:20,fontWeight:"900"},
  studentName:{fontSize:18,fontWeight:"900",color:tokens.color.text},
  meta:{fontSize:11.5,lineHeight:18,color:tokens.color.textMuted},
  sectionHeading:{flexDirection:"row",alignItems:"center",gap:9},
  sectionIcon:{width:36,height:36,borderRadius:11,backgroundColor:"#eaf2ff",
    alignItems:"center",justifyContent:"center"},
  sectionTitle:{fontSize:16,fontWeight:"900",color:tokens.color.text},
  stats:{flexDirection:"row",flexWrap:"wrap",gap:9},
  stat:{flexBasis:"47%",flexGrow:1,padding:12,minHeight:123,gap:7,
    backgroundColor:"#fff",borderWidth:1,borderColor:"#e0e8f2",borderRadius:17},
  statHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  statIcon:{backgroundColor:"#eff5ff",borderRadius:10,padding:7},
  statValue:{fontSize:23,fontWeight:"900",color:tokens.color.brandStrong},
  statLabel:{fontSize:11.5,fontWeight:"700",color:tokens.color.textMuted},
  sectionCard:{backgroundColor:"#fff",borderWidth:1,borderColor:"#e1e7f0",
    borderRadius:18,padding:15,gap:13},
  seeAll:{minHeight:38,flexDirection:"row",alignItems:"center",gap:4,
    paddingHorizontal:7},
  seeAllText:{fontSize:11.5,fontWeight:"900",color:tokens.color.brandStrong},
  highlight:{flexDirection:"row",alignItems:"center",gap:11,padding:12,
    borderRadius:13,backgroundColor:"#f4f8ff"},
  highlightIcon:{height:39,width:39,borderRadius:12,alignItems:"center",
    justifyContent:"center",backgroundColor:"#e1eeff"},
  eyebrow:{fontSize:11,fontWeight:"800",color:tokens.color.brandStrong},
  rowTitle:{fontSize:14,fontWeight:"900",color:tokens.color.text,lineHeight:20},
  muted:{fontSize:12.5,lineHeight:19,color:tokens.color.textMuted},
  dataHint:{fontSize:11.5,lineHeight:18,color:tokens.color.textMuted},
  innerStack:{gap:11},
  flags:{flexDirection:"row",flexWrap:"wrap",gap:7},
  warning:{backgroundColor:"#fff1e8",color:"#974424",paddingHorizontal:10,
    paddingVertical:6,borderRadius:11,fontSize:11.5,fontWeight:"800"},
  progressBlock:{gap:6},
  progressHeading:{flexDirection:"row",alignItems:"center"},
  progressValue:{fontSize:12,fontWeight:"900",color:tokens.color.brandStrong},
  progressTrack:{height:8,backgroundColor:"#e8edf5",borderRadius:12,overflow:"hidden"},
  progressFill:{height:8,backgroundColor:tokens.color.brandStrong,borderRadius:12},
  academicRow:{flexDirection:"row",gap:9},
  academicMetric:{flex:1,gap:4,padding:11,backgroundColor:"#f3f7fd",
    borderRadius:13,alignItems:"center"},
  academicValue:{fontSize:20,fontWeight:"900",color:tokens.color.brandStrong},
  academicLabel:{fontSize:11.5,color:tokens.color.textMuted,textAlign:"center"},
  latestRow:{flexDirection:"row",alignItems:"center",padding:10,gap:9,
    borderRadius:12,borderColor:"#ecf0f6",borderWidth:1},
  latestMark:{fontSize:13,fontWeight:"900",color:tokens.color.brandStrong},
  loading:{minHeight:49,flexDirection:"row",alignItems:"center",gap:9},
  pressed:{opacity:0.7}
});
