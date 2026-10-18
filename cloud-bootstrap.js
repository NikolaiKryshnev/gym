import {createInitialData} from './core.js?v=2.2.1';
const fields=['settings','exercises','programs','sessions','measurements','schedule','goals','active','english'];
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const content=value=>JSON.stringify(canonical(Object.fromEntries(fields.map(key=>[key,value[key]]))));
export function personalJournal(payload){
  const next=structuredClone(payload);
  if(next.demo){next.demo=false;next.sessions=[];next.measurements=[];next.schedule={};next.active=null;}
  return next;
}
export const sameJournal=(a,b)=>content(personalJournal(a))===content(personalJournal(b));
export const hasPersonalJournal=payload=>!sameJournal(payload,createInitialData(false));
// A legacy browser journal can be adopted by one account, never silently copied to another.
export const accountCandidate=(payload,owner,identity)=>owner&&owner!==identity?createInitialData(false):payload;
