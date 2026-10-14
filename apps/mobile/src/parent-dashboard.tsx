import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatAfn, formatLocalizedDate, formatLocalizedNumber,
  formatLocalizedTimeRange, getDirection, translate,
  type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import type {
  AnnouncementPayload, AttendanceStatus, FeeInvoiceViewPayload,
  LearnerAcademicPayload, ParentNotification, ParentTimetablePeriod
} from "./api";
import {
  buildParentHomeView, type ParentHomeResource, type ParentHomeResourceMap
} from "./parent-home-model";

type TextDirectionStyle = { textAlign: "right" | "left"; writingDirection: "rtl" | "ltr" };
export type ParentDashboardDestination =
  | "ATTENDANCE" | "ACADEMICS_TIMETABLE" | "ACADEMICS_HOMEWORK"
  | "ACADEMICS_RESULTS" | "MORE_FEES" | "INBOX_ANNOUNCEMENTS" | "INBOX_NOTIFICATIONS";

type Props = {
  classId: string;
  todayDate: string;
  todayAttendance: AttendanceStatus | null;
  timetable: ParentTimetablePeriod[];
  learning: LearnerAcademicPayload | null;
  announcements: AnnouncementPayload[];
  fees: FeeInvoiceViewPayload[];
  notifications: ParentNotification[];
  resourceStatus: ParentHomeResourceMap;
  locale: SupportedLocale;
  textDirection: TextDirectionStyle;
  onNavigate: (to: ParentDashboardDestination) => void;
  onRetry: (resource: ParentHomeResource) => void;
  onRefresh: () => void;
};

