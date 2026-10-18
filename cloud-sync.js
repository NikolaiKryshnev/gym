// Offline-first journal synchronization. All writes use an atomic revision check.
import {personalJournal,hasPersonalJournal,sameJournal} from './cloud-bootstrap.js?v=2.3.0';
export class JournalSync {
  constructor({remote,storage,key,validate,onData=()=>{},onChange=()=>{},onBackup=()=>{},now=()=>Date.now(),readTtl=300000}) {
    Object.assign(this,{remote,storage,key,validate,onData,onChange,onBackup,now,readTtl});
    this.state=null;this.conflict=null;this.status='unlinked';this.lastError=null;this.inFlight=null;
    this.retryAt=0;this.failures=0;
    try {const cached=JSON.parse(storage.getItem(key)||'null');if(cached){
      if(!Number.isSafeInteger(cached.revision)||cached.revision<0||typeof cached.dirty!=='boolean'||(cached.bootstrap!==undefined&&typeof cached.bootstrap!=='boolean'))throw Error('Invalid cache');
      this.state={...cached,payload:validate(cached.payload)};
    }} catch(error) {this.lastError=error;this.status='cache-error';}
  }
  emit(status=this.status){this.status=status;this.onChange(this);}
  write(next){
    // Save the revision and journal atomically; a storage failure never advances the local base.
    this.storage.setItem(this.key,JSON.stringify(next));this.state=next;
  }
  restore(){if(this.state){this.onData(structuredClone(this.state.payload));this.emit(this.state.dirty?'pending':'saved');return true;}return false;}
  initialize(payload){
    if(this.state||this.status==='cache-error')return false;
    const valid=this.validate(personalJournal(payload));
    this.write({payload:valid,revision:0,dirty:true,syncedAt:null,bootstrap:true});
    this.onData(structuredClone(valid));this.emit('pending');return true;
  }
  saveLocal(payload){
    if(!this.state)return false;
    const valid=this.validate(payload);
    if(this.conflict?.externalTab){
      this.onBackup(valid);this.state={...this.state,payload:valid,dirty:true};
      this.emit('conflict');return true;
    }
    if(JSON.stringify(valid)===JSON.stringify(this.state.payload))return true;
    this.write({...this.state,payload:valid,dirty:true});
    this.emit(this.conflict?'conflict':'pending');return true;
  }
  async connect(payload,choice){
    if(this.state)throw Error('Дневник уже подключён.');
    const row=await this.remote.read();
    if(choice==='cloud'){
      if(!row)throw Error('В облаке пока нет дневника. Сначала сохрани записи с основного устройства.');
      const valid=this.validate(row.payload);
      this.onBackup(payload);this.write({payload:valid,revision:row.revision,dirty:false,syncedAt:row.updated_at});
      this.onData(structuredClone(valid));this.emit('saved');
    }else if(choice==='local'){
      if(payload.demo)throw Error('Демо-дневник не отправляется в облако. Сначала начни свою историю.');
      if(row)throw Error('В облаке уже есть дневник. Открой его, затем перенеси записи через резервную копию.');
      this.write({payload:this.validate(payload),revision:0,dirty:true,syncedAt:null});
      this.emit('pending');await this.sync();
    }else throw Error('Выбери источник дневника.');
  }
  async sync({force=false}={}){
    if(this.inFlight)return this.inFlight;
    if(!this.state||this.conflict||this.status==='cache-error')return;
    if(!force&&(this.now()<this.retryAt||(!this.state.dirty&&!this.state.bootstrap&&Number.isFinite(this.state.checkedAt)&&this.now()>=this.state.checkedAt&&this.now()-this.state.checkedAt<this.readTtl)))return;
    this.inFlight=this.performSync().finally(()=>{this.inFlight=null;});
    return this.inFlight;
  }
  async performSync(){
    this.lastError=null;this.emit('syncing');
    try{
      const start=this.state,needsRead=start.bootstrap||!start.dirty;
      const row=needsRead?await this.remote.read():{revision:start.revision};
      if(needsRead&&row&&(!Number.isSafeInteger(row.revision)||row.revision<1))throw Error('Некорректная версия облачного дневника.');
      if(start.bootstrap){
        if(row){
          const valid=this.validate(row.payload),local=this.state.payload;
          if(hasPersonalJournal(local)&&!sameJournal(local,valid)){this.conflict=row;this.emit('conflict');return;}
          this.onBackup(local);this.write({payload:valid,revision:row.revision,dirty:false,syncedAt:row.updated_at,checkedAt:this.now()});
          this.failures=0;this.retryAt=0;
          this.onData(structuredClone(valid));this.emit('saved');return;
        }
        this.write({...this.state,bootstrap:false});
      }
      if((row?.revision||0)!==start.revision){
        if(this.state.dirty||!row){this.conflict=row||{revision:0,payload:null};this.emit('conflict');return;}
        const valid=this.validate(row.payload);
        this.write({payload:valid,revision:row.revision,dirty:false,syncedAt:row.updated_at,checkedAt:this.now()});
        this.failures=0;this.retryAt=0;
        this.onData(structuredClone(valid));this.emit('saved');return;
      }
      if(!this.state.dirty){this.write({...this.state,checkedAt:this.now()});this.failures=0;this.retryAt=0;this.emit('saved');return;}
      const sent=structuredClone(this.state.payload),expected=this.state.revision;
      let saved;
      try{saved=await this.remote.save(sent,expected);}catch(error){
        if(error.code==='40001'){
          const latest=await this.remote.read();
          if(latest&&sameJournal(latest.payload,this.state.payload)){this.write({payload:this.validate(latest.payload),revision:latest.revision,dirty:false,syncedAt:latest.updated_at,checkedAt:this.now()});this.emit('saved');return;}
          this.conflict=latest||{revision:0,payload:null};this.emit('conflict');return;
        }throw error;
      }
      if(!Number.isSafeInteger(saved?.revision)||saved.revision<=expected)throw Error('База не подтвердила сохранение.');
      // Input may continue while the request is in flight; keep the newer local draft queued.
      const changed=JSON.stringify(this.state.payload)!==JSON.stringify(sent);
      this.write({...this.state,revision:saved.revision,dirty:changed,syncedAt:saved.updated_at,checkedAt:this.now()});
      this.failures=0;this.retryAt=0;
      this.emit(changed?'pending':'saved');
    }catch(error){this.lastError=error;this.failures++;this.retryAt=this.now()+Math.min(900000,30000*2**Math.min(5,this.failures-1));this.emit('error');}
  }
  receiveExternal(raw){
    if(!this.state||!raw)return;
    try{
      const cached=JSON.parse(raw);if(!Number.isSafeInteger(cached.revision)||cached.revision<0||typeof cached.dirty!=='boolean')throw Error('Invalid cache');
      const valid=this.validate(cached.payload);
      if(sameJournal(valid,this.state.payload)){if(cached.revision>=this.state.revision){this.state={...cached,payload:valid};if(this.conflict?.externalTab)this.conflict=null;this.emit(cached.dirty?'pending':'saved');}return;}
      if(!this.state.dirty&&!cached.dirty&&cached.revision>=this.state.revision){this.state={...cached,payload:valid};this.conflict=null;this.onData(structuredClone(valid));this.emit('saved');return;}
      this.conflict={externalTab:true};this.emit('conflict');
    }catch(error){this.lastError=error;this.emit('error');}
  }
  async resolve(choice){
    if(!this.conflict)return;
    if(this.conflict.externalTab){
      const cached=JSON.parse(this.storage.getItem(this.key)||'null');
      if(!cached)throw Error('Копия другой вкладки недоступна. Перезагрузи приложение.');
      this.validate(cached.payload);
      if(choice==='cloud'){
        this.onBackup(this.state.payload);this.state=cached;this.conflict=null;
        this.onData(structuredClone(cached.payload));this.emit(cached.dirty?'pending':'saved');return;
      }
      this.onBackup(cached.payload);this.conflict=null;
      this.write({...this.state,revision:cached.revision,dirty:true});await this.sync();return;
    }
    if(choice==='cloud'){
      const row=await this.remote.read();if(!row)throw Error('Облачная копия отсутствует.');
      const valid=this.validate(row.payload);this.onBackup(this.state.payload);
      this.write({payload:valid,revision:row.revision,dirty:false,syncedAt:row.updated_at});
      this.conflict=null;this.onData(structuredClone(valid));this.emit('saved');
    }else if(choice==='local'){
      // Read again: a second edit on another device must still be detected by CAS.
      const row=await this.remote.read();if(row)this.onBackup(row.payload);
      this.write({...this.state,revision:row?.revision||0,dirty:true,bootstrap:false});this.conflict=null;
      await this.sync();
    }
  }
}
