import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const port=8798;
const origin=`http://127.0.0.1:${port}`;
const persist=path.join(root,'tmp','cf-test-state');
rmSync(persist,{recursive:true,force:true});
execFileSync(process.execPath,['scripts/build-worker.mjs'],{cwd:root,stdio:'inherit'});
const worker=spawn(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'dev','--config','wrangler.local.jsonc','--ip','127.0.0.1','--port',String(port),'--local','--persist-to',persist],{cwd:root,stdio:['ignore','pipe','pipe']});
let logs='';worker.stdout.on('data',d=>{logs+=d});worker.stderr.on('data',d=>{logs+=d});
const checks=[];
function check(name,condition){assert.ok(condition,name);checks.push(name);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitReady(){
  for(let i=0;i<300;i++){
    try{const r=await fetch(origin+'/api/session',{headers:{'X-VS-Protocol':'vs-cf-1'}});if(r.ok)return;}catch{}
    await sleep(100);
  }
  throw new Error('wrangler local server did not become ready\n'+logs);
}
async function api(pathname,options={}){
  const method=options.method||'GET';
  const headers={'X-VS-Protocol':'vs-cf-1',...(options.headers||{})};
  if(!['GET','HEAD'].includes(method)&&options.origin!==false)headers.Origin=origin;
  let body=options.body;
  if(body!==undefined&&!(body instanceof Uint8Array)&&typeof body!=='string'){
    headers['Content-Type']='application/json';body=JSON.stringify(body);
  }
  return fetch(origin+pathname,{method,headers,body});
}
function stopWorker(){
  if(process.platform==='win32')spawnSync('taskkill',['/PID',String(worker.pid),'/T','/F'],{stdio:'ignore'});
  else worker.kill('SIGTERM');
}
try{
  await waitReady();
  let r=await api('/api/session');let j=await r.json();
  check('session protocol',r.status===200&&j.protocol==='vs-cf-1');
  r=await api('/api/state');check('empty destination is 404',r.status===404);
  r=await fetch(origin+'/api/state');check('protocol required',r.status===400);
  const source={students:[{id:'s1',name:'QA'}],logs:[],consults:[],payments:[],inquiries:[],weekOvr:{w1:{s1:{time:'10:00'}}},futureRoot:{keep:true}};
  r=await api('/api/import',{method:'POST',body:{state:source}});j=await r.json();
  check('empty import stages only',r.status===201&&j.mode==='staged');
  const stagedHash=j.hash;
  r=await api('/api/import',{method:'POST',body:{state:source}});check('second import rejected',r.status===409);
  r=await api('/api/commit',{method:'POST',body:{baseRevision:0,requestId:'staged-commit-0001',state:source}});
  check('staged state is read-only',r.status===409);
  r=await api('/api/export');j=await r.json();
  check('private export records staged readback',r.status===200&&j.hash===stagedHash&&j.mode==='staged');
  r=await api('/api/activate',{method:'POST',body:{hash:stagedHash}});j=await r.json();
  check('verified readback activates',r.status===200&&j.mode==='active');
  const intent={baseRevision:0,requestId:'commit-idempotent-0001',state:{weekOvr:{w1:{s1:{time:'11:00'}}}}};
  r=await api('/api/commit',{method:'POST',body:intent});j=await r.json();
  check('active commit succeeds',r.status===200&&j.revision===1&&j.state.futureRoot.keep===true);
  r=await api('/api/commit',{method:'POST',body:intent});
  check('exact request replay is idempotent',r.status===200&&r.headers.get('X-VS-Idempotent-Replay')==='1');
  r=await api('/api/commit',{method:'POST',body:{...intent,state:{weekOvr:{w1:{s1:{time:'12:00'}}}}}});
  check('request id cannot change payload',r.status===409);
  const [a,b]=await Promise.all([
    api('/api/commit',{method:'POST',body:{baseRevision:1,requestId:'cas-a-0001',state:{weekOvr:{w1:{s1:{time:'12:00'}}}}}}),
    api('/api/commit',{method:'POST',body:{baseRevision:1,requestId:'cas-b-0001',state:{weekOvr:{w1:{s1:{time:'13:00'}}}}}})
  ]);
  check('concurrent CAS admits one writer',[a.status,b.status].sort().join(',')==='200,409');
  r=await api('/api/state');j=await r.json();
  check('unknown root fields survive commits',j.state.futureRoot.keep===true&&j.revision===2);
  r=await api('/api/commit',{method:'POST',origin:false,body:{baseRevision:2,requestId:'origin-missing-0001',state:{}}});
  check('mutation requires exact origin',r.status===403);
  const pointer='studios/default/media/qa/test.bin';
  const mediaPath='/api/media/'+encodeURIComponent(pointer);
  const bytes=Uint8Array.from({length:16},(_,i)=>i);
  r=await api(mediaPath,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes});j=await r.json();
  check('private R2 upload succeeds',r.status===201&&j.pointer===pointer);
  r=await api(mediaPath,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes});
  check('identical media retry succeeds',r.status===200&&r.headers.get('X-VS-Idempotent-Replay')==='1');
  r=await api(mediaPath,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:new Uint8Array([99])});
  check('different media cannot overwrite pointer',r.status===409);
  r=await api(mediaPath,{headers:{Range:'bytes=2-5'}});const partial=new Uint8Array(await r.arrayBuffer());
  check('range request returns exact bytes',r.status===206&&partial.length===4&&partial[0]===2&&partial[3]===5);
  r=await api(mediaPath,{method:'HEAD'});check('media HEAD works',r.status===200&&r.headers.get('Content-Length')==='16');
  r=await api(mediaPath,{headers:{Range:'bytes=99-120'}});check('invalid range returns 416',r.status===416);
  r=await api(mediaPath,{method:'DELETE'});check('media delete API is absent',r.status===405);
  const oversize=new Uint8Array(20*1024*1024+1);
  r=await api('/api/media/'+encodeURIComponent('studios/default/media/qa/too-large.bin'),{
    method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:oversize
  });
  check('oversize media rejected',r.status===413);
  const assets=['/','/index.html','/vs-sync.js','/cf-transport.js','/cf-migration.js','/sw.js','/manifest.json','/icon-192.png','/icon-512.png'];
  for(const asset of assets){r=await fetch(origin+asset,{redirect:'manual'});check('asset '+asset,r.status===200);}
  r=await fetch(origin+'/not-allowlisted.txt');check('unknown asset is hidden',r.status===404);
  console.log(JSON.stringify({ok:true,checks:checks.length,names:checks},null,2));
}catch(error){
  console.error(logs);throw error;
}finally{
  stopWorker();
}
