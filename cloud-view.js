const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(action,label,style='outline')=>`<button type="button" class="btn ${style}" data-action="cloud-${action}">${label}</button>`;
export const cloudLabel=state=>state.status==='unlinked'&&!state.user?'Вход в аккаунт':({loading:'Проверяем подключение',unconfigured:'На этом устройстве',unlinked:'Подключаем облако…',saved:'Сохранено в облаке',pending:'Ожидает отправки',syncing:'Синхронизация…',conflict:'Есть разные версии',offline:'Без сети · сохранено на устройстве',error:'Нужна синхронизация','cache-error':'Нужна проверка копии'}[state.status]||'На этом устройстве');
export function cloudView(state,mode='signin'){
  const title=`<div class="section-header"><h2>Облачный дневник</h2><span class="badge ${state.status==='saved'?'':'neutral'}" data-cloud-label>${cloudLabel(state)}</span></div>`;
  if(!state.configured)return `${title}<p class="muted small">Подключение базы готовится. Пока записи сохраняются только в этом браузере. После подключения здесь появится вход и синхронизация между телефоном и компьютером.</p>`;
  if(state.recovery)return `${title}<p class="muted small mb">Задай новый пароль для своего дневника.</p><form id="cloud-password-form"><div class="field"><label for="cloud-new-password">Новый пароль</label><input id="cloud-new-password" name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></div><button class="btn primary mt" type="submit">Сохранить пароль</button></form>`;
  if(state.user){
    let content=`<p class="cloud-email">${esc(state.user.email||'Личный аккаунт')}</p>`;
    if(state.status==='cache-error'){
      content+=`<p class="muted small mb">Локальная копия аккаунта повреждена. Скачай исходный файл перед восстановлением из облака.</p><div class="cloud-choices">${button('raw-cache','Скачать исходную копию')}${button('reset-cache','Восстановить подключение')}</div>`;
    }else if(!state.linked){
      content+=`<p class="muted small mb">Подключаем дневник автоматически. Тренировки и английский будут сохраняться в твоём аккаунте вместе.</p>`;
    }else{
      content+=`<p class="muted small mb"><b>Автосохранение включено.</b> Тренировки, подходы, программы, замеры, планы, английский и настройки сохраняются после изменений. На другом устройстве достаточно войти в тот же аккаунт. Без сети изменения ждут отправки.</p>`;
      if(state.status==='conflict')content+=`<div class="notice mb">На устройстве и в облаке есть разные записи. Один раз выбери нужную версию — затем автосохранение продолжится.<div class="mt">${button('conflict','Сравнить версии','primary')}</div></div>`;
      content+=`<div class="cloud-detail" data-cloud-detail>${state.syncedAt?'Последняя синхронизация: '+esc(new Date(state.syncedAt).toLocaleString('ru-RU')):'Первое сохранение ожидает связи.'}</div><p class="small muted mt">Локальный кэш включён. Изменения отправляются автоматически; обновления с других устройств проверяем раз в 5 минут, когда приложение открыто. Можно обновить сразу.</p><div class="cloud-choices mt">${button('sync',['error','offline'].includes(state.status)?'Повторить сейчас':'Обновить из облака')}${button('backup','Копия до замены')}</div>`;
    }
    if(state.error)content+=`<p class="cloud-error" role="status">${esc(state.error)}</p>`;
    return title+content+`<div class="mt">${button('logout','Выйти из аккаунта')}</div>`;
  }
  const signup=mode==='signup',reset=mode==='reset';
  return `${title}<p class="muted small mb">Войди в один аккаунт на телефоне и компьютере. Твой дневник доступен только тебе.</p><form id="cloud-auth-form" data-mode="${mode}"><div class="field"><label for="cloud-email">Электронная почта</label><input id="cloud-email" name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" required></div>${reset?'':`<div class="field mt"><label for="cloud-password">Пароль${signup?' · от 8 символов':''}</label><input id="cloud-password" name="password" type="password" autocomplete="${signup?'new-password':'current-password'}" minlength="${signup?8:1}" maxlength="128" required></div>`}<button class="btn primary mt" type="submit">${reset?'Отправить письмо':signup?'Создать аккаунт':'Войти'}</button><p class="cloud-error" id="cloud-auth-error" role="status"></p></form><div class="cloud-choices mt">${button(signup||reset?'signin':'signup',signup||reset?'Уже есть аккаунт':'Регистрация','text-btn')}${!reset?button('reset','Забыл пароль','text-btn'):''}</div>${state.error?`<p class="cloud-error">${esc(state.error)}</p>`:''}`;
}
