/* Dedicated, owner-keyed durable overflow. Never opens or modifies the media database. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.VSBackup=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function create(options){
    options=options||{};
    var idb=options.indexedDB,timeout=options.timeoutMs||10000;
    function open(){
      return new Promise(function(resolve,reject){
        var request,done=false,timer=setTimeout(function(){fail(Error('backup-open-timeout'));},timeout);
        function fail(error){if(done)return;done=true;clearTimeout(timer);reject(error);}
        if(!idb){fail(Error('backup-unavailable'));return;}
        try{request=idb.open('vsSyncBackupDB',1);}catch(error){fail(error);return;}
        request.onupgradeneeded=function(){if(!request.result.objectStoreNames.contains('backups'))request.result.createObjectStore('backups');};
        request.onerror=function(){fail(request.error||Error('backup-open-error'));};
        request.onblocked=function(){fail(Error('backup-open-blocked'));};
        request.onsuccess=function(){
          var db=request.result;if(done){db.close();return;}
          done=true;clearTimeout(timer);db.onversionchange=function(){db.close();};resolve(db);
        };
      });
    }
    // A request's success event is not a transaction commit. Read back using a separate,
    // completed transaction only after strict-durability readwrite completion.
    function transaction(db,mode,action,onSuccess){
      return new Promise(function(resolve,reject){
        var tx,request,result,done=false,timer=setTimeout(function(){
          try{if(tx)tx.abort();}catch(error){}fail(Error('backup-transaction-timeout'));
        },timeout);
        function fail(error){if(done)return;done=true;clearTimeout(timer);reject(error);}
        try{tx=db.transaction('backups',mode,mode==='readwrite'?{durability:'strict'}:undefined);
          tx.oncomplete=function(){if(done)return;done=true;clearTimeout(timer);resolve(result);};
          tx.onabort=function(){fail(tx.error||Error('backup-abort'));};
          tx.onerror=function(){fail(tx.error||Error('backup-transaction-error'));};
          request=action(tx.objectStore('backups'));
          request.onsuccess=function(){result=request.result;if(onSuccess)onSuccess(result);};
          request.onerror=function(){fail(request.error||Error('backup-request-error'));};
        }catch(error){try{if(tx)tx.abort();}catch(ignored){}fail(error);}
      });
    }
    return {
      async put(key,text){
        if(typeof key!=='string'||typeof text!=='string')throw Error('invalid-backup');
        var db=await open();
        try{
          await transaction(db,'readwrite',function(store){return store.put(text,key);});
          var saved=await transaction(db,'readonly',function(store){return store.get(key);});
          if(saved!==text)throw Error('backup-readback');return saved;
        }finally{db.close();}
      },
      async list(prefix){
        if(typeof prefix!=='string'||!prefix)throw Error('invalid-backup-prefix');
        var db=await open();
        try{
          // Only owner-scoped keys/values are read; no other account's payload is loaded.
          var range=(options.IDBKeyRange||globalThis.IDBKeyRange).bound(prefix,prefix+'\uffff');
          var rows=[];
          await transaction(db,'readonly',function(store){return store.openCursor(range);},function(cursor){
            // Capture request.result once in the helper, before continue() makes it pending.
            if(cursor){rows.push({key:cursor.key,text:cursor.value});cursor.continue();}
          });return rows;
        }finally{db.close();}
      }
    };
  }
  return {create:create};
});
