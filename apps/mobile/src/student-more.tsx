import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedNumber, getDirection, localizeDigits, supportedLocales, translate,
  type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import { AdminContactCard } from "./admin-contact-card";
import type { AdminContactPayload } from "./api";

const localeNames:Record<SupportedLocale,string>={
  "fa-AF":"دری","ps-AF":"پښتو",en:"English"
};
type Direction={textAlign:"left"|"right";writingDirection:"ltr"|"rtl"};
type Destination="ANNOUNCEMENTS"|"NOTIFICATIONS";

function MenuLink({label,description,icon,rtl,textDirection,badge,onPress}:{
  label:string;description:string;icon:keyof typeof Ionicons.glyphMap;
  rtl:boolean;textDirection:Direction;badge?:number;onPress:()=>void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    onPress={onPress} style={({pressed})=>[
      styles.linkRow,rtl&&styles.rtl,pressed&&styles.pressed
    ]}>
    <View style={styles.icon}><Ionicons name={icon} size={21} color={tokens.color.brandStrong}/></View>
    <View style={styles.flex}>
      <Text style={[styles.linkTitle,textDirection]}>{label}</Text>
      <Text style={[styles.description,textDirection]}>{description}</Text>
    </View>
    {badge&&badge>0?<View style={styles.badge}>
      <Text style={styles.badgeText}>{badge>99?"99+":formatLocalizedNumber(badge,"en")}</Text>
    </View>:null}
    <Ionicons name={rtl?"chevron-back":"chevron-forward"} size={19} color={tokens.color.textMuted}/>
  </Pressable>;
}

export function StudentMorePanel({
  locale,textDirection,fullName,username,studentCode,className,academicYear,schoolName,
  unreadCount,contact,onOpenUpdates,onLocaleChange,onLogout
}:{
  locale:SupportedLocale;
  textDirection:Direction;
  fullName:string|null;username:string;studentCode:string|null;
  className:string|null;academicYear:string|null;schoolName:string;
  unreadCount:number;contact:AdminContactPayload|null;
  onOpenUpdates:(tab:Destination)=>void;
  onLocaleChange:(locale:SupportedLocale)=>void;onLogout:()=>void;
}) {
  const rtl=getDirection(locale)==="rtl";
  const display=fullName||username;
  return <View style={styles.stack} testID="student-more-page">
    <View style={styles.profile} testID="student-more-profile">
      <View style={[styles.profileRow,rtl&&styles.rtl]}>
        <View style={styles.avatar}><Ionicons name="person-outline" size={27} color={tokens.color.brandStrong}/></View>
        <View style={styles.flex}>
          <Text style={[styles.profileName,textDirection]}>{display}</Text>
          <Text style={[styles.description,textDirection]}>{schoolName}</Text>
          <Text style={[styles.description,textDirection]}>{translate(locale,"student.moreProfileHint")}</Text>
        </View>
      </View>
      <View style={[styles.profileStats,rtl&&styles.rtl]}>
        {([
          ["student.studentCode",studentCode?localizeDigits(studentCode,locale):"—"],
          ["student.class",className??"—"],
          ["student.academicYear",academicYear?localizeDigits(academicYear,locale):"—"]
        ] as Array<[TranslationKey,string]>).map(([key,value])=>
          <View style={styles.profileStat} key={key}>
            <Text style={styles.statValue} numberOfLines={2}>{value}</Text>
            <Text style={styles.statLabel}>{translate(locale,key)}</Text>
          </View>)}
      </View>
    </View>
    <View style={styles.card}>
      <Text style={[styles.heading,textDirection]}>{translate(locale,"student.moreSchoolUpdates")}</Text>
      <Text style={[styles.description,textDirection]}>{translate(locale,"student.moreSchoolUpdatesHint")}</Text>
      <MenuLink icon="megaphone-outline" label={translate(locale,"student.announcementsTitle")}
        description={translate(locale,"student.announcementsSubtitle")}
        rtl={rtl} textDirection={textDirection}
        onPress={()=>onOpenUpdates("ANNOUNCEMENTS")}/>
      <MenuLink icon="notifications-outline" label={translate(locale,"student.notificationsTitle")}
        description={translate(locale,"student.notificationsSubtitle")}
        badge={unreadCount} rtl={rtl} textDirection={textDirection}
        onPress={()=>onOpenUpdates("NOTIFICATIONS")}/>
    </View>
    <View style={styles.card}>
      <Text style={[styles.heading,textDirection]}>{translate(locale,"student.moreSettings")}</Text>
      <Text style={[styles.description,textDirection]}>{translate(locale,"student.moreLanguage")}</Text>
      <View style={[styles.languages,rtl&&styles.rtl]}>
        {supportedLocales.map(next=><Pressable key={next} accessibilityRole="radio"
          accessibilityLabel={localeNames[next]} accessibilityState={{checked:locale===next}}
          onPress={()=>onLocaleChange(next)}
          style={[styles.language,locale===next&&styles.languageActive]}>
          <Text style={[styles.languageText,locale===next&&styles.languageTextActive]}>
            {localeNames[next]}
          </Text>
        </Pressable>)}
      </View>
    </View>
    <View style={styles.card}>
      <Text style={[styles.heading,textDirection]}>{translate(locale,"student.moreHelp")}</Text>
      <AdminContactCard contact={contact} locale={locale}/>
    </View>
    <Pressable accessibilityRole="button" onPress={onLogout}
      style={[styles.logout,rtl&&styles.rtl]}>
      <Ionicons name="log-out-outline" size={20} color={tokens.color.brandStrong}/>
      <Text style={styles.logoutText}>{translate(locale,"auth.logout")}</Text>
    </Pressable>
  </View>;
}

const styles=StyleSheet.create({
  stack:{gap:14},flex:{flex:1,minWidth:0},rtl:{flexDirection:"row-reverse"},
  profile:{borderRadius:19,backgroundColor:"#f0f6ff",borderColor:"#d8e6fa",
    borderWidth:1,padding:15,gap:14},
  profileRow:{flexDirection:"row",alignItems:"center",gap:12},
  avatar:{width:51,height:51,borderRadius:16,alignItems:"center",
    justifyContent:"center",backgroundColor:"#dbeaff"},
  profileName:{fontSize:17,fontWeight:"900",color:tokens.color.text},
  profileStats:{flexDirection:"row",gap:7,flexWrap:"wrap"},
  profileStat:{flexGrow:1,minWidth:"29%",padding:9,alignItems:"center",
    justifyContent:"center",gap:5,backgroundColor:"#fff",borderRadius:12},
  statValue:{fontSize:13,fontWeight:"900",color:tokens.color.brandStrong,textAlign:"center"},
  statLabel:{fontSize:10.5,color:tokens.color.textMuted,textAlign:"center"},
  card:{padding:15,gap:10,borderRadius:18,borderWidth:1,
    borderColor:"#e1e7f0",backgroundColor:tokens.color.surface},
  heading:{fontSize:16,fontWeight:"900",color:tokens.color.text},
  description:{color:tokens.color.textMuted,fontSize:12,lineHeight:19},
  linkRow:{flexDirection:"row",alignItems:"center",gap:9,borderTopWidth:1,
    borderTopColor:"#ecf0f6",paddingVertical:10,minHeight:58},
  icon:{width:39,height:39,borderRadius:12,justifyContent:"center",
    alignItems:"center",backgroundColor:"#eaf2ff"},
  linkTitle:{fontSize:13.5,fontWeight:"800",color:tokens.color.text},
  badge:{backgroundColor:"#e1edff",borderRadius:12,paddingHorizontal:7,
    minWidth:23,minHeight:23,alignItems:"center",justifyContent:"center"},
  badgeText:{color:tokens.color.brandStrong,fontWeight:"900",fontSize:11},
  languages:{flexDirection:"row",gap:8},
  language:{flex:1,minHeight:45,alignItems:"center",justifyContent:"center",
    borderRadius:12,borderColor:"#dbe3ed",borderWidth:1,backgroundColor:"#f8faff"},
  languageActive:{backgroundColor:"#eaf2ff",borderColor:tokens.color.brandStrong},
  languageText:{fontSize:12,color:tokens.color.text,fontWeight:"800"},
  languageTextActive:{color:tokens.color.brandStrong},
  logout:{minHeight:50,alignItems:"center",justifyContent:"center",
    flexDirection:"row",gap:9,borderRadius:13,borderColor:"#dce5f1",
    borderWidth:1,backgroundColor:"#f7faff"},
  logoutText:{fontSize:13,color:tokens.color.brandStrong,fontWeight:"800"},
  pressed:{opacity:0.72}
});
