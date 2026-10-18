import {createCourseData,validateCourse,recordCourseSession,reviewSchedule} from './course-core.js?v=2.3.0';
import {LESSONS} from './lessons.js?v=2.3.0';
import {validatePlanProgress} from './lesson-plan.js?v=2.3.0';
export {LESSONS};
export const PHRASES=LESSONS.flatMap(lesson=>lesson.groups.flatMap(group=>group.items.map(item=>({...item,lessonId:lesson.id,groupId:group.id,groupTitle:group.title}))));
export const PHRASE_MAP=new Map(PHRASES.map(p=>[p.id,p]));
export const STUDY_MODES={act:'Слушай и делай',cards:'Вспомни фразу',translate:'Напиши по-английски',listen:'На слух',actions:'Карточки действий',dictation:'Аудио → напиши текст',choice:'Аудио → выбери действие',variants:'Выбери английскую фразу'};
const newId=()=>globalThis.crypto?.randomUUID?.()||'eng-'+Date.now()+'-'+Math.random().toString(36).slice(2);
export const studyDate=(time=Date.now())=>{const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function createEnglishData(){return {version:1,settings:{dailyGoal:10,rate:.85,pause:4,accent:'en-US'},cards:{},sessions:[],active:null,plans:{},course:createCourseData()};}
export function normalizeAnswer(value){
  return String(value).toLowerCase().replace(/[‘’]/g,"'").replace(/\bdon't\b/g,'do not').replace(/\bcan't\b/g,'cannot').replace(/\bit's\b/g,'it is').replace(/\bthat's\b/g,'that is').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
export const checkAnswer=(answer,phrase)=>[phrase.en,...phrase.alternatives||[]].some(en=>normalizeAnswer(answer)===normalizeAnswer(en));
export function duePhrases(english,now=Date.now(),onlyMistakes=false){return PHRASES.filter(p=>{const c=Object.hasOwn(english.cards,p.id)?english.cards[p.id]:null;return c&&c.seen>0&&(onlyMistakes?c.lapses>0&&c.streak<2:c.due<=now);}).sort((a,b)=>(english.cards[a.id].due||0)-(english.cards[b.id].due||0));}
export function startStudy(english,{lessonId=null,groupId=null,mode='act',limit=10,review=false,mistakes=false,ids=null,shuffle=false,courseTask=null},now=Date.now()){
  if(!Object.hasOwn(STUDY_MODES,mode))throw Error('Неизвестный режим практики.');
  if(english.active)throw Error('Сначала заверши или отложи текущую практику.');
  let phrases=ids?ids.map(id=>PHRASE_MAP.get(id)).filter(Boolean):review||mistakes?duePhrases(english,now,mistakes):PHRASES.filter(p=>(!lessonId||p.lessonId===lessonId)&&(!groupId||p.groupId===groupId));
  phrases=[...phrases];if(shuffle)for(let i=phrases.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[phrases[i],phrases[j]]=[phrases[j],phrases[i]];}
  if(limit>0)phrases=phrases.slice(0,Math.min(500,limit));
  if(!phrases.length)throw Error('Пока нет фраз для этого занятия.');
  english.active={id:newId(),lessonId,mode,queue:phrases.map(p=>p.id),index:0,results:[],startedAt:now,resumedAt:now,elapsedMs:0,paused:false,...courseTask?{courseTask:structuredClone(courseTask)}:{}};
  return english.active;
}
export function studySeconds(active,now=Date.now()){return active?Math.max(0,Math.floor((active.elapsedMs+(active.paused?0:Math.max(0,now-active.resumedAt)))/1000)):0;}
export function pauseStudy(active,now=Date.now()){if(active&&!active.paused){active.elapsedMs+=Math.max(0,now-active.resumedAt);active.paused=true;}return active;}
export function resumeStudy(active,now=Date.now()){if(active?.paused){active.paused=false;active.resumedAt=now;}return active;}
export function finishStudy(english,now=Date.now()){
  const active=english.active;if(!active)return null;
  const session={id:active.id,lessonId:active.lessonId,mode:active.mode,date:studyDate(now),startedAt:active.startedAt,finishedAt:now,duration:studySeconds(active,now),results:structuredClone(active.results),completed:active.index>=active.queue.length,...active.courseTask?{courseTask:structuredClone(active.courseTask)}:{}};
  if(session.results.length){english.sessions.push(session);if(english.sessions.length>5000)english.sessions.splice(0,english.sessions.length-5000);}
  english.active=null;recordCourseSession(english,session,now);return session;
}
export function gradeStudy(english,correct,now=Date.now()){
  const active=english.active;if(!active||active.paused)throw Error('Сначала возобнови практику.');
  const id=active.queue[active.index];if(!PHRASE_MAP.has(id))throw Error('Эта фраза недоступна в текущей версии урока.');
  const old=Object.hasOwn(english.cards,id)?english.cards[id]:{seen:0,correct:0,lapses:0,streak:0,level:0,due:0,lastReviewed:0,starred:false};
  const scheduled=reviewSchedule(old,correct,active.mode,now);
  
  english.cards[id]={...old,seen:old.seen+1,correct:old.correct+(correct?1:0),lapses:old.lapses+(correct?0:1),streak:correct?old.streak+1:0,...scheduled,lastReviewed:now};
  active.results.push({id,correct:Boolean(correct),at:now});active.index++;
  return active.index>=active.queue.length?finishStudy(english,now):null;
}
export function togglePhraseStar(english,id){if(!PHRASE_MAP.has(id))return;const old=Object.hasOwn(english.cards,id)?english.cards[id]:{seen:0,correct:0,lapses:0,streak:0,level:0,due:0,lastReviewed:0,starred:false};english.cards[id]={...old,starred:!old.starred};}
export function englishStats(english,now=Date.now()){
  const today=studyDate(now),results=english.sessions.flatMap(s=>s.results),todayResults=english.sessions.filter(s=>s.date===today).flatMap(s=>s.results);
  if(english.active)todayResults.push(...english.active.results.filter(r=>studyDate(r.at)===today));
  const doneDays=new Set(english.sessions.filter(s=>s.results.length).map(s=>s.date));let day=new Date(now),streak=0;
  if(!doneDays.has(studyDate(day.getTime())))day.setDate(day.getDate()-1);
  while(doneDays.has(studyDate(day.getTime()))){streak++;day.setDate(day.getDate()-1);}
  const cards=Object.values(english.cards);
  return {today:new Set(todayResults.map(r=>r.id)).size,studied:cards.filter(c=>c.seen>0).length,mastered:cards.filter(c=>c.level>=2&&c.streak>=2).length,due:duePhrases(english,now).length,mistakes:duePhrases(english,now,true).length,starred:cards.filter(c=>c.starred).length,accuracy:results.length?Math.round(results.filter(r=>r.correct).length/results.length*100):0,minutes:Math.round(english.sessions.reduce((n,s)=>n+s.duration,0)/60),streak,sessions:english.sessions.length};
}
export function validateEnglishData(value){
  const fail=()=>{throw Error('Данные английского раздела повреждены.');};
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v),number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9:_-]{0,99}$/i.test(v)&&!['constructor','prototype'].includes(v);
  const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(new Date(v+'T12:00:00Z').getTime())&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
  const results=rows=>Array.isArray(rows)&&rows.length<=500&&rows.every(r=>object(r)&&id(r.id)&&typeof r.correct==='boolean'&&number(r.at,0,9e15));
  if(!object(value)||value.version!==1||!object(value.settings)||!object(value.cards)||!Array.isArray(value.sessions)||value.sessions.length>5000)fail();
  const s=value.settings;if(!Number.isInteger(s.dailyGoal)||!number(s.dailyGoal,1,200)||!number(s.rate,.5,1.5)||!number(s.pause,1,30)||!['en-US','en-GB'].includes(s.accent))fail();
  if(Object.keys(value.cards).length>10000)fail();
  for(const [key,c] of Object.entries(value.cards)){if(!id(key)||!object(c)||!['seen','correct','lapses','streak','level'].every(k=>Number.isInteger(c[k])&&number(c[k],0,1e7))||c.level>6||c.correct>c.seen||c.lapses>c.seen||!number(c.due,0,9e15)||!number(c.lastReviewed,0,9e15)||typeof c.starred!=='boolean')fail();}
  const sessionIds=new Set();
  for(const row of value.sessions){if(!object(row)||!id(row.id)||sessionIds.has(row.id)||!(row.lessonId===null||id(row.lessonId))||!Object.hasOwn(STUDY_MODES,row.mode)||!date(row.date)||!number(row.startedAt,0,9e15)||!number(row.finishedAt,row.startedAt,9e15)||!number(row.duration,0,9e12)||typeof row.completed!=='boolean'||!results(row.results))fail();sessionIds.add(row.id);}
  if(value.active!==null){const a=value.active;if(!object(a)||!id(a.id)||sessionIds.has(a.id)||!(a.lessonId===null||id(a.lessonId))||!Object.hasOwn(STUDY_MODES,a.mode)||!Array.isArray(a.queue)||!a.queue.length||a.queue.length>500||!a.queue.every(id)||!Number.isInteger(a.index)||!number(a.index,0,a.queue.length-1)||!results(a.results)||a.results.length!==a.index||a.results.some((r,i)=>r.id!==a.queue[i])||!number(a.startedAt,0,9e15)||!number(a.resumedAt,a.startedAt,9e15)||!number(a.elapsedMs,0,9e12)||typeof a.paused!=='boolean')fail();}
  if(value.plans!==undefined)validatePlanProgress(value.plans);
  if(value.course!==undefined)validateCourse(value.course);
  for(const row of [...value.sessions,...value.active?[value.active]:[]])if(row.courseTask!==undefined&&(!object(row.courseTask)||!date(row.courseTask.date)||!id(row.courseTask.id)))fail();
  return {...structuredClone(value),plans:structuredClone(value.plans||{}),course:structuredClone(value.course||createCourseData())};
}
