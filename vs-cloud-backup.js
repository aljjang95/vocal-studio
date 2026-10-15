/* Journal backup storage for Vocal Studio. Device commit/readback precedes the bounded cloud request.
   Full journals stay in memory and, when they fit, in sessionStorage until a durable pointer replaces them.
   This module never touches the media database. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.VSCloudBackup=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var PROTOCOL='vs-cf-1',ENDPOINT='/api/backups',POINTER='vsCloudJournalPointer',INSTANCE_PREFIX='vsC_sync_instance_v1:';
  var host=typeof globalThis!=='undefined'?globalThis:this;
  function isObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
  function prefixFor(namespace,principal){return 'vsC_sync_v1:'+encodeURIComponent(namespace+':'+principal)+':backup:';}
  /* A row is accepted only when it is a version 1 journal for exactly this owner and namespace. */
  function validateJournal(text,principal,namespace){
    var journal;
    try{journal=JSON.parse(text);}catch(error){throw Error('invalid-backup');}
    if(!isObject(journal)||journal.version!==1)throw Error('invalid-backup');
    if(journal.owner!==principal||journal.namespace!==namespace)throw Error('invalid-backup-owner');
    if(!Number.isSafeInteger(journal.revision)||journal.revision<0)throw Error('invalid-backup');
    if(!isObject(journal.base)||!isObject(journal.local)||!Array.isArray(journal.recovery))throw Error('invalid-backup');
    if(journal.overflowPrevious!==undefined&&!Array.isArray(journal.overflowPrevious))throw Error('invalid-backup');
    return journal;
  }
  function collect(rows,prefix,principal,namespace){
    var map=new Map();
    rows.forEach(function(row){
      if(!isObject(row)||typeof row.key!=='string'||typeof row.text!=='string'||row.key.indexOf(prefix)!==0||row.key.length===prefix.length)throw Error('invalid-backup');
      validateJournal(row.text,principal,namespace);
      if(map.has(row.key))throw Error('invalid-backup');
      map.set(row.key,row.text);
    });
    return map;
  }
  /* Same key, different bytes: the local (unsent) journal stays the head and the cloud journal is kept
     once in overflowPrevious, so nothing is dropped. The Controller persists this expanded text itself. */
  function mergeRow(cloudText,localText,head){
    var local=JSON.parse(localText),selected=head==='cloud'?JSON.parse(cloudText):local,other=head==='cloud'?local:JSON.parse(cloudText);
    if(!Array.isArray(selected.overflowPrevious))selected.overflowPrevious=[];
    var otherText=JSON.stringify(other);
    if(!selected.overflowPrevious.some(function(value){return JSON.stringify(value)===otherText;}))selected.overflowPrevious.push(other);
    return JSON.stringify(selected);
  }
  function request(fetchFn,url,init,timeoutMs){
    return new Promise(function(resolve,reject){
      var done=false,aborter=typeof AbortController==='function'?new AbortController():null,timer;
      function finish(fn,value){if(done)return;done=true;clearTimeout(timer);fn(value);}
      timer=setTimeout(function(){finish(reject,transportError('cloud-backup-timeout'));try{if(aborter)aborter.abort();}catch(error){}},timeoutMs);
      if(aborter)init.signal=aborter.signal;
      Promise.resolve().then(function(){return fetchFn(url,init);}).then(null,function(error){
        throw transportError(error&&error.message||'cloud-backup-network');
      }).then(function(response){
        if(!response||!response.ok)throw transportError('cloud-backup-http-'+(response?response.status:'none'));
        // An answer that arrived but cannot be parsed is not "offline": it must not be treated as empty.
        return Promise.resolve().then(function(){return response.json();}).then(null,function(){throw Error('cloud-backup-response');});
      }).then(function(body){finish(resolve,body);},function(error){finish(reject,error);});
    });
  }
  /* Only network failure, timeout and HTTP status errors are transport trouble that may use the device copy. */
  function transportError(message){var error=Error(message);error.transport=true;return error;}
  function canon(value){
    if(Array.isArray(value))return '['+value.map(canon).join(',')+']';
    if(isObject(value))return '{'+Object.keys(value).sort().map(function(k){return JSON.stringify(k)+':'+canon(value[k]);}).join(',')+'}';
    return JSON.stringify(value);
  }
  var KNOWN=['version','namespace','owner','revision','base','local','recovery','overflowPrevious'];
  /* True only when the new journal text still holds everything a device-only journal held: it is the same
     journal, carries it whole in its overflowPrevious chain, or keeps its pending data (local and recovery
     snapshots) as its own base, local, recovery or previous-journal data. A journal with ACK or other
     metadata must be carried whole. */
  function includes(text,variantText){
    if(text===variantText)return true;
    var next,variant;
    try{next=JSON.parse(text);variant=JSON.parse(variantText);}catch(error){return false;}
    var whole=new Set(),data=new Set();
    (function walk(journal){
      if(!isObject(journal))return;
      whole.add(canon(journal));data.add(canon(journal.base));data.add(canon(journal.local));
      (Array.isArray(journal.recovery)?journal.recovery:[]).forEach(function(item){data.add(canon(item));});
      (Array.isArray(journal.overflowPrevious)?journal.overflowPrevious:[]).forEach(walk);
    })(next);
    if(whole.has(canon(variant)))return true;
    if(Object.keys(variant).some(function(k){return KNOWN.indexOf(k)<0;}))return false;
    if(!data.has(canon(variant.local)))return false;
    if(!(Array.isArray(variant.recovery)?variant.recovery:[]).every(function(item){return data.has(canon(item));}))return false;
    return (Array.isArray(variant.overflowPrevious)?variant.overflowPrevious:[]).every(function(entry){return includes(text,JSON.stringify(entry));});
  }
  function create(options){
    options=options||{};
    var localStore=options.localStore||null,ownerOf=options.owner,namespace=options.namespace,timeoutMs=options.timeoutMs||10000;
    var latest=new Map(),sequence=0,chains=new Map(),incorporated=new Map();
    function fetchFn(url,init){
      var f=options.fetch||host.fetch;
      if(typeof f!=='function')throw Error('cloud-backup-unavailable');
      return f.call(host,url,init);
    }
    function capture(){
      var principal=typeof ownerOf==='function'?ownerOf():null;
      if(typeof namespace!=='string'||!namespace)throw Error('invalid-backup-namespace');
      if(typeof principal!=='string'||!principal)throw Error('auth-required');
      return principal;
    }
    function changed(principal){var now;try{now=ownerOf();}catch(error){return true;}return now!==principal;}
    function headers(extra){var h={'X-VS-Protocol':PROTOCOL};if(extra)for(var k in extra)h[k]=extra[k];return h;}
    async function cloudPut(key,text){
      var body=await request(fetchFn,ENDPOINT,{method:'POST',credentials:'same-origin',
        headers:headers({'Content-Type':'application/json'}),body:JSON.stringify({key:key,text:text})},timeoutMs);
      // The server must read the stored value back; anything but the exact key and text is not durable.
      if(!isObject(body)||body.key!==key||body.text!==text)throw Error('cloud-backup-readback');
    }
    async function cloudList(prefix,principal){
      var rows=[],cursor=null,seen=new Set();
      do{
        if(changed(principal))throw Error('owner-changed');
        var url=ENDPOINT+'?prefix='+encodeURIComponent(prefix)+'&metadata=1';
        if(cursor!==null)url+='&cursor='+encodeURIComponent(cursor);
        var body=await request(fetchFn,url,{method:'GET',credentials:'same-origin',headers:headers()},timeoutMs);
        if(!isObject(body)||!Array.isArray(body.rows)||!(body.cursor===null||typeof body.cursor==='string'))throw Error('cloud-backup-response');
        if(body.rows.length>100)throw Error('cloud-backup-response');
        body.rows.forEach(function(row){
          if(!isObject(row)||typeof row.key!=='string'||row.key.indexOf(prefix)!==0||row.key.length===prefix.length)throw Error('invalid-backup');
          if(rows.some(function(existing){return existing.key===row.key;}))throw Error('invalid-backup');
          var legacy=row.length===null&&row.revision===null&&row.pending===true&&row.recoveryCount===0;
          if(typeof row.sha256!=='string'||!/^[a-f0-9]{64}$/.test(row.sha256)||(!legacy&&(!Number.isSafeInteger(row.length)||row.length<0||
             !Number.isSafeInteger(row.revision)||row.revision<0))||typeof row.pending!=='boolean'||!Number.isSafeInteger(row.recoveryCount)||row.recoveryCount<0)throw Error('invalid-backup');
          rows.push({key:row.key,sha256:row.sha256,length:row.length,revision:row.revision,pending:row.pending,recoveryCount:row.recoveryCount});
        });
        var next=body.cursor;
        if(next===null)cursor=null;else{if(!next||seen.has(next))throw Error('cloud-backup-response');seen.add(next);cursor=next;}
      }while(cursor!==null);
      return {rows:rows};
    }
    async function cloudRow(prefix,key,principal){
      if(changed(principal))throw Error('owner-changed');
      var url=ENDPOINT+'?prefix='+encodeURIComponent(prefix)+'&key='+encodeURIComponent(key),body=await request(fetchFn,url,{method:'GET',credentials:'same-origin',headers:headers()},timeoutMs);
      if(!isObject(body)||!Array.isArray(body.rows)||body.rows.length>1)throw Error('cloud-backup-response');
      if(!body.rows.length)throw Error('cloud-backup-missing');
      var row=body.rows[0];if(!isObject(row)||row.key!==key||typeof row.text!=='string')throw Error('invalid-backup');
      validateJournal(row.text,principal,namespace);return row.text;
    }
    // kind 'own': written by put() in this page, so a later put on the same key derives from it.
    // kind 'listed': read by list() from the device store; deleted only when the new text includes it.
    function remember(key,text,kind){
      var entry=incorporated.get(key);
      if(!entry){entry={own:new Set(),listed:new Set()};incorporated.set(key,entry);}
      entry[kind].add(text);
    }
    function revisionOf(text){try{return JSON.parse(text).revision;}catch(error){return Infinity;}}
    /* Once the cloud holds the newer journal, drop only device copies it supersedes. Every delete compares
       the stored bytes first, so a newer offline save is never removed. */
    async function cleanup(key,text,principal){
      if(!localStore||typeof localStore.remove!=='function')return;
      var entry=incorporated.get(key)||{own:new Set(),listed:new Set()},targets=[];
      entry.own.forEach(function(old){if(revisionOf(text)>=revisionOf(old))targets.push([old,'own']);});
      entry.listed.forEach(function(old){if(includes(text,old))targets.push([old,'listed']);});
      if(targets.every(function(item){return item[0]!==text;}))targets.push([text,null]);
      for(var i=0;i<targets.length;i++){
        if(changed(principal))throw Error('owner-changed');
        var old=targets[i][0],kind=targets[i][1];
        try{await localStore.remove(key,old);if(kind)entry[kind].delete(old);}catch(error){}
      }
      if(entry.own.size||entry.listed.size)incorporated.set(key,entry);else incorporated.delete(key);
    }
    function notify(key,text,kind){
      if(typeof options.onDurable!=='function')return;
      // The save is already durable; a failing session pointer must not undo that.
      try{options.onDurable(key,text,kind);}catch(error){}
    }
    async function write(key,text,principal,seq){
      try{
        if(changed(principal))throw Error('owner-changed');
        var device=false,cloud=false;
        try{
          if(!localStore||typeof localStore.put!=='function')throw Error('backup-unavailable');
          var prior=incorporated.get(key),retainListed=false;
          if(prior)prior.listed.forEach(function(raw){if(!includes(text,raw))retainListed=true;});
          // The device slot can contain unsent intent from a prior page, including ACK metadata.
          // A new cloud save cannot destroy it before the inclusion check used by cleanup.
          if(retainListed)throw Error('backup-preserve-listed');
          if(changed(principal))throw Error('owner-changed');
          var saved=await localStore.put(key,text);
          if(saved!==text)throw Error('backup-readback');
          device=true;remember(key,text,'own');
        }catch(error){if(error&&error.message==='owner-changed')throw error;}
        if(changed(principal))throw Error('owner-changed');
        try{await cloudPut(key,text);cloud=true;}catch(error){cloud=false;}
        if(changed(principal))throw Error('owner-changed');
        if(cloud){
          if(changed(principal))throw Error('owner-changed');
          await cleanup(key,text,principal);
        }else if(!device)throw Error('backup-unavailable');
        if(changed(principal))throw Error('owner-changed');
        if(latest.get(key)===seq)notify(key,text,cloud?'cloud':'device');
        return text;
      }finally{if(latest.get(key)===seq)latest.delete(key);}
    }
    // Writes to one key run in call order, so an older request can never overwrite a newer one.
    function enqueue(key,job){
      var next=(chains.get(key)||Promise.resolve()).then(job),tail=next.catch(function(){});
      chains.set(key,tail);
      tail.then(function(){if(chains.get(key)===tail)chains.delete(key);});
      return next;
    }
    async function put(key,text){
      if(typeof key!=='string'||typeof text!=='string')throw Error('invalid-backup');
      var principal=capture(),prefix=prefixFor(namespace,principal);
      if(key.indexOf(prefix)!==0||key.length===prefix.length)throw Error('invalid-backup-owner');
      validateJournal(text,principal,namespace);
      var seq=++sequence;latest.set(key,seq);
      return enqueue(key,function(){return write(key,text,principal,seq);});
    }
    async function list(prefix){
      var principal=capture(),expected=prefixFor(namespace,principal);
      if(typeof prefix!=='string'||!prefix)throw Error('invalid-backup-prefix');
      if(prefix!==expected)throw Error('invalid-backup-owner');
      var cloudRows=null,localRows=null,hintInfo=null,current=null;
      if(typeof options.resumeHint==='function')hintInfo=options.resumeHint();
      if(hintInfo!==null&&hintInfo!==undefined){
        if(!isObject(hintInfo)||typeof hintInfo.key!=='string'||hintInfo.key.indexOf(expected)!==0||hintInfo.key.length===expected.length)throw Error('invalid-backup-hint');
        if(hintInfo.hint!==null&&hintInfo.hint!==undefined&&typeof hintInfo.hint!=='string')throw Error('invalid-backup-hint');
      }
      // A session pointer names the tab instance that wrote it. A pointer left by an earlier page in this
      // tab (back/forward, sign-in redirect, duplicated tab) belongs to that instance's journal, which is
      // listed below as another tab's row. It is never evidence for this page's own key.
      var hintPointer=hintInfo&&hintInfo.hint!==null&&hintInfo.hint!==undefined?pointerValue(hintInfo.hint):null;
      if(hintPointer&&typeof hintPointer.instance==='string'&&hintInfo.key!==expected+hintPointer.instance){
        hintInfo={key:hintInfo.key,hint:null};hintPointer=null;
      }
      var legacyHint=!!hintPointer&&hintPointer.instance===undefined;
      if(typeof options.currentKey==='function')current=options.currentKey();
      if(current!==null&&current!==undefined&&
         (typeof current!=='string'||current.indexOf(expected)!==0||current.length===expected.length))throw Error('invalid-backup-key');
      // Only transport trouble falls back to the device copy; rows that fail validation never do.
      try{cloudRows=await cloudList(expected,principal);}catch(error){if(!error||!error.transport)throw error;cloudRows=null;}
      if(changed(principal))throw Error('owner-changed');
      if(localStore&&typeof localStore.list==='function'){localRows=await localStore.list(expected);if(changed(principal))throw Error('owner-changed');}
      // Without the cloud list and without any device journal, an empty answer could hide a cloud-only journal.
      if(cloudRows===null&&(!localRows||!localRows.length))throw Error('cloud-backup-unavailable');
      var local=localRows?collect(localRows,expected,principal,namespace):new Map();
      var cloud=new Map(),hint=hintInfo&&hintInfo.hint!==null&&hintInfo.hint!==undefined?hintInfo.hint:null,required=new Set(local.keys());
      if(current)required.add(current);
      if(hintInfo)required.add(hintInfo.key);
      if(cloudRows){
        cloudRows.rows.forEach(function(meta){if(meta.pending||meta.recoveryCount>0)required.add(meta.key);});
        // An instance-less (older) pointer whose key is absent from the verified cloud list may belong to an
        // earlier page of this tab. Load same-length rows so the exact text can be checked below.
        if(legacyHint&&!local.has(hintInfo.key)&&!cloudRows.rows.some(function(row){return row.key===hintInfo.key;}))
          cloudRows.rows.forEach(function(meta){if(meta.length===hintPointer.length)required.add(meta.key);});
        if(changed(principal))throw Error('owner-changed');
        var loads=[];required.forEach(function(key){
          var meta=cloudRows.rows.find(function(row){return row.key===key;});if(!meta)return;
          loads.push(cloudRow(expected,key,principal).then(function(text){cloud.set(key,text);}));
        });
        await Promise.all(loads);
        if(changed(principal))throw Error('owner-changed');
      }
      if(hint){
        var hintKey=hintInfo.key,hasHintKey=local.has(hintKey)||cloud.has(hintKey);
        if(!hasHintKey){
          // Only a complete cloud list can prove this key holds nothing. Then an exact match under another
          // key identifies the pointer's real owner; without the cloud list this still fails closed.
          var foreign=false;
          if(legacyHint&&cloudRows){
            cloud.forEach(function(text){if(matchesHint(text,hint))foreign=true;});
            local.forEach(function(text){if(matchesHint(text,hint))foreign=true;});
          }
          if(!foreign)throw Error('backup-hint-missing');
          hint=null;
        }
        else if(!((local.has(hintKey)&&matchesHint(local.get(hintKey),hint))||(cloud.has(hintKey)&&matchesHint(cloud.get(hintKey),hint))))throw Error('backup-hint-mismatch');
      }
      var merged=[];
      cloud.forEach(function(text,key){
        if(!local.has(key)||local.get(key)===text)merged.push({key:key,text:text});
        else{
          var keyHint=hint&&hintInfo.key===key?hint:null,cloudMatches=keyHint&&matchesHint(text,keyHint),localMatches=keyHint&&matchesHint(local.get(key),keyHint);
          if(keyHint&&cloudMatches===localMatches)throw Error('backup-hint-mismatch');
          merged.push({key:key,text:mergeRow(text,local.get(key),keyHint&&cloudMatches?'cloud':'local')});
        }
      });
      local.forEach(function(text,key){
        remember(key,text,'listed');
        if(!cloud.has(key))merged.push({key:key,text:text});
      });
      return merged;
    }
    return {put:put,list:list};
  }
  /* Synchronous Storage-like facade. Full journals live in memory and are mirrored to session when they fit.
     A session pointer is written only by markDurable() after the matching cloud/IndexedDB write, and a
     pointer reads as null so a reload loads the journal from durable storage. */
  function checksum(text){var h=2166136261;for(var i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return (h>>>0).toString(16).padStart(8,'0');}
  function validInstance(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(value);}
  function pointerFor(text,instance){
    var pointer={};pointer[POINTER]=1;pointer.length=text.length;pointer.digest=checksum(text);
    if(validInstance(instance))pointer.instance=instance;
    return JSON.stringify(pointer);
  }
  function pointerValue(hint){
    if(isObject(hint))return hint;
    if(typeof hint!=='string'||hint.length>256||hint.charAt(0)!=='{')return null;
    try{return JSON.parse(hint);}catch(error){return null;}
  }
  function matchesHint(text,hint){
    if(typeof text!=='string')return false;
    var pointer=pointerValue(hint);
    return !!pointer&&pointer[POINTER]===1&&Number.isSafeInteger(pointer.length)&&pointer.length>=0&&
      typeof pointer.digest==='string'&&/^[0-9a-f]{8}$/.test(pointer.digest)&&pointer.length===text.length&&pointer.digest===checksum(text);
  }
  function journalKey(key){return typeof key==='string'&&/^vsC_sync_v1:[^:]+$/.test(key);}
  function isPointer(raw){
    if(typeof raw!=='string'||raw.length>256||raw.charAt(0)!=='{')return false;
    try{var value=JSON.parse(raw);return isObject(value)&&value[POINTER]===1&&Number.isSafeInteger(value.length)&&value.length>=0&&
      typeof value.digest==='string'&&/^[0-9a-f]{8}$/.test(value.digest)&&(value.instance===undefined||validInstance(value.instance));}catch(error){return false;}
  }
  function journalStore(session,codec){
    codec=codec||{};
    var memory=new Map(),hidden=new Set();
    function sessionGet(key){try{return session?session.getItem(key):null;}catch(error){return null;}}
    function getItem(key){
      key=String(key);
      if(memory.has(key))return memory.get(key);
      if(hidden.has(key))return null;
      var raw=sessionGet(key);
      // A preserved legacy journal stays readable until a durable replacement is marked.
      if(raw===null||raw===undefined||isPointer(raw))return null;
      if(journalKey(key)&&typeof codec.decode==='function'){
        var decoded;
        try{decoded=codec.decode(raw);}catch(error){throw error;}
        if(typeof decoded!=='string')throw Error('journal-decode');
        return decoded;
      }
      return raw;
    }
    function setItem(key,value){
      key=String(key);value=String(value);
      memory.set(key,value);hidden.delete(key);
      var stored=value;
      if(journalKey(key)){
        if(typeof codec.encode==='function'){
          try{stored=codec.encode(value);if(typeof stored!=='string')return false;
            if(typeof codec.decode==='function'&&codec.decode(stored)!==value)return false;
          }catch(error){return false;}
        }
        try{session.setItem(key,stored);return sessionGet(key)===stored;}catch(error){return false;}
      }
      // Only the tiny instance id is mirrored to the session; reclaimed and backup rows stay memory-only.
      if(key.indexOf(INSTANCE_PREFIX)===0){try{session.setItem(key,value);return sessionGet(key)===value;}catch(error){return false;}}
      return false;
    }
    function removeItem(key){
      key=String(key);memory.delete(key);hidden.add(key);
      var raw=sessionGet(key);
      // Never delete a legacy full journal here; only pointers and the instance id are ours to remove.
      if(raw!==null&&(isPointer(raw)||key.indexOf(INSTANCE_PREFIX)===0)){try{session.removeItem(key);}catch(error){}}
    }
    function markDurable(key,text,instance){
      key=String(key);
      if(!journalKey(key)||typeof text!=='string'||!memory.has(key)||memory.get(key)!==text)return false;
      var pointer=pointerFor(text,instance);
      try{session.setItem(key,pointer);return session.getItem(key)===pointer;}catch(error){return false;}
    }
    function readDurableHint(key){
      key=String(key);if(!journalKey(key))return null;
      var raw=sessionGet(key);return isPointer(raw)?raw:null;
    }
    function names(){
      var seen=new Set(),out=[];
      function add(key){if(!seen.has(key)){seen.add(key);if(getItem(key)!==null)out.push(key);}}
      memory.forEach(function(value,key){add(key);});
      try{if(session)for(var i=0;i<session.length;i++){var key=session.key(i);if(key!==null&&key!==undefined)add(key);}}catch(error){}
      return out;
    }
    return {getItem:getItem,setItem:setItem,removeItem:removeItem,markDurable:markDurable,readDurableHint:readDurableHint,matchesHint:matchesHint,
      key:function(index){var list=names();return index>=0&&index<list.length?list[index]:null;},
      get length(){return names().length;}};
  }
  return {create:create,journalStore:journalStore,isPointer:isPointer,matchesHint:matchesHint};
});
