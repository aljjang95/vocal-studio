/* Vocal Studio synchronization protocol. No network access without an injected adapter. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VSSync=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var LISTS=['students','logs','consults','payments','inquiries'];
  var own=function(object,key){return Object.prototype.hasOwnProperty.call(object,key);};
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object'){
      var out=Object.create(null);
      Object.keys(value).sort().forEach(function(key){out[key]=stable(value[key]);});
      return out;
    }
    return value;
  }
  function equal(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
  function put(object,key,value){Object.defineProperty(object,key,{value:value,writable:true,enumerable:true,configurable:true});}
  function safeMedia(entry){
    if(!entry||typeof entry!=='object')return entry;
    var out=Object.assign({},entry);delete out._mediaKey;delete out._photoKey;
    if(typeof out.data==='string'&&out.data.length>50000)out.data='[saved]';
    return out;
  }
  function safeRow(row){
    if(!row||typeof row!=='object')return row;
    var out=Object.assign({},row);delete out._photoKey;delete out._mediaKey;
    if(typeof out.photo==='string'&&out.photo.length>5000)out.photo='';
    ['audios','videos'].forEach(function(field){if(Array.isArray(out[field]))out[field]=out[field].map(safeMedia);});
    if(out.consentRec)out.consentRec=safeMedia(out.consentRec);
    return out;
  }
  function retainLocal(row,previous){
    if(!row||typeof row!=='object'||!previous)return row;
    var out=Object.assign({},row);
    ['_photoKey','_mediaKey'].forEach(function(key){if(!out[key]&&previous[key])out[key]=previous[key];});
    function carry(entry,old){
      if(!entry||!old||rowKey(entry)===null||rowKey(entry)!==rowKey(old))return entry;
      var item=Object.assign({},entry);
      if(old._mediaKey)item._mediaKey=old._mediaKey;
      if(item.data==='[saved]'&&typeof old.data==='string'&&old.data.length>50000)item.data=old.data;
      return item;
    }
    ['audios','videos'].forEach(function(field){
      var old=indexed(previous[field]||[]);if(!old||!Array.isArray(out[field]))return;
      out[field]=out[field].map(function(entry){return carry(entry,old.get(rowKey(entry)));});
    });
    if(out.consentRec)out.consentRec=carry(out.consentRec,previous.consentRec);
    return out;
  }
  function normalize(data){
    var out={};
    LISTS.forEach(function(field){
      if(data[field]!=null&&!Array.isArray(data[field]))throw Error('invalid-collection:'+field);
      out[field]=clone(data[field]||[]).map(safeRow);
    });
    if(data.weekOvr!=null&&(typeof data.weekOvr!=='object'||Array.isArray(data.weekOvr)))throw Error('invalid-week-map');
    out.weekOvr=clone(data.weekOvr||{});
    Object.keys(out.weekOvr).forEach(function(week){
      if(!out.weekOvr[week]||typeof out.weekOvr[week]!=='object'||Array.isArray(out.weekOvr[week]))throw Error('invalid-week');
    });
    return out;
  }
  function rowKey(row){return row&&['string','number'].indexOf(typeof row.id)>=0&&String(row.id)!==''?typeof row.id+':'+row.id:null;}
  function indexed(list){
    var map=new Map();
    for(var i=0;i<list.length;i++){var key=rowKey(list[i]);if(key===null||map.has(key))return null;map.set(key,list[i]);}
    return map;
  }
  function diff(base,local){
    base=normalize(base);local=normalize(local);var operations=[];
    function add(kind,field,key,before,after,beforeExists,afterExists,week){
      if(beforeExists===afterExists&&equal(before,after))return;
      operations.push({kind:kind,field:field,key:key,week:week,before:before,after:after,beforeExists:beforeExists,afterExists:afterExists});
    }
    LISTS.forEach(function(field){
      var a=indexed(base[field]),b=indexed(local[field]);
      if(!a||!b){add('field',field,null,base[field],local[field],true,true);return;}
      new Set(Array.from(a.keys()).concat(Array.from(b.keys()))).forEach(function(key){add('row',field,key,a.get(key),b.get(key),a.has(key),b.has(key));});
    });
    new Set(Object.keys(base.weekOvr).concat(Object.keys(local.weekOvr))).forEach(function(week){
      var a=own(base.weekOvr,week)?base.weekOvr[week]:{},b=own(local.weekOvr,week)?local.weekOvr[week]:{};
      new Set(Object.keys(a).concat(Object.keys(b))).forEach(function(key){add('week','weekOvr',key,a[key],b[key],own(a,key),own(b,key),week);});
    });
    return operations;
  }
  function apply(remote,operations){
    var value=normalize(remote),conflicts=[];
    operations.forEach(function(op){
      var target=value,key=op.field,index=-1,exists=true,current;
      if(op.kind==='row'){
        target=value[op.field];index=target.findIndex(function(row){return rowKey(row)===op.key;});
        key=index;exists=index>=0;current=target[index];
        if(indexed(target)===null){conflicts.push(op);return;}
      }else if(op.kind==='week'){
        target=own(value.weekOvr,op.week)?value.weekOvr[op.week]:{};key=op.key;
        exists=own(target,key);current=target[key];
      }else current=target[key];
      if(exists===op.afterExists&&equal(current,op.after))return;
      if(exists!==op.beforeExists||!equal(current,op.before)){conflicts.push(op);return;}
      if(op.kind==='row'){
        if(!op.afterExists)target.splice(index,1);
        else if(index<0)target.push(clone(op.after));
        else target[index]=clone(op.after);
      }else{
        if(op.kind==='week'&&!own(value.weekOvr,op.week))put(value.weekOvr,op.week,target);
        if(op.afterExists)put(target,key,clone(op.after));else delete target[key];
      }
    });
    return {value:value,conflicts:conflicts};
  }
  function revision(data){
    var value=data._vsSyncRevision==null?0:data._vsSyncRevision;
    if(!Number.isSafeInteger(value)||value<0)throw Error('invalid-revision');return value;
  }
  function Controller(adapter){
    this.a=adapter;this.epoch=0;this.state=null;this.owner=null;this.unsubscribe=null;
    this.flight=null;this.deferred=null;this.latest=null;this.ready=false;this.blocked=false;this.hold=null;
    var instanceKey='vsC_sync_instance_v1:'+encodeURIComponent(adapter.namespace);
    this.instance=adapter.forkInstance?null:adapter.store.getItem(instanceKey);
    if(!this.instance){
      this.instance=adapter.instanceId||String(Date.now())+'-'+Math.random().toString(36).slice(2);
      adapter.store.setItem(instanceKey,this.instance);
    }
  }
  Controller.prototype.status=function(mode,detail){this.mode=mode;this.a.status(mode,detail);};
  Controller.prototype.unready=function(){this.ready=false;if(this.a.ready)this.a.ready(false);};
  Controller.prototype.guard=function(epoch){return epoch===this.epoch&&this.owner&&this.a.owner()===this.owner;};
  Controller.prototype.persist=function(next){
    var text=JSON.stringify(next);
    try{
      this.a.store.setItem(this.key,text);
      if(this.a.store.getItem(this.key)!==text)throw Error('journal-readback');
      if(this.a.backupStore){
        var store=this.a.backupStore,backupKey=this.key+':backup:'+this.instance;
        store.setItem(backupKey,text);
        if(!next.ack&&!diff(next.base,next.local).length){
          var duplicates=[];
          for(var i=0;i<store.length&&duplicates.length<64;i++){
            var key=store.key(i);
            if(key!==backupKey&&key&&key.indexOf(this.key+':backup:')===0&&store.getItem(key)===text)duplicates.push(key);
          }
          duplicates.forEach(function(key){try{store.removeItem(key);}catch(error){}});
        }
      }
      this.state=next;this.blocked=false;this.hold=null;return true;
    }catch(error){this.blocked=true;this.hold='storage';this.status('storage-error');return false;}
  };
  Controller.prototype.display=function(){
    if(this.a.editing&&this.a.editing())return;
    try{this.a.setData(clone(this.state.local));this.a.render();}
    catch(error){this.blocked=true;this.hold='apply';this.status('apply-error');}
  };
  Controller.prototype.disconnect=function(){
    this.epoch++;if(this.unsubscribe)try{this.unsubscribe();}catch(error){}
    this.unsubscribe=null;this.ready=false;this.blocked=false;this.hold=null;this.doc=null;this.state=null;this.flight=null;this.deferred=null;this.latest=null;this.owner=null;
    if(this.a.ready)this.a.ready(false);
  };
  Controller.prototype.pending=function(){return this.state?diff(this.state.base,this.state.local).length:0;};
  Controller.prototype.connect=function(){
    var owner=this.a.owner();if(owner===this.owner&&this.unsubscribe&&!this.unbound)return;
    this.disconnect();if(!owner){this.status('auth-required');return;}
    this.owner=owner;this.key='vsC_sync_v1:'+encodeURIComponent(this.a.namespace+':'+owner);
    var epoch=this.epoch,self=this;
    try{
      var hydrated=this.a.hydrated?!!this.a.hydrated():true;
      var durable=(!hydrated&&this.a.resumeData)?this.a.resumeData(owner):null;
      var resumeFromDurable=!!durable;
      var startup=normalize(resumeFromDurable?durable:(hydrated?this.a.getData():{}));
      var raw=this.a.store.getItem(this.key);
      if(raw){
        var saved=JSON.parse(raw);
        if(saved.version!==1||saved.owner!==owner||saved.namespace!==this.a.namespace)throw Error('invalid-journal');
        saved.base=normalize(saved.base);saved.local=normalize(saved.local);
        if(!Number.isSafeInteger(saved.revision)||saved.revision<0)throw Error('invalid-journal-revision');
        if(!Array.isArray(saved.recovery))throw Error('invalid-recovery');
        if(resumeFromDurable&&!equal(startup,saved.local)){
          if(!saved.recovery.some(function(data){return equal(data,saved.local);}))saved.recovery.push(clone(saved.local));
          saved.local=startup;saved.resumeConflict=true;
          if(!this.persist(saved))return;
        }else if(!equal(startup,saved.local)){
          if(!saved.recovery.some(function(data){return equal(data,startup);}))saved.recovery.push(startup);
          if(saved.ack||diff(saved.base,saved.local).length)saved.resumeConflict=true;
          if(!this.persist(saved))return;
        }
        this.state=saved;if(saved.ack&&!saved.resumeConflict)this.finishAck();
        if(!this.unbound&&!this.blocked&&(!saved.resumeConflict||resumeFromDurable))this.display();
      }else if(resumeFromDurable){
        try{this.a.setData(clone(startup));this.a.render();}
        catch(error){this.blocked=true;this.hold='apply';this.status('apply-error');return;}
      }
      this.initialLocal=startup;
      this.doc=this.a.database().collection('studio').doc('data');
      if(this.a.doc)this.a.doc(this.doc);
      var unsubscribe=this.doc.onSnapshot({includeMetadataChanges:true},function(snapshot){
        if(!self.guard(epoch))return;
        var meta=snapshot.metadata||{};
        if(meta.fromCache!==false||meta.hasPendingWrites!==false){self.status('unconfirmed');return;}
        if(!snapshot.exists){self.unready();self.status('missing-remote');return;}
        try{self.receive(snapshot.data());}catch(error){self.unready();self.blocked=true;self.status('invalid-remote');}
      },function(){if(!self.guard(epoch))return;self.unready();self.status('offline');});
      if(this.guard(epoch))this.unsubscribe=unsubscribe;else unsubscribe();
    }catch(error){this.blocked=true;this.status('storage-error');}
  };
  Controller.prototype.receive=function(data){
    var rev=revision(data),remote=normalize(data),self=this;
    if(this.state&&rev<this.state.revision)return;
    this.latest=clone(data);
    if(this.state&&this.state.resumeConflict){this.blocked=true;this.status('conflict');return;}
    if(this.hold){this.deferred=clone(data);return;}
    if(this.flight||(this.state&&this.state.ack)||(this.blocked&&(this.mode==='storage-error'||this.mode==='apply-error'))||(this.a.editing&&this.a.editing())){this.deferred=clone(data);this.status('deferred');return;}
    var next;
    if(!this.state){
      var previous=normalize(this.a.getData());
      next={version:1,namespace:this.a.namespace,owner:this.owner,revision:rev,base:remote,local:remote,recovery:equal(previous,remote)?[]:[previous]};
    }else{
      if(rev===this.state.revision&&!equal(remote,this.state.base)){this.blocked=true;this.status('legacy-conflict');return;}
      var merged=apply(remote,diff(this.state.base,this.state.local));
      if(merged.conflicts.length){this.blocked=true;this.status('conflict',merged.conflicts.length);return;}
      next=Object.assign({},this.state,{revision:rev,base:remote,local:merged.value});
    }
    var changed=!this.state||!equal(this.state.local,next.local);
    if(!this.persist(next))return;
    this.ready=true;this.unbound=false;if(this.a.ready)this.a.ready(true);
    if(changed)this.display();if(this.blocked)return;
    this.status(this.pending()?'pending':(this.state.recovery.length?'recovery':'synced'));
    if(this.pending()&&!this.scheduled){this.scheduled=true;var scheduledEpoch=this.epoch;this.a.later(function(){self.scheduled=false;if(self.guard(scheduledEpoch))self.flush();});}
  };
  Controller.prototype.drain=function(){
    if(this.a.editing&&this.a.editing())return;
    if(this.state&&this.state.ack)this.finishAck();
    if(this.flight||this.blocked)return;
    if(this.deferred){var data=this.deferred;this.deferred=null;this.receive(data);}
    this.flush();
  };
  Controller.prototype.save=function(){
    if(!this.state||this.a.owner()!==this.owner){this.unbound=true;this.status('local-only');return Promise.resolve(false);}
    var next=Object.assign({},this.state,{local:normalize(this.a.getData())});
    if(!this.persist(next))return Promise.resolve(false);
    if(this.state.resumeConflict){this.blocked=true;this.status('conflict');return Promise.resolve(false);}
    this.status(this.pending()?'pending':(this.ready?'synced':'unconfirmed'));
    return this.flush();
  };
  Controller.prototype.flush=function(){
    var self=this,epoch=this.epoch;
    if(!this.guard(epoch)||!this.state||this.state.resumeConflict||!this.ready||this.blocked||this.flight)return Promise.resolve(false);
    if(this.a.editing&&this.a.editing())return Promise.resolve(false);
    if(this.a.frozen()){this.status('frozen');return Promise.resolve(false);}
    var base=clone(this.state.base),sent=clone(this.state.local),operations=diff(base,sent),baseRevision=this.state.revision;
    if(!operations.length)return Promise.resolve(true);
    var token={};this.flight=token;this.status('saving');
    var request=Promise.resolve().then(function(){return self.a.database().runTransaction(async function(transaction){
      if(!self.guard(epoch)||self.a.frozen())throw Error('session-or-freeze');
      var snapshot=await transaction.get(self.doc);
      if(!self.guard(epoch)||self.a.frozen())throw Error('session-or-freeze');
      if(!snapshot.exists)throw Error('missing-remote');
      var raw=snapshot.data(),rev=revision(raw),remote=normalize(raw);
      if(rev<baseRevision||(rev===baseRevision&&!equal(remote,base)))throw Error('legacy-conflict');
      var merged=apply(remote,operations);
      if(merged.conflicts.length)throw Error('write-conflict');
      if(equal(remote,merged.value))return {value:remote,revision:rev};
      if(rev===Number.MAX_SAFE_INTEGER)throw Error('revision-exhausted');
      transaction.set(self.doc,{...raw,...merged.value,_vsSyncRevision:rev+1,updatedAt:self.a.timestamp()});
      return {value:merged.value,revision:rev+1};
    });});
    return request.then(function(committed){
      if(!self.guard(epoch)||self.flight!==token)return false;
      var next=Object.assign({},self.state,{ack:{sent:sent,value:committed.value,revision:committed.revision}});
      if(!self.persist(next)){self.flight=null;return false;}
      self.status('deferred');self.finishAck();self.drain();return true;
    },function(error){
      if(!self.guard(epoch)||self.flight!==token)return false;
      self.flight=null;self.status(error.message==='write-conflict'||error.message==='legacy-conflict'?'conflict':'write-error');
      if(self.deferred){var deferred=self.deferred;self.deferred=null;self.receive(deferred);}
      return false;
    });
  };
  Controller.prototype.finishAck=function(){
    if(!this.state||this.state.resumeConflict||!this.state.ack||(this.a.editing&&this.a.editing()))return false;
    var ack=this.state.ack,rebased=apply(ack.value,diff(ack.sent,this.state.local));
    if(rebased.conflicts.length){this.flight=null;this.blocked=true;this.status('conflict',rebased.conflicts.length);return false;}
    var next=Object.assign({},this.state,{base:ack.value,local:rebased.value,revision:ack.revision});delete next.ack;
    if(!this.persist(next)){this.flight=null;return false;}
    this.flight=null;this.display();
    if(!this.blocked)this.status(this.pending()?'pending':(this.state.recovery.length?'recovery':'synced'));
    return true;
  };
  Controller.prototype.retry=function(){
    if(!this.a.owner()){this.status('auth-required');return Promise.resolve(false);}
    if(this.a.owner()!==this.owner||!this.unsubscribe)this.connect();
    if(this.hold==='storage'&&this.state){
      if(!this.persist(Object.assign({},this.state,{local:normalize(this.a.getData())})))return Promise.resolve(false);
    }
    if(this.hold==='apply'&&this.state){this.hold=null;this.blocked=false;this.display();}
    if(!this.doc||this.hold)return Promise.resolve(false);
    var self=this,epoch=this.epoch;
    return this.doc.get({source:'server'}).then(function(snapshot){
      if(!self.guard(epoch))return false;
      if(!snapshot.exists){self.unready();self.status('missing-remote');return false;}
      self.receive(snapshot.data());self.drain();return self.flush();
    }).catch(function(){if(self.guard(epoch)){self.unready();self.status('offline');}return false;});
  };
  Controller.prototype.useServer=function(){
    if(!this.latest||!this.guard(this.epoch)||(this.flight&&!this.state.ack)||(this.a.editing&&this.a.editing()))return false;
    var remote=normalize(this.latest),recovery=this.state?(this.state.recovery||[]).slice():[];
    if(this.state&&!equal(this.state.local,remote))recovery.push(clone(this.state.local));
    var next={version:1,namespace:this.a.namespace,owner:this.owner,revision:revision(this.latest),base:remote,local:remote,recovery:recovery};
    if(!this.persist(next))return false;
    this.flight=null;this.deferred=null;this.ready=true;this.display();this.status('recovery');return true;
  };
  Controller.prototype.exportData=function(){
    var result={version:1,current:this.state,backups:[]},store=this.a.backupStore;
    if(store&&this.key)for(var i=0;i<store.length;i++){
      var key=store.key(i);if(key&&key.indexOf(this.key+':backup:')===0){
        try{result.backups.push(JSON.parse(store.getItem(key)));}catch(error){result.backups.push({unreadable:true});}
      }
    }
    return clone(result);
  };
  return {normalize:normalize,retainLocal:retainLocal,equal:equal,diff:diff,apply:apply,Controller:Controller,create:function(adapter){return new Controller(adapter);}};
});
