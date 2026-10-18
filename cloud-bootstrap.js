import {createInitialData} from './core.js?v=2.3.0';
const fields=['settings','exercises','programs','sessions','measurements','schedule','goals','active','english'];
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const content=value=>JSON.stringify(canonical(Object.fromEntries(fields.map(key=>[key,value[key]]))));
export function personalJournal(payload){
  const next=structuredClone(payload);
  if(next.demo){next.demo=false;next.sessions=[];next.measurements=[];next.schedule={};next.active=null;}
  return next;
}
export const sameJournal=(a,b)=>content(personalJournal(a))===content(personalJournal(b));
export function hasPersonalJournal(payload){
  const copy=personalJournal(payload);
  // Merely opening today's automatically generated plan is not a user's edit.
  if(copy.english?.course?.days)copy.english.course.days=Object.fromEntries(Object.entries(copy.english.course.days).filter(([,d])=>d.completedAt!==null||d.tasks.some(t=>t.status!=='pending'||t.attempts>0||t.seconds>0||t.runningSince!==null)));
  return !sameJournal(copy,createInitialData(false));
}
// A legacy browser journal can be adopted by one account, never silently copied to another.
export const accountCandidate=(payload,owner,identity)=>owner&&owner!==identity?createInitialData(false):payload;
