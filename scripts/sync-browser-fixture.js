/* Synthetic transport for browser QA only. Never shipped with the application. */
(function(){
  var user={uid:'qa-synthetic-admin',email:'qa@example.invalid',emailVerified:true};
  var auth={currentUser:user,onAuthStateChanged:function(fn){window.__qaAuth=fn;return function(){};}};
  function snapshot(data){var saved=structuredClone(data);return {exists:true,metadata:{fromCache:false,hasPendingWrites:false},data:function(){return structuredClone(saved);}};}
  var listener=null;
  window.__qaEmit=function(data){if(listener)listener(snapshot(data));};
  var doc={onSnapshot:function(options,fn){listener=fn;return function(){listener=null;};},get:async function(){return snapshot(await window.qaRead());}};
  var db={settings:function(){},collection:function(name){if(name!=='studio')throw Error('QA blocks other collections');return {doc:function(id){if(id!=='data')throw Error('QA blocks other documents');return doc;}};},
    runTransaction:async function(callback){
      for(var attempt=0;attempt<5;attempt++){
        var remote=await window.qaRead(),write=null;
        var result=await callback({get:async function(){return snapshot(remote);},set:function(ref,data){write=structuredClone(data);}});
        if(!write)return result;
        var ack=await window.qaCommit({expected:remote._vsSyncRevision||0,data:write});
        if(ack.ok){window.__qaEmit(write);return result;}
      }
      throw Error('QA contention limit');
    }
  };
  function firestore(){return db;}firestore.FieldValue={serverTimestamp:function(){return 'qa-server-timestamp';}};
  function getAuth(){return auth;}getAuth.GoogleAuthProvider=function(){};
  window.firebase={apps:[{}],initializeApp:function(){},auth:getAuth,firestore:firestore};
})();
