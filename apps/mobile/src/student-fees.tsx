import {useEffect,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {tokens} from "@maktablink/design-tokens";
import {formatLocalizedDate,formatLocalizedNumber,getDirection,translate,
  type SupportedLocale,type TranslationKey} from "@maktablink/localization";
import {api,type FeeInvoiceViewPayload} from "./api";
import {
  studentVisibleFees,studentFeeSummary,studentFilterFees,studentFeeFilters,
  studentSortedPayments,type StudentFeeFilter
} from "./student-records-model";

type Direction={textAlign:"left"|"right";writingDirection:"ltr"|"rtl"};
type FeeState={identity:string;status:"loading"|"ready"|"error";rows:FeeInvoiceViewPayload[]};
const statusLabels:Record<FeeInvoiceViewPayload["invoice"]["status"],TranslationKey>={
  DRAFT:"student.feeIssued",ISSUED:"student.feeIssued",
  PARTIALLY_PAID:"student.feePartiallyPaid",PAID:"student.feePaid",
  OVERDUE:"student.feeOverdue",CANCELLED:"student.feeCancelled"
};
const filters:Record<StudentFeeFilter,TranslationKey>={
  ALL:"student.feeAll",DUE:"student.feeDue",PAID:"student.feePaid"
};
function Amount({value,currency,locale}:{
  value:number;currency:string;locale:SupportedLocale
}){
  return <Text style={styles.money}>{formatLocalizedNumber(value,locale)} {currency}</Text>;
}
export function StudentFeesContent({accessToken,studentId,locale,textDirection,onSensitiveError}:{
  accessToken:string;studentId:string;locale:SupportedLocale;
  textDirection:Direction;onSensitiveError:(cause:unknown)=>void;
}){
  const rtl=getDirection(locale)==="rtl";
  const identity=`${studentId}:${accessToken}`;
  const [load,setLoad]=useState<FeeState>({identity:"",status:"loading",rows:[]});
  const [attempt,setAttempt]=useState(0);
  const [filter,setFilter]=useState<StudentFeeFilter>("ALL");
  const [expanded,setExpanded]=useState<string|null>(null);
  useEffect(()=>{
    let active=true;
    setLoad({identity,status:"loading",rows:[]});
    void api.studentFees(accessToken,true).then(value=>{
      if(active)setLoad({identity,status:"ready",
        rows:studentVisibleFees(value.invoices,studentId)});
    }).catch(cause=>{
      if(!active)return;
      setLoad({identity,status:"error",rows:[]});
      onSensitiveError(cause);
    });
    return ()=>{active=false;};
  },[identity,attempt]);
  const status=identity===load.identity?load.status:"loading";
  const rows=status==="ready"?load.rows:[];
  const summary=studentFeeSummary(rows);
  const visible=studentFilterFees(rows,filter);
  const currency=rows[0]?.invoice.currency??"AFN";
  return <View style={styles.stack} testID="student-fees-phase6">
    <View style={styles.card}>
      <View style={[styles.row,rtl&&styles.rtl]}>
        <Ionicons name="wallet-outline" size={23} color={tokens.color.brandStrong}/>
        <View style={styles.flex}>
          <Text style={[styles.heading,textDirection]}>{translate(locale,"student.feeOverview")}</Text>
          <Text style={[styles.muted,textDirection]}>{translate(locale,"student.feeReadOnly")}</Text>
        </View>
        <Pressable accessibilityRole="button" testID="student-fees-refresh"
          onPress={()=>setAttempt(x=>x+1)} style={styles.refresh}>
          <Ionicons name="refresh-outline" size={21} color={tokens.color.brandStrong}/>
        </Pressable>
      </View>
      {status==="loading"?<ActivityIndicator color={tokens.color.brandStrong}/>:
        status==="error"?<View style={styles.stack}>
          <Text style={[styles.muted,textDirection]}>{translate(locale,"student.recordsLoadError")}</Text>
          <Pressable accessibilityRole="button" onPress={()=>setAttempt(x=>x+1)}
            style={styles.retry}><Text style={styles.retryText}>{translate(locale,"student.recordsRetry")}</Text></Pressable>
        </View>:
        <View style={[styles.summary,rtl&&styles.rtl]}>
          {([
            ["student.feeTotal",summary.total],
            ["student.feePaid",summary.paid],
            ["student.feeOutstanding",summary.outstanding]
          ] as Array<[TranslationKey,number]>).map(([key,value])=>
            <View key={key} style={styles.stat}>
              <Text style={styles.statLabel}>{translate(locale,key)}</Text>
              <Amount value={value} currency={currency} locale={locale}/>
            </View>)}
        </View>}
    </View>
    {status==="ready"?<>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.filters,rtl&&styles.rtl]}>
        {studentFeeFilters.map(next=><Pressable key={next}
          accessibilityRole="button" accessibilityState={{selected:filter===next}}
          onPress={()=>{setFilter(next);setExpanded(null);}}
          style={[styles.chip,filter===next&&styles.chipActive]}>
          <Text style={[styles.chipText,filter===next&&styles.chipTextActive]}>
            {translate(locale,filters[next])}
          </Text>
        </Pressable>)}
      </ScrollView>
      <Text style={[styles.muted,textDirection]}>
        {translate(locale,"student.feeInvoiceCount")}: {formatLocalizedNumber(visible.length,locale)}
      </Text>
      {visible.length?visible.map(row=>{
        const open=expanded===row.invoice.id;
        return <View key={row.invoice.id} style={styles.card}>
          <Pressable accessibilityRole="button"
            accessibilityState={{expanded:open}}
            onPress={()=>setExpanded(open?null:row.invoice.id)}
            style={[styles.row,rtl&&styles.rtl]}>
            <View style={styles.flex}>
              <Text style={[styles.heading,textDirection]}>
                {row.invoice.description||translate(locale,"fees.invoice")}
              </Text>
              <Text style={[styles.muted,textDirection]}>
                {translate(locale,"fees.due")} {formatLocalizedDate(row.invoice.dueDate,locale)}
              </Text>
              <Text style={[styles.status,textDirection]}>
                {translate(locale,statusLabels[row.invoice.status])}
              </Text>
            </View>
            <Ionicons name={open?"chevron-up":"chevron-down"} size={19}
              color={tokens.color.textMuted}/>
          </Pressable>
          <View style={[styles.amountRow,rtl&&styles.rtl]}>
            <Text style={styles.muted}>{translate(locale,"student.feeOutstanding")}</Text>
            <Amount value={row.outstanding} currency={row.invoice.currency} locale={locale}/>
          </View>
          {open?<View style={styles.detail}>
            <View style={[styles.amountRow,rtl&&styles.rtl]}>
              <Text style={styles.muted}>{translate(locale,"student.feeTotal")}</Text>
              <Amount value={row.invoice.amount} currency={row.invoice.currency} locale={locale}/>
            </View>
            <View style={[styles.amountRow,rtl&&styles.rtl]}>
              <Text style={styles.muted}>{translate(locale,"student.feePaid")}</Text>
              <Amount value={row.paid} currency={row.invoice.currency} locale={locale}/>
            </View>
            <Text style={[styles.heading,textDirection]}>
              {translate(locale,"student.feePaymentHistory")}
            </Text>
            {row.payments.length?studentSortedPayments(row).map(payment=>
              <View key={payment.id} style={[styles.amountRow,rtl&&styles.rtl]}>
                <View style={styles.flex}>
                  <Text style={[styles.muted,textDirection]}>
                    {translate(locale,payment.kind==="PAYMENT"?"fees.payment":"fees.reversal")}
                  </Text>
                  <Text style={[styles.muted,textDirection]}>
                    {formatLocalizedDate(payment.recordedAt,locale)}
                  </Text>
                </View>
                <Amount value={payment.amount} currency={row.invoice.currency} locale={locale}/>
              </View>):
              <Text style={[styles.muted,textDirection]}>
                {translate(locale,"student.feeNoPayments")}
              </Text>}
          </View>:null}
        </View>;
      }):<View style={styles.card}>
        <Text style={[styles.muted,textDirection]}>
          {translate(locale,"student.feeNoInvoices")}
        </Text>
      </View>}
      <View style={styles.hint}>
        <Ionicons name="information-circle-outline" size={20}
          color={tokens.color.brandStrong}/>
        <Text style={[styles.muted,styles.flex,textDirection]}>
          {translate(locale,"student.feeContactSchool")}
        </Text>
      </View>
    </>:null}
  </View>;
}
const styles=StyleSheet.create({
  stack:{gap:13},flex:{flex:1,minWidth:0},rtl:{flexDirection:"row-reverse"},
  card:{backgroundColor:"#fff",borderWidth:1,borderColor:"#e1e8f2",
    borderRadius:18,padding:15,gap:12},
  row:{flexDirection:"row",alignItems:"center",gap:10},
  heading:{fontSize:15,fontWeight:"900",color:tokens.color.text},
  muted:{fontSize:12,lineHeight:19,color:tokens.color.textMuted},
  money:{fontSize:12,fontWeight:"900",color:tokens.color.brandStrong},
  refresh:{width:43,height:43,alignItems:"center",justifyContent:"center",
    borderRadius:11,backgroundColor:"#edf4ff"},
  summary:{flexDirection:"row",gap:8,flexWrap:"wrap"},
  stat:{minWidth:"29%",flexGrow:1,padding:10,gap:8,
    backgroundColor:"#f2f7ff",borderRadius:12,alignItems:"center"},
  statLabel:{fontSize:11,fontWeight:"700",color:tokens.color.textMuted,textAlign:"center"},
  filters:{flexDirection:"row",gap:8,paddingVertical:3},
  chip:{minHeight:42,borderRadius:11,justifyContent:"center",
    paddingHorizontal:17,backgroundColor:"#fff",borderWidth:1,borderColor:"#dbe4f0"},
  chipActive:{backgroundColor:"#e5efff",borderColor:tokens.color.brandStrong},
  chipText:{fontSize:12,fontWeight:"800",color:tokens.color.textMuted},
  chipTextActive:{color:tokens.color.brandStrong},
  status:{fontSize:11,fontWeight:"800",color:tokens.color.brandStrong},
  amountRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",
    gap:8,paddingVertical:7},
  detail:{borderTopWidth:1,borderTopColor:"#edf1f7",gap:10,paddingTop:12},
  hint:{padding:12,borderRadius:12,backgroundColor:"#f0f6ff",
    flexDirection:"row",gap:9,alignItems:"center"},
  retry:{minHeight:43,paddingHorizontal:14,borderRadius:10,
    backgroundColor:"#e8f3ff",alignSelf:"flex-start",justifyContent:"center"},
  retryText:{fontSize:12,fontWeight:"800",color:tokens.color.brandStrong}
});
