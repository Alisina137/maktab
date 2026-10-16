import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedNumber, getDirection, supportedLocales, translate,
  type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import { AdminContactCard } from "./admin-contact-card";
import type { AdminContactPayload } from "./api";

export type TeacherMoreSection = "HOME" | "ANNOUNCEMENTS" | "PROFILE";
type Direction = { textAlign: "right" | "left"; writingDirection: "rtl" | "ltr" };
type MoreAction = {
  label: TranslationKey; subtitle: TranslationKey; icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};
const languageNames: Record<SupportedLocale, string> = {
  "fa-AF": "دری", "ps-AF": "پښتو", en: "English"
};

export function TeacherMorePanel({
  section, schoolName, username, fullName, unreadCount, locale, textDirection,
  contact, onSectionChange, onNotifications, onChangeLocale, onLogout,
  announcementContent
}: {
  section: TeacherMoreSection;
  schoolName: string;
  username: string;
  fullName: string;
  unreadCount: number;
  locale: SupportedLocale;
  textDirection: Direction;
  contact: AdminContactPayload | null;
  onSectionChange: (section: TeacherMoreSection) => void;
  onNotifications: () => void;
  onChangeLocale: (locale: SupportedLocale) => void;
  onLogout: () => void;
  announcementContent: ReactNode;
}) {
  const rtl=getDirection(locale)==="rtl";
  const actions: MoreAction[]=[
    { label:"teacher.workflowAnnouncements", subtitle:"teacher.latestAnnouncements",
      icon:"megaphone-outline",onPress:()=>onSectionChange("ANNOUNCEMENTS") },
    { label:"teacher.notificationsCenter",subtitle:"teacher.unreadNotifications",
      icon:"notifications-outline",onPress:onNotifications },
    { label:"teacher.moreProfile",subtitle:"teacher.moreAccountInfo",
      icon:"person-circle-outline",onPress:()=>onSectionChange("PROFILE") }
  ];
  return <View style={styles.stack} testID="teacher-more-page">
    {section!=="HOME"?<Pressable accessibilityRole="button"
      accessibilityLabel={translate(locale,"teacher.moreBack")}
      onPress={()=>onSectionChange("HOME")} style={[styles.back,rtl&&styles.rtl]}>
      <Ionicons name={rtl?"arrow-forward":"arrow-back"} size={18} color={tokens.color.brandStrong}/>
      <Text style={styles.link}>{translate(locale,"teacher.moreBack")}</Text>
    </Pressable>:null}
    {section==="HOME"?<>
      <View style={styles.card}>
        <Text style={[styles.heading,textDirection]}>{translate(locale,"teacher.navMore")}</Text>
        <Text style={[styles.muted,textDirection]}>{translate(locale,"teacher.moreIntro")}</Text>
        {actions.map(action=><Pressable key={action.label} accessibilityRole="button"
          accessibilityLabel={translate(locale,action.label)}
          onPress={action.onPress}
          style={({pressed})=>[styles.row,rtl&&styles.rtl,pressed&&styles.pressed]}>
          <View style={styles.icon}><Ionicons name={action.icon} size={21} color={tokens.color.brandStrong}/></View>
          <View style={styles.flex}>
            <Text style={[styles.label,textDirection]}>{translate(locale,action.label)}</Text>
            <Text style={[styles.muted,textDirection]}>{translate(locale,action.subtitle)}</Text>
          </View>
          {action.label==="teacher.notificationsCenter"&&unreadCount>0?<View style={styles.badge}>
            <Text style={styles.badgeText}>{formatLocalizedNumber(unreadCount,locale)}</Text>
          </View>:null}
          <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={18} color={tokens.color.textMuted}/>
        </Pressable>)}
      </View>
      <AdminContactCard contact={contact} locale={locale}/>
    </>:null}
    {section==="ANNOUNCEMENTS"?<View style={styles.stack}>
      <Text style={[styles.heading,textDirection]}>{translate(locale,"teacher.workflowAnnouncements")}</Text>
      {announcementContent}
    </View>:null}
    {section==="PROFILE"?<>
      <View style={styles.card}>
        <Text style={[styles.heading,textDirection]}>{translate(locale,"teacher.moreProfile")}</Text>
        <Text style={[styles.muted,textDirection]}>{translate(locale,"teacher.moreAccountInfo")}</Text>
        <View style={styles.info}><Text style={[styles.muted,textDirection]}>{translate(locale,"teacher.workspace")}</Text>
          <Text style={[styles.label,textDirection]}>{fullName||username}</Text></View>
        <View style={styles.info}><Text style={[styles.muted,textDirection]}>{translate(locale,"teacher.moreUsername")}</Text>
          <Text style={[styles.label,textDirection]}>{username}</Text></View>
        <View style={styles.info}><Text style={[styles.muted,textDirection]}>{translate(locale,"teacher.moreSchool")}</Text>
          <Text style={[styles.label,textDirection]}>{schoolName}</Text></View>
      </View>
      <View style={styles.card}>
        <Text style={[styles.heading,textDirection]}>{translate(locale,"teacher.moreLanguage")}</Text>
        <View style={[styles.languages,rtl&&styles.rtl]}>
          {supportedLocales.map(next=><Pressable key={next} accessibilityRole="radio"
            accessibilityState={{checked:locale===next}}
            onPress={()=>onChangeLocale(next)}
            style={[styles.language,locale===next&&styles.languageActive]}>
            <Text style={[styles.label,locale===next&&styles.link]}>{languageNames[next]}</Text>
          </Pressable>)}
        </View>
      </View>
      <AdminContactCard contact={contact} locale={locale}/>
      <Pressable accessibilityRole="button" onPress={onLogout} style={[styles.logout,rtl&&styles.rtl]}>
        <Ionicons name="log-out-outline" size={20} color={tokens.color.brandStrong}/>
        <Text style={styles.link}>{translate(locale,"auth.logout")}</Text>
      </Pressable>
    </>:null}
  </View>;
}
const styles=StyleSheet.create({
  stack:{gap:14},
  flex:{flex:1,minWidth:0},
  rtl:{flexDirection:"row-reverse"},
  card:{gap:12,padding:16,backgroundColor:tokens.color.surface,borderRadius:19,
    borderWidth:1,borderColor:"#e1e7f0"},
  heading:{fontSize:18,fontWeight:"900",color:tokens.color.text},
  label:{fontSize:14,fontWeight:"700",color:tokens.color.text},
  muted:{fontSize:12.5,lineHeight:20,color:tokens.color.textMuted},
  row:{flexDirection:"row",alignItems:"center",gap:12,minHeight:61,padding:10,
    borderRadius:13,borderWidth:1,borderColor:"#e4ebf5",backgroundColor:"#f9fbff"},
  icon:{height:38,width:38,borderRadius:12,backgroundColor:"#eaf2ff",
    alignItems:"center",justifyContent:"center"},
  badge:{minWidth:24,height:24,paddingHorizontal:5,borderRadius:12,
    backgroundColor:"#dcf0ff",alignItems:"center",justifyContent:"center"},
  badgeText:{fontSize:11,fontWeight:"900",color:tokens.color.brandStrong},
  info:{paddingTop:10,borderTopWidth:1,borderTopColor:"#edf1f7",gap:4},
  languages:{flexDirection:"row",gap:7},
  language:{flex:1,minHeight:44,alignItems:"center",justifyContent:"center",padding:7,
    backgroundColor:"#f8faff",borderRadius:11,borderWidth:1,borderColor:"#e1e7f0"},
  languageActive:{backgroundColor:"#eaf2ff",borderColor:tokens.color.brandStrong},
  back:{alignSelf:"flex-start",padding:12,flexDirection:"row",gap:9,alignItems:"center",
    borderRadius:12,backgroundColor:"#edf4ff"},
  logout:{minHeight:50,alignItems:"center",justifyContent:"center",flexDirection:"row",
    gap:10,backgroundColor:"#f7faff",borderRadius:13,borderWidth:1,borderColor:"#dbe5f2"},
  pressed:{opacity:.78},
  link:{fontSize:13,fontWeight:"800",color:tokens.color.brandStrong}
});
