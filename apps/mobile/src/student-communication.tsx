import {useEffect,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {tokens} from "@maktablink/design-tokens";
import {formatLocalizedDate,formatLocalizedNumber,getDirection,translate,
  type SupportedLocale,type TranslationKey} from "@maktablink/localization";
import type {AnnouncementPayload,ParentNotification} from "./api";
import {
  STUDENT_INBOX_PAGE_SIZE,studentReadFilters,studentTopicFilters,studentAnnouncementFilters,
  studentFilterAnnouncements,studentFilterNotifications,studentNotificationUnread,
  studentInboxPage,type StudentReadFilter,type StudentTopicFilter,
  type StudentAnnouncementFilter
} from "./student-communication-model";

export type StudentCommunicationTab="ANNOUNCEMENTS"|"NOTIFICATIONS";
type ResourceStatus="loading"|"ready"|"error";
type Direction={textAlign:"right"|"left";writingDirection:"rtl"|"ltr"};
const readLabels:Record<StudentReadFilter,TranslationKey>={
  ALL:"student.inboxAll",UNREAD:"student.inboxUnread",READ:"student.inboxRead"
};
const topicLabels:Record<StudentTopicFilter,TranslationKey>={
  ALL:"student.inboxAll",SCHOOL:"student.inboxSchool",ACADEMICS:"student.inboxAcademics",
  ATTENDANCE:"student.inboxAttendance",FEES:"student.inboxFees"
};
const audienceLabels:Record<StudentAnnouncementFilter,TranslationKey>={
  ALL:"student.inboxAll",SCHOOL:"student.inboxSchool",CLASS:"student.inboxClass",
  STUDENT:"student.inboxStudent"
};

function ChipBar<T extends string>({values,selected,labels,onChange,locale,rtl}:{
  values:readonly T[];selected:T;labels:Record<T,TranslationKey>;
  onChange:(value:T)=>void;locale:SupportedLocale;rtl:boolean
}) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false}
    keyboardShouldPersistTaps="handled"
    contentContainerStyle={[styles.chips,rtl&&styles.rtl]}>
    {values.map(value=><Pressable key={value} accessibilityRole="button"
      accessibilityState={{selected:selected===value}}
      onPress={()=>onChange(value)}
      style={[styles.chip,selected===value&&styles.chipSelected]}>
      <Text style={[styles.chipText,selected===value&&styles.chipTextSelected]}>
        {translate(locale,labels[value])}
      </Text>
    </Pressable>)}
  </ScrollView>;
}
function StateCard({locale,textDirection,status,onRetry,refreshing}:{
  locale:SupportedLocale;textDirection:Direction;status:ResourceStatus;
  onRetry:()=>void;refreshing:boolean
}){
  return <View style={styles.emptyCard} testID="student-inbox-resource-state">
    {status==="loading"?<ActivityIndicator color={tokens.color.brandStrong}/>:
      <Ionicons name="cloud-offline-outline" size={23} color={tokens.color.textMuted}/>}
    <Text style={[styles.muted,textDirection]}>
      {translate(locale,status==="loading"?"common.loading":"student.inboxLoadError")}
    </Text>
    {status==="error"?<Pressable accessibilityRole="button"
      disabled={refreshing} onPress={onRetry} style={styles.action}>
      <Text style={styles.actionText}>{translate(locale,"student.inboxRetry")}</Text>
    </Pressable>:null}
  </View>;
}

