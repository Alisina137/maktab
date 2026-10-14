import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tokens } from "@maktablink/design-tokens";
import {
  formatAfn, formatLocalizedDate, formatLocalizedNumber, getDirection,
  supportedLocales, translate, type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import { AdminContactCard } from "./admin-contact-card";
import type { AdminContactPayload, FeeInvoiceViewPayload, ParentHomePayload,
  SchoolOption } from "./api";
import {
  parentFeeSummary, parentPasswordValidation, sortedParentPayments,
  visibleParentInvoices, type ParentFeeFilter
} from "./parent-more-model";

type LoadStatus = "idle" | "loading" | "ready" | "error";
const feeStatus: Record<FeeInvoiceViewPayload["invoice"]["status"],TranslationKey> = {
  DRAFT: "fees.statusDraft", ISSUED: "fees.statusIssued",
  PARTIALLY_PAID: "fees.statusPartiallyPaid", PAID: "fees.statusPaid",
  OVERDUE: "fees.statusOverdue", CANCELLED: "fees.statusCancelled"
};
const filterLabel: Record<ParentFeeFilter, TranslationKey> = {
  ALL: "parent.moreAllInvoices", DUE: "parent.moreUnpaid",
  PAID: "parent.morePaid", CANCELLED: "fees.statusCancelled"
};
const passwordErrors: Record<NonNullable<ReturnType<typeof parentPasswordValidation>>,TranslationKey> = {
  CURRENT: "parent.moreCurrentRequired", SAME: "parent.moreSamePassword",
  LENGTH: "parent.morePasswordLength", LETTER: "passwordChange.missingLetter",
  NUMBER: "passwordChange.missingNumber", SPECIAL: "passwordChange.missingSpecial",
  CONFIRM: "passwordChange.mismatch"
};

function Head({
  title, description, icon, locale, action
}: { title: TranslationKey; description: TranslationKey; icon: keyof typeof Ionicons.glyphMap;
  locale: SupportedLocale; action?: React.ReactNode }) {
  const rtl = getDirection(locale) === "rtl";
  return <View style={[styles.head, rtl && styles.rtlRow]}>
    <View style={styles.icon}><Ionicons name={icon} size={21} color={tokens.color.brandStrong}/></View>
    <View style={styles.flex}>
      <Text style={[styles.title, rtl && styles.rtlText]}>{translate(locale,title)}</Text>
      <Text style={[styles.sub, rtl && styles.rtlText]}>{translate(locale,description)}</Text>
    </View>
    {action}
  </View>;
}
function Stat({
  name, value, locale
}: { name: TranslationKey; value: string; locale: SupportedLocale }) {
  const rtl = getDirection(locale) === "rtl";
  return <View style={styles.stat}>
    <Text style={[styles.mini, rtl && styles.rtlText]}>{translate(locale,name)}</Text>
    <Text style={styles.statValue} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
  </View>;
}
function Info({
  label, value, locale
}: { label: TranslationKey; value: string; locale: SupportedLocale }) {
  const rtl = getDirection(locale) === "rtl";
  return <View style={[styles.info, rtl && styles.rtlRow]}>
    <Text style={[styles.mini, rtl && styles.rtlText]}>{translate(locale,label)}</Text>
    <Text style={[styles.value, rtl && styles.rtlText]}>{value}</Text>
  </View>;
}
function Notice({
  locale, error, onRetry
}: { locale: SupportedLocale; error: boolean; onRetry: () => void }) {
  const rtl = getDirection(locale) === "rtl";
  return <View style={styles.notice}>
    {error ? <Ionicons name="cloud-offline-outline" color={tokens.color.textMuted} size={24}/>
      : <ActivityIndicator color={tokens.color.brand}/>}
    <Text style={[styles.sub,rtl && styles.rtlText]}>
      {translate(locale,error ? "parent.unavailable" : "common.loading")}
    </Text>
    {error ? <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}>
      <Text style={styles.buttonText}>{translate(locale,"parent.tryAgain")}</Text>
    </Pressable> : null}
  </View>;
}

