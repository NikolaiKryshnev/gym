// Goals are captured when a session starts. Opening/reloading a session never raises its weights.
const round=n=>Math.round(n*10000)/10000;
export const workSets=exercise=>(exercise?.sets||[]).filter(s=>s.type==='work');
export const progressionConfig=item=>item.progression||{enabled:true,increment:2.5};
export function goalReached(exercise,item){
  if(!exercise||!item)return false;
  const target=exercise.workTarget||{sets:item.sets,reps:item.reps,weights:workSets(exercise).slice(0,item.sets).map(s=>s.weight)};
  if(target.sets!==item.sets||target.reps!==item.reps)return false;
  const sets=workSets(exercise).slice(0,target.sets);
  return sets.length===target.sets&&sets.every((s,i)=>s.done&&s.reps>=target.reps&&s.weight>0&&s.weight>=(target.weights[i]??Infinity));
}
export function nextWorkingPlan(item,previous){
  const config=progressionConfig(item),old=workSets(previous);
  const changedBase=previous?.workTarget&&previous.workTarget.baseWeight!==undefined&&previous.workTarget.baseWeight!==item.weight;
  const raised=Boolean(config.enabled&&!changedBase&&goalReached(previous,item)&&old.slice(0,item.sets).every(s=>s.weight+config.increment<=2000));
  const weights=Array.from({length:item.sets},(_,i)=>round(Math.min(2000,(changedBase?item.weight:old[i]?.weight??item.weight)+(raised?config.increment:0))));
  return {weights,raised:raised&&weights.some((w,i)=>w>(old[i]?.weight??item.weight)),increment:config.increment};
}
export function prepareWorkingSets(item,previous,sets){
  const plan=nextWorkingPlan(item,previous);let index=0;
  for(const set of sets)if(set.type==='work'){set.weight=plan.weights[index++];set.reps=item.reps;}
  return {sets,workTarget:{sets:item.sets,reps:item.reps,weights:plan.weights,baseWeight:item.weight},weightIncrease:plan.raised?plan.increment:0};
}
export function previousExerciseSession(sessions,exerciseId,before=Infinity,excludeId=null){
  return [...sessions].filter(s=>s.id!==excludeId&&s.startedAt<before&&s.exercises.some(e=>e.exerciseId===exerciseId&&e.sets.some(x=>x.done&&x.type!=='warmup'))).sort((a,b)=>b.startedAt-a.startedAt)[0]||null;
}
export function exerciseMetrics(exercise){
  const sets=(exercise?.sets||[]).filter(s=>s.done&&s.type!=='warmup');
  return {volume:sets.reduce((n,s)=>n+s.weight*s.reps,0),weight:sets.length?Math.max(...sets.map(s=>s.weight)):0,sets:sets.length};
}
export function exerciseComparison(exercise,previous){
  const current=exerciseMetrics(exercise),past=exerciseMetrics(previous);
  return {current,previous:past,hasPrevious:past.sets>0,volumeDelta:round(current.volume-past.volume),weightDelta:round(current.weight-past.weight)};
}
