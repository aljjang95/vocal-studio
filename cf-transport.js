(function(root){
  'use strict';
  var PROTOCOL='vs-cf-1';
  var pollMs=2500;
  var stateMode='unknown';
  function headers(extra){return Object.assign({'X-VS-Protocol':PROTOCOL},extra||{});}
  async function api(path,options){
    options=options||{};
    var init={method:options.method||'GET',credentials:'same-origin',headers:headers(options.headers)};
    if(options.body!==undefined){
      init.body=typeof options.body==='string'?options.body:JSON.stringify(options.body);
      init.headers['Content-Type']=init.headers['Content-Type']||'application/json';
    }
    var response=await fetch(path,init);
    var text=await response.text();
    var data=null;try{data=text?JSON.parse(text):null;}catch(e){}
    if(!response.ok&&!options.allow)return Object.assign(new Error((data&&data.error)||('http-'+response.status)),{status:response.status,data:data});
    return {response:response,data:data,text:text};
  }
  function snapshot(payload){
    if(!payload||payload.error==='missing-state')return{exists:false,metadata:{fromCache:false,hasPendingWrites:false},data:function(){return null;}};
    stateMode=payload.mode||'unknown';
    var data=Object.assign({},payload.state||{}, {_vsSyncRevision:payload.revision||0});
    return{exists:true,metadata:{fromCache:false,hasPendingWrites:false},data:function(){return JSON.parse(JSON.stringify(data));},mode:stateMode};
  }
  async function readState(){
    var result=await api('/api/state',{allow:true});
    if(result instanceof Error)throw result;
    if(result.response.status===404)return snapshot(null);
    if(!result.response.ok)throw Object.assign(new Error((result.data&&result.data.error)||('http-'+result.response.status)),{status:result.response.status});
    return snapshot(result.data);
  }
  function makeDoc(){
    return{
      onSnapshot:function(options,onValue,onError){
        var stopped=false,timer=null;
        async function tick(){
          if(stopped)return;
          try{onValue(await readState());}catch(error){if(onError)onError(error);}
          if(!stopped)timer=setTimeout(tick,pollMs);
        }
        tick();
        return function(){stopped=true;if(timer)clearTimeout(timer);};
      },
      get:function(){return readState();}
    };
  }
  function database(){
    return{
      collection:function(){return{doc:function(){return makeDoc();}};},
      runTransaction:async function(fn){
        var before=await readState();
        if(!before.exists)throw new Error('missing-remote');
        var base=before.data(),written=null;
        var tx={get:async function(){return before;},set:function(doc,value){written=JSON.parse(JSON.stringify(value));}};
        var result=await fn(tx);
        if(!written)return result;
        if(stateMode!=='active')throw new Error('staged-readonly');
        var baseRevision=Number(base._vsSyncRevision||0);delete written._vsSyncRevision;
        var requestId=(root.crypto&&root.crypto.randomUUID?root.crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));
        var committed=await api('/api/commit',{method:'POST',body:{baseRevision:baseRevision,requestId:requestId,state:written}});
        if(committed instanceof Error)throw committed;
        return result;
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
    }else{
      bytes=new TextEncoder().encode(decodeURIComponent(payload));
    }
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
  root.VCFTransport={
    protocol:PROTOCOL,
    api:api,
    session:session,
    database:database,
    uploadDataUrl:uploadDataUrl,
    mediaUrl:mediaUrl,
    stateMode:function(){return stateMode;},
    setPollMs:function(ms){pollMs=Math.max(100,Number(ms)||2500);}
  };
})(typeof globalThis!=='undefined'?globalThis:this);