export function ParentFeesPanel({
  fees, status, locale, onRetry
}: { fees: FeeInvoiceViewPayload[]; status: LoadStatus; locale: SupportedLocale;
  onRetry: () => void }) {
  const rtl = getDirection(locale) === "rtl";
  const [filter,setFilter] = useState<ParentFeeFilter>("ALL");
  const [expanded,setExpanded] = useState<string | null>(null);
  const summary = parentFeeSummary(status === "ready" ? fees : []);
  const visible = visibleParentInvoices(fees,filter);
  return <View style={styles.stack}>
    <View style={styles.card}>
      <Head title="fees.title" description="parent.moreFeesDescription"
        icon="wallet-outline" locale={locale} action={
          <Pressable accessibilityRole="button" accessibilityLabel={translate(locale,"parent.academicRefresh")}
            style={styles.iconButton} onPress={onRetry}>
            <Ionicons name="refresh-outline" size={21} color={tokens.color.brandStrong}/>
          </Pressable>
        }/>
      {status !== "ready" ? <Notice locale={locale} error={status==="error"} onRetry={onRetry}/> :
        <>
          <View style={[styles.stats, rtl && styles.rtlRow]}>
            <Stat name="parent.moreBilled" value={formatAfn(summary.issued,locale)} locale={locale}/>
            <Stat name="fees.paid" value={formatAfn(summary.paid,locale)} locale={locale}/>
            <Stat name="fees.outstanding" value={formatAfn(summary.outstanding,locale)} locale={locale}/>
          </View>
          <Text style={[styles.sub, rtl && styles.rtlText]}>
            {translate(locale,"parent.moreLedgerHint")}
          </Text>
          <Text style={[styles.mini, rtl && styles.rtlText]}>
            {translate(locale,"parent.moreInvoices")}: {formatLocalizedNumber(summary.invoiceCount,locale)}
            {" · "}{translate(locale,"parent.moreUnpaid")}: {formatLocalizedNumber(summary.dueCount,locale)}
          </Text>
        </>}
    </View>
    {status === "ready" ? <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.filters,rtl && styles.rtlRow]}>
        {(Object.keys(filterLabel) as ParentFeeFilter[]).map(key=>(
          <Pressable key={key} accessibilityRole="button" accessibilityState={{selected:filter===key}}
            onPress={()=>{setFilter(key);setExpanded(null);}}
            style={[styles.chip,filter===key && styles.activeChip]}>
            <Text style={[styles.chipText,filter===key && styles.activeText]}>
              {translate(locale,filterLabel[key])}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {!visible.length ? <View style={styles.card}><Text style={[styles.sub,rtl && styles.rtlText]}>
        {translate(locale,fees.length===0?"fees.none":"parent.moreNoFilteredFees")}
      </Text></View> : null}
      {visible.map(row=>{
        const open=expanded===row.invoice.id;
        return <View key={row.invoice.id} style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityState={{expanded:open}}
            onPress={()=>setExpanded(open?null:row.invoice.id)}
            style={[styles.head,rtl && styles.rtlRow]}>
            <View style={styles.icon}><Ionicons name="receipt-outline" size={20} color={tokens.color.brandStrong}/></View>
            <View style={styles.flex}>
              <Text style={[styles.itemTitle,rtl && styles.rtlText]}>
                {row.invoice.description || translate(locale,"fees.invoice")}
              </Text>
              <Text style={[styles.sub,rtl && styles.rtlText]}>
                {translate(locale,"fees.due")} {formatLocalizedDate(row.invoice.dueDate,locale)}
              </Text>
              <Text style={[styles.badge,rtl && styles.rtlText]}>
                {translate(locale,feeStatus[row.invoice.status])}
              </Text>
            </View>
            <Ionicons name={open?"chevron-up":"chevron-down"} size={20} color={tokens.color.textMuted}/>
          </Pressable>
          <View style={[styles.total,rtl && styles.rtlRow]}>
            <Text style={styles.mini}>{translate(locale,"fees.outstanding")}</Text>
            <Text style={styles.amount}>{formatAfn(row.outstanding,locale)}</Text>
          </View>
          {open ? <View style={styles.details}>
            <Info label="fees.amount" value={formatAfn(row.invoice.amount,locale)} locale={locale}/>
            <Info label="fees.paid" value={formatAfn(row.paid,locale)} locale={locale}/>
            <Info label="fees.outstanding" value={formatAfn(row.outstanding,locale)} locale={locale}/>
            {row.invoice.issuedAt ?
              <Info label="parent.moreIssuedOn" value={formatLocalizedDate(row.invoice.issuedAt,locale)} locale={locale}/> : null}
            <Text style={[styles.itemTitle,rtl && styles.rtlText]}>
              {translate(locale,"parent.morePaymentHistory")}
            </Text>
            {row.payments.length===0 ? <Text style={[styles.sub,rtl && styles.rtlText]}>
              {translate(locale,"parent.moreNoPayments")}
            </Text>:sortedParentPayments(row.payments).map(payment=><View key={payment.id} style={styles.payment}>
              <View style={[styles.head,rtl && styles.rtlRow]}>
                <View style={styles.flex}>
                  <Text style={[styles.itemTitle,rtl && styles.rtlText]}>
                    {translate(locale,payment.kind==="PAYMENT"?"fees.payment":"fees.reversal")}
                  </Text>
                  <Text style={[styles.sub,rtl && styles.rtlText]}>
                    {formatLocalizedDate(payment.recordedAt,locale)}
                  </Text>
                </View>
                <Text style={styles.amount}>{formatAfn(payment.amount,locale)}</Text>
              </View>
              {payment.transactionReference ? <Text style={[styles.mini,rtl && styles.rtlText]}>
                {translate(locale,"parent.moreReference")}: {payment.transactionReference}
              </Text> : null}
              {payment.reversalReason ? <Text style={[styles.mini,rtl && styles.rtlText]}>
                {translate(locale,"parent.moreReversalReason")}: {payment.reversalReason}
              </Text> : null}
            </View>)}
          </View> : null}
        </View>;
      })}
      <View style={styles.hint}><Ionicons name="information-circle-outline" size={20}
        color={tokens.color.brandStrong}/>
        <Text style={[styles.sub,styles.flex,rtl && styles.rtlText]}>
          {translate(locale,"parent.morePaymentHelp")}
        </Text>
      </View>
    </> : null}
  </View>;
}

export function ParentProfilePanel({
  home, username, locale, onRefresh
}: { home: ParentHomePayload | null; username: string; locale: SupportedLocale;
  onRefresh: () => void }) {
  const rtl = getDirection(locale)==="rtl";
  return <View style={styles.stack}>
    <View style={styles.card}>
      <Head title="parent.moreProfile" description="parent.moreProfileHint"
        icon="person-circle-outline" locale={locale} action={
          <Pressable accessibilityRole="button" accessibilityLabel={translate(locale,"parent.academicRefresh")}
            onPress={onRefresh} style={styles.iconButton}>
            <Ionicons name="refresh-outline" size={20} color={tokens.color.brandStrong}/>
          </Pressable>}/>
      <View style={[styles.profile,rtl && styles.rtlRow]}>
        <View style={styles.avatar}><Text style={styles.avatarText}>
          {(home?.parent.fullName || username).slice(0,1).toUpperCase()}
        </Text></View>
        <View style={styles.flex}>
          <Text style={[styles.title,rtl && styles.rtlText]}>{home?.parent.fullName || username}</Text>
          <Text style={[styles.sub,rtl && styles.rtlText]}>{translate(locale,"parent.moreParentAccount")}</Text>
        </View>
      </View>
      <Info label="parent.moreUsername" value={username} locale={locale}/>
      {home?.parent.phone ?
        <Info label="contact.phone" value={home.parent.phone} locale={locale}/> :
        <Info label="contact.phone" value={translate(locale,"parent.moreNotProvided")} locale={locale}/>}
      <Text style={[styles.sub,rtl && styles.rtlText]}>
        {translate(locale,"parent.moreManagedBySchool")}
      </Text>
    </View>
    <View style={styles.card}>
      <Text style={[styles.title,rtl && styles.rtlText]}>
        {translate(locale,"parent.moreLinkedChildren")}
        {home ? ` (${formatLocalizedNumber(home.children.length,locale)})` : ""}
      </Text>
      {!home ? <ActivityIndicator color={tokens.color.brand}/> :
        home.children.length===0 ? <Text style={[styles.sub,rtl && styles.rtlText]}>
          {translate(locale,"parent.noChildren")}
        </Text> : home.children.map(child=><View key={child.student.id}
          style={[styles.childRow,rtl && styles.rtlRow]}>
          <View style={styles.icon}><Ionicons name="school-outline" color={tokens.color.brandStrong} size={18}/></View>
          <View style={styles.flex}>
            <Text style={[styles.itemTitle,rtl && styles.rtlText]}>{child.student.fullName}</Text>
            <Text style={[styles.sub,rtl && styles.rtlText]}>
              {child.classSection.name} · {child.academicYear.name}
            </Text>
            <Text style={[styles.mini,rtl && styles.rtlText]}>
              {translate(locale,"parent.studentCode")}: {child.student.studentCode}
            </Text>
          </View>
        </View>)}
    </View>
  </View>;
}

export function ParentSchoolPanel({
  school, contact, locale
}: { school: SchoolOption | null; contact: AdminContactPayload | null; locale: SupportedLocale }) {
  const rtl = getDirection(locale)==="rtl";
  return <View style={styles.stack}>
    <View style={styles.card}>
      <Head title="parent.moreSchool" description="parent.moreSchoolHint"
        icon="business-outline" locale={locale}/>
      <Text style={[styles.title,rtl && styles.rtlText]}>{school?.name ?? translate(locale,"parent.unavailable")}</Text>
      {school ? <>
        <Info label="parent.moreSchoolCode" value={school.code} locale={locale}/>
        <Info label="parent.moreProvince" value={school.province} locale={locale}/>
        <Info label="parent.moreCity" value={school.city} locale={locale}/>
      </> : null}
    </View>
    <AdminContactCard contact={contact} locale={locale}/>
    <View style={styles.hint}>
      <Ionicons name="shield-checkmark-outline" size={20} color={tokens.color.brandStrong}/>
      <Text style={[styles.sub,styles.flex,rtl && styles.rtlText]}>
        {translate(locale,"parent.moreSchoolContactHelp")}
      </Text>
    </View>
  </View>;
}

export function ParentPreferencesPanel({
  locale, onSelectLocale, onChangePassword, onLogout
}: {
  locale: SupportedLocale;
  onSelectLocale: (value: SupportedLocale) => void;
  onChangePassword: (current: string, next: string) => Promise<boolean>;
  onLogout: () => void;
}) {
  const rtl = getDirection(locale)==="rtl";
  const [current,setCurrent]=useState("");
  const [next,setNext]=useState("");
  const [confirm,setConfirm]=useState("");
  const [show,setShow]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<TranslationKey | null>(null);
  const [success,setSuccess]=useState(false);
  const submit=async()=>{
    if(saving)return;
    const issue=parentPasswordValidation(current,next,confirm);
    if(issue){setError(passwordErrors[issue]);setSuccess(false);return;}
    setSaving(true);setError(null);setSuccess(false);
    try{
      const changed=await onChangePassword(current,next);
      if(changed){setCurrent("");setNext("");setConfirm("");setShow(false);setSuccess(true);}
      else setError("parent.morePasswordFailed");
    }finally{setSaving(false);}
  };
  return <View style={styles.stack}>
    <View style={styles.card}>
      <Head title="parent.morePreferences" description="parent.moreLanguageHint"
        icon="language-outline" locale={locale}/>
      <Text style={[styles.itemTitle,rtl && styles.rtlText]}>{translate(locale,"parent.moreLanguage")}</Text>
      {supportedLocales.map(code=><Pressable key={code} accessibilityRole="button"
        accessibilityLabel={code==="en"?"English":code==="fa-AF"?"دری":"پښتو"}
        accessibilityState={{selected:code===locale}} onPress={()=>onSelectLocale(code)}
        style={[styles.language,rtl && styles.rtlRow,code===locale && styles.languageActive]}>
        <Ionicons name="language-outline" color={tokens.color.brandStrong} size={19}/>
        <Text style={[styles.itemTitle,styles.flex,rtl && styles.rtlText]}>
          {code==="en"?"English":code==="fa-AF"?"دری":"پښتو"}
        </Text>
        {code===locale?<Ionicons name="checkmark-circle" size={21} color={tokens.color.brandStrong}/>:null}
      </Pressable>)}
    </View>
    <View style={styles.card}>
      <Head title="parent.moreSecurity" description="parent.moreSecurityHint"
        icon="shield-checkmark-outline" locale={locale}/>
      {([
        ["parent.moreCurrentPassword",current,setCurrent],
        ["parent.moreNewPassword",next,setNext],
        ["parent.moreConfirmPassword",confirm,setConfirm]
      ] as const).map(([label,value,set])=><View key={label} style={styles.field}>
        <Text style={[styles.mini,rtl && styles.rtlText]}>{translate(locale,label)}</Text>
        <TextInput value={value} onChangeText={v=>{set(v);setError(null);setSuccess(false);}}
          accessibilityLabel={translate(locale,label)} secureTextEntry={!show}
          autoCapitalize="none" autoCorrect={false} textContentType="none"
          style={[styles.input,rtl && styles.rtlText]} editable={!saving}
          placeholder={translate(locale,label)} placeholderTextColor={tokens.color.textMuted}/>
      </View>)}
      <Pressable accessibilityRole="button" onPress={()=>setShow(v=>!v)}
        style={[styles.head,rtl && styles.rtlRow,styles.showButton]}>
        <Ionicons name={show?"eye-off-outline":"eye-outline"} size={19} color={tokens.color.brandStrong}/>
        <Text style={styles.actionText}>{translate(locale,show?"action.hidePassword":"action.showPassword")}</Text>
      </Pressable>
      <Text style={[styles.sub,rtl && styles.rtlText]}>{translate(locale,"parent.morePasswordRules")}</Text>
      {error?<Text accessibilityRole="alert" style={[styles.error,rtl && styles.rtlText]}>
        {translate(locale,error)}
      </Text>:null}
      {success?<Text style={[styles.success,rtl && styles.rtlText]}>
        {translate(locale,"parent.morePasswordChanged")}
      </Text>:null}
      <Pressable accessibilityRole="button" disabled={saving}
        accessibilityState={{disabled:saving}}
        style={[styles.primary,saving && styles.disabled]} onPress={()=>void submit()}>
        {saving?<ActivityIndicator color="#fff"/>:
          <Ionicons name="lock-closed-outline" size={18} color="#fff"/>}
        <Text style={styles.primaryText}>{translate(locale,"parent.moreChangePassword")}</Text>
      </Pressable>
    </View>
    <Pressable accessibilityRole="button" style={styles.logout} onPress={()=>{
      Alert.alert(translate(locale,"parent.moreLogoutTitle"),
        translate(locale,"parent.moreLogoutConfirm"),[
          {text:translate(locale,"action.back"),style:"cancel"},
          {text:translate(locale,"auth.logout"),style:"destructive",onPress:onLogout}
        ]);
    }}>
      <Ionicons name="log-out-outline" color={tokens.color.danger} size={21}/>
      <Text style={styles.logoutText}>{translate(locale,"auth.logout")}</Text>
    </Pressable>
  </View>;
}

const styles=StyleSheet.create({
  stack:{gap:14,paddingBottom:8},
  card:{borderRadius:20,borderWidth:1,borderColor:tokens.color.border,
    backgroundColor:tokens.color.surface,padding:16,gap:13},
  flex:{flex:1,minWidth:0}, rtlRow:{flexDirection:"row-reverse"},
  rtlText:{textAlign:"right",writingDirection:"rtl"},
  head:{flexDirection:"row",gap:10,alignItems:"center"},
  icon:{width:41,height:41,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:"#edf3ff"},
  iconButton:{width:44,height:44,borderRadius:13,alignItems:"center",justifyContent:"center",backgroundColor:tokens.color.surfaceMuted},
  title:{fontSize:17,fontWeight:"900",color:tokens.color.text},
  itemTitle:{fontSize:14,fontWeight:"800",color:tokens.color.text},
  sub:{fontSize:12.5,lineHeight:19,color:tokens.color.textMuted},
  mini:{fontSize:12,lineHeight:18,color:tokens.color.textMuted,fontWeight:"600"},
  stats:{flexDirection:"row",gap:7},
  stat:{flex:1,minWidth:0,borderRadius:13,padding:9,gap:7,backgroundColor:tokens.color.surfaceMuted},
  statValue:{fontSize:13,fontWeight:"900",color:tokens.color.brandStrong},
  filters:{flexDirection:"row",gap:8},
  chip:{minHeight:44,borderRadius:13,paddingHorizontal:13,justifyContent:"center",
    backgroundColor:tokens.color.surface,borderWidth:1,borderColor:tokens.color.border},
  activeChip:{backgroundColor:"#edf3ff",borderColor:tokens.color.brandStrong},
  chipText:{fontSize:12.5,color:tokens.color.textMuted,fontWeight:"700"},
  activeText:{color:tokens.color.brandStrong,fontWeight:"900"},
  badge:{color:tokens.color.brandStrong,fontWeight:"800",fontSize:12,marginTop:3},
  amount:{color:tokens.color.text,fontSize:14,fontWeight:"900"},
  total:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",
    padding:11,borderRadius:12,backgroundColor:tokens.color.surfaceMuted},
  details:{borderTopWidth:1,borderTopColor:tokens.color.border,paddingTop:10,gap:11},
  info:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:10,
    paddingVertical:6,borderBottomColor:"#eef1f5",borderBottomWidth:1},
  value:{flex:1,textAlign:"right",fontSize:13,fontWeight:"800",color:tokens.color.text},
  payment:{padding:11,borderRadius:12,borderWidth:1,borderColor:tokens.color.border,gap:7},
  hint:{borderRadius:13,backgroundColor:"#edf3ff",padding:13,flexDirection:"row",alignItems:"flex-start",gap:9},
  notice:{alignItems:"center",gap:10,padding:12},
  button:{minHeight:44,borderRadius:12,backgroundColor:"#edf3ff",paddingHorizontal:14,justifyContent:"center"},
  buttonText:{fontWeight:"900",fontSize:13,color:tokens.color.brandStrong},
  profile:{flexDirection:"row",gap:12,alignItems:"center",paddingVertical:9},
  avatar:{width:56,height:56,borderRadius:18,backgroundColor:"#e8f0fd",alignItems:"center",justifyContent:"center"},
  avatarText:{fontWeight:"900",fontSize:23,color:tokens.color.brandStrong},
  childRow:{borderTopWidth:1,borderTopColor:"#edf1f5",paddingVertical:11,flexDirection:"row",gap:10,alignItems:"center"},
  language:{borderRadius:13,borderWidth:1,borderColor:tokens.color.border,
    minHeight:53,paddingHorizontal:12,flexDirection:"row",alignItems:"center",gap:10},
  languageActive:{backgroundColor:"#edf3ff",borderColor:tokens.color.brandStrong},
  field:{gap:7},
  input:{minHeight:49,borderWidth:1,borderColor:tokens.color.border,borderRadius:12,
    paddingHorizontal:12,color:tokens.color.text,fontSize:14,backgroundColor:"#fafbfe"},
  showButton:{minHeight:40,alignSelf:"flex-start"},
  actionText:{color:tokens.color.brandStrong,fontSize:13,fontWeight:"800"},
  error:{fontSize:13,color:tokens.color.danger,lineHeight:20},
  success:{fontSize:13,color:tokens.color.success,lineHeight:20},
  primary:{minHeight:49,backgroundColor:tokens.color.brand,borderRadius:13,
    alignItems:"center",justifyContent:"center",gap:9,flexDirection:"row",paddingHorizontal:12},
  primaryText:{fontSize:14,color:"#fff",fontWeight:"900"},
  disabled:{opacity:.55},
  logout:{minHeight:53,borderRadius:15,borderWidth:1,borderColor:"#f6d3d0",
    backgroundColor:"#fff8f7",flexDirection:"row",gap:9,alignItems:"center",justifyContent:"center"},
  logoutText:{color:tokens.color.danger,fontSize:14,fontWeight:"800"}
});
