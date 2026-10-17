import * as SecureStore from "expo-secure-store";

export const STUDENT_DRAFT_MAX_CHARS=10_000;
const CHUNK_SIZE=650;
const MAX_CHUNKS=Math.ceil(STUDENT_DRAFT_MAX_CHARS/CHUNK_SIZE);
type Manifest={version:1;slot:0|1;chunks:number};
export type StudentHomeworkDraft={answer:string;fileId:string|null;fileName:string};

function hash(value:string):string {
  let result=2166136261;
  for(let i=0;i<value.length;i++){
    result^=value.charCodeAt(i);
    result=Math.imul(result,16777619);
  }
  return (result>>>0).toString(16);
}
/** Scope all encrypted device drafts to the exact school, student and homework. */
export function studentDraftKey(schoolId:string,studentId:string,homeworkId:string){
  if(!schoolId||!studentId||!homeworkId)throw new Error("Student draft identity is required");
  return `maktab.student.draft.v1.${hash(JSON.stringify([schoolId,studentId,homeworkId]))}`;
}
const chunkKey=(key:string,slot:0|1,index:number)=>`${key}.${slot}.${index}`;
function parseManifest(value:string|null):Manifest|null {
  if(!value)return null;
  try {
    const parsed=JSON.parse(value) as Manifest;
    if(parsed.version!==1||(parsed.slot!==0&&parsed.slot!==1)||
      !Number.isInteger(parsed.chunks)||parsed.chunks<1||parsed.chunks>MAX_CHUNKS+2)return null;
    return parsed;
  }catch{return null;}
}
export async function readStudentHomeworkDraft(key:string):Promise<StudentHomeworkDraft|null> {
  const manifest=parseManifest(await SecureStore.getItemAsync(key));
  if(!manifest)return null;
  let raw="";
  for(let i=0;i<manifest.chunks;i++){
    const part=await SecureStore.getItemAsync(chunkKey(key,manifest.slot,i));
    if(part===null)return null;
    raw+=part;
  }
  try {
    const data=JSON.parse(raw) as StudentHomeworkDraft;
    if(typeof data.answer!=="string"||data.answer.length>STUDENT_DRAFT_MAX_CHARS||
      !(data.fileId===null||typeof data.fileId==="string")||typeof data.fileName!=="string")return null;
    return {answer:data.answer,fileId:data.fileId,fileName:data.fileName};
  }catch{return null;}
}
export async function writeStudentHomeworkDraft(key:string,draft:StudentHomeworkDraft):Promise<void> {
  if(draft.answer.length>STUDENT_DRAFT_MAX_CHARS)throw new Error("Draft exceeds the answer limit");
  const previous=parseManifest(await SecureStore.getItemAsync(key));
  const slot:0|1=previous?.slot===0?1:0;
  const raw=JSON.stringify(draft);
  const chunks=Math.ceil(raw.length/CHUNK_SIZE);
  if(chunks<1||chunks>MAX_CHUNKS+2)throw new Error("Draft is too large");
  for(let index=0;index<chunks;index++){
    await SecureStore.setItemAsync(chunkKey(key,slot,index),
      raw.slice(index*CHUNK_SIZE,(index+1)*CHUNK_SIZE));
  }
  // Commit the manifest last so interrupted writes retain the previous draft.
  await SecureStore.setItemAsync(key,JSON.stringify({version:1,slot,chunks} satisfies Manifest));
  if(previous){
    for(let i=0;i<previous.chunks;i++){
      await SecureStore.deleteItemAsync(chunkKey(key,previous.slot,i)).catch(()=>{});
    }
  }
}
export async function clearStudentHomeworkDraft(key:string):Promise<void>{
  const current=parseManifest(await SecureStore.getItemAsync(key));
  await SecureStore.deleteItemAsync(key);
  if(!current)return;
  for(let i=0;i<current.chunks;i++){
    await SecureStore.deleteItemAsync(chunkKey(key,current.slot,i)).catch(()=>{});
  }
}