export function StudentCommunicationContent({
  announcements,notifications,classId,ready,activeTab,locale,textDirection,
  onSelectTab,onMarkRead,onMarkAllRead,onOpenNotification,onRefresh,
  announcementStatus,notificationStatus,focusedAnnouncementId
}:{
  announcements:AnnouncementPayload[];
  notifications:ParentNotification[];
  classId:string|null;ready:boolean;activeTab:StudentCommunicationTab;
  locale:SupportedLocale;textDirection:Direction;
  onSelectTab:(tab:StudentCommunicationTab)=>void;
  onMarkRead:(id:string)=>Promise<boolean>;
  onMarkAllRead:()=>Promise<boolean>;
  onOpenNotification:(item:ParentNotification)=>void;
  onRefresh:()=>Promise<boolean>;
  announcementStatus:ResourceStatus;notificationStatus:ResourceStatus;
  focusedAnnouncementId?:string|null;
}) {
  const rtl=getDirection(locale)==="rtl";
  const [query,setQuery]=useState("");
  const [readFilter,setReadFilter]=useState<StudentReadFilter>("ALL");
  const [topic,setTopic]=useState<StudentTopicFilter>("ALL");
  const [audience,setAudience]=useState<StudentAnnouncementFilter>("ALL");
  const [page,setPage]=useState(1);
  const [refreshing,setRefreshing]=useState(false);
  const [busyId,setBusyId]=useState<string|null>(null);
  const [markingAll,setMarkingAll]=useState(false);
  const [notice,setNotice]=useState<TranslationKey|null>(null);
  useEffect(()=>{setPage(1);setQuery("");setNotice(null);},[activeTab]);
  const changeFilter=()=>{setPage(1);setNotice(null);};
  const announcementItems=studentFilterAnnouncements(announcements,{classId,query,audience});
  const notificationItems=studentFilterNotifications(notifications,{query,read:readFilter,topic});
  const unread=studentNotificationUnread(notifications);
  const isAnnouncements=activeTab==="ANNOUNCEMENTS";
  const status=isAnnouncements?announcementStatus:notificationStatus;
  const visible=studentInboxPage(isAnnouncements?announcementItems:notificationItems,
    page,(row)=>row.id,isAnnouncements?focusedAnnouncementId:null);
  const hasMore=visible.hasMore;

  async function refresh(){
    if(refreshing)return;
    setRefreshing(true);setNotice(null);
    try {if(!(await onRefresh()))setNotice("student.inboxRefreshFailed");}
    catch {setNotice("student.inboxRefreshFailed");}
    finally{setRefreshing(false);}
  }
  async function markOne(id:string){
    if(busyId||markingAll)return;
    setBusyId(id);setNotice(null);
    try{if(!(await onMarkRead(id)))setNotice("student.inboxMarkFailed");}
    catch{setNotice("student.inboxMarkFailed");}
    finally{setBusyId(null);}
  }
  async function markAll(){
    if(markingAll||busyId||unread===0)return;
    setMarkingAll(true);setNotice(null);
    try{if(!(await onMarkAllRead()))setNotice("student.inboxMarkFailed");}
    catch{setNotice("student.inboxMarkFailed");}
    finally{setMarkingAll(false);}
  }
  return <View style={styles.stack} testID="student-inbox-phase7">
    <View style={[styles.tabs,rtl&&styles.rtl]} accessibilityRole="tablist">
      {([
        ["ANNOUNCEMENTS","student.announcementsTitle","megaphone-outline"],
        ["NOTIFICATIONS","student.notificationsTitle","notifications-outline"]
      ] as const).map(([tab,key,icon])=><Pressable key={tab}
        accessibilityRole="tab" accessibilityState={{selected:tab===activeTab}}
        onPress={()=>onSelectTab(tab)} testID={`student-inbox-tab-${tab.toLowerCase()}`}
        style={[styles.tab,tab===activeTab&&styles.tabSelected]}>
        <Ionicons name={icon} size={17} color={tokens.color.brandStrong}/>
        <Text style={[styles.tabText,tab===activeTab&&styles.tabTextSelected]}>
          {translate(locale,key)}</Text>
        {tab==="NOTIFICATIONS"&&unread>0?<View style={styles.badge}>
          <Text style={styles.badgeText}>{formatLocalizedNumber(unread,locale)}</Text>
        </View>:null}
      </Pressable>)}
    </View>
    <View style={[styles.toolbar,rtl&&styles.rtl]}>
      <Text style={[styles.muted,styles.flex,textDirection]}>
        {translate(locale,isAnnouncements?"student.announcementsTitle":"student.unreadNotifications")}
        {!isAnnouncements?` · ${formatLocalizedNumber(unread,locale)}`:""}
      </Text>
      <Pressable accessibilityRole="button" testID="student-inbox-refresh"
        disabled={refreshing} onPress={()=>void refresh()}
        style={[styles.action,refreshing&&styles.disabled]}>
        {refreshing?<ActivityIndicator size="small" color={tokens.color.brandStrong}/>:
          <Ionicons name="refresh-outline" size={17} color={tokens.color.brandStrong}/>}
        <Text style={styles.actionText}>{translate(locale,"student.inboxRefresh")}</Text>
      </Pressable>
    </View>
    {status==="ready"&&(!ready||notice)?<Text accessibilityRole="alert"
      style={[styles.hint,textDirection]}>
      {notice?translate(locale,notice):translate(locale,"student.inboxLoadError")}
    </Text>:null}
    {status!=="ready"?<StateCard locale={locale} textDirection={textDirection}
      status={status} onRetry={()=>void refresh()} refreshing={refreshing}/>:
    <View style={styles.stack}>
      <View style={[styles.searchRow,rtl&&styles.rtl]}>
        <Ionicons name="search-outline" size={19} color={tokens.color.textMuted}/>
        <TextInput testID="student-inbox-search" value={query}
          onChangeText={value=>{setQuery(value);changeFilter();}}
          placeholder={translate(locale,"student.inboxSearch")}
          placeholderTextColor={tokens.color.textMuted}
          style={[styles.search,styles.flex,textDirection]} autoCorrect={false}/>
        {query?<Pressable accessibilityRole="button" onPress={()=>{
          setQuery("");changeFilter();
        }}><Ionicons name="close-circle" size={19} color={tokens.color.textMuted}/></Pressable>:null}
      </View>
      {isAnnouncements?<ChipBar values={studentAnnouncementFilters} selected={audience}
        labels={audienceLabels} locale={locale} rtl={rtl}
        onChange={value=>{setAudience(value);changeFilter();}}/>:
        <View style={styles.stack}>
          <ChipBar values={studentReadFilters} selected={readFilter}
            labels={readLabels} locale={locale} rtl={rtl}
            onChange={value=>{setReadFilter(value);changeFilter();}}/>
          <ChipBar values={studentTopicFilters} selected={topic}
            labels={topicLabels} locale={locale} rtl={rtl}
            onChange={value=>{setTopic(value);changeFilter();}}/>
          {unread>0?<Pressable accessibilityRole="button"
            testID="student-inbox-mark-all" disabled={markingAll||!!busyId}
            onPress={()=>void markAll()} style={[styles.action,styles.markAll]}>
            {markingAll?<ActivityIndicator size="small" color={tokens.color.brandStrong}/>:
              <Ionicons name="checkmark-done-outline" size={18} color={tokens.color.brandStrong}/>}
            <Text style={styles.actionText}>{translate(locale,"student.inboxMarkAll")}</Text>
          </Pressable>:null}
        </View>}
      <Text style={[styles.meta,textDirection]}>
        {formatLocalizedNumber(visible.showing,locale)}
        {" / "}{formatLocalizedNumber(visible.total,locale)}
        {" "}{translate(locale,"student.inboxItems")}
      </Text>
      {isAnnouncements?(visible.visible as AnnouncementPayload[]).map(item=>
        <View key={item.id} style={[styles.card,
          focusedAnnouncementId===item.id&&styles.focused]} testID={`student-announcement-${item.id}`}>
          <View style={[styles.cardTitle,rtl&&styles.rtl]}>
            <Ionicons name="megaphone-outline" size={19} color={tokens.color.brandStrong}/>
            <Text style={[styles.title,styles.flex,textDirection]}>{item.title}</Text>
          </View>
          <Text style={[styles.copy,textDirection]}>{item.content}</Text>
          <View style={[styles.metaRow,rtl&&styles.rtl]}>
            <Text style={styles.meta}>{formatLocalizedDate(item.publishAt,locale)}</Text>
            <Text style={styles.meta}>{translate(locale,
              item.audienceScope==="CLASS"?"student.classAnnouncement":
              item.audienceScope==="ROLE"?"student.studentAnnouncement":"student.schoolAnnouncement")}
            </Text>
          </View>
        </View>):
        (visible.visible as ParentNotification[]).map(item=><View key={item.id}
          style={[styles.card,!item.readAt&&styles.unreadCard]}>
          <Pressable accessibilityRole="button" accessibilityLabel={item.title}
            onPress={()=>onOpenNotification(item)}
            style={[styles.cardTitle,rtl&&styles.rtl]}>
            <Ionicons name={item.readAt?"notifications-outline":"notifications"} size={20}
              color={tokens.color.brandStrong}/>
            <Text style={[styles.title,styles.flex,textDirection]}>{item.title}</Text>
            {!item.readAt?<View style={styles.dot}/>:null}
          </Pressable>
          <Text style={[styles.copy,textDirection]}>{item.message}</Text>
          <View style={[styles.metaRow,rtl&&styles.rtl]}>
            <Text style={styles.meta}>{formatLocalizedDate(item.createdAt,locale)}</Text>
            {!item.readAt?<Pressable accessibilityRole="button"
              disabled={busyId===item.id||markingAll} onPress={()=>void markOne(item.id)}
              style={styles.action}>
              <Ionicons name="checkmark-circle-outline" size={16} color={tokens.color.brandStrong}/>
              <Text style={styles.actionText}>{translate(locale,"student.markRead")}</Text>
            </Pressable>:<Text style={styles.meta}>{translate(locale,"student.read")}</Text>}
          </View>
        </View>)}
      {visible.total===0?<View style={styles.emptyCard}>
        <Ionicons name={isAnnouncements?"megaphone-outline":"notifications-off-outline"}
          size={24} color={tokens.color.textMuted}/>
        <Text style={[styles.muted,textDirection]}>
          {translate(locale,query||audience!=="ALL"&&isAnnouncements||
            !isAnnouncements&&(readFilter!=="ALL"||topic!=="ALL")
            ?"student.inboxNoMatching":
            isAnnouncements?"student.noAnnouncements":"communication.noNotifications")}
        </Text>
      </View>:null}
      {hasMore?<Pressable accessibilityRole="button" testID="student-inbox-more"
        onPress={()=>setPage(value=>value+1)} style={styles.loadMore}>
        <Text style={styles.actionText}>{translate(locale,"student.inboxLoadMore")}</Text>
        <Text style={styles.meta}>{formatLocalizedNumber(STUDENT_INBOX_PAGE_SIZE,locale)}</Text>
      </Pressable>:null}
    </View>}
  </View>;
}
const styles=StyleSheet.create({
  stack:{gap:12},flex:{flex:1,minWidth:0},rtl:{flexDirection:"row-reverse"},
  tabs:{flexDirection:"row",borderRadius:16,padding:4,gap:4,backgroundColor:"#edf3fa"},
  tab:{flex:1,flexDirection:"row",alignItems:"center",justifyContent:"center",
    gap:5,minHeight:47,paddingHorizontal:5,borderRadius:12},
  tabSelected:{borderWidth:1,borderColor:"#c9d9f0",backgroundColor:"#fff"},
  tabText:{fontSize:12,fontWeight:"800",color:tokens.color.textMuted},
  tabTextSelected:{color:tokens.color.brandStrong},
  badge:{backgroundColor:"#d9eaff",minWidth:21,paddingHorizontal:4,borderRadius:10},
  badgeText:{fontSize:11,fontWeight:"800",color:tokens.color.brandStrong,textAlign:"center"},
  toolbar:{flexDirection:"row",alignItems:"center",gap:7},
  muted:{fontSize:12.5,lineHeight:19,color:tokens.color.textMuted},
  hint:{fontSize:12,color:"#9c491b",backgroundColor:"#fff3e6",
    borderRadius:11,padding:12},
  action:{minHeight:43,borderRadius:11,paddingHorizontal:10,
    flexDirection:"row",alignItems:"center",justifyContent:"center",
    gap:5,backgroundColor:"#eaf2ff"},
  actionText:{fontSize:11.5,fontWeight:"800",color:tokens.color.brandStrong},
  disabled:{opacity:0.65},
  searchRow:{flexDirection:"row",alignItems:"center",gap:8,
    borderRadius:12,borderColor:"#cfdeec",borderWidth:1,backgroundColor:"#fff",
    paddingHorizontal:12,minHeight:48},
  search:{fontSize:13,color:tokens.color.text,paddingVertical:8},
  chips:{flexDirection:"row",alignItems:"center",gap:8,paddingVertical:3},
  chip:{minHeight:42,paddingHorizontal:14,justifyContent:"center",
    borderRadius:11,borderWidth:1,borderColor:"#d6e3f0",backgroundColor:"#fff"},
  chipSelected:{borderColor:tokens.color.brandStrong,backgroundColor:"#e5f0ff"},
  chipText:{fontSize:12,fontWeight:"800",color:tokens.color.textMuted},
  chipTextSelected:{color:tokens.color.brandStrong},
  markAll:{alignSelf:"flex-start"},
  card:{backgroundColor:"#fff",borderWidth:1,borderColor:"#e1e8f2",
    borderRadius:17,padding:14,gap:11},
  unreadCard:{backgroundColor:"#f5faff",borderColor:"#b9d5f4"},
  focused:{borderColor:tokens.color.brandStrong,borderWidth:2},
  cardTitle:{flexDirection:"row",alignItems:"center",gap:10,minHeight:43},
  title:{fontSize:14,fontWeight:"900",color:tokens.color.text},
  copy:{fontSize:13,lineHeight:20,color:tokens.color.text},
  metaRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",
    flexWrap:"wrap",gap:7},
  meta:{fontSize:11.5,color:tokens.color.textMuted},
  dot:{width:8,height:8,borderRadius:4,backgroundColor:tokens.color.brandStrong},
  emptyCard:{minHeight:120,borderRadius:16,backgroundColor:"#f8faff",
    padding:16,alignItems:"center",justifyContent:"center",gap:10},
  loadMore:{minHeight:47,borderRadius:12,backgroundColor:"#eaf2ff",
    flexDirection:"row",alignItems:"center",justifyContent:"center",gap:10}
});