export function ParentDashboardPanel({
  classId, todayDate, todayAttendance, timetable, learning,
  announcements, fees, notifications, resourceStatus, locale, textDirection,
  onNavigate, onRetry, onRefresh
}: Props) {
  const rtl = getDirection(locale) === "rtl";
  const tr = (key: TranslationKey) => translate(locale, key);
  const available = {
    attendance: resourceStatus.attendance === "ready",
    timetable: resourceStatus.timetable === "ready",
    learning: resourceStatus.learning === "ready",
    announcements: resourceStatus.announcements === "ready",
    fees: resourceStatus.fees === "ready",
    notifications: resourceStatus.notifications === "ready"
  };
  const dashboard = useMemo(() => buildParentHomeView({
    classId, todayDate, todayAttendance, timetable, learning,
    announcements, fees, notifications, available
  }), [classId, todayDate, todayAttendance, timetable, learning,
    announcements, fees, notifications, resourceStatus]);

  const attendanceLabel = !todayDate
    ? tr("common.loading")
    : todayAttendance
      ? tr(({
          PRESENT: "attendance.present", ABSENT: "attendance.absent",
          LATE: "attendance.late", EXCUSED: "attendance.excused"
        } as const)[todayAttendance])
      : tr("attendance.notRecorded");

  const scheduleDetail = dashboard.todayPeriods[0]
    ? `${formatLocalizedTimeRange(dashboard.todayPeriods[0].period.startsAt,
        dashboard.todayPeriods[0].period.endsAt,locale)} · ${dashboard.todayPeriods[0].teacherName}${dashboard.todayPeriods.length>1
      ? ` · +${formatLocalizedNumber(dashboard.todayPeriods.length-1,locale)} ${tr("parent.moreItems")}` : ""}`
    : "";
  const homeworkDetail = dashboard.homework
    ? `${dashboard.homework.subjectName} · ${tr("learning.due")} ${formatLocalizedDate(dashboard.homework.homework.dueAt,locale)}`
    : "";
  const resultDetail = dashboard.latestResult
    ? `${dashboard.latestResult.exam.name} · ${dashboard.latestResult.subjectName}`
    : "";
  const announcementDetail = dashboard.latestAnnouncement
    ? formatLocalizedDate(dashboard.latestAnnouncement.publishAt,locale) : "";
  const allLoaded = Object.values(resourceStatus).every(status => status === "ready");
  const anyLoading = Object.values(resourceStatus).some(status => status === "loading" || status === "idle");

  return (
    <View style={styles.section}>
      <View style={[styles.headingRow,rtl&&styles.rowRtl]}>
        <View style={styles.headingIconShell}>
          <Ionicons name="sunny-outline" size={18} color={tokens.color.brandStrong} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={[styles.sectionTitle,textDirection]}>{tr("parent.dashboard")}</Text>
          {todayDate ? <Text style={[styles.headingDate,textDirection]}>
            {formatLocalizedDate(todayDate,locale)}
          </Text> : null}
        </View>
        <Pressable accessibilityRole="button"
          accessibilityLabel={tr("parent.refreshHome")}
          onPress={onRefresh}
          style={({pressed})=>[styles.refreshButton,pressed&&styles.pressed]}>
          <Ionicons name="refresh-outline" size={20} color={tokens.color.brandStrong}/>
        </Pressable>
      </View>

      {dashboard.alerts.length ? (
        <View style={styles.alertSection}>
          <Text style={[styles.alertSectionTitle,textDirection]}>{tr("parent.actionRequired")}</Text>
          {dashboard.alerts.map(alert => {
            const target:ParentDashboardDestination=alert.destination==="ACADEMICS"
              ? "ACADEMICS_HOMEWORK" : alert.destination==="INBOX" ? "INBOX_NOTIFICATIONS"
              : alert.destination==="MORE" ? "MORE_FEES" : "ATTENDANCE";
            return (
              <Pressable key={alert.id} accessibilityRole="button"
                accessibilityLabel={`${tr(alert.label)}${alert.detail ? `: ${alert.detail}` : ""}`}
                onPress={()=>onNavigate(target)}
                style={({pressed})=>[
                  styles.alert,alert.tone==="danger"&&styles.alertDanger,
                  alert.tone==="warning"&&styles.alertWarning,
                  rtl&&styles.rowRtl,pressed&&styles.pressed
                ]}>
                <Ionicons name={alert.tone==="danger"?"alert-circle-outline"
                  :alert.tone==="warning"?"alert-outline":"notifications-outline"}
                  size={21} color={alert.tone==="danger"?"#a73535"
                    :alert.tone==="warning"?"#976000":tokens.color.brandStrong}/>
                <View style={styles.flex}>
                  <Text style={[styles.alertTitle,textDirection]}>{tr(alert.label)}</Text>
                  {alert.detail?<Text numberOfLines={2} style={[styles.detail,textDirection]}>
                    {alert.detail}
                  </Text>:null}
                </View>
                <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={18} color={tokens.color.textMuted}/>
              </Pressable>
            );
          })}
        </View>
      ) : allLoaded ? (
        <View style={[styles.clearState,rtl&&styles.rowRtl]}>
          <Ionicons name="checkmark-circle-outline" size={19} color="#207a4c"/>
          <Text style={[styles.clearText,textDirection]}>{tr("parent.noAlerts")}</Text>
        </View>
      ) : !anyLoading ? (
        <Text style={[styles.detail,textDirection]}>{tr("parent.someDataUnavailable")}</Text>
      ) : null}

      <View style={styles.grid}>
        <DashboardCard icon="calendar-outline"
          label={tr("attendance.today")} primary={attendanceLabel}
          status={resourceStatus.attendance}
          tone={todayAttendance==="ABSENT"?"danger":todayAttendance==="LATE"?"warning"
            :todayAttendance==="PRESENT"?"success":"brand"}
          textDirection={textDirection} locale={locale}
          onPress={()=>onNavigate("ATTENDANCE")} onRetry={()=>onRetry("attendance")}/>
        <DashboardCard icon="time-outline"
          label={tr("parent.todaySchedule")}
          primary={dashboard.todayPeriods[0]?.subjectName ?? tr("parent.noClassesToday")}
          detail={scheduleDetail}
          status={resourceStatus.timetable}
          textDirection={textDirection} locale={locale}
          onPress={()=>onNavigate("ACADEMICS_TIMETABLE")} onRetry={()=>onRetry("timetable")}/>
        <DashboardCard icon="document-text-outline"
          label={tr("parent.homeworkDue")}
          primary={dashboard.homework?.homework.title ?? tr("parent.noHomeworkDue")}
          detail={homeworkDetail}
          status={resourceStatus.learning}
          tone={dashboard.homework?"warning":"brand"}
          textDirection={textDirection} locale={locale}
          onPress={()=>onNavigate("ACADEMICS_HOMEWORK")} onRetry={()=>onRetry("learning")}/>
        <DashboardCard icon="ribbon-outline"
          label={tr("parent.latestResult")}
          primary={dashboard.latestResult
            ? `${formatLocalizedNumber(dashboard.latestResult.grade.score,locale)}/${formatLocalizedNumber(dashboard.latestResult.examSubject.maxScore,locale)}`
            : tr("parent.noPublishedResult")}
          detail={resultDetail}
          status={resourceStatus.learning}
          tone={dashboard.latestResult?"success":"brand"}
          textDirection={textDirection} locale={locale}
          onPress={()=>onNavigate("ACADEMICS_RESULTS")} onRetry={()=>onRetry("learning")}/>
        <DashboardCard icon="wallet-outline"
          label={tr("parent.feeStatus")}
          primary={dashboard.outstanding>0?formatAfn(dashboard.outstanding,locale)
            :tr("parent.noOutstandingFees")}
          status={resourceStatus.fees}
          tone={dashboard.outstanding>0?"warning":"brand"}
          textDirection={textDirection} locale={locale}
          onPress={()=>onNavigate("MORE_FEES")} onRetry={()=>onRetry("fees")}/>
        <DashboardCard icon="megaphone-outline"
          label={tr("parent.latestAnnouncement")}
          primary={dashboard.latestAnnouncement?.title ?? tr("parent.noAnnouncements")}
          detail={announcementDetail}
          status={resourceStatus.announcements}
          textDirection={textDirection} locale={locale} wide
          onPress={()=>onNavigate("INBOX_ANNOUNCEMENTS")} onRetry={()=>onRetry("announcements")}/>
        <DashboardCard icon="notifications-outline"
          label={tr("notifications.title")}
          primary={formatLocalizedNumber(dashboard.unreadCount,locale)}
          detail={tr("parent.unreadNotifications")}
          status={resourceStatus.notifications}
          textDirection={textDirection} locale={locale} wide
          onPress={()=>onNavigate("INBOX_NOTIFICATIONS")} onRetry={()=>onRetry("notifications")}/>
      </View>
    </View>
  );
}

