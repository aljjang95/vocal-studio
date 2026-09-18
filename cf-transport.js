(function(root){
  'use strict';
  var PROTOCOL='vs-cf-1';
  var auditMs=300000;
  var stateMode='unknown';
  function headers(extra){return Object.assign({'X-VS-Protocol':PROTOCOL},extra||{});}
  async function api(path,options){
    options=options||{};
    var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},20000);
    var cancel=function(){controller.abort();};
    if(options.signal){if(options.signal.aborted)cancel();else options.signal.addEventListener('abort',cancel,{once:true});}
    try{
      var init={method:options.method||'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:controller.signal,headers:headers(options.headers)};
      if(options.body!==undefined){init.body=typeof options.body==='string'?options.body:JSON.stringify(options.body);init.headers['Content-Type']=init.headers['Content-Type']||'application/json';}
      var response=await fetch(path,init),text=await response.text(),data;
      try{data=JSON.parse(text);}catch(error){return Object.assign(new Error('invalid-json-response'),{status:response.status});}
      if(response.redirected||!data||typeof data!=='object'||Array.isArray(data))return new Error('invalid-api-response');
      if(!response.ok&&!options.allow)return Object.assign(new Error(data.error||('http-'+response.status)),{status:response.status,data:data});
      return {response:response,data:data,text:text};
    }finally{clearTimeout(timer);if(options.signal)options.signal.removeEventListener('abort',cancel);}
  }
  function validRecord(value){
    return value&&['active','staged'].includes(value.mode)&&Number.isSafeInteger(value.revision)&&value.revision>=0&&
      value.state&&typeof value.state==='object'&&!Array.isArray(value.state)&&typeof value.hash==='string'&&/^[a-f0-9]{64}$/.test(value.hash);
  }
  function canonical(value){
    if(Array.isArray(value))return value.map(canonical);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(function(key){return[key,canonical(value[key])];}));
    return value;
  }
  function snapshot(payload){
    if(payload===null)return{exists:false,metadata:{fromCache:false,hasPendingWrites:false},data:function(){return null;}};
    if(!validRecord(payload))throw new Error('invalid-state-response');
    stateMode=payload.mode;
    var data=Object.assign({},payload.state||{}, {_vsSyncRevision:payload.revision||0});
    return{exists:true,metadata:{fromCache:false,hasPendingWrites:false},data:function(){return JSON.parse(JSON.stringify(data));},mode:stateMode};
  }
  async function readState(signal){
    var result=await api('/api/state',{allow:true,signal:signal});
    if(result instanceof Error)throw result;
    if(result.response.status===404&&result.data.error==='missing-state'){stateMode='missing';return snapshot(null);}
    if(!result.response.ok)throw Object.assign(new Error((result.data&&result.data.error)||('http-'+result.response.status)),{status:result.response.status});
    return snapshot(result.data);
  }
  function eventUrl(){
    if(!root.location||!root.location.host)return null;
    return(root.location.protocol==='https:'?'wss://':'ws://')+root.location.host+'/api/events?protocol='+encodeURIComponent(PROTOCOL);
  }
  function makeDoc(){
    return{
      onSnapshot:function(options,onValue,onError){
        var stopped=false,auditTimer=null,reconnectTimer=null,controller=null,socket=null,reading=false,queued=false,lastRevision=null,retryMs=1000;
        function clearTimers(){if(auditTimer)clearTimeout(auditTimer);if(reconnectTimer)clearTimeout(reconnectTimer);auditTimer=reconnectTimer=null;}
        function scheduleAudit(){if(stopped)return;if(auditTimer)clearTimeout(auditTimer);auditTimer=setTimeout(function(){refresh().finally(scheduleAudit);},auditMs);}
        async function refresh(){
          if(stopped)return;if(reading){queued=true;return;}reading=true;controller=new AbortController();
          try{var value=await readState(controller.signal);if(stopped)return;var data=value.exists?value.data():null;lastRevision=data?Number(data._vsSyncRevision||0):null;onValue(value);}
          catch(error){if(!stopped&&onError)onError(error);}
          finally{controller=null;reading=false;if(queued&&!stopped){queued=false;refresh();}}
        }
        function scheduleReconnect(){
          if(stopped)return;if(reconnectTimer)clearTimeout(reconnectTimer);
          reconnectTimer=setTimeout(function(){reconnectTimer=null;refresh().finally(connect);},retryMs);
          retryMs=Math.min(retryMs*2,30000);
        }
        function connect(){
          if(stopped)return;var url=eventUrl();if(!url||!root.WebSocket){scheduleAudit();return;}
          try{socket=new root.WebSocket(url);}catch(error){scheduleReconnect();return;}
          socket.onopen=function(){retryMs=1000;scheduleAudit();};
          socket.onmessage=function(event){try{var msg=JSON.parse(event.data);if(msg.type==='state-changed'&&msg.revision!==lastRevision)refresh();}catch(error){}};
          socket.onerror=function(){};
          socket.onclose=function(){socket=null;if(auditTimer){clearTimeout(auditTimer);auditTimer=null;}scheduleReconnect();};
        }
        refresh().finally(connect);
        return function(){stopped=true;clearTimers();if(controller)controller.abort();if(socket)try{socket.close();}catch(error){}socket=null;};
      },
      get:function(){return readState();}
    };
  }
  function database(){
    return{
      collection:function(){return{doc:function(){return makeDoc();}};},
      runTransaction:async function(fn){
        for(var attempt=0;attempt<4;attempt++){
          var before=await readState();
          if(!before.exists)throw new Error('missing-remote');
          var base=before.data(),written=null;
          var tx={get:async function(){return before;},set:function(doc,value){written=JSON.parse(JSON.stringify(value));}};
          var result=await fn(tx);
          if(!written)return result;
          if(before.mode!=='active')throw new Error('staged-readonly');
          var baseRevision=Number(base._vsSyncRevision||0);delete written._vsSyncRevision;
          var requestId=(root.crypto&&root.crypto.randomUUID?root.crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));
          var committed=await api('/api/commit',{method:'POST',body:{baseRevision:baseRevision,requestId:requestId,state:written}});
          if(committed instanceof Error){
            if(committed.status===409&&committed.data?.error==='revision-conflict'&&attempt<3)continue;
            throw committed;
          }
          var ack=committed.data,expected=Object.assign({},base,written);delete expected._vsSyncRevision;
          if(!validRecord(ack)||ack.ok!==true||ack.mode!=='active'||ack.revision!==baseRevision+1||
            JSON.stringify(canonical(ack.state))!==JSON.stringify(canonical(expected)))throw new Error('invalid-commit-acknowledgement');
          return result;
        }
      }
    };
  }
  async function session(){
    var result=await api('/api/session');if(result instanceof Error)throw result;return result.data;
  }
  function dataUrlBlob(data,contentType){
    if(typeof data!=='string'||data.slice(0,5)!=='data:')throw new Error('invalid-data-url');
    var comma=data.indexOf(',');if(comma<5)throw new Error('invalid-data-url');
    var meta=data.slice(5,comma),payload=data.slice(comma+1),parts=meta.split(';');
    var type=contentType||parts[0]||'application/octet-stream';
    var bytes;
    if(parts.indexOf('base64')>=0){
      var binary=atob(payload);bytes=new Uint8Array(binary.length);
      for(var i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    }else bytes=new TextEncoder().encode(decodeURIComponent(payload));
    return new Blob([bytes],{type:type});
  }
  async function uploadDataUrl(data,pointer,contentType){
    var blob=dataUrlBlob(data,contentType),type=blob.type||contentType||'application/octet-stream';
    var result=await fetch('/api/media/'+encodeURIComponent(pointer),{
      method:'PUT',credentials:'same-origin',headers:headers({'Content-Type':type}),body:blob
    });
    var payload=await result.json().catch(function(){return{};});
    if(!result.ok)throw Object.assign(new Error(payload.error||('http-'+result.status)),{status:result.status});
    return payload.url;
  }
  function mediaUrl(pointer){return '/api/media/'+encodeURIComponent(pointer);}
  root.VCFTransport={protocol:PROTOCOL,api:api,session:session,database:database,uploadDataUrl:uploadDataUrl,mediaUrl:mediaUrl,
    stateMode:function(){return stateMode;},setPollMs:function(ms){auditMs=Math.max(60000,Number(ms)||300000);},setAuditMs:function(ms){auditMs=Math.max(60000,Number(ms)||300000);}};
})(typeof globalThis!=='undefined'?globalThis:this);
