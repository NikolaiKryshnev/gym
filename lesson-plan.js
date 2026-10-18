// Sources were checked against the public transcript, not inferred from the drills.
const source=(seconds,label)=>({videoId:'KP8d-TcrMGw',seconds,label});
const steps=material=>[
  {id:'prepare',title:'Подготовь бумажные карточки',where:'За столом',goal:1,unit:'подготовка',optional:false,instructions:`${material} На одной стороне карточки напиши русскую фразу, на другой — английскую. Можно распечатать лист ниже и закрывать английские ответы отдельным листом.`,source:source(316,'Карточки · 5:16')},
  {id:'recall',title:'Вспомни → произнеси → проверь',where:'Вслух, с карточками',goal:1,unit:'занятие',optional:false,instructions:'Закрой английскую сторону. По русской подсказке сначала сам вспомни и произнеси фразу вслух. Только потом открой ответ и проверь себя. Начни с короткого занятия на 2–5 минут.',source:source(247,'Устная практика · 4:07'),extraSource:source(658,'Короткие ежедневные занятия · 10:58')},
  {id:'notebook',title:'Тетрадь: напиши по памяти',where:'В тетради, от руки',goal:10,unit:'проходов',optional:true,customGoal:true,instructions:'Выбери один блок фраз. Смотри только на русскую подсказку и записывай английскую фразу по памяти. После каждой попытки открывай ответ, сверяй и исправляй ошибку. Один проход — весь выбранный блок. Отмечай проход только после работы в тетради.',note:'10 проходов — личная стартовая цель в приложении, её можно изменить. Автор показывает письмо как дополнительный способ и советует начинающим сначала привыкнуть к устной практике.',source:source(437,'Письмо по памяти · 7:17'),extraSource:source(651,'Совет начинающим · 10:51')},
  {id:'objects',title:'Свяжи фразы с реальными действиями',where:'С предметами',goal:1,unit:'проход',optional:true,instructions:'Возьми подходящий предмет. Вспомни английскую команду для действия, произнеси её и выполни действие. Проверь формулировку. Пройди выбранный блок таким способом.',note:'Практическое задание приложения по примеру с телефоном из видео. Один проход — ориентир для твоей отметки, а не названная автором норма.',source:source(178,'Пример с телефоном · 2:58')},
  {id:'corrections',title:'Разбери ошибки и проверь себя снова',where:'Карточки и тетрадь',goal:1,unit:'проверка',optional:false,instructions:'Если были ошибки, исправь запись. Затем снова закрой английский ответ и попробуй восстановить фразу по памяти. Если ошибок не было, отметь, что проверка выполнена. Сложные фразы и страницы тетради можно записать в заметку к плану.',source:source(494,'Самопроверка и исправление · 8:14')}
];
export const LESSON_PLANS={
  'drill-01':{version:1,groupId:'objects',groupTitle:'Те же действия с предметами · 20 фраз',intro:'Работа с 20 фразами о предметах из первого видео. Базовые команды с it можно проработать отдельным проходом.',sourceNote:'Порядок устной и письменной работы сверён с главой «КАК» первого видео. Счётчики фиксируют твою работу вне приложения.',steps:steps('Для начала возьми блок «Те же действия с предметами» — 20 фраз.')},
  'drill-02':{version:1,groupId:null,groupTitle:'Весь урок · 33 фразы',intro:'Фразы из истории про чашку: подготовь пустую чашку и место для записей. Можно заниматься небольшими блоками.',sourceNote:'К фразам второго урока применён общий способ из первого видео: сначала вспомнить, потом проверить. Ссылки у шагов ведут к проверенным объяснениям этого способа.',steps:steps('Возьми фразы урока про чашку или один небольшой блок.')}
};
const safeId=id=>typeof id==='string'&&/^[a-z0-9][a-z0-9:_-]{0,99}$/i.test(id)&&!['constructor','prototype'].includes(id);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const validTime=v=>Number.isSafeInteger(v)&&v>=0&&v<=9e15;
function validateEntries(entries){
  if(!object(entries)||Object.keys(entries).length>100)throw Error('Повреждены отметки плана урока.');
  for(const [id,row] of Object.entries(entries))if(!safeId(id)||!object(row)||!Number.isInteger(row.count)||!Number.isInteger(row.goal)||row.count<0||row.count>1000||row.goal<1||row.goal>1000||!validTime(row.updatedAt))throw Error('Повреждены отметки плана урока.');
}
export function validatePlanProgress(plans){
  if(!object(plans)||Object.keys(plans).length>1000)throw Error('Повреждены планы уроков.');
  for(const [id,plan] of Object.entries(plans)){
    if(!safeId(id)||!object(plan)||typeof plan.note!=='string'||plan.note.length>4000||!validTime(plan.updatedAt)||!Array.isArray(plan.history)||plan.history.length>20)throw Error('Повреждён план урока.');
    validateEntries(plan.entries);
    for(const round of plan.history){if(!object(round)||!validTime(round.finishedAt)||typeof round.note!=='string'||round.note.length>4000)throw Error('Повреждена история плана.');validateEntries(round.entries);}
  }
  return plans;
}
function definitions(lessonId,stepId){const plan=LESSON_PLANS[lessonId],step=plan?.steps.find(s=>s.id===stepId);if(!step)throw Error('Задание не найдено.');return step;}
function record(english,lessonId){if(!Object.hasOwn(LESSON_PLANS,lessonId))throw Error('План не найден.');english.plans??={};return english.plans[lessonId]??=( {entries:{},note:'',updatedAt:0,history:[]} );}
export function planStep(english,lessonId,stepId){const definition=definitions(lessonId,stepId),saved=english.plans?.[lessonId]?.entries?.[stepId];return saved||{count:0,goal:definition.goal,updatedAt:0};}
export function changePlanCount(english,lessonId,stepId,delta,now=Date.now()){
  definitions(lessonId,stepId);if(!Number.isInteger(delta)||Math.abs(delta)!==1)throw Error('Измени отметку на один шаг.');
  const plan=record(english,lessonId),entry=planStep(english,lessonId,stepId);plan.entries[stepId]={...entry,count:delta>0?Math.max(entry.count,Math.min(entry.goal,entry.count+1)):Math.max(0,entry.count-1),updatedAt:now};plan.updatedAt=now;return plan.entries[stepId];
}
export function setPlanGoal(english,lessonId,stepId,goal,now=Date.now()){
  const step=definitions(lessonId,stepId);if(!step.customGoal||!Number.isInteger(goal)||goal<1||goal>100)throw Error('Личная цель — от 1 до 100 проходов.');
  const plan=record(english,lessonId),entry=planStep(english,lessonId,stepId);plan.entries[stepId]={...entry,goal,updatedAt:now};plan.updatedAt=now;
}
export function savePlanNote(english,lessonId,note,now=Date.now()){if(typeof note!=='string'||note.length>4000)throw Error('Заметка — до 4000 символов.');const plan=record(english,lessonId);plan.note=note;plan.updatedAt=now;}
export function restartPlan(english,lessonId,now=Date.now()){
  const plan=record(english,lessonId);if(Object.values(plan.entries).some(e=>e.count>0)||plan.note)plan.history.unshift({entries:structuredClone(plan.entries),note:plan.note,finishedAt:now});plan.history=plan.history.slice(0,20);plan.entries={};plan.updatedAt=now;
}
export function planStats(english,lessonId){
  const plan=LESSON_PLANS[lessonId];if(!plan)return {done:0,total:0,mainDone:0,mainTotal:0};
  const complete=s=>{const p=planStep(english,lessonId,s.id);return p.count>=p.goal;},main=plan.steps.filter(s=>!s.optional);
  return {done:plan.steps.filter(complete).length,total:plan.steps.length,mainDone:main.filter(complete).length,mainTotal:main.length};
}
