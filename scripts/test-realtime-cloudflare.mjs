import assert from 'node:assert/strict';
import {execFileSync,spawn,spawnSync} from 'node:child_process';
import {rmSync} from 'node:fs';
import path from 'node:path';
import {WebSocket} from 'ws';
const root=path.resolve(import.meta.dirname,'..'),port=8797,origin=`http://127.0.0.1:${port}`;
const persist=path.join(root,'tmp','cf-realtime-state');rmSync(persist,{recursive:true,force:true});
execFileSync(process.execPath,['scripts/build-worker.mjs'],{cwd:root,stdio:'inherit'});
const worker=spawn(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'dev','--config','wrangler.local.jsonc','--ip','127.0.0.1','--port',String(port),'--local','--persist-to',persist],{cwd:root,stdio:['ignore','pipe','pipe']});
let logs='';worker.stdout.on('data',d=>logs+=d);worker.stderr.on('data',d=>logs+=d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitReady(){for(let i=0;i<300;i++){try{if((await api('/api/session')).ok)return;}catch{}await sleep(100);}throw Error('worker not ready\n'+logs);}
async function api(pathname,options={}){const method=options.method||'GET',headers={'X-VS-Protocol':'vs-cf-1',...(options.headers||{})};if(!['GET','HEAD'].includes(method))headers.Origin=origin;let body=options.body;if(body!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(body);}return fetch(origin+pathname,{method,headers,body});}
function stop(){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(worker.pid),'/T','/F'],{stdio:'ignore'});else worker.kill('SIGTERM');}
function nextMessage(ws,timeout=5000){return new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('websocket timeout')),timeout);ws.once('message',data=>{clearTimeout(t);resolve(JSON.parse(String(data)));});ws.once('error',reject);});}
try{
  await waitReady();const source={students:[{id:'s1',name:'QA'}],logs:[],weekOvr:{},consults:[],payments:[],inquiries:[]};
  let r=await api('/api/import',{method:'POST',body:{state:source}});assert.equal(r.status,201);let staged=await r.json();
  r=await api('/api/export');assert.equal(r.status,200);let exported=await r.json();
  r=await api('/api/activate',{method:'POST',body:{hash:exported.hash}});assert.equal(r.status,200);
  const ws=new WebSocket(`ws://127.0.0.1:${port}/api/events?protocol=vs-cf-1`,{headers:{Origin:origin}});
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  const hello=await nextMessage(ws);assert.equal(hello.type,'hello');assert.equal(hello.revision,0);
  const changedPromise=nextMessage(ws);
  r=await api('/api/commit',{method:'POST',body:{baseRevision:0,requestId:'realtime-commit-0001',state:{...source,students:[{id:'s1',name:'Changed'}]}}});
  assert.equal(r.status,200);const changed=await changedPromise;assert.equal(changed.type,'state-changed');assert.equal(changed.revision,1);
  ws.close();console.log(JSON.stringify({ok:true,hello,changed},null,2));
}catch(error){console.error(logs);throw error;}finally{stop();}
