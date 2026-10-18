import {cloudConfig} from './cloud-config.js?v=2.1.0';
import {JournalSync} from './cloud-sync.js';
import {validateData} from './core.js?v=2.1.0';

export function createCloud({getData,onData,onGuest,onStatus,blocked=()=>false}){
  let client=null,engine=null,user=null,debounce=null,initializing=true;
  const configured=Boolean(cloudConfig.url&&cloudConfig.publishableKey);
  const state={configured,user:null,linked:false,status:configured?'loading':'unconfigured',error:null,syncedAt:null};
  const notify=()=>onStatus({...state});
  const update=()=>{
    Object.assign(state,{user,linked:Boolean(engine?.state),status:engine?.status||'unlinked',
      error:engine?.lastError?friendlyError(engine.lastError):null,syncedAt:engine?.state?.syncedAt||null});
    if(!navigator.onLine&&state.linked)state.status='offline';notify();
  };
  function backupFor(key,payload){
    key+='.backups';const previous=JSON.parse(localStorage.getItem(key)||'[]');
    localStorage.setItem(key,JSON.stringify([{date:new Date().toISOString(),payload},...previous].slice(0,3)));
  }
  function attach(next){
    if(!initializing&&user?.id===next?.id)return;
    initializing=false;clearTimeout(debounce);const hadUser=Boolean(user);user=next;engine=null;
    if(!user){state.recovery=false;if(hadUser)onGuest();update();return;}
    const identity=user.id;
    const requireIdentity=()=>{if(user?.id!==identity||engine!==nextEngine)throw Error('Аккаунт изменился. Повтори действие.');};
    const remote={
      async read(){requireIdentity();const {data,error}=await client.from('training_journals').select('payload,revision,updated_at').eq('user_id',identity).maybeSingle();if(error)throw error;requireIdentity();return data;},
      async save(payload,revision){requireIdentity();const {data,error}=await client.rpc('save_training_journal',{p_payload:payload,p_expected_revision:revision,p_user_id:identity});if(error)throw error;requireIdentity();return data?.[0];}
    };
    const nextEngine=new JournalSync({remote,storage:localStorage,key:`forma.cloud.${new URL(cloudConfig.url).hostname}.${identity}`,
      validate:validateData,onData:payload=>{if(engine===nextEngine)onData(payload);},
      onChange:()=>{if(engine===nextEngine)update();},onBackup:payload=>backupFor(nextEngine.key,payload)});
    engine=nextEngine;
    if(!engine.restore()&&hadUser)onGuest();update();if(engine.state)sync();
  }
  async function init(){
    if(!configured){notify();return;}
    try{
      if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cloudConfig.url)||!isPublicKey(cloudConfig.publishableKey))throw Error('Некорректная публичная конфигурация облака.');
      const {createClient}=await import('./vendor/supabase.js');
      client=createClient(cloudConfig.url,cloudConfig.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      client.auth.onAuthStateChange((event,session)=>{
        // Defer API calls until the auth callback releases the SDK's session lock.
        setTimeout(()=>{if(event==='PASSWORD_RECOVERY'){state.recovery=true;notify();}attach(session?.user||null);},0);
      });
      const {data,error}=await client.auth.getSession();if(error)throw error;attach(data.session?.user||null);
    }catch(error){state.status='error';state.error=friendlyError(error);notify();}
  }
  async function sync(){if(!engine?.state||blocked()||!navigator.onLine)return;await engine.sync();}
  function saveLocal(payload){
    if(!engine?.state)return false;
    engine.saveLocal(payload);clearTimeout(debounce);debounce=setTimeout(sync,1800);return true;
  }
  async function auth(mode,email,password){
    if(!client)throw Error('Облако ещё не настроено.');
    const redirectTo=new URL('./',location.href).href;
    let result;
    if(mode==='signup')result=await client.auth.signUp({email,password,options:{emailRedirectTo:redirectTo}});
    else if(mode==='reset')result=await client.auth.resetPasswordForEmail(email,{redirectTo});
    else result=await client.auth.signInWithPassword({email,password});
    if(result.error)throw Error(friendlyError(result.error));
    if(result.data?.session)attach(result.data.session.user);
    return mode==='signup'&&!result.data?.session?'Проверь почту: для входа может потребоваться подтверждение адреса.':mode==='reset'?'Если адрес зарегистрирован, на него придёт письмо для смены пароля.':'Вход выполнен. Выбери дневник для синхронизации.';
  }
  async function signOut(){
    const {error}=await client.auth.signOut({scope:'local'});if(error)throw Error(friendlyError(error));attach(null);
  }
  async function connect(choice){
    if(!engine)throw Error('Сначала войди в аккаунт.');
    if(engine.status==='cache-error')throw Error('Локальная облачная копия повреждена. Скачай её перед восстановлением.');
    await engine.connect(getData(),choice);update();
  }
  async function resolve(choice){await engine?.resolve(choice);update();}
  async function password(value){const {error}=await client.auth.updateUser({password:value});if(error)throw Error(friendlyError(error));state.recovery=false;notify();}
  function getBackup(){const raw=engine&&localStorage.getItem(engine.key+'.backups');return raw?JSON.parse(raw)[0]:null;}
  function rawCache(){return engine?localStorage.getItem(engine.key):null;}
  function resetCache(){
    if(!engine||engine.status!=='cache-error')return;
    const raw=rawCache();if(raw)localStorage.setItem(engine.key+'.recovery',raw);
    localStorage.removeItem(engine.key);engine.lastError=null;engine.emit('unlinked');
  }
  function conflictInfo(){
    let other=engine?.conflict?.payload;
    if(engine?.conflict?.externalTab)try{other=JSON.parse(localStorage.getItem(engine.key)).payload;}catch{}
    return {externalTab:Boolean(engine?.conflict?.externalTab),localSessions:getData().sessions.length,localMeasurements:getData().measurements.length,
      localEnglishSessions:getData().english.sessions.length,remoteEnglishSessions:other?.english?.sessions?.length||0,
      remoteSessions:other?.sessions?.length,remoteMeasurements:other?.measurements?.length};
  }
  const poll=setInterval(sync,30000);
  window.addEventListener('online',()=>{update();sync();});window.addEventListener('offline',update);
  window.addEventListener('focus',()=>setTimeout(sync,800));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
  // Another tab may have advanced the same local cache. Pause instead of overwriting it.
  window.addEventListener('storage',event=>{if(engine?.state&&event.key===engine.key){engine.conflict={externalTab:true};engine.emit('conflict');}});
  return {state,init,saveLocal,sync,auth,signOut,connect,resolve,password,getBackup,conflictInfo,rawCache,resetCache,
    hasPending:()=>Boolean(engine?.state?.dirty),isLinked:()=>Boolean(engine?.state),
    stop:()=>{clearInterval(poll);clearTimeout(debounce);}};
}

export function isPublicKey(key){
  if(typeof key!=='string')return false;
  if(key.startsWith('sb_publishable_'))return key.length>20;
  try{return key.startsWith('eyJ')&&JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon';}catch{return false;}
}

export function friendlyError(error){
  const message=String(error?.message||error||'');
  if(/Invalid cache|JSON|Unexpected token/i.test(message))return 'Сохранённая копия не прошла проверку. Скачай исходный файл перед восстановлением.';
  if(/invalid login credentials/i.test(message))return 'Неверная почта или пароль.';
  if(/email not confirmed/i.test(message))return 'Подтверди адрес по ссылке из письма.';
  if(/rate limit|too many requests|over_email_send_rate_limit/i.test(message))return 'Слишком много попыток. Подожди несколько минут.';
  if(/fetch|network|load failed/i.test(message))return 'Нет связи с базой. Записи остаются на устройстве; повторим синхронизацию позже.';
  if(/relation .* does not exist|schema cache|PGRST/i.test(message))return 'База ещё не настроена. Нужна миграция таблицы дневника.';
  if(/JWT|refresh token/i.test(message))return 'Сессия истекла. Войди в аккаунт повторно.';
  return message.slice(0,250)||'Не удалось связаться с облаком.';
}
