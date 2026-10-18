import {LESSONS} from './lessons.js?v=2.3.0';
export {LESSONS};
const dateKey=(time=Date.now())=>{const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const courseDate=dateKey;
const phraseRows=LESSONS.flatMap(l=>l.groups.flatMap(g=>g.items.map(p=>({...p,lessonId:l.id,groupId:g.id}))));
export const COURSE_PHRASES=new Map(phraseRows.map(p=>[p.id,p]));
const chunk=(items,size=5)=>Array.from({length:Math.ceil(items.length/size)},(_,i)=>items.slice(i*size,(i+1)*size));
export const COURSE_UNITS=LESSONS.flatMap(lesson=>{
  const groups=lesson.groups.map(g=>chunk(g.items).map((rows,i)=>({id:`${lesson.id}:${g.id}:${i+1}`,lessonId:lesson.id,title:g.title+(g.items.length>5?` · часть ${i+1}`:''),ids:rows.map(p=>p.id)})));
  if(lesson.id==='drill-01'&&groups.length===2)return groups[0].flatMap((u,i)=>[u,...groups[1][i]?[groups[1][i]]:[]]);
  return groups.flat();
});
export const createCourseData=()=>({version:1,units:{},days:{}});
export const minutesForLessons=count=>Math.min(90,10+Math.max(0,count)*10);
export function passedLessons(english,before=Infinity){return LESSONS.filter(l=>{const units=COURSE_UNITS.filter(u=>u.lessonId===l.id);return units.length&&units.every(u=>english.course?.units[u.id]?.completedAt&&english.course.units[u.id].completedAt<before);});}
export function courseMinutes(english,date=courseDate()){
  const start=new Date(date+'T00:00:00').getTime();return minutesForLessons(passedLessons(english,start).length);
}
export function courseFocus(english){return COURSE_UNITS.find(u=>!english.course?.units[u.id]?.completedAt)||null;}
export function courseDue(english,now=Date.now()){return phraseRows.filter(p=>{const c=english.cards[p.id];return c?.seen>0&&c.due<=now;}).sort((a,b)=>{
  const ca=english.cards[a.id],cb=english.cards[b.id];return (ca.due-cb.due)||((cb.lapses>0&&cb.streak<2)-(ca.lapses>0&&ca.streak<2));
});}
const makeTask=(id,kind,title,minutes,ids=[],mode=null,unitId=null)=>({id,kind,title,minutes,ids,mode,unitId,status:'pending',score:null,attempts:0,mistakes:[],seconds:0,runningSince:null,finishedAt:null});
export function ensureCourseDay(english,now=Date.now()){
  english.course??=createCourseData();const date=courseDate(now);if(english.course.days[date])return english.course.days[date];
  for(const day of Object.values(english.course.days))for(const task of day.tasks)if(task.runningSince!==null){task.seconds=taskSeconds(task,now);task.runningSince=null;}
  const minutes=courseMinutes(english,date),focus=courseFocus(english),due=courseDue(english,now),catchup=due.length>minutes*2;
  const ids=focus&&!catchup?focus.ids:due.slice(0,5).map(p=>p.id);
  const known=phraseRows.filter(p=>english.cards[p.id]?.seen>0).map(p=>p.id);
  const practiceIds=ids.length?ids:known.slice(0,5);
  const focusProgress=focus&&english.course.units[focus.id],phase=focusProgress?.firstPassedAt?'confirm':'learn';
  const reviewIds=due.filter(p=>!ids.includes(p.id)).slice(0,5).map(p=>p.id);
  const tasks=[reviewIds.length?makeTask('warmup','review','Вспомни то, что подошло к повторению',1,reviewIds,'cards'):makeTask('warmup','prepare','Подготовь предметы и бумажные карточки',1,practiceIds),
    makeTask('learn','learn',focus&&!catchup?(phase==='confirm'?'Освежи вчерашние команды':'Изучи маленький блок команд'):'Послушай и повтори знакомые команды',2,practiceIds,'act'),
    makeTask('objects','objects','Произнеси команды и выполни действия',3,practiceIds),
    makeTask('check','check',phase==='confirm'&&!catchup?'Проверка памяти в другой день':'Вспомни команды без английской подсказки',2,practiceIds,'actions',focus&&!catchup?focus.id:null),
    makeTask('corrections','notebook','Исправь ошибки: в тетради или вслух',2,practiceIds)];
  if(!practiceIds.length){tasks.splice(1,3,makeTask('refresh','objects','Проговори знакомые действия с предметами',7,known.slice(0,5)));}
  // Extra time is practice of introduced material, never an ever-growing queue of new phrases.
  let remaining=minutes-10,index=0;const pool=[...new Set([...reviewIds,...known,...practiceIds])];
  while(remaining>0){const n=Math.min(5,remaining),batch=Array.from({length:Math.min(10,pool.length)},(_,i)=>pool[(index*5+i)%pool.length]);
    tasks.push(makeTask('extra-'+index,index%2?'notebook':'review',index%2?'Закрепи блок на бумаге и в действиях':'Повтори знакомые фразы по памяти',n,batch,index%2?null:'cards'));remaining-=n;index++;
  }
  const day={date,minutes,unitId:focus&&!catchup?focus.id:null,phase,catchup,createdAt:now,completedAt:null,tasks};
  english.course.days[date]=day;const dates=Object.keys(english.course.days).sort();while(dates.length>365){const old=dates.shift();if(english.active?.courseTask?.date!==old)delete english.course.days[old];}
  return day;
}
export function courseTask(english,date,id){const day=english.course?.days[date],task=day?.tasks.find(t=>t.id===id);if(!task)throw Error('Задание не найдено. Открой план на сегодня.');return {day,task};}
export function taskUnlocked(day,task){const index=day.tasks.indexOf(task);return day.tasks.slice(0,index).every(t=>t.status==='done'||t.kind==='check'&&t.status==='failed');}
export function taskSeconds(task,now=Date.now()){return Math.min(task.minutes*60,Math.max(0,Math.floor(task.seconds+(task.runningSince===null?0:(now-task.runningSince)/1000))));}
export function toggleTaskTimer(english,date,id,now=Date.now()){
  const {day,task}=courseTask(english,date,id);if(!taskUnlocked(day,task)||task.mode||task.status==='done')throw Error('Сначала выполни предыдущее задание.');
  const seconds=taskSeconds(task,now),wasRunning=task.runningSince!==null;for(const d of Object.values(english.course.days))for(const t of d.tasks)if(t.runningSince!==null){t.seconds=taskSeconds(t,now);t.runningSince=null;}
  task.runningSince=!wasRunning&&seconds<task.minutes*60?now:null;task.seconds=seconds;return task;
}
function updateCourseCompletion(english,day,now){
  if(day.completedAt!==null||!day.tasks.every(t=>t.status==='done'))return;
  day.completedAt=now;if(!day.unitId)return;
  const check=day.tasks.find(t=>t.kind==='check');if(!check||check.score<80)return;
  const unit=english.course.units[day.unitId]??={firstPassedAt:null,completedAt:null};
  if(unit.firstPassedAt===null)unit.firstPassedAt=now;
  else if(courseDate(unit.firstPassedAt)!==courseDate(now))unit.completedAt??=now;
}
export function finishManualTask(english,date,id,now=Date.now()){
  const {day,task}=courseTask(english,date,id);if(task.mode||!taskUnlocked(day,task))throw Error('Сначала выполни предыдущее задание.');
  if(task.status==='done')return day;
  task.seconds=taskSeconds(task,now);task.runningSince=null;task.status='done';task.finishedAt=now;updateCourseCompletion(english,day,now);return day;
}
export function studyTaskOptions(english,date,id){
  const {day,task}=courseTask(english,date,id);if(!taskUnlocked(day,task)||!task.mode||task.status==='done')throw Error('Сначала выполни предыдущее задание.');
  return {ids:task.ids,mode:task.mode,limit:0,shuffle:task.kind!=='learn',courseTask:{date,id}};
}
export function recordCourseSession(english,session,now=Date.now()){
  if(!session.courseTask)return;
  const {date,id}=session.courseTask;const day=english.course?.days[date],task=day?.tasks.find(t=>t.id===id);if(!task)return;
  if(task.status==='done')return;
  task.seconds=Math.min(task.minutes*60,task.seconds+session.duration);
  if(!session.completed)return;
  const covered=new Set(session.results.map(r=>r.id));if(!task.ids.every(id=>covered.has(id)))return;
  const correct=session.results.filter(r=>r.correct).length;task.score=Math.round(correct/session.results.length*100);task.attempts++;
  task.mistakes=[...new Set(session.results.filter(r=>!r.correct).map(r=>r.id))];task.finishedAt=now;
  task.status=task.kind==='check'&&task.score<80?'failed':'done';updateCourseCompletion(english,day,now);
}
export function nextCourseTask(day){return day.tasks.find(t=>t.status==='pending'&&taskUnlocked(day,t))||day.tasks.find(t=>t.status==='failed'&&taskUnlocked(day,t))||null;}
export function daySummary(day){return {done:day.tasks.filter(t=>t.status==='done').length,total:day.tasks.length,minutesDone:day.tasks.filter(t=>t.status==='done').reduce((n,t)=>n+t.minutes,0),seconds:day.tasks.reduce((n,t)=>n+taskSeconds(t),0)};}
export const REVIEW_INTERVALS=[600000,86400000,3*86400000,7*86400000,14*86400000,30*86400000,60*86400000];
export function reviewSchedule(old,correct,mode,now){
  if(!correct)return {level:0,due:now+REVIEW_INTERVALS[0]};
  const independent=['cards','actions','translate','dictation','listen'].includes(mode);
  if(!old||old.seen===0)return {level:0,due:now+REVIEW_INTERVALS[0]};
  if(!independent||now<old.due)return {level:old.level,due:old.due};
  const level=Math.min(6,old.level+1);return {level,due:now+REVIEW_INTERVALS[level]};
}
export function validateCourse(value){
  const fail=()=>{throw Error('Повреждён ежедневный план английского.');},obj=v=>v&&typeof v==='object'&&!Array.isArray(v),time=v=>Number.isSafeInteger(v)&&v>=0&&v<=9e15,id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9:_-]{0,99}$/i.test(v)&&!['constructor','prototype'].includes(v),date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(new Date(v+'T12:00:00').getTime())&&dateKey(new Date(v+'T12:00:00'))===v;
  if(!obj(value)||value.version!==1||!obj(value.units)||!obj(value.days)||Object.keys(value.units).length>5000||Object.keys(value.days).length>366)fail();
  for(const [key,u] of Object.entries(value.units))if(!id(key)||!obj(u)||!(u.firstPassedAt===null||time(u.firstPassedAt))||!(u.completedAt===null||time(u.completedAt))||(u.completedAt!==null&&(u.firstPassedAt===null||u.completedAt<u.firstPassedAt)))fail();
  for(const [key,d] of Object.entries(value.days)){
    if(!date(key)||!obj(d)||d.date!==key||!Number.isInteger(d.minutes)||d.minutes<10||d.minutes>90||!(d.unitId===null||id(d.unitId))||!['learn','confirm'].includes(d.phase)||typeof d.catchup!=='boolean'||!time(d.createdAt)||!(d.completedAt===null||time(d.completedAt))||!Array.isArray(d.tasks)||!d.tasks.length||d.tasks.length>24)fail();
    const ids=new Set();for(const t of d.tasks){if(!obj(t)||!id(t.id)||ids.has(t.id)||!['prepare','review','learn','objects','check','notebook'].includes(t.kind)||typeof t.title!=='string'||t.title.length>200||!Number.isInteger(t.minutes)||t.minutes<1||t.minutes>90||!Array.isArray(t.ids)||t.ids.length>500||!t.ids.every(id)||!(t.mode===null||['act','cards','actions','dictation','listen','translate'].includes(t.mode))||!(t.unitId===null||id(t.unitId))||!['pending','done','failed'].includes(t.status)||!(t.score===null||Number.isInteger(t.score)&&t.score>=0&&t.score<=100)||!Number.isInteger(t.attempts)||t.attempts<0||t.attempts>10000||!Array.isArray(t.mistakes)||t.mistakes.length>500||!t.mistakes.every(id)||!Number.isFinite(t.seconds)||t.seconds<0||t.seconds>5400||!(t.runningSince===null||time(t.runningSince))||!(t.finishedAt===null||time(t.finishedAt)))fail();ids.add(t.id);}
    if(d.tasks.reduce((n,t)=>n+t.minutes,0)!==d.minutes)fail();
  }
  return value;
}
