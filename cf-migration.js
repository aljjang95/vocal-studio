(function(root){
  'use strict';
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object'){
      var out={};Object.keys(value).sort().forEach(function(key){out[key]=stable(value[key]);});return out;
    }
    return value;
  }
  async function digest(value){
    var bytes=new TextEncoder().encode(JSON.stringify(stable(value)));
    var hash=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(hash)).map(function(x){return x.toString(16).padStart(2,'0');}).join('');
  }
  async function privateExport(){
    if(!root.VCFTransport)throw new Error('cloudflare-transport-unavailable');
    var result=await root.VCFTransport.api('/api/export',{method:'GET'});
    if(result instanceof Error)throw result;
    return result.data;
  }
  async function verifyReadback(source,exported){
    if(!exported||!exported.state||!exported.hash)return{ok:false,reason:'missing-export'};
    var sourceHash=await digest(source),readbackHash=await digest(exported.state);
    return{ok:sourceHash===readbackHash&&readbackHash===exported.hash,sourceHash:sourceHash,readbackHash:readbackHash,serverHash:exported.hash,mode:exported.mode,revision:exported.revision};
  }
  root.VCFMigration={digest:digest,privateExport:privateExport,verifyReadback:verifyReadback};
})(typeof globalThis!=='undefined'?globalThis:this);
