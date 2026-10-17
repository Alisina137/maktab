import {useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {tokens} from "@maktablink/design-tokens";
import {getDirection,translate,type SupportedLocale,type TranslationKey} from "@maktablink/localization";
import {parentPasswordValidation} from "./parent-more-model";

const messages:Record<NonNullable<ReturnType<typeof parentPasswordValidation>>,TranslationKey>={
 CURRENT:"parent.moreCurrentRequired",SAME:"parent.moreSamePassword",
 LENGTH:"parent.morePasswordLength",LETTER:"passwordChange.missingLetter",
 NUMBER:"passwordChange.missingNumber",SPECIAL:"passwordChange.missingSpecial",
 CONFIRM:"passwordChange.mismatch"
};

export function StudentPasswordSettings({locale,onChangePassword}:{
 locale:SupportedLocale;
 onChangePassword:(current:string,next:string)=>Promise<boolean>;
}){
 const rtl=getDirection(locale)==="rtl";
 const [current,setCurrent]=useState("");
 const [next,setNext]=useState("");
 const [confirm,setConfirm]=useState("");
 const [visible,setVisible]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState<TranslationKey|null>(null);
 const [success,setSuccess]=useState(false);
 async function submit(){
  if(saving)return;
  const issue=parentPasswordValidation(current,next,confirm);
  if(issue){setError(messages[issue]);setSuccess(false);return;}
  setError(null);setSuccess(false);setSaving(true);
  try{
   if(await onChangePassword(current,next)){
    setCurrent("");setNext("");setConfirm("");setVisible(false);setSuccess(true);
   }else setError("student.profilePasswordFailed");
  }catch{setError("student.profilePasswordFailed");}
  finally{setSaving(false);}
 }
 return <View style={styles.card} testID="student-phase8-security">
   <View style={[styles.row,rtl&&styles.rtl]}>
    <Ionicons name="shield-checkmark-outline" size={22} color={tokens.color.brandStrong}/>
    <View style={styles.flex}>
     <Text style={[styles.heading,rtl&&styles.right]}>{translate(locale,"student.profileSecurity")}</Text>
     <Text style={[styles.hint,rtl&&styles.right]}>{translate(locale,"student.profileSecurityHint")}</Text>
    </View>
   </View>
   {([
    ["parent.moreCurrentPassword",current,setCurrent],
    ["parent.moreNewPassword",next,setNext],
    ["parent.moreConfirmPassword",confirm,setConfirm]
   ] as const).map(([key,value,change])=><View key={key}>
    <Text style={[styles.label,rtl&&styles.right]}>{translate(locale,key)}</Text>
    <TextInput testID={key} accessibilityLabel={translate(locale,key)}
     value={value} onChangeText={v=>{change(v);setError(null);setSuccess(false);}}
     secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false}
     textContentType="none" editable={!saving}
     placeholder={translate(locale,key)} placeholderTextColor={tokens.color.textMuted}
     style={[styles.input,rtl&&styles.right]}/>
   </View>)}
   <Pressable testID="student-phase8-password-toggle" accessibilityRole="button"
    accessibilityLabel={translate(locale,"action.showPassword")}
    onPress={()=>setVisible(v=>!v)} style={[styles.row,rtl&&styles.rtl]}>
    <Ionicons name={visible?"eye-off-outline":"eye-outline"} size={18} color={tokens.color.brandStrong}/>
    <Text style={styles.hint}>{translate(locale,"action.showPassword")}</Text>
   </Pressable>
   {error?<Text accessibilityRole="alert" style={styles.error}>{translate(locale,error)}</Text>:null}
   {success?<Text accessibilityRole="alert" style={styles.success}>
    {translate(locale,"student.profilePasswordSaved")}</Text>:null}
   <Pressable testID="student-phase8-change-password" accessibilityRole="button"
    accessibilityState={{disabled:saving}} disabled={saving}
    onPress={()=>void submit()} style={[styles.submit,saving&&styles.disabled]}>
    {saving?<ActivityIndicator color="#fff"/>:
     <Text style={styles.submitText}>{translate(locale,"parent.moreChangePassword")}</Text>}
   </Pressable>
  </View>;
}
const styles=StyleSheet.create({
 card:{padding:15,gap:11,borderRadius:18,borderWidth:1,borderColor:"#e1e7f0",
  backgroundColor:tokens.color.surface},
 row:{flexDirection:"row",gap:9,alignItems:"center"},rtl:{flexDirection:"row-reverse"},
 flex:{flex:1},right:{textAlign:"right",writingDirection:"rtl"},
 heading:{fontSize:16,fontWeight:"900",color:tokens.color.text},
 hint:{fontSize:12,lineHeight:19,color:tokens.color.textMuted},
 label:{fontSize:12,color:tokens.color.text,fontWeight:"700",marginBottom:5},
 input:{minHeight:47,borderWidth:1,borderColor:"#dce3ec",borderRadius:12,
  paddingHorizontal:12,color:tokens.color.text,backgroundColor:"#f8faff"},
 error:{fontSize:12,color:"#b42318"},success:{fontSize:12,color:"#087443"},
 submit:{minHeight:47,borderRadius:12,backgroundColor:tokens.color.brandStrong,
  alignItems:"center",justifyContent:"center"},disabled:{opacity:0.6},
 submitText:{fontSize:13,fontWeight:"800",color:"#fff"}
});