function DashboardCard({
  icon,label,primary,detail,status,tone="brand",wide=false,
  textDirection,locale,onPress,onRetry
}:{
  icon:keyof typeof Ionicons.glyphMap;
  label:string;primary:string;detail?:string;
  status:ParentHomeResourceMap[ParentHomeResource];
  tone?:"brand"|"success"|"warning"|"danger";wide?:boolean;
  textDirection:TextDirectionStyle;locale:SupportedLocale;
  onPress:()=>void;onRetry:()=>void;
}) {
  const loading=status==="loading"||status==="idle";
  const failed=status==="error";
  const iconStyle=tone==="success"?styles.iconShellSuccess
    :tone==="warning"?styles.iconShellWarning
    :tone==="danger"?styles.iconShellDanger:styles.iconShellBrand;
  const iconColor=tone==="success"?"#207a4c":tone==="warning"?"#9a6500"
    :tone==="danger"?"#b43a3a":tokens.color.brandStrong;
  return (
    <Pressable accessibilityRole="button"
      accessibilityLabel={`${label}: ${failed?translate(locale,"parent.unavailable")
        :loading?translate(locale,"common.loading"):primary}`}
      accessibilityHint={failed?translate(locale,"parent.tryAgain"):translate(locale,"parent.viewDetails")}
      onPress={failed?onRetry:onPress}
      style={({pressed})=>[styles.card,wide&&styles.cardWide,pressed&&styles.pressed]}>
      <View style={[styles.cardTopRow,textDirection.writingDirection==="rtl"&&styles.rowRtl]}>
        <View style={[styles.iconShell,iconStyle]}>
          <Ionicons name={icon} size={18} color={iconColor}/>
        </View>
        <Text style={[styles.label,styles.cardLabelFlex,textDirection]}>{label}</Text>
        <Ionicons name={textDirection.writingDirection==="rtl"?"chevron-back":"chevron-forward"}
          size={16} color={tokens.color.textMuted}/>
      </View>
      {loading?(
        <View style={styles.loadingBlock}>
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={tokens.color.brand}/>
            <View style={styles.loadingLinePrimary}/>
          </View>
          <View style={styles.loadingLineDetail}/>
        </View>
      ):failed?(
        <View style={styles.failedBody}>
          <Text style={[styles.failedText,textDirection]}>{translate(locale,"parent.unavailable")}</Text>
          <Text style={[styles.retryLabel,textDirection]}>{translate(locale,"parent.tryAgain")}</Text>
        </View>
      ):(
        <>
          <Text style={[styles.primary,textDirection]} numberOfLines={3}>{primary}</Text>
          {detail?<Text style={[styles.detail,textDirection]} numberOfLines={2}>{detail}</Text>:null}
          <Text style={[styles.viewDetails,textDirection]}>{translate(locale,"parent.viewDetails")}</Text>
        </>
      )}
    </Pressable>
  );
}
const styles=StyleSheet.create({
  section:{gap:13},flex:{flex:1,minWidth:0},rowRtl:{flexDirection:"row-reverse"},
  headingRow:{flexDirection:"row",alignItems:"center",gap:9},
  headingIconShell:{width:38,height:38,borderRadius:12,alignItems:"center",
    justifyContent:"center",backgroundColor:"#edf3ff"},
  headingCopy:{flex:1,minWidth:0},
  sectionTitle:{color:tokens.color.text,fontSize:17,fontWeight:"900"},
  headingDate:{color:tokens.color.textMuted,fontSize:12,marginTop:2},
  refreshButton:{minWidth:44,minHeight:44,borderRadius:13,borderWidth:1,
    borderColor:"#dce6f2",alignItems:"center",justifyContent:"center"},
  alertSection:{gap:8},alertSectionTitle:{fontSize:15.5,color:tokens.color.text,fontWeight:"900"},
  alert:{flexDirection:"row",alignItems:"center",gap:10,minHeight:62,
    paddingHorizontal:13,paddingVertical:11,borderRadius:15,
    borderWidth:1,borderColor:"#d9e7fa",backgroundColor:"#f1f7ff"},
  alertWarning:{backgroundColor:"#fffaf0",borderColor:"#f1dfb7"},
  alertDanger:{backgroundColor:"#fff4f4",borderColor:"#edc9c9"},
  alertTitle:{fontSize:13.5,color:tokens.color.text,fontWeight:"800"},
  clearState:{flexDirection:"row",gap:10,alignItems:"center",padding:13,
    borderRadius:14,backgroundColor:"#eff8f2"},
  clearText:{color:"#236844",fontSize:13,fontWeight:"700",flex:1},
  grid:{flexDirection:"row",flexWrap:"wrap",gap:10},
  card:{flexGrow:1,flexBasis:"46%",minWidth:138,minHeight:132,padding:14,
    borderRadius:19,borderWidth:1,borderColor:"#e1e7f0",
    backgroundColor:tokens.color.surface,gap:9,
    shadowColor:"#172033",shadowOpacity:0.035,
    shadowRadius:10,shadowOffset:{width:0,height:4},elevation:1},
  cardWide:{flexBasis:"100%"},
  cardTopRow:{flexDirection:"row",alignItems:"center",gap:8},
  cardLabelFlex:{flex:1,minWidth:0},iconShell:{width:34,height:34,borderRadius:11,
    alignItems:"center",justifyContent:"center"},
  iconShellBrand:{backgroundColor:"#edf3ff"},
  iconShellSuccess:{backgroundColor:"#e9f7ef"},
  iconShellWarning:{backgroundColor:"#fff5df"},
  iconShellDanger:{backgroundColor:"#fff0f0"},
  label:{color:tokens.color.textMuted,fontSize:11.5,fontWeight:"800"},
  primary:{color:tokens.color.text,fontSize:14.5,lineHeight:21,fontWeight:"900"},
  detail:{color:tokens.color.textMuted,fontSize:11.5,lineHeight:18},
  viewDetails:{color:tokens.color.brandStrong,fontSize:11.5,fontWeight:"800",marginTop:"auto"},
  failedBody:{gap:5},failedText:{color:"#a73535",fontSize:13,fontWeight:"700"},
  retryLabel:{color:tokens.color.brandStrong,fontSize:12,fontWeight:"900"},
  loadingBlock:{gap:9,paddingTop:4},
  loadingRow:{flexDirection:"row",alignItems:"center",gap:8},
  loadingLinePrimary:{height:11,flex:1,borderRadius:999,backgroundColor:"#edf1f6"},
  loadingLineDetail:{height:9,width:"62%",borderRadius:999,backgroundColor:"#f0f3f7"},
  pressed:{opacity:0.72}
});
