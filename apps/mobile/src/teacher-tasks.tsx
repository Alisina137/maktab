import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as SecureStore from "expo-secure-store";
import { tokens } from "@maktablink/design-tokens";
import {
  formatLocalizedDate, formatLocalizedNumber, getDirection, translate,
  type SupportedLocale, type TranslationKey
} from "@maktablink/localization";
import { api, type TeacherTaskForm, type TeacherTaskPayload } from "./api";
import { HomeworkDueDatePicker } from "./homework-date-picker";
import { appErrorFromCause, type AppErrorKind } from "./error-message";

type Direction = { textAlign: "right" | "left"; writingDirection: "rtl" | "ltr" };
type Filter = "OPEN" | "DONE" | "ALL";
const priorities: TeacherTaskPayload["priority"][] = ["LOW", "NORMAL", "HIGH"];
const priorityKey: Record<TeacherTaskPayload["priority"], TranslationKey> = {
  LOW: "productivity.low", NORMAL: "productivity.normal", HIGH: "productivity.high"
};

export function TeacherTasksPanel({
  accessToken, schoolId, teacherUserId, locale, textDirection, reconnectEpoch, onError, onNotice
}: {
  accessToken: string; schoolId: string; teacherUserId: string;
  locale: SupportedLocale; textDirection: Direction; reconnectEpoch: number;
  onError: (key: TranslationKey | null, kind?: AppErrorKind) => void;
  onNotice: (text: string | null) => void;
}) {
  const rtl = getDirection(locale) === "rtl";
  const [tasks, setTasks] = useState<TeacherTaskPayload[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const requestId = useRef(0);
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [query, setQuery] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState<TeacherTaskForm["priority"]>("NORMAL");
  const [dueOn, setDueOn] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const key = `maktablink.teacher.taskdraft.${schoolId}.${teacherUserId}`;

  useEffect(() => {
    let active = true;
    setDraftLoaded(false);
    setEditId(null); setTitle(""); setDetails(""); setPriority("NORMAL"); setDueOn("");
    void SecureStore.getItemAsync(key).then((saved) => {
      if (!active || !saved) return;
      try {
        const data = JSON.parse(saved) as TeacherTaskForm;
        if (typeof data.title === "string" && typeof data.details === "string" &&
          priorities.includes(data.priority) && data.title.length <= 160 && data.details.length <= 1500) {
          setTitle(data.title); setDetails(data.details); setPriority(data.priority);
          setDueOn(typeof data.dueOn === "string" ? data.dueOn : "");
        }
      } catch { /* A malformed local draft does not affect server tasks. */ }
    }).catch(() => {}).finally(() => { if (active) setDraftLoaded(true); });
    return () => { active = false; };
  }, [key]);

  useEffect(() => {
    if (!draftLoaded || editId) return;
    // No write queue: only a device-local form draft is saved. Every server
    // mutation still requires connectivity and a valid Teacher authorization.
    const timer = setTimeout(() => {
      const value: TeacherTaskForm = {
        title: title.trim(), details: details.trim(), priority, dueOn: dueOn || null
      };
      void (value.title || value.details || value.dueOn
        ? SecureStore.setItemAsync(key, JSON.stringify(value))
        : SecureStore.deleteItemAsync(key)).catch(() => {});
    }, 700);
    return () => clearTimeout(timer);
  }, [key, draftLoaded, editId, title, details, priority, dueOn]);

  useEffect(() => {
    const request = ++requestId.current;
    setReady(false);
    void api.teacherTasks(accessToken).then((result) => {
      if (request === requestId.current) setTasks(result.tasks);
    }).catch((cause: unknown) => {
      if (request !== requestId.current) return;
      const failure = appErrorFromCause(cause); onError(failure.key, failure.kind);
    }).finally(() => { if (request === requestId.current) setReady(true); });
    return () => { requestId.current += 1; };
  }, [accessToken, reconnectEpoch, refresh]);

  function clearForm() {
    setEditId(null); setTitle(""); setDetails(""); setPriority("NORMAL"); setDueOn("");
  }
  function startEdit(item: TeacherTaskPayload) {
    setEditId(item.id); setTitle(item.title); setDetails(item.details);
    setPriority(item.priority); setDueOn(item.dueOn ?? "");
  }
  async function save() {
    if (!title.trim() || title.trim().length > 160 || details.trim().length > 1500) {
      onError("productivity.invalid"); return;
    }
    setBusy(true);
    const form: TeacherTaskForm = { title: title.trim(), details: details.trim(), priority, dueOn: dueOn || null };
    try {
      if (editId) await api.updateTeacherTask(accessToken, editId, form);
      else await api.createTeacherTask(accessToken, form);
      clearForm();
      setRefresh(n => n + 1);
      onNotice(translate(locale, "productivity.saved"));
    } catch (cause) {
      const failure = appErrorFromCause(cause); onError(failure.key, failure.kind);
    } finally { setBusy(false); }
  }
  async function toggle(item: TeacherTaskPayload) {
    setBusy(true);
    try {
      await api.updateTeacherTask(accessToken, item.id, {
        status: item.status === "OPEN" ? "DONE" : "OPEN"
      });
      setRefresh(n => n + 1);
    } catch (cause) {
      const failure = appErrorFromCause(cause); onError(failure.key, failure.kind);
    } finally { setBusy(false); }
  }
  function confirmDelete(item: TeacherTaskPayload) {
    Alert.alert(translate(locale, "productivity.deleteTitle"),
      translate(locale, "productivity.deleteConfirm"), [
        { text: translate(locale, "attendance.cancel"), style: "cancel" },
        { text: translate(locale, "productivity.delete"), style: "destructive",
          onPress: () => void remove(item.id) }
      ]);
  }
  async function remove(id: string) {
    setBusy(true);
    try {
      await api.deleteTeacherTask(accessToken, id);
      if (editId === id) clearForm();
      setRefresh(n => n + 1);
    } catch (cause) {
      const failure = appErrorFromCause(cause); onError(failure.key, failure.kind);
    } finally { setBusy(false); }
  }

  const open = tasks.filter(x => x.status === "OPEN");
  const items = tasks.filter(item =>
    (filter === "ALL" || item.status === filter) &&
    (!query.trim() || [item.title, item.details].some(value =>
      value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))
  ).sort((a, b) => (a.status === "DONE" ? 1 : 0) - (b.status === "DONE" ? 1 : 0) ||
    (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999") ||
    (a.priority === "HIGH" ? -1 : 0) - (b.priority === "HIGH" ? -1 : 0));

  return <View style={styles.stack} testID="teacher-personal-tasks">
    <View style={styles.card}>
      <Text style={[styles.heading, textDirection]}>{translate(locale, "productivity.title")}</Text>
      <Text style={[styles.muted, textDirection]}>{translate(locale, "productivity.privateHint")}</Text>
      <Text style={[styles.counter, textDirection]}>
        {formatLocalizedNumber(open.length, locale)} {translate(locale, "productivity.open")}
        {" · "}{formatLocalizedNumber(tasks.length, locale)} {translate(locale, "productivity.total")}
      </Text>
    </View>
    <View style={styles.card}>
      <Text style={[styles.heading, textDirection]}>
        {translate(locale, editId ? "productivity.edit" : "productivity.new")}
      </Text>
      <TextInput value={title} onChangeText={setTitle} maxLength={160}
        placeholder={translate(locale, "productivity.taskTitle")}
        style={[styles.input, textDirection]} editable={!busy} />
      <TextInput value={details} onChangeText={setDetails} multiline maxLength={1500}
        placeholder={translate(locale, "productivity.details")}
        style={[styles.input, styles.multi, textDirection]} editable={!busy} />
      <Text style={[styles.muted, textDirection]}>{translate(locale, "productivity.dueDate")}</Text>
      <HomeworkDueDatePicker value={dueOn} onChange={setDueOn}
        locale={locale} textDirection={textDirection} disabled={busy} />
      {dueOn ? <Pressable accessibilityRole="button" onPress={() => setDueOn("")}>
        <Text style={styles.action}>{translate(locale, "productivity.clearDueDate")}</Text>
      </Pressable> : null}
      <View style={[styles.chips, rtl && styles.rtl]}>
        {priorities.map(next => <Pressable key={next} accessibilityRole="button"
          accessibilityState={{selected:priority===next}} onPress={()=>setPriority(next)}
          style={[styles.chip,priority===next&&styles.selected]}>
          <Text style={styles.chipText}>{translate(locale, priorityKey[next])}</Text>
        </Pressable>)}
      </View>
      <Text style={[styles.muted,textDirection]}>{translate(locale, "productivity.offlineDraft")}</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()}
        style={[styles.primary,busy&&styles.dim]}>
        <Text style={styles.primaryText}>{translate(locale, "productivity.save")}</Text>
      </Pressable>
      {editId ? <Pressable accessibilityRole="button" onPress={clearForm}>
        <Text style={styles.action}>{translate(locale, "productivity.cancelEdit")}</Text>
      </Pressable> : null}
    </View>
    <View style={styles.card}>
      <View style={[styles.header,rtl&&styles.rtl]}>
        <Text style={[styles.heading,styles.flex,textDirection]}>{translate(locale,"productivity.list")}</Text>
        <Pressable accessibilityRole="button" onPress={()=>setRefresh(x=>x+1)}>
          <Ionicons name="refresh-outline" size={22} color={tokens.color.brandStrong}/>
        </Pressable>
      </View>
      <TextInput value={query} onChangeText={setQuery}
        placeholder={translate(locale,"productivity.search")}
        style={[styles.input,textDirection]}/>
      <View style={[styles.chips,rtl&&styles.rtl]}>
        {(["OPEN","DONE","ALL"] as const).map(status=>(
          <Pressable accessibilityRole="button" key={status}
            accessibilityState={{selected:filter===status}}
            onPress={()=>setFilter(status)} style={[styles.chip,filter===status&&styles.selected]}>
            <Text style={styles.chipText}>{translate(locale,
              status==="OPEN"?"productivity.open":status==="DONE"?"productivity.done":"productivity.all")}</Text>
          </Pressable>
        ))}
      </View>
      {!ready ? <ActivityIndicator color={tokens.color.brand}/> : null}
      {ready && !items.length ? <Text style={[styles.muted,textDirection]}>
        {translate(locale,"productivity.empty")}
      </Text> : null}
      {items.map(item=><View key={item.id} style={styles.item}>
        <View style={[styles.header,rtl&&styles.rtl]}>
          <Ionicons name={item.status==="DONE"?"checkmark-circle":"ellipse-outline"}
            size={22} color={tokens.color.brandStrong}/>
          <Text style={[styles.itemTitle,styles.flex,textDirection]}>{item.title}</Text>
        </View>
        {item.details ? <Text style={[styles.muted,textDirection]}>{item.details}</Text>:null}
        <Text style={[styles.muted,textDirection]}>
          {translate(locale,priorityKey[item.priority])}
          {item.dueOn ? " · "+formatLocalizedDate(item.dueOn,locale) : ""}
        </Text>
        <View style={[styles.chips,rtl&&styles.rtl]}>
          <Pressable accessibilityRole="button" disabled={busy} style={styles.chip}
            onPress={()=>void toggle(item)}>
            <Text style={styles.action}>{translate(locale,item.status==="OPEN"?"productivity.markDone":"productivity.reopen")}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={()=>startEdit(item)} style={styles.chip}>
            <Text style={styles.action}>{translate(locale,"productivity.edit")}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={()=>confirmDelete(item)} style={styles.chip}>
            <Text style={styles.action}>{translate(locale,"productivity.delete")}</Text>
          </Pressable>
        </View>
      </View>)}
    </View>
  </View>;
}
const styles=StyleSheet.create({
  stack:{gap:13},rtl:{flexDirection:"row-reverse"},
  card:{backgroundColor:"#fff",borderWidth:1,borderColor:"#e0e7f0",borderRadius:19,padding:15,gap:11},
  heading:{fontSize:16,fontWeight:"900",color:tokens.color.text},
  counter:{fontSize:13,fontWeight:"900",color:tokens.color.brandStrong},
  muted:{fontSize:12,color:tokens.color.textMuted,lineHeight:19},
  input:{borderRadius:11,borderWidth:1,borderColor:"#d9e3f0",minHeight:47,padding:11,color:tokens.color.text,fontSize:14},
  multi:{minHeight:76,textAlignVertical:"top"},
  primary:{backgroundColor:tokens.color.brand,minHeight:49,alignItems:"center",justifyContent:"center",borderRadius:12},
  primaryText:{color:"#fff",fontWeight:"900",fontSize:14},
  dim:{opacity:0.5},action:{fontSize:12.5,fontWeight:"800",color:tokens.color.brandStrong},
  chips:{flexDirection:"row",gap:7,flexWrap:"wrap"},
  chip:{padding:10,minHeight:43,borderRadius:11,borderColor:"#dce5f0",borderWidth:1,backgroundColor:"#f8fafc",justifyContent:"center"},
  selected:{borderColor:"#8ebaf0",backgroundColor:"#e9f2ff"},
  chipText:{fontSize:12.5,fontWeight:"800",color:tokens.color.text},
  item:{borderTopWidth:1,borderTopColor:"#edf1f6",gap:8,paddingTop:13},
  itemTitle:{color:tokens.color.text,fontSize:14,fontWeight:"900"},
  header:{flexDirection:"row",alignItems:"center",gap:8},flex:{flex:1,minWidth:0}
});
