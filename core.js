import {createCourseData} from './course-core.js?v=2.3.0';
import {createEnglishData,validateEnglishData} from './english-core.js?v=2.3.0';
import {prepareWorkingSets} from './progression.js?v=2.3.0';
export const STORAGE_KEY = 'forma.training.v1';
export const uid = () => globalThis.crypto?.randomUUID?.() || 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2);
export const dateKey = (date = new Date()) => { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const addDays = (date, count) => { const d = new Date(typeof date === 'string' && date.length === 10 ? date + 'T12:00:00' : date); d.setDate(d.getDate() + count); return d; };
export const weekStart = (date = new Date()) => { const d = addDays(date, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dateKey(d); };
export const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export const doneSets = (session) => (session.exercises || []).flatMap(ex => (ex.sets || []).filter(set => set.done));
export const volume = session => doneSets(session).reduce((sum, set) => sum + num(set.weight) * num(set.reps), 0);
export const estimate1RM = (weight, reps) => reps === 1 ? weight : weight * (1 + reps / 30);
export const totalSeconds = (session, now = Date.now()) => Math.max(0, Math.floor(((session.pausedAt || now) - session.startedAt - (session.pausedMs || 0)) / 1000));
export const formatTime = seconds => { const n = Math.max(0, Math.floor(seconds)); return n >= 3600 ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}` : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
export const EXERCISES = [
  ['bench','Жим штанги лёжа','Грудь','Штанга'],['incline','Жим гантелей на наклонной','Грудь','Гантели'],['fly','Сведение рук в кроссовере','Грудь','Блок'],['pushup','Отжимания','Грудь','Свой вес'],
  ['pullup','Подтягивания','Спина','Свой вес'],['pulldown','Тяга верхнего блока','Спина','Блок'],['row','Тяга штанги в наклоне','Спина','Штанга'],['cable-row','Горизонтальная тяга','Спина','Блок'],['deadlift','Становая тяга','Спина','Штанга'],
  ['squat','Приседания со штангой','Ноги','Штанга'],['legpress','Жим ногами','Ноги','Тренажёр'],['rdl','Румынская тяга','Ноги','Штанга'],['lunge','Выпады с гантелями','Ноги','Гантели'],['legcurl','Сгибание ног','Ноги','Тренажёр'],['calf','Подъём на носки','Ноги','Тренажёр'],['hipthrust','Ягодичный мост','Ноги','Штанга'],
  ['ohp','Жим гантелей сидя','Плечи','Гантели'],['lateral','Махи гантелями в стороны','Плечи','Гантели'],['rear','Обратная бабочка','Плечи','Тренажёр'],['curl','Сгибания с гантелями','Руки','Гантели'],['barcurl','Подъём штанги на бицепс','Руки','Штанга'],['triceps','Разгибания на блоке','Руки','Блок'],['dips','Отжимания на брусьях','Руки','Свой вес'],['crunch','Скручивания','Пресс','Свой вес'],['legraise','Подъём ног в висе','Пресс','Свой вес'],['cablecrunch','Скручивания на блоке','Пресс','Блок']
].map(([id,name,muscle,equipment]) => ({id,name,muscle,equipment}));
export const programSetCount = program => program.exercises.reduce((sum,item)=>sum+item.sets+(item.warmupSets??2),0);
export function migrateData(input){
  const result=structuredClone(input);
  if(result.english===undefined)result.english=createEnglishData();
  else if(result.english.plans===undefined)result.english.plans={};
  if(result.english.course===undefined)result.english.course=createCourseData();
  if(result.programSetScheme!==1){
    for(const program of result.programs)for(const item of program.exercises){item.warmupSets=2;item.sets=3;}
    result.programSetScheme=1;
  }
  for(const program of result.programs)for(const item of program.exercises)if(item.progression===undefined)item.progression={enabled:true,increment:2.5};
  return result;
}
export function createExerciseSets(item,previous){
  const warmups=(previous?.sets||[]).filter(set=>set.type==='warmup');
  const working=(previous?.sets||[]).filter(set=>set.type!=='warmup');
  const make=(type,count,old,fallbackWeight)=>Array.from({length:count},(_,index)=>({id:uid(),weight:old[index]?.weight??fallbackWeight,reps:old[index]?.reps??item.reps??10,done:false,type}));
  return [...make('warmup',item.warmupSets??2,warmups,0),...make('work',item.sets??3,working,item.weight??0)];
}
const template = (id,name,focus,color,items) => ({id,name,focus,color,rest:90,exercises:items.map(([exerciseId,sets,reps,weight])=>({exerciseId,warmupSets:2,sets:3,reps,weight,progression:{enabled:true,increment:2.5}}))});
export const DEFAULT_PROGRAMS = [
  template('upper','Верх тела','Грудь · спина · плечи','purple',[['bench',3,10,60],['pulldown',3,12,45],['incline',3,10,20],['cable-row',3,12,40],['lateral',3,15,8],['triceps',3,12,20]]),
  template('lower','Ноги и ягодицы','Квадрицепс · бицепс бедра','orange',[['squat',4,8,60],['rdl',3,10,50],['legpress',3,12,100],['legcurl',3,12,30],['calf',3,15,40]]),
  template('full','Всё тело','Все основные группы мышц','green',[['squat',3,8,50],['bench',3,10,50],['row',3,10,40],['ohp',3,10,12],['crunch',3,20,0]])
];
export function createInitialData(demo = true, now = new Date()) {
  const data = { version:1, programSetScheme:1, demo, settings:{name:'Атлет',weeklyGoal:3,rest:90,autoRest:true,sound:true,unit:'kg'},exercises:structuredClone(EXERCISES),programs:structuredClone(DEFAULT_PROGRAMS),sessions:[],measurements:[],schedule:{},goals:[{id:'goal-training',type:'sessions',name:'12 тренировок за месяц',target:12},{id:'goal-bench',type:'weight',name:'Жим лёжа · 80 кг',exerciseId:'bench',target:80}],active:null,english:createEnglishData() };
  if (!demo) return data;
  const days = [27,25,23,20,18,16,13,11,9,6,4,2];
  days.forEach((ago,index) => {
    const program = data.programs[index % 3];
    const session = createSession(program, data, addDays(now, -ago).getTime());
    session.exercises.forEach(ex => ex.sets.forEach(set => { set.done = true; const base=program.exercises.find(item=>item.exerciseId===ex.exerciseId).weight; set.weight = set.type==='warmup'?0:Math.max(0, base - 10 + Math.floor(index / 3) * 2.5); }));
    session.duration = (42 + index % 4 * 6) * 60;
    session.finishedAt = session.startedAt + session.duration * 1000;
    session.note = index === 11 ? 'Хорошая тренировка! Остался запас на следующий раз.' : '';
    session.effort = 7 + index % 3;
    data.sessions.push(session);
  });
  for (let i=0;i<6;i++) data.measurements.push({id:uid(),date:dateKey(addDays(now,-35+i*7)),weight:78.4-i*0.3,waist:85-i*0.4,chest:101+i*0.2,hip:98,note:''});
  const start = weekStart(now);
  data.schedule[dateKey(addDays(start,0))] = 'upper'; data.schedule[dateKey(addDays(start,2))] = 'lower'; data.schedule[dateKey(addDays(start,4))] = 'full';
  return data;
}
export function createSession(program, data, now = Date.now()) {
  return {id:uid(),name:program?.name || 'Свободная тренировка',programId:program?.id || null,date:dateKey(new Date(now)),startedAt:now,pausedMs:0,pausedAt:null,note:'',effort:7,exercises:(program?.exercises || []).map(item=>{
    const exercise = data.exercises.find(e=>e.id===item.exerciseId);
    const previous = [...data.sessions].filter(s=>s.startedAt<now).sort((a,b)=>b.startedAt-a.startedAt).flatMap(s=>s.exercises).find(e=>e.exerciseId===item.exerciseId&&e.sets.some(x=>x.done&&x.type==='work'));
    return {id:uid(),exerciseId:item.exerciseId,name:exercise?.name || 'Упражнение',rest:program.rest??data.settings.rest,...prepareWorkingSets(item,previous,createExerciseSets(item,previous))};
  })};
}
export function stats(data, days = 28, now = new Date()) {
  const end = dateKey(now), start = dateKey(addDays(now,-days+1));
  const sessions = data.sessions.filter(s=>s.date>=start && s.date<=end);
  const week = data.sessions.filter(s=>s.date>=weekStart(now) && s.date<=end);
  const activeWeeks = new Set(data.sessions.filter(s=>s.date<=end).map(s=>weekStart(s.date)));
  let streak=0, cursor=weekStart(now);
  if (!activeWeeks.has(cursor)) cursor = dateKey(addDays(cursor,-7));
  while(activeWeeks.has(cursor)) { streak++; cursor = dateKey(addDays(cursor,-7)); }
  return {sessions,week:week.length,count:sessions.length,volume:sessions.reduce((sum,s)=>sum+volume(s),0),minutes:Math.round(sessions.reduce((sum,s)=>sum+num(s.duration),0)/60),sets:sessions.reduce((sum,s)=>sum+doneSets(s).length,0),streak};
}
export function records(data) {
  const result = new Map();
  for(const session of [...data.sessions].sort((a,b)=>a.startedAt-b.startedAt)) for(const exercise of session.exercises) for(const set of exercise.sets.filter(s=>s.done && s.type !== 'warmup')) {
    const previous = result.get(exercise.exerciseId);
    if (!previous || set.weight > previous.weight || (set.weight === previous.weight && set.reps > previous.reps)) result.set(exercise.exerciseId,{exerciseId:exercise.exerciseId,name:exercise.name,weight:set.weight,reps:set.reps,date:session.date,sessionId:session.id});
  }
  return [...result.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
export function progressPoints(data, exerciseId) {
  return data.sessions.filter(s=>s.exercises.some(e=>e.exerciseId===exerciseId && e.sets.some(x=>x.done && x.type!=='warmup'))).sort((a,b)=>a.date.localeCompare(b.date)).map(s=>({date:s.date,value:Math.max(...s.exercises.filter(e=>e.exerciseId===exerciseId).flatMap(e=>e.sets.filter(x=>x.done && x.type!=='warmup').map(x=>x.weight)))}));
}
function validateNumber(value, min, max) { return typeof value==='number' && Number.isFinite(value) && value>=min && value<=max; }
function validDate(date) { if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;const d=new Date(date+'T12:00:00');return !Number.isNaN(d.getTime())&&dateKey(d)===date; }
export function validateData(input) {
  const fail=()=>{throw new Error('Файл не похож на резервную копию FORMA или содержит некорректные данные.');};
  if(!input || input.version!==1 || !input.settings || !Array.isArray(input.sessions) || !Array.isArray(input.exercises) || !Array.isArray(input.programs) || !Array.isArray(input.measurements) || !Array.isArray(input.goals) || !input.schedule || typeof input.schedule!=='object' || Array.isArray(input.schedule)) fail();
  if(input.sessions.length>10000 || input.exercises.length>1000 || input.programs.length>500 || input.measurements.length>10000 || input.goals.length>500) fail();
  const text = (v,n=300) => typeof v==='string' && v.length<=n;
  if(!text(input.settings.name,60)||!validateNumber(input.settings.weeklyGoal,1,14)||!validateNumber(input.settings.rest,0,3600)||!['kg','lb'].includes(input.settings.unit)||typeof input.settings.autoRest!=='boolean'||typeof input.settings.sound!=='boolean'||typeof input.demo!=='boolean')fail();
  const ids=new Set();
  for(const e of input.exercises){if(!text(e.id,100)||!e.id||ids.has(e.id)||!text(e.name,100)||!e.name||!text(e.muscle,50)||!text(e.equipment,50))fail();ids.add(e.id);}
  const programIds=new Set();
  for(const p of input.programs){if(!text(p.id,100)||programIds.has(p.id)||!text(p.name,100)||!text(p.focus)||!['purple','orange','green'].includes(p.color)||!validateNumber(p.rest,0,3600)||!Array.isArray(p.exercises)||p.exercises.length>50)fail();programIds.add(p.id);for(const e of p.exercises)if(!ids.has(e.exerciseId)||!Number.isInteger(e.sets)||!validateNumber(e.sets,1,30)||(e.warmupSets!==undefined&&(!Number.isInteger(e.warmupSets)||!validateNumber(e.warmupSets,0,20)))||!validateNumber(e.reps,1,1000)||!validateNumber(e.weight,0,2000))fail();}
  for(const p of input.programs)for(const e of p.exercises)if(e.progression!==undefined&&(!e.progression||typeof e.progression.enabled!=='boolean'||!validateNumber(e.progression.increment,.01,100)))fail();
  const validateSession=(s,active=false)=>{
    if(!text(s.id,100)||!text(s.name,100)||!validDate(s.date)||!validateNumber(s.startedAt,0,9e15)||!text(s.note,3000)||!validateNumber(s.effort,1,10)||!Array.isArray(s.exercises)||s.exercises.length>50)fail();
    if(active){if(!validateNumber(s.pausedMs,0,9e15)||(s.pausedAt!==null&&!validateNumber(s.pausedAt,s.startedAt,9e15)))fail();}else if(!validateNumber(s.duration,0,9e12)||!validateNumber(s.finishedAt,s.startedAt,9e15))fail();
    for(const e of s.exercises){if(!text(e.id,100)||!ids.has(e.exerciseId)||!text(e.name,100)||!validateNumber(e.rest,0,3600)||!Array.isArray(e.sets)||e.sets.length>50)fail();for(const set of e.sets)if(!text(set.id,100)||!validateNumber(set.weight,0,2000)||!validateNumber(set.reps,1,1000)||typeof set.done!=='boolean'||!['work','warmup','drop','failure'].includes(set.type))fail();}
  };
  for(const s of [...input.sessions,...input.active?[input.active]:[]])for(const e of s.exercises){
    if(e.workTarget!==undefined){const t=e.workTarget;if(!t||!Number.isInteger(t.sets)||!validateNumber(t.sets,1,30)||!validateNumber(t.reps,1,1000)||!Array.isArray(t.weights)||t.weights.length!==t.sets||!t.weights.every(w=>validateNumber(w,0,2000))||(t.baseWeight!==undefined&&!validateNumber(t.baseWeight,0,2000)))fail();}
    if(e.weightIncrease!==undefined&&!validateNumber(e.weightIncrease,0,100))fail();
  }
  const sessionIds=new Set();for(const s of input.sessions){validateSession(s);if(sessionIds.has(s.id))fail();sessionIds.add(s.id);}
  if(input.active!==null){if(!input.active||sessionIds.has(input.active.id))fail();validateSession(input.active,true);}
  for(const m of input.measurements){if(!text(m.id,100)||!validDate(m.date)||!text(m.note,1000))fail();for(const field of ['weight','waist','chest','hip'])if(m[field]!==null&&!validateNumber(m[field],0,1000))fail();}
  for(const g of input.goals){if(!text(g.id,100)||!text(g.name,150)||!['sessions','weight'].includes(g.type)||!validateNumber(g.target,0.1,10000)||(g.type==='weight'&&!ids.has(g.exerciseId)))fail();}
  for(const [date,id] of Object.entries(input.schedule))if(!validDate(date)||!programIds.has(id))fail();
  if(input.english!==undefined)validateEnglishData(input.english);
  return migrateData(input);
}
export function exportCSV(data) {
  const cell = value => '"'+String(value??'').replace(/"/g,'""')+'"';
  const rows=[['Дата','Тренировка','Упражнение','Подход','Тип','Вес (кг)','Повторения','Длительность (сек)','Заметка']];
  for(const s of data.sessions) for(const e of s.exercises) e.sets.forEach((set,i)=>{if(set.done)rows.push([s.date,s.name,e.name,i+1,set.type,set.weight,set.reps,s.duration,s.note]);});
  return '\uFEFF'+rows.map(row=>row.map(v=>cell(/^[=+\-@\t\r]/.test(String(v))?'\''+v:v)).join(';')).join('\r\n');
}
