import {PHRASES,normalizeAnswer} from './english-core.js?v=2.2.1';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=value=>{let h=[...value].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261);h=Math.imul(h^(h>>>16),2246822507);return (h^(h>>>13))>>>0;};
export function choiceOptions(phrase,seed='',limit=4){
  const seenEn=new Set([normalizeAnswer(phrase.en)]),seenRu=new Set([phrase.ru.toLowerCase()]);
  const equivalent=p=>/^(pick|lift)\b/i.test(p.en)?actionSymbol(p).object+'-lift':normalizeAnswer(p.en);
  const seenMeaning=new Set([equivalent(phrase)]);
  const candidates=PHRASES.filter(p=>p.lessonId===phrase.lessonId&&p.id!==phrase.id).sort((a,b)=>(a.groupId===phrase.groupId?0:1)-(b.groupId===phrase.groupId?0:1)||hash(seed+a.id)-hash(seed+b.id));
  const options=[phrase];
  for(const p of candidates){const en=normalizeAnswer(p.en),ru=p.ru.toLowerCase(),meaning=equivalent(p);if(seenEn.has(en)||seenRu.has(ru)||seenMeaning.has(meaning))continue;seenEn.add(en);seenRu.add(ru);seenMeaning.add(meaning);options.push(p);if(options.length>=limit)break;}
  return options.sort((a,b)=>hash(seed+'option'+a.id)-hash(seed+'option'+b.id));
}
export function actionSymbol(phrase){
  const en=phrase.en.toLowerCase();
  const object=phrase.lessonId==='drill-02'||/cup|drink|sip|sugar/.test(en)?'cup':/phone/.test(en)?'phone':/book/.test(en)?'book':/bottle/.test(en)?'bottle':/key/.test(en)?'key':/pen/.test(en)?'pen':/plate/.test(en)?'plate':/glass/.test(en)?'glass':/laptop/.test(en)?'laptop':'box';
  const direction=/upside down|turn.*around|stir/.test(en)?'turn':/out|lift|pick|up\./.test(en)?'up':/put|lower|set.*down/.test(en)?'down':/closer|give|over here|to me|to your lips/.test(en)?'left':/aside|farther|carry/.test(en)?'right':/shake/.test(en)?'shake':/tilt/.test(en)?'tilt':/wash/.test(en)?'wash':/pour|add/.test(en)?'pour':/sip|drink|hot/.test(en)?'drink':'hold';
  return {object,direction};
}
const objects={cup:'M30 34h30v22q0 14-15 14T30 56ZM60 38h8q12 12-8 18',phone:'M34 22h28v53H34ZM44 68h8',book:'M29 27h37v49H29ZM36 27v49',bottle:'M41 20h14v15l8 9v30H33V44l8-9ZM41 26h14',key:'M44 46a12 12 0 1 0-1 1l22 22h9v-9h-8v-8h-8',pen:'M32 65 57 29l10 7-25 36-13 5Z',plate:'M24 51a25 12 0 1 0 50 0 25 12 0 1 0-50 0M31 51a18 7 0 1 0 36 0 18 7 0 1 0-36 0',glass:'M32 28h32l-5 45H37ZM35 43h26',laptop:'M26 27h45v35H26ZM21 70h55l-5-8H26Z',box:'M28 36 48 25l23 11v28L49 77 28 64ZM28 36l21 13 22-13M49 49v28'};
const arrows={up:'M85 66V25m-8 8 8-8 8 8',down:'M85 25v41m-8-8 8 8 8-8',left:'M75 13H28m8-7-8 7 8 7',right:'M25 13h47m-8-7 8 7-8 7',turn:'M25 18q38-23 60 10l-1-13m1 13-14-2',shake:'M16 37l-6 7 6 7-6 7M84 37l6 7-6 7 6 7',tilt:'M16 26l15-12m-9 0h9v9',wash:'M21 20v8m12-12v8m-6 58h45',pour:'M74 17l-4 14m12-9-4 14m-3 6v7',drink:'M74 20q12 4 12 16m-12-8q6 4 4 10',hold:'M22 83h53'};
export function actionArt(phrase){const {object,direction}=actionSymbol(phrase);return `<svg class="action-art action-${direction}" viewBox="0 0 100 100" aria-hidden="true" fill="none"><circle cx="50" cy="50" r="47" fill="currentColor" opacity=".06"/><path d="${objects[object]}" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${arrows[direction]}" stroke="var(--green)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}
export function actionCard(phrase,{english=false}={}){return `<div class="action-flashcard">${actionArt(phrase)}<p class="action-caption">${esc(phrase.ru)}</p>${english?`<h1 lang="en">${esc(phrase.en)}</h1>`:'<p class="action-hidden">Вспомни и произнеси команду</p>'}</div>`;}
