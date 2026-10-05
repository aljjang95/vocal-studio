import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import syncRuntime from '../vs-sync.js';
import {DatabaseSync} from 'node:sqlite';
import {StudioState} from '../worker/state.mjs';

// Synthetic DOM + owner API only. No real SMS, browser session or credentials.
const source = readFileSync(new URL('../sms-manager.js', import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
class Element {
  constructor(tag, doc) { this.tagName=tag; this.doc=doc; this.children=[]; this.dataset={}; this.style={}; this.attributes={}; this.events={}; this.value=''; this.disabled=false; this.checked=false; this._text=''; }
  set textContent(value) { this._text=String(value); this.children=[]; }
  get textContent() { return this._text + this.children.map(el=>el.textContent).join(''); }
  set innerHTML(value) { throw Error('HTML interpretation forbidden'); }
  appendChild(el) { this.children.push(el); el.parent=this; return el; }
  replaceChildren(...els) { this.children=[]; this._text=''; els.forEach(el=>this.appendChild(el)); }
  setAttribute(key,value) { this.attributes[key]=String(value); }
  getAttribute(key) { return this.attributes[key]; }
  addEventListener(key,fn) { (this.events[key] ||= []).push(fn); }
  remove() { if(this.parent) this.parent.children=this.parent.children.filter(el=>el!==this); }
  focus() { this.doc.activeElement=this; }
  blur() { this.doc.activeElement=this.doc.body; }
  contains(el) { return this===el || this.children.some(child=>child.contains(el)); }
  emit(type) { for(const fn of this.events[type] || []) fn({target:this}); }
  matches(selector) {
    return selector.split(',').some(raw=>{
      const s=raw.trim(), attr=s.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);
      if(attr) { const key=attr[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase()); return key in this.dataset && (attr[2]===undefined || this.dataset[key]===attr[2]); }
      if(s.startsWith('.')) return s.slice(1).split('.').every(cls=>String(this.className||'').split(' ').includes(cls));
      if(s==='a[href]') return this.tagName==='a' && !!this.href;
      return this.tagName===s;
    });
  }
  querySelectorAll(selector) { return this.children.flatMap(el=>[...(el.matches(selector)?[el]:[]),...el.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
const student=(id='student-1',extra={})=>({id,name:'합성 정본 이름',ph:'010-0000-1234',status:'수강중',schedType:'flex',...extra});
const message=(id='message-1',extra={})=>({id,phone:'+82 10-0000-1234',text:'합성 원문: 다음 주 가능한 시간 문의',direction:'received',receivedAt:'2026-10-03T00:00:00Z',studentId:'student-1',matchStatus:'unique',proposal:{date:'2099-10-05',time:'10:00',warnings:[]},status:'pending',...extra});
function fixture(extra={}) {
  const document={createElement(tag){return new Element(tag,this);},querySelector(selector){return this.body.querySelector(selector);},addEventListener(){},removeEventListener(){}};
  document.body=new Element('body',document); document.body.style.overflow='auto'; document.activeElement=document.body;
  const calls=[], clipboard=[];
  const data={ok:true,settings:{enabled:false,mondayTime:'10:00',tuesdayTime:'14:00',mondayText:'{name}님 가능 시간을 알려 주세요.',tuesdayText:'{name}님 일정 확인 부탁드립니다.'},device:{paired:false,lastSeen:null,relayOrigin:'https://synthetic-relay.example'},revision:7,weekStart:'2026-09-28',unassigned:[{id:'student-1',name:'신뢰하지 않을 별명'}],messages:[message()],outbox:[],aliasChanges:[],callSettings:{enabled:false,includeUnknown:false},calls:[],...extra};
  const control={handler:null, retry:true, confirm:true, retryRevision:null};
  const sync={owner:'synthetic-owner',ready:true,confirmed:true,blocked:false,state:{revision:data.revision,base:{students:[student()]}},pending:()=>0,
    async retry(){calls.push({kind:'retry'}); if(control.retry){this.state.revision=control.retryRevision ?? data.revision;this.displayRequired=false;this.viewBase=clone(this.state.local);} return control.retry;}};
  sync.state.local=syncRuntime.normalize(sync.state.base);
  sync.a={getData:()=>sync.state.local,editing:()=>!!document.querySelector('.ov.open')||document.activeElement.matches('input,textarea,select')};
  const ctx=vm.createContext({document,console:{log(){throw Error('logging forbidden');},error(){throw Error('logging forbidden');}},Date,Map,URL,Error,Number,Object,String,Array,Promise,_vsSync:sync,VSSync:syncRuntime,
    location:{hostname:'synthetic-owner.example'},navigator:{clipboard:{async writeText(value){clipboard.push(value);}}},
    localStorage:{setItem(){throw Error('persistence forbidden');}},sessionStorage:{setItem(){throw Error('persistence forbidden');}},
    confirm(text){calls.push({kind:'prompt',text});return control.confirm;},render(){calls.push({kind:'render'});},renderSidebarToday(){calls.push({kind:'sidebar'});},
    VCFTransport:{async api(path,options){
      const route=path.split('/').at(-1); calls.push({kind:'api',route,body:options.body && clone(options.body),options});
      if(control.handler) { const custom=await control.handler(route,options.body); if(custom!==undefined)return custom; }
      if(route==='overview')return ok(clone(data));
      if(route==='confirm'){data.revision++; for(const entry of options.body.entries){const m=data.messages.find(m=>m.id===entry.messageId);m.status='scheduled';m.confirmation={date:entry.date,time:entry.time,studentId:entry.studentId};}return ok({ok:true,revision:data.revision,count:options.body.entries.length});}
      if(route==='alias'){data.revision++;data.aliasChanges=[];return ok({ok:true,revision:data.revision});}
      if(route==='settings'){data.settings=clone(options.body);return ok({ok:true});}
      if(route==='call-settings'){data.callSettings=clone(options.body);return ok({ok:true});}
      if(route==='call-dismiss'){data.calls.find(c=>c.id===options.body.callId).status='acknowledged';return ok({ok:true});}
      if(route==='options'){return ok({ok:true,revision:data.revision,messageId:options.body.messageId,options:[{date:options.body.date,time:'15:15',reason:'요청한 시간이 가능해요.'}],warnings:[]});}
      if(route==='prepare'){return ok({ok:true,count:1});}
      if(route==='test-message'){
        const prior=data.outbox.find(row=>row.stage==='connection-test');
        const row=prior || {id:'synthetic-test-outbox',stage:'connection-test',name:'연결 시험',status:'pending',createdAt:Date.now()};
        if(!prior)data.outbox.push(row);
        return ok({ok:true,id:row.id,status:row.status,expiresAt:Date.now()+3600000,duplicate:!!prior});
      }
      if(route==='dismiss'){data.messages.find(m=>m.id===options.body.messageId).status='dismissed';return ok({ok:true});}
      if(route==='revoke'){data.device.paired=false;data.settings.enabled=false;data.callSettings={enabled:false,includeUnknown:false};return ok({ok:true});}
      if(route==='pair'){data.device.paired=true;data.callSettings={enabled:false,includeUnknown:false};return ok({ok:true,token:'synthetic-one-time-token',deviceId:'device-test',relayOrigin:data.device.relayOrigin});}
      throw Error('Unexpected test route');
    }}});
  vm.runInContext(source,ctx);
  const query=selector=>document.body.querySelector(selector);
  const action=key=>query(`[data-action="${key}"]`);
  const card=()=>query('[data-message-id]') || query('.vs-sms-card');
  const field=(key,parent=document.body)=>parent.querySelector(`[data-field="${key}"]`);
  async function click(key) {
    const el=action(key);assert.ok(el,`button ${key} exists`);assert.equal(el.disabled,false,`button ${key} enabled`);el.emit('click');await settle();
    // SQLite-backed handlers also await WebCrypto; four event-loop turns do not prove completion.
    const deadline=Date.now()+2000;
    while(query('.vs-sms-modal')?.getAttribute('aria-busy')==='true' && Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,5));
    assert.notEqual(query('.vs-sms-modal')?.getAttribute('aria-busy'),'true',`action ${key} completed`);
  }
  function fill(key,value,parent=document.body) { const el=field(key,parent);assert.ok(el,`field ${key} exists`); if(el.type==='checkbox')el.checked=value;else el.value=value;el.emit(el.tagName==='select'?'change':'input'); }
  return {ctx,document,calls,clipboard,data,control,sync,query,action,card,field,click,fill,text:()=>document.body.textContent,open:()=>ctx.VSSms.open()};
}
function ok(data) { return {response:{ok:true,status:200},data}; }
function failure(status) { return {response:{ok:false,status},data:{ok:false,error:'synthetic-secret-error-never-display'}}; }
async function settle() { for(let i=0;i<4;i++) await new Promise(resolve=>setImmediate(resolve)); }
async function actionSettled(f,key) {
  // Observe action()'s explicit aria-busy signal cleared by finally.
  // Mutation eligibility can remain disabled after success; it is not completion.
  // Keep every result assertion unchanged.
  const deadline=performance.now()+2000;
  while(f.query('.vs-sms-modal')?.getAttribute('aria-busy')!=='false') {
    assert.ok(performance.now()<deadline,`action ${key} must finish within the bounded observation`);
    await new Promise(resolve=>setImmediate(resolve));
  }
}
function deferred() {
  let resolve, reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
function promisedClipboard(f,{requireGesture=false,denied=false,completion=null,constructorThrows=false,writeThrows=false}={}) {
  let gesture=false;
  f.ctx.Blob=Blob;
  f.ctx.ClipboardItem=class {
    constructor(data) { if(constructorThrows)throw Error('unsupported promised item');this.data=data; }
  };
  f.ctx.navigator.clipboard={
    async write(items) {
      f.calls.push({kind:'clipboard-write',gesture});
      if(requireGesture&&!gesture)throw Error('activation lost');
      if(writeThrows)throw Error('unsupported promised write');
      const blob=await items[0].data['text/plain'];
      const value=await blob.text();
      if(completion)await completion.promise;
      if(denied)throw Error('synthetic clipboard denied');
      f.clipboard.push(value);
    },
    async writeText(value) {
      f.calls.push({kind:'clipboard-writeText',gesture});
      if(requireGesture&&!gesture||denied)throw Error('synthetic clipboard denied');
      f.clipboard.push(value);
    }
  };
  return {click(key){gesture=true;try{f.action(key).emit('click');}finally{gesture=false;}}};
}

const pairedTest=()=>fixture({device:{paired:true,relayOrigin:'https://synthetic-relay.example'},messages:[],unassigned:[]});
test('connection test confirms exact normalized target and fixed text, preserves other drafts, reports queue and duplicate truthfully',async()=>{
  const f=pairedTest();await f.open();f.fill('testPhone','+82 10-0000-1234');f.fill('mondayText','{name} retained');
  await f.click('refresh');assert.equal(f.field('testPhone').value,'+82 10-0000-1234');
  await f.click('test-message');const post=f.calls.find(c=>c.route==='test-message');assert.deepEqual(post.body,{phone:'01000001234'});
  const prompt=f.calls.find(c=>c.kind==='prompt');assert.match(prompt.text,/01000001234/);assert.match(prompt.text,/SMS 1건/);assert.match(prompt.text,/HLB 연결 시험입니다/);
  assert.ok(prompt.text.split('\n\n')[1].length<=70,'confirmed fixed body stays within 70 UTF16 code units');
  assert.equal(f.field('testPhone').value,'');assert.equal(f.field('mondayText').value,'{name} retained');assert.equal(f.data.settings.enabled,false);
  assert.match(f.text(),/연결 시험 · 전송 대기/);assert.ok(!f.text().includes('명단 확인 필요'));assert.ok(!f.text().includes('전달 완료'));
  f.fill('testPhone','01000001234');await f.click('test-message');assert.match(f.text(),/기존 요청 확인 · 전송 대기/);assert.equal(f.data.outbox.length,1);
  for(const [status,expected] of [['claimed','전송 시도 중'],['sent','수신 여부 미확인'],['failed','전송 실패'],['unknown','전송 결과 불확실'],['expired','발송 기한 만료']]) {
    f.data.outbox[0].status=status;f.fill('testPhone','01000001234');await f.click('test-message');assert.match(f.text(),new RegExp(expected));assert.equal(f.data.outbox.length,1);
  }
});

test('test phone invalid/unknown/stale contacts, unpaired and refusal never queue; own draft survives failures and clears on close',async()=>{
  const f=pairedTest();await f.open();
  for(const number of ['not a phone','01000009999']) {f.fill('testPhone',number);await f.click('test-message');assert.equal(f.calls.filter(c=>c.route==='test-message').length,0);assert.equal(f.field('testPhone').value,number);}
  f.fill('testPhone','01000001234');f.control.confirm=false;await f.click('test-message');assert.equal(f.calls.filter(c=>c.route==='test-message').length,0);
  assert.match(f.text(),/연결 시험을 취소했습니다/);
  f.control.confirm=true;f.control.handler=route=>{if(route==='overview')f.sync.state.base.students=[];};await f.click('test-message');assert.equal(f.calls.filter(c=>c.route==='test-message').length,0);
  f.sync.state.base.students=[student()];f.control.handler=route=>route==='test-message'?failure(503):undefined;
  await f.click('test-message');assert.equal(f.field('testPhone').value,'01000001234');assert.match(f.text(),/처리 여부가 불확실/);
  const old=f.field('testPhone');f.ctx.VSSms.close();assert.equal(old.value,'');await f.open();assert.equal(f.field('testPhone').value,'');
  const g=fixture();await g.open();assert.equal(g.action('test-message').disabled,true);
  const h=pairedTest();await h.open();h.fill('testPhone','01000001234');h.control.handler=route=>{if(route==='overview')h.data.device.paired=false;};
  await h.click('test-message');assert.equal(h.calls.filter(c=>c.route==='test-message').length,0);assert.match(h.text(),/연결된 휴대폰이 필요/);
});

test('connection-test pending request prevents duplicate click and isolates late refresh/POST across owner epoch sync and modal changes',async()=>{
  for(const phase of ['overview','test-message'])for(const transition of ['owner','epoch','sync','close']) {
    const f=pairedTest(),gate=deferred();f.sync.epoch=1;await f.open();f.fill('testPhone','01000001234');const oldInput=f.field('testPhone'),oldButton=f.action('test-message');
    f.control.handler=route=>route===phase?gate.promise:undefined;
    oldButton.emit('click');await settle();assert.equal(f.action('test-message').disabled,true);oldButton.emit('click');await settle();
    assert.equal(f.calls.filter(c=>c.route==='test-message').length,phase==='overview'?0:1);
    if(transition==='owner')f.sync.owner='new-owner';
    if(transition==='epoch')f.sync.epoch++;
    if(transition==='sync'){f.sync={...f.sync};f.ctx._vsSync=f.sync;}
    if(transition==='close'){assert.equal(f.action('close').disabled,false);f.ctx.VSSms.close();}
    else oldInput.emit('input');
    assert.equal(oldInput.value,'');
    f.control.handler=null;
    gate.resolve(phase==='overview'?ok(clone(f.data)):ok({ok:true,id:'late-test',status:'pending',duplicate:false}));await settle();
    if(transition==='close')await f.open();else await f.click('refresh');
    assert.equal(f.field('testPhone').value,'');assert.ok(!f.text().includes('연결 시험 · 전송 대기'));
    oldInput.value='01000001234';oldInput.emit('input');oldButton.emit('click');await settle();
    assert.equal(f.calls.filter(c=>c.route==='test-message').length,phase==='overview'?0:1);
  }
});

test('accepted test queue with failed overview retains draft and does not falsely report pending success',async()=>{
  const f=pairedTest();await f.open();f.fill('testPhone','01000001234');let queued=false;
  f.control.handler=route=>{if(route==='test-message')queued=true;if(route==='overview'&&queued)return failure(503);};
  await f.click('test-message');assert.equal(f.data.outbox.length,1);assert.equal(f.field('testPhone').value,'01000001234');
  assert.match(f.text(),/처리 여부가 불확실/);assert.ok(!f.text().includes('연결 시험 · 전송 대기'));
  f.control.handler=null;await f.click('refresh');assert.match(f.text(),/연결 시험 · 전송 대기/);
  await f.click('test-message');assert.equal(f.data.outbox.length,1);assert.match(f.text(),/기존 요청 확인/);
});

test('disconnected empty overview is usable, default disabled, setup origin + protected APK and no native phone requirement',async()=>{
  const f=fixture({messages:[],unassigned:[]});await f.open();
  assert.match(f.text(),/휴대폰 연결 안 됨/);assert.match(f.text(),/새 문자 기록이 없습니다/);
  assert.equal(f.query('a[href]').href,'/hlb-sms-relay.apk');assert.equal(f.field('relayOrigin').value,f.data.device.relayOrigin);
  assert.equal(f.field('enabled').checked,false);assert.equal(f.field('mondayTime').value,'10:00');assert.equal(f.field('tuesdayTime').value,'14:00');
  assert.equal(f.action('prepare-monday').disabled,true);assert.equal(f.action('pair').disabled,false);
  assert.equal(f.calls.filter(c=>c.body).length,0);
  f.ctx.VSSms.close();assert.equal(f.document.body.style.overflow,'auto');
});
test('unconfigured relay keeps setup screen but disables pair; edits cannot route token to arbitrary origin',async()=>{
  const f=fixture({device:{paired:false,relayOrigin:''},messages:[]});await f.open();assert.equal(f.action('pair').disabled,true);
  const g=fixture();await g.open();g.fill('relayOrigin','https://unconfigured.example');await g.click('pair');
  assert.equal(g.calls.filter(c=>c.route==='pair').length,0);assert.match(g.text(),/휴대폰 연결 주소/);
});
test('raw SMS and canonical names use text nodes, receive/sent preserved, no NLP guesses from ambiguous raw text',async()=>{
  const payload='<img src=x onerror="steal()"> & </pre><script>bad()</script>';
  const f=fixture({messages:[message('message-1',{text:payload,direction:'sent',name:'invented',proposal:{date:null,time:null,warnings:['모호한 날짜']}})]});await f.open();
  assert.equal(f.query('.vs-sms-raw').textContent,payload);assert.match(f.text(),/합성 정본 이름 · 발신/);assert.ok(!f.text().includes('invented'));
  assert.equal(f.field('date').value,'');assert.equal(f.field('time').value,'');assert.match(f.text(),/모호한 날짜/);
  assert.equal(f.query('script'),null);assert.equal(f.query('img'),null);
});
test('owner batch confirms edited synthetic future entries with fresh overview revision; retry precedes host render',async()=>{
  const f=fixture();await f.open();f.calls.length=0;
  f.fill('date','2099-10-06');f.fill('time','15:30');f.fill('checked',true);await f.click('confirm');
  const post=f.calls.find(c=>c.route==='confirm');assert.deepEqual(post.body,{baseRevision:7,entries:[{messageId:'message-1',studentId:'student-1',date:'2099-10-06',time:'15:30'}]});
  assert.equal(f.calls[0].route,'overview');assert.equal(post.options.method,'POST');
  const retry=f.calls.findIndex(c=>c.kind==='retry'),render=f.calls.findIndex(c=>c.kind==='render');assert.ok(retry>0&&render>retry);
  assert.match(f.text(),/일정 1건이 등록되었습니다/);assert.equal(f.field('checked').checked,false);
});
test('CAS409 retains date, time, checkbox, safe error and refresh preserves failed drafts',async()=>{
  const f=fixture();await f.open();f.control.handler=route=>route==='confirm'?failure(409):undefined;
  f.fill('date','2099-10-07');f.fill('time','16:00');f.fill('checked',true);await f.click('confirm');
  assert.match(f.text(),/자료가 변경되었거나 일정이 충돌/);assert.ok(!f.text().includes('synthetic-secret-error'));
  assert.equal(f.field('date').value,'2099-10-07');assert.equal(f.field('time').value,'16:00');assert.equal(f.field('checked').checked,true);
  assert.equal(f.calls.filter(c=>c.kind==='render').length,0);assert.equal(f.action('confirm').disabled,false);
  await f.click('refresh');assert.equal(f.field('date').value,'2099-10-07');assert.equal(f.field('checked').checked,true);
});
test('transport failures never report saved or clear selections; settings drafts survive refresh',async()=>{
  const f=fixture();await f.open();f.fill('mondayText','{name}님 합성 수정 문구');f.fill('checked',true);
  f.control.handler=route=>{if(route==='settings'||route==='confirm')throw Error('synthetic transport secret');};
  await f.click('settings');assert.match(f.text(),/서버 결과를 확인하지 못/);assert.equal(f.field('mondayText').value,'{name}님 합성 수정 문구');
  await f.click('refresh');assert.equal(f.field('mondayText').value,'{name}님 합성 수정 문구');
  await f.click('confirm');assert.equal(f.field('checked').checked,true);assert.ok(!f.text().includes('synthetic transport secret'));
  assert.ok(!f.text().includes('일정 1건이 등록되었습니다'));
});
test('accepted mutation with failed readback retains draft and forbids render/resubmit until readback',async()=>{
  const f=fixture();await f.open();f.fill('checked',true);f.control.retry=false;await f.click('confirm');
  assert.match(f.text(),/등록 결과를 아직 확인하지 못/);assert.equal(f.field('checked').checked,true);
  assert.equal(f.calls.filter(c=>c.kind==='render').length,0);assert.equal(f.action('confirm').disabled,true);
  f.control.retry=true;await f.click('refresh');assert.equal(f.sync.state.revision,8);assert.equal(f.field('checked').disabled,true);
  assert.ok(f.calls.some(c=>c.kind==='render'));
});
test('fresh overview revision and ready/confirmed/pending0 guard prevent authority on stale or dirty records',async()=>{
  for(const change of [f=>{f.sync.ready=false;},f=>{f.sync.confirmed=false;},f=>{f.sync.pending=()=>1;},f=>{f.data.revision=8;}]) {
    const f=fixture();await f.open();f.fill('checked',true);change(f);await f.click('confirm');
    assert.equal(f.calls.filter(c=>c.route==='confirm').length,0);assert.equal(f.field('checked').checked,true);assert.match(f.text(),/학생 정보를 확인/);
  }
});
test('duplicate phone remains held even after explicit student selection; inactive/fixed or changed mapping cannot confirm',async()=>{
  for(const scenario of ['duplicate','fixed','inactive','changed-id','invalid-phone','held','malformed-phone']) {
    const f=fixture();
    if(scenario==='duplicate')f.sync.state.base.students.push(student('student-2',{name:'합성 중복 정본'}));
    if(scenario==='fixed')f.sync.state.base.students[0].schedType='fixed';
    if(scenario==='inactive')f.sync.state.base.students[0].status='중단';
    if(scenario==='changed-id')f.data.messages[0].studentId='other-student';
    if(scenario==='invalid-phone')f.data.messages[0].phone='01000009999';
    if(scenario==='held'){f.data.messages[0].studentId=null;f.data.messages[0].matchStatus='held';}
    if(scenario==='malformed-phone')f.data.messages[0].phone='attacker01000001234';
    await f.open();f.fill('studentId','student-1');f.fill('checked',true);await f.click('confirm');
    assert.equal(f.calls.filter(c=>c.route==='confirm').length,0);assert.match(f.text(),/등록된 학생 한 명과 일치/);
  }
});
test('invalid calendar date, malformed time or past proposal is never confirmed',async()=>{
  for(const [date,time] of [['2099-02-31','10:00'],['2099-10-05','25:00'],['2000-01-01','10:00']]) {
    const f=fixture();await f.open();f.fill('date',date);f.fill('time',time);f.fill('checked',true);await f.click('confirm');
    assert.equal(f.calls.filter(c=>c.route==='confirm').length,0);assert.match(f.text(),/실제 미래 날짜와 시간/);
  }
});
test('name alias requires owner confirmation and unique current canonical name, successful revision readback',async()=>{
  const alias={id:'alias-1',studentId:'student-1',kind:'consult',oldName:'합성 별명',newName:'합성 정본 이름'};
  const f=fixture({aliasChanges:[alias]});await f.open();f.control.confirm=false;await f.click('alias');
  assert.equal(f.calls.filter(c=>c.route==='alias').length,0);
  f.control.confirm=true;await f.click('alias');assert.deepEqual(f.calls.find(c=>c.route==='alias').body,{aliasId:'alias-1'});assert.ok(f.calls.some(c=>c.kind==='render'));
  const g=fixture({aliasChanges:[{...alias,newName:'invented name'}]});await g.open();await g.click('alias');assert.equal(g.calls.filter(c=>c.route==='alias').length,0);
  const h=fixture({aliasChanges:[alias]});await h.open();h.sync.state.base.students.push(student('dup'));await h.click('alias');assert.equal(h.calls.filter(c=>c.route==='alias').length,0);
});
test('one-time pairing auto-copies once, uses password value only, clears on close and cannot rotate without confirmation',async()=>{
  const f=fixture();await f.open();f.control.confirm=false;await f.click('pair');assert.equal(f.calls.filter(c=>c.route==='pair').length,0);
  assert.deepEqual(f.clipboard,[]);
  f.control.confirm=true;await f.click('pair');const token=f.field('token');assert.equal(token.type,'password');assert.equal(token.value,'synthetic-one-time-token');
  assert.equal(token.getAttribute('value'),undefined);assert.ok(!f.text().includes(token.value));assert.equal(f.action('copy-token').disabled,false);
  assert.deepEqual(f.clipboard,['synthetic-one-time-token']);assert.match(f.text(),/이 기기의 클립보드에 복사/);
  await f.click('refresh');assert.deepEqual(f.clipboard,['synthetic-one-time-token']);
  await f.click('copy-token');assert.deepEqual(f.clipboard,['synthetic-one-time-token','synthetic-one-time-token']);
  f.control.confirm=false;await f.click('pair');assert.equal(f.calls.filter(c=>c.route==='pair').length,1);assert.equal(token.value,'synthetic-one-time-token');
  f.ctx.VSSms.close();assert.equal(token.value,'');await f.open();assert.equal(f.field('token'),null);
});
test('promised ClipboardItem is requested inside generation gesture and receives key only after guarded API response',async()=>{
  const f=fixture(),gate=deferred();const clip=promisedClipboard(f,{requireGesture:true});await f.open();
  f.control.handler=async route=>{if(route==='pair'){await gate.promise;return ok({ok:true,token:'synthetic-gesture-token',relayOrigin:f.data.device.relayOrigin});}};
  clip.click('pair');assert.equal(f.calls.filter(c=>c.kind==='clipboard-write').length,1);assert.equal(f.field('token'),null);
  await settle();assert.deepEqual(f.clipboard,[]);gate.resolve();await settle();
  assert.deepEqual(f.clipboard,['synthetic-gesture-token']);assert.match(f.text(),/이 기기의 클립보드에 복사/);
  assert.equal(f.calls.filter(c=>c.kind==='clipboard-writeText').length,0);assert.equal(f.calls.filter(c=>c.route==='pair').length,1);
});
test('cancelled, failed, malformed and wrong-origin pair never place data into clipboard',async()=>{
  for(const mode of ['cancel','failure','transport','empty','wrong-origin']) {
    const f=fixture();promisedClipboard(f);await f.open();
    if(mode==='cancel')f.control.confirm=false;
    else f.control.handler=route=>{if(route==='pair') {
      if(mode==='failure')return failure(500);
      if(mode==='transport')throw Error('synthetic private error');
      return ok({ok:true,token:mode==='empty'?'':'synthetic-invalid-origin-token',relayOrigin:mode==='wrong-origin'?'https://another.example':f.data.device.relayOrigin});
    }};
    await f.click('pair');assert.deepEqual(f.clipboard,[],mode);assert.equal(f.field('token'),null,mode);
    assert.ok(!f.text().includes('이 기기의 클립보드에 복사'));assert.ok(!f.text().includes('synthetic private error'));
    assert.equal(f.calls.filter(c=>c.kind==='clipboard-writeText').length,0);
    if(mode==='cancel')assert.equal(f.calls.filter(c=>c.kind==='clipboard-write'||c.route==='pair').length,0);
  }
});
test('missing, denied and unsupported clipboard retain generated password plus explicit copy retry without new pair',async()=>{
  for(const mode of ['missing','writeText-denied','item-denied','item-constructor','item-write']) {
    const f=fixture();await f.open();
    if(mode==='missing')delete f.ctx.navigator.clipboard;
    if(mode==='writeText-denied')f.ctx.navigator.clipboard.writeText=async()=>{throw Error('synthetic denied');};
    if(mode==='item-denied')promisedClipboard(f,{denied:true});
    if(mode==='item-constructor')promisedClipboard(f,{constructorThrows:true});
    if(mode==='item-write')promisedClipboard(f,{writeThrows:true});
    await f.click('pair');assert.equal(f.field('token').value,'synthetic-one-time-token');assert.equal(f.action('copy-token').disabled,false);
    if(mode==='item-constructor')assert.deepEqual(f.clipboard,['synthetic-one-time-token']);
    else {assert.deepEqual(f.clipboard,[]);assert.match(f.text(),/자동 복사하지 못/);assert.ok(!f.text().includes('클립보드에 복사했습니다'));}
    f.ctx.navigator.clipboard={async writeText(value){f.clipboard.push(value);}};
    await f.click('copy-token');assert.equal(f.clipboard.at(-1),'synthetic-one-time-token');assert.match(f.text(),/이 기기의 클립보드에 복사/);
    assert.equal(f.calls.filter(c=>c.route==='pair').length,1,mode);
  }
});
test('clipboard outcome remains truthful when overview succeeds or fails after key creation',async()=>{
  for(const denied of [false,true])for(const overviewFails of [false,true]) {
    const f=fixture();await f.open();if(denied)f.ctx.navigator.clipboard.writeText=async()=>{throw Error('denied');};
    if(overviewFails)f.control.handler=route=>route==='overview'?failure(500):undefined;
    await f.click('pair');assert.equal(f.field('token').value,'synthetic-one-time-token');assert.equal(f.action('copy-token').disabled,false);
    if(denied){assert.match(f.text(),/자동 복사하지 못/);assert.deepEqual(f.clipboard,[]);assert.ok(!f.text().includes('클립보드에 복사했습니다'));}
    else{assert.match(f.text(),/이 기기의 클립보드에 복사/);assert.deepEqual(f.clipboard,['synthetic-one-time-token']);}
    if(overviewFails)assert.match(f.text(),/연결 상태.*새로고침/);
    assert.equal(f.calls.filter(c=>c.route==='pair').length,1);
  }
});
test('activation-limited writeText fallback can be retried by explicit copy gesture without rotating the key',async()=>{
  const f=fixture(),clip=promisedClipboard(f,{requireGesture:true,constructorThrows:true});await f.open();
  clip.click('pair');await settle();assert.deepEqual(f.clipboard,[]);assert.match(f.text(),/자동 복사하지 못/);
  clip.click('copy-token');await settle();assert.deepEqual(f.clipboard,['synthetic-one-time-token']);assert.match(f.text(),/이 기기의 클립보드에 복사/);
  assert.equal(f.calls.filter(c=>c.route==='pair').length,1);
});
test('each confirmed rotation copies only its new key and wipes retained prior-key handlers without secret attributes or globals',async()=>{
  const f=fixture();await f.open();const globals=Object.keys(f.ctx).sort();let keys=0;
  f.control.handler=route=>route==='pair'?ok({ok:true,token:'synthetic-rotation-'+(++keys),relayOrigin:f.data.device.relayOrigin}):undefined;
  await f.click('pair');const old=f.field('token'),oldCopy=f.action('copy-token');
  await f.click('pair');assert.equal(old.value,'');assert.equal(f.field('token').value,'synthetic-rotation-2');
  assert.deepEqual(f.clipboard,['synthetic-rotation-1','synthetic-rotation-2']);assert.deepEqual(Object.keys(f.ctx).sort(),globals);
  const before=f.text();oldCopy.emit('click');await settle();assert.equal(f.text(),before);assert.equal(f.clipboard.length,2);
  for(const el of f.query('.vs-sms-modal').querySelectorAll('input,textarea,select,button,label,p,a,section')) {
    assert.ok(!JSON.stringify(el.attributes).includes('synthetic-rotation-'));assert.ok(!JSON.stringify(el.dataset).includes('synthetic-rotation-'));
    assert.ok(!String(el.href||'').includes('synthetic-rotation-'));
  }
  assert.ok(!f.text().includes('synthetic-rotation-'));assert.ok(!JSON.stringify(f.calls).includes('synthetic-rotation-'));
  const password=f.field('token'),copy=f.action('copy-token');f.query('[data-secret]').querySelectorAll('button').find(el=>el.textContent==='연결 키 닫기').emit('click');
  assert.equal(password.value,'');assert.equal(f.field('token'),null);copy.emit('click');await settle();assert.equal(f.clipboard.length,2);
});
test('pair busy prevents duplicate generation gestures while allowing modal close and fresh reopen',async()=>{
  const f=fixture(),gate=deferred();promisedClipboard(f);await f.open();
  f.control.handler=async route=>{if(route==='pair'){await gate.promise;return ok({ok:true,token:'synthetic-double-gesture',relayOrigin:f.data.device.relayOrigin});}};
  const pair=f.action('pair');pair.emit('click');pair.emit('click');await settle();
  assert.equal(f.calls.filter(c=>c.route==='pair').length,1);assert.equal(f.calls.filter(c=>c.kind==='clipboard-write').length,1);
  await f.click('close');assert.equal(f.query('.vs-sms-modal'),null);await f.open();const before=f.text();
  gate.resolve();await settle();assert.equal(f.field('token'),null);assert.deepEqual(f.clipboard,[]);assert.equal(f.text(),before);
});
test('explicit copy retry pending native completion cannot revive a hidden key or overwrite owner and close feedback',async()=>{
  for(const transition of ['hide','owner','logout','close']) {
    const f=fixture();await f.open();await f.click('pair');assert.deepEqual(f.clipboard,['synthetic-one-time-token']);f.clipboard.length=0;
    const completion=deferred();let submitted=0;
    f.ctx.navigator.clipboard.writeText=async value=>{submitted++;await completion.promise;f.clipboard.push(value);};
    f.action('copy-token').emit('click');await settle();const old=f.field('token');
    if(transition==='hide')f.query('[data-secret]').querySelectorAll('button').find(el=>el.textContent==='연결 키 닫기').emit('click');
    if(transition==='close')f.ctx.VSSms.close();
    if(transition==='owner'||transition==='logout'){f.sync.owner=transition==='owner'?'another-owner':null;await f.open();}
    assert.equal(old.value,'');const before=f.text();completion.resolve();await settle();
    assert.equal(f.field('token'),null);assert.equal(old.value,'');assert.equal(f.text(),before);assert.equal(submitted,1);assert.equal(f.calls.filter(c=>c.route==='pair').length,1);
  }
});
test('owner, logout, epoch, sync replacement and modal close discard pending pair before any clipboard data',async()=>{
  for(const promised of [false,true])for(const transition of ['owner','logout','epoch','sync','close']) {
    const f=fixture(),gate=deferred();f.sync.epoch=1;if(promised)promisedClipboard(f);await f.open();
    f.control.handler=async route=>{if(route==='pair'){await gate.promise;return ok({ok:true,token:'synthetic-stale-key',relayOrigin:f.data.device.relayOrigin});}};
    f.action('pair').emit('click');await settle();
    if(transition==='owner')f.sync.owner='new-owner';
    if(transition==='logout')f.sync.owner=null;
    if(transition==='epoch')f.sync.epoch++;
    if(transition==='sync')f.ctx._vsSync={...f.sync};
    if(transition==='close'){assert.equal(f.action('close').disabled,false);f.ctx.VSSms.close();assert.equal(f.query('.vs-sms-modal'),null);}
    else await f.open();
    gate.resolve();await settle();assert.deepEqual(f.clipboard,[],`${promised}/${transition}`);assert.equal(f.field('token'),null);
    assert.equal(f.calls.filter(c=>c.kind==='clipboard-writeText').length,0);assert.ok(!f.text().includes('클립보드에 복사했습니다'));
  }
});
test('pending native clipboard success or refusal after owner/logout/close cannot restore secret, feedback or initiate retry',async()=>{
  for(const promised of [false,true])for(const denied of [false,true])for(const transition of ['owner','logout','epoch','sync','close']) {
    const f=fixture(),completion=deferred();f.sync.epoch=1;let submitted=0;
    if(promised)promisedClipboard(f,{completion,denied});
    else f.ctx.navigator.clipboard.writeText=async value=>{submitted++;await completion.promise;if(denied)throw Error('denied');f.clipboard.push(value);};
    await f.open();f.action('pair').emit('click');await settle();const old=f.field('token');assert.ok(old);
    assert.ok(!f.text().includes('클립보드에 복사했습니다'));
    if(transition==='close'){assert.equal(f.action('close').disabled,false);f.ctx.VSSms.close();}
    else {
      if(transition==='owner')f.sync.owner='new-owner';
      if(transition==='logout')f.sync.owner=null;
      if(transition==='epoch')f.sync.epoch++;
      if(transition==='sync')f.ctx._vsSync={...f.sync};
      await f.open();
    }
    assert.equal(old.value,'');const before=f.text(),overviews=f.calls.filter(c=>c.route==='overview').length;
    completion.resolve();await settle();assert.equal(old.value,'');assert.equal(f.field('token'),null);assert.equal(f.text(),before);
    assert.equal(f.calls.filter(c=>c.route==='overview').length,overviews);assert.equal(f.calls.filter(c=>c.route==='pair').length,1);
    assert.equal(promised?f.calls.filter(c=>c.kind==='clipboard-write').length:submitted,1);
    // Clipboard API has no abort contract once data is submitted: late native completion is not a new JS write.
    assert.equal(f.clipboard.length,denied?0:1);
  }
});
test('disabled settings, explicit enable preview, prepare stages and dismiss remain narrow APIs',async()=>{
  const f=fixture({device:{paired:true,relayOrigin:'https://synthetic-relay.example'}});await f.open();
  f.fill('mondayText','안녕하세요 {name}님');assert.equal(f.query('.vs-sms-preview').textContent,'안녕하세요 학생 이름님');
  await f.click('settings');assert.equal(f.calls.find(c=>c.route==='settings').body.enabled,false);
  f.fill('enabled',true);f.control.confirm=false;await f.click('settings');assert.equal(f.calls.filter(c=>c.route==='settings').length,1);
  f.control.confirm=true;await f.click('settings');assert.equal(f.data.settings.enabled,true);
  await f.click('prepare-monday');await f.click('prepare-tuesday');assert.deepEqual(f.calls.filter(c=>c.route==='prepare').map(c=>c.body),[{stage:'monday'},{stage:'tuesday'}]);
  await f.click('dismiss');assert.deepEqual(f.calls.find(c=>c.route==='dismiss').body,{messageId:'message-1'});assert.equal(f.calls.filter(c=>c.route==='confirm').length,0);
  await f.click('revoke');assert.equal(f.data.device.paired,false);assert.equal(f.action('prepare-monday').disabled,true);
});
test('changed owner clears old drafts and Access HTML/error response does not display server body',async()=>{
  const f=fixture();await f.open();f.fill('date','2099-12-01');f.fill('checked',true);f.ctx.VSSms.close();f.sync.owner='new-synthetic-owner';
  await f.open();assert.equal(f.field('date').value,'2099-10-05');assert.equal(f.field('checked').checked,false);
  f.control.handler=route=>route==='confirm'?Object.assign(new Error('synthetic-cookie'),{status:401}):undefined;
  f.fill('checked',true);await f.click('confirm');assert.match(f.text(),/관리자 로그인 상태/);assert.ok(!f.text().includes('synthetic-cookie'));
});
test('existing host modal blocks confirm and alias before any authoritative POST while preserving drafts',async()=>{
  const f=fixture({aliasChanges:[{id:'alias-1',studentId:'student-1',oldName:'별명',newName:'합성 정본 이름'}]});await f.open();f.fill('checked',true);
  const host=f.document.createElement('div');host.className='ov open';f.document.body.appendChild(host);
  await f.click('confirm');await f.click('alias');
  assert.equal(f.calls.filter(c=>c.route==='confirm'||c.route==='alias').length,0);assert.equal(f.field('checked').checked,true);assert.match(f.text(),/다른 편집 화면을 먼저/);
});
test('host input focused during fresh overview blocks POST; refresh never blurs that input',async()=>{
  const f=fixture();await f.open();f.fill('checked',true);
  const host=f.document.createElement('input');f.document.body.appendChild(host);
  f.control.handler=route=>{if(route==='overview')host.focus();};
  await f.click('confirm');assert.equal(f.calls.filter(c=>c.route==='confirm').length,0);assert.equal(f.document.activeElement,host);
  f.calls.length=0;await f.ctx.VSSms.refresh();assert.equal(f.document.activeElement,host);assert.equal(f.calls.filter(c=>c.kind==='retry').length,0);
});
test('host editing started during accepted POST defers readback and retains draft without touching host focus',async()=>{
  const f=fixture();await f.open();f.fill('checked',true);
  const host=f.document.createElement('input');f.document.body.appendChild(host);
  f.control.handler=route=>{if(route==='confirm')host.focus();};
  f.calls.length=0;await f.click('confirm');assert.equal(f.document.activeElement,host);
  assert.equal(f.calls.filter(c=>c.kind==='retry'||c.kind==='render').length,0);assert.equal(f.field('checked').checked,true);
  assert.match(f.text(),/등록 결과를 아직 확인하지 못/);
});
test('actual VSSync retry reads authoritative synthetic schedule with own input focused, without editing bypass',async()=>{
  const f=fixture(), memory=new Map();
  const store={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key),key:i=>[...memory.keys()][i]??null,get length(){return memory.size;}};
  let ui=syncRuntime.normalize({students:[student()],logs:[],payments:[],consults:[],inquiries:[],weekOvr:{}});
  const controller=syncRuntime.create({namespace:'sms-synthetic',instanceId:'one',store,backupStore:store,owner:()=> 'synthetic-owner',frozen:()=>false,
    editing:()=>!!f.document.querySelector('.ov.open')||f.document.activeElement.matches('input,textarea,select'),
    getData:()=>ui,setData:data=>{ui=data;},render:()=>f.calls.push({kind:'adapter-render'}),status:()=>{},ready:()=>{},later:fn=>queueMicrotask(fn)});
  controller.owner='synthetic-owner';controller.key='synthetic-journal';controller.ready=true;controller.confirmed=true;controller.unsubscribe=()=>{};
  controller.state={version:1,namespace:'sms-synthetic',owner:controller.owner,revision:7,base:clone(ui),local:clone(ui),recovery:[]};
  controller.doc={async get(){
    f.calls.push({kind:'actual-server-read'});
    const data={...clone(ui),_vsSyncRevision:f.data.revision};
    if(f.data.revision===8)data.weekOvr={'2099-10-05':{'student-1':[{day:'월',time:'10:00',source:'sms-confirmed'}]}};
    return {exists:true,data:()=>data};
  }};
  f.ctx._vsSync=controller;
  await f.open();f.fill('checked',true);
  f.control.handler=route=>{if(route==='confirm')f.field('date').focus();};
  f.calls.length=0;await f.click('confirm');
  assert.equal(controller.state.revision,8);assert.equal(controller.pending(),0);assert.equal(controller.ready,true);assert.equal(controller.deferred,null);
  assert.equal(ui.weekOvr['2099-10-05']['student-1'][0].source,'sms-confirmed');
  const read=f.calls.findIndex(c=>c.kind==='actual-server-read'),render=f.calls.findIndex(c=>c.kind==='render');assert.ok(read>=0&&render>read);
  assert.match(f.text(),/일정 1건이 등록되었습니다/);
});
test('numeric, numeric-string and ISO timestamps show readable Korean KST time instead of epochs',async()=>{
  const epoch=1790958883033, iso=new Date(epoch).toISOString();
  const expected=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(epoch));
  const f=fixture({device:{paired:true,lastSeen:epoch,relayOrigin:'https://synthetic-relay.example'},messages:[message('one',{receivedAt:epoch}),message('two',{receivedAt:iso}),message('three',{receivedAt:String(epoch)})]});await f.open();
  assert.equal(f.text().split(expected).length-1,4);assert.ok(!f.text().includes(String(epoch)));assert.ok(!f.text().includes(iso));
  assert.match(f.text(),/한국 시간/);assert.match(f.text(),/문자 일정 관리/);assert.match(f.text(),/레슨 날짜/);assert.match(f.text(),/레슨 시간/);
});
test('structured409 names/date/time show as safe text; raw error HTML and extra fields never display, batch drafts survive',async()=>{
  const f=fixture({messages:[message('one'),message('two',{phone:'01000005678',studentId:'student-2'})]});
  f.sync.state.base.students.push(student('student-2',{ph:'01000005678',name:'합성 두번째 학생'}));
  await f.open();const cards=f.document.body.querySelectorAll('.vs-sms-card');
  f.fill('checked',true,cards[0]);f.fill('date','2099-10-08',cards[0]);f.fill('time','16:00',cards[0]);
  f.fill('checked',true,cards[1]);f.fill('date','2099-10-09',cards[1]);f.fill('time','17:00',cards[1]);
  f.control.handler=route=>route==='confirm'?{response:{ok:false,status:409},data:{error:'sms-schedule-conflict',
    conflict:{date:'2099-10-08',time:'16:00',names:['합성 다른 학생','<img src=x onerror=bad()>']},debug:'synthetic-secret'}}:undefined;
  await f.click('confirm');const notice=f.query('.vs-sms-notice');
  assert.match(notice.textContent,/2099-10-08 16:00/);assert.match(notice.textContent,/합성 다른 학생/);assert.match(notice.textContent,/<img src=x onerror=bad\(\)>/);
  assert.equal(f.query('img'),null);assert.ok(!f.text().includes('synthetic-secret'));
  assert.equal(f.calls.find(c=>c.route==='confirm').body.entries.length,2);assert.equal(f.sync.state.revision,7);
  const after=f.document.body.querySelectorAll('.vs-sms-card');assert.equal(f.field('checked',after[0]).checked,true);assert.equal(f.field('checked',after[1]).checked,true);
  assert.equal(f.field('date',after[0]).value,'2099-10-08');assert.equal(f.field('time',after[1]).value,'17:00');
});
test('adjusted registered date/time comes from server confirmation after refresh and completely new modal runtime',async()=>{
  const f=fixture();await f.open();f.fill('date','2099-10-07');f.fill('time','17:00');f.fill('checked',true);await f.click('confirm');
  assert.equal(f.field('date').value,'2099-10-07');assert.equal(f.field('time').value,'17:00');assert.equal(f.field('time').disabled,true);
  assert.equal(f.data.messages[0].proposal.time,'10:00');assert.equal(f.data.messages[0].confirmation.time,'17:00');
  f.ctx.VSSms.close();await f.open();assert.equal(f.field('time').value,'17:00');
  const reload=fixture(clone(f.data));await reload.open();assert.equal(reload.field('date').value,'2099-10-07');assert.equal(reload.field('time').value,'17:00');
  assert.equal(reload.field('studentId').value,'student-1');assert.equal(reload.query('.vs-sms-raw').textContent,f.data.messages[0].text);
  reload.data.messages[0].confirmation={date:'2099-10-08',time:'18:00',studentId:'student-1'};await reload.click('refresh');
  assert.equal(reload.field('date').value,'2099-10-08');assert.equal(reload.field('time').value,'18:00');
});
test('legacy scheduled message with no confirmation never labels its old parsed proposal as registered time',async()=>{
  const f=fixture({messages:[message('one',{status:'scheduled'})]});await f.open();
  assert.equal(f.field('date').value,'');assert.equal(f.field('time').value,'');assert.equal(f.field('time').disabled,true);assert.match(f.text(),/스케줄에서 확인/);
});

test('open modal rebinds owner before rendering or posting and clears detached token values, including overview401',async()=>{
  for(const unauthorized of [false,true]) {
    const f=fixture();await f.open();await f.click('pair');
    const oldToken=f.field('token');f.fill('mondayText','{name} owner-A private draft');f.fill('checked',true);
    f.sync.owner='owner-B';f.data.messages=[];f.data.unassigned=[];
    f.data.settings.mondayText='{name} owner-B authoritative template';
    if(unauthorized)f.control.handler=route=>route==='overview'?failure(401):undefined;
    const opening=f.open();assert.ok(!f.text().includes('합성 원문'));assert.equal(oldToken.value,'');await opening;
    assert.equal(f.field('token'),null);assert.ok(!f.text().includes('합성 원문'));
    if(!unauthorized){await f.click('settings');assert.equal(f.calls.find(c=>c.route==='settings').body.mondayText,f.data.settings.mondayText);}
    assert.ok(!f.calls.some(c=>c.route==='settings'&&c.body.mondayText==='{name} owner-A private draft'));
  }
});

test('every stale action and retained input/copy handler rejects owner changes before any side effect',async()=>{
  for(const key of ['settings','pair','copy-token','confirm','dismiss','revoke','prepare-monday','alias']) {
    const f=fixture({settings:{enabled:true,mondayTime:'10:00',tuesdayTime:'14:00',mondayText:'{name} A',tuesdayText:'{name} A'},
      device:{paired:true,relayOrigin:'https://synthetic-relay.example'},aliasChanges:[{id:'a',studentId:'student-1',oldName:'A',newName:'합성 정본 이름'}]});
    await f.open();await f.click('pair');const token=f.field('token'),oldInput=f.field('mondayText'),oldButton=f.action(key);
    assert.deepEqual(f.clipboard,['synthetic-one-time-token']);f.clipboard.length=0;
    f.calls.length=0;f.sync.owner='owner-B';oldButton.emit('click');oldInput.value='{name} stale';oldInput.emit('input');await settle();
    assert.equal(token.value,'');assert.equal(f.clipboard.length,0);assert.equal(f.calls.filter(c=>c.body).length,0,key);
    assert.ok(!f.text().includes('합성 원문'));assert.equal(f.field('mondayText'),null);
  }
});

test('persistent modal header refresh and close remain usable after owner isolation',async()=>{
  const f=fixture();await f.open();await f.click('pair');const oldToken=f.field('token');
  f.sync.owner='owner-B';f.data.messages=[];f.data.unassigned=[];f.data.settings.mondayText='{name} owner-B template';
  await f.click('settings');assert.equal(oldToken.value,'');assert.equal(!!f.field('mondayText'),false);
  await f.click('refresh');assert.equal(f.field('mondayText').value,'{name} owner-B template');
  assert.ok(!f.text().includes('합성 원문'));await f.click('close');assert.equal(!!f.query('.vs-sms-modal'),false);
});

test('logout and same-owner reconnection cannot resurrect drafts or a late pairing response',async()=>{
  const f=fixture();f.sync.epoch=1;await f.open();f.fill('mondayText','{name} old session');
  let release;const gate=new Promise(resolve=>{release=resolve;});
  f.control.handler=async route=>{if(route==='pair'){await gate;return ok({ok:true,token:'synthetic-late-token',relayOrigin:f.data.device.relayOrigin});}};
  f.action('pair').emit('click');await settle();f.sync.owner=null;f.sync.epoch++;
  await f.ctx.VSSms.refresh();assert.equal(!!f.field('mondayText'),false);assert.equal(!!f.field('token'),false);
  f.sync.owner='synthetic-owner';f.sync.epoch++;f.data.settings.mondayText='{name} fresh same owner';await f.open();
  release();await settle();assert.equal(f.field('token'),null);assert.equal(f.field('mondayText').value,'{name} fresh same owner');
  // A disconnect/reconnect entirely between actions is still detected by the real controller epoch.
  f.fill('mondayText','{name} another old draft');f.sync.epoch+=2;await f.open();
  assert.equal(f.field('mondayText').value,'{name} fresh same owner');
});

function actualDisplayFixture({lateEdit=false,skipDisplay=false,held=false,localMedia=false,providedFixture=null,canonicalRead=null}={}) {
  const f=providedFixture || fixture(),baseRevision=f.data.revision,memory=new Map(),host=f.document.createElement('input');host.value='uncommitted host draft';f.document.body.appendChild(host);
  const store={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k),key:i=>[...memory.keys()][i]??null,get length(){return memory.size;}};
  const photo='data:image/png;base64,'+'p'.repeat(6000),audio='data:audio/webm;base64,'+'a'.repeat(60000);
  if(localMedia) {
    store.setItem('synthetic-photo',photo);
    const hostSource=readFileSync(new URL('../index.html',import.meta.url),'utf8');
    const start=hostSource.indexOf('function _vsCarryRows('),end=hostSource.indexOf('var _vsSync=null;',start);
    assert.ok(start>=0&&end>start,'production media-retention adapter boundary');
    vm.runInContext(hostSource.slice(start,end),f.ctx);
  }
  let ui={students:[student('student-1',localMedia ? {photo:'',_photoKey:'synthetic-photo',audios:[{id:'audio-1',data:audio,_mediaKey:'synthetic-audio'}]} : {})],logs:[],payments:[],consults:[],inquiries:[],weekOvr:{}},allowEdit=lateEdit;
  let enterPut,releasePut;const entered=new Promise(resolve=>{enterPut=resolve;});
  const controller=syncRuntime.create({namespace:'sms-synthetic',instanceId:'one',store,backupStore:{...store,setItem(){throw Error('synthetic quota');}},
    overflowStore:{async put(key,text){if(JSON.parse(text).revision===baseRevision+1&&allowEdit){
      if(held){const wait=new Promise(resolve=>{releasePut=()=>resolve(text);});enterPut();return wait;}
      await new Promise(resolve=>setImmediate(resolve));host.focus();
    }return text;}},
    owner:()=> 'synthetic-owner',frozen:()=>false,
    editing:()=>!!f.document.querySelector('.ov.open')||f.document.activeElement.matches('input,textarea,select'),
    getData:()=>ui,setData:data=>{
      if(localMedia)for(const field of ['students','logs','consults','payments','inquiries']) {
        data[field]=f.ctx._vsCarryRows(data[field],ui[field]);
      }
      ui=data;
    },render:()=>f.calls.push({kind:'adapter-render'}),status:()=>{},ready:()=>{},later:fn=>queueMicrotask(fn)});
  controller.owner='synthetic-owner';controller.key='synthetic-journal';controller.ready=controller.confirmed=true;controller.unsubscribe=()=>{};
  controller.state={version:1,namespace:'sms-synthetic',owner:controller.owner,revision:baseRevision,base:syncRuntime.normalize(ui),local:syncRuntime.normalize(ui),recovery:[]};
  controller.doc={async get(){if(canonicalRead){const record=canonicalRead();return {exists:true,data:()=>({...clone(record.state),_vsSyncRevision:record.revision})};}
    const data={...syncRuntime.normalize(ui),_vsSyncRevision:f.data.revision};if(f.data.revision===8){const receipt=f.data.messages[0].confirmation;
    data.weekOvr={[receipt.date]:{[receipt.studentId]:[{day:'월',time:receipt.time,source:'sms-confirmed'}]}};}return {exists:true,data:()=>data};}};
  const display=controller.display;if(skipDisplay)controller.display=function(){this.displayRequired=false;};
  f.ctx._vsSync=controller;
  return {f,controller,host,ui:()=>ui,photo:()=>store.getItem('synthetic-photo'),audio,entered,release:()=>releasePut(),recover(){allowEdit=false;controller.display=display;f.document.body.focus();}};
}

test('actual VSSync retainLocal adapter applies schedule without dropping filtered local photo or large audio',async()=>{
  const {f,controller,ui,photo,audio}=actualDisplayFixture({localMedia:true});await f.open();
  f.fill('date','2099-10-06');f.fill('time','16:30');f.fill('checked',true);f.calls.length=0;await f.click('confirm');
  assert.equal(controller.state.revision,8);assert.equal(controller.pending(),0);assert.equal(controller.displayRequired,false);
  assert.equal(controller.state.local.students[0].photo,'');assert.equal(controller.state.local.students[0]._photoKey,undefined);
  assert.equal(controller.state.local.students[0].audios[0].data,'[saved]');
  assert.equal(ui().students[0]._photoKey,'synthetic-photo');assert.match(photo(),/^data:image\/png;base64,p{6000}$/);
  assert.equal(ui().students[0].audios[0].data,audio);assert.equal(ui().students[0].audios[0]._mediaKey,'synthetic-audio');
  assert.equal(ui().weekOvr['2099-10-06']['student-1'][0].time,'16:30');
  assert.equal(syncRuntime.equal(syncRuntime.normalize(ui()),controller.viewBase),true);
  assert.match(f.text(),/일정 1건이 등록되었습니다/);assert.ok(!f.text().includes('등록 결과를 아직 확인하지 못'));
  assert.equal(f.field('checked').checked,false);assert.equal(f.calls.filter(c=>c.route==='confirm').length,1);
  const applied=f.calls.findIndex(c=>c.kind==='adapter-render'),render=f.calls.findIndex(c=>c.kind==='render');assert.ok(applied>=0&&render>applied);
});

test('readback accepts an applied adapter viewBase that differs from the canonical journal',async()=>{
  const {f,controller,ui}=actualDisplayFixture({localMedia:true});
  const setData=controller.a.setData;
  // A display adapter may include local presentation data; the journal is not its display baseline.
  controller.a.setData=data=>{setData(data);ui().students[0].localMediaAvailable=true;};
  await f.open();f.fill('checked',true);await f.click('confirm');
  assert.equal(syncRuntime.equal(controller.viewBase,controller.state.local),false);
  assert.equal(syncRuntime.equal(syncRuntime.normalize(ui()),controller.viewBase),true);
  assert.equal(controller.displayRequired,false);assert.equal(controller.deferred,null);assert.equal(controller.state.ack,undefined);
  assert.equal(ui().weekOvr['2099-10-05']['student-1'][0].source,'sms-confirmed');
  assert.match(f.text(),/일정 1건이 등록되었습니다/);assert.equal(f.field('checked').checked,false);
});

test('actual VSSync held overflow readback retains pending drafts until host edit ends and display recovers',{timeout:5000},async()=>{
  const {f,controller,host,ui,recover,entered,release,photo,audio}=actualDisplayFixture({lateEdit:true,held:true,localMedia:true});await f.open();
  f.fill('date','2099-10-06');f.fill('time','16:30');f.fill('checked',true);f.fill('mondayText','{name} retained SMS draft');f.calls.length=0;
  const attempt=f.click('confirm');await entered;assert.equal(controller.hold,'durability');host.focus();release();await attempt;
  assert.equal(controller.state.revision,8);assert.equal(controller.ready,true);assert.equal(controller.pending(),0);
  assert.equal(ui().weekOvr['2099-10-06'],undefined);assert.equal(f.document.activeElement,host);assert.equal(host.value,'uncommitted host draft');
  assert.equal(f.calls.filter(c=>c.kind==='render'||c.kind==='adapter-render').length,0);assert.ok(!f.text().includes('일정 1건이 등록되었습니다'));
  assert.equal(f.field('checked').checked,true);assert.equal(f.field('date').value,'2099-10-06');assert.equal(f.field('time').value,'16:30');
  assert.equal(f.field('mondayText').value,'{name} retained SMS draft');assert.equal(f.action('confirm').disabled,true);
  assert.match(f.text(),/등록 결과를 아직 확인하지 못/);assert.equal(controller.displayRequired,true);
  recover();await f.click('refresh');assert.equal(ui().weekOvr['2099-10-06']['student-1'][0].source,'sms-confirmed');assert.equal(ui().weekOvr['2099-10-06']['student-1'][0].time,'16:30');
  assert.equal(controller.displayRequired,false);assert.equal(f.field('checked').checked,false);assert.equal(f.field('checked').disabled,true);
  assert.equal(ui().students[0]._photoKey,'synthetic-photo');assert.ok(photo().length>5000);assert.equal(ui().students[0].audios[0].data,audio);
  assert.equal(f.calls.filter(c=>c.route==='confirm').length,1);assert.ok(f.calls.some(c=>c.kind==='adapter-render'));
});

test('journal revision and cleared displayRequired without adapter display are insufficient readback proof',async()=>{
  const {f,controller,ui,recover}=actualDisplayFixture({skipDisplay:true});await f.open();f.fill('checked',true);f.calls.length=0;await f.click('confirm');
  assert.equal(controller.state.revision,8);assert.equal(ui().weekOvr['2099-10-05'],undefined);
  assert.equal(f.calls.filter(c=>c.kind==='render').length,0);assert.equal(f.field('checked').checked,true);assert.equal(f.action('confirm').disabled,true);
  recover();await f.click('refresh');assert.ok(ui().weekOvr['2099-10-05']);
});

test('native provider query preserves identical other-app/unknown-creator replies across sent, failed and unknown attempts',()=>{
  const engine=readFileSync(new URL('../native/android-sms-relay/src/com/tllhouse/hlbreplay/RelayEngine.java',import.meta.url),'utf8');
  const relayStore=readFileSync(new URL('../native/android-sms-relay/src/com/tllhouse/hlbreplay/RelayStore.java',import.meta.url),'utf8');
  const selection=engine.match(/"(date>=\? AND type IN \(1,2\))"/)[1],db=new DatabaseSync(':memory:');
  try {
    const attempts=relayStore.match(/CREATE TABLE attempts[^"\r\n]+/)[0];db.exec(attempts);
    db.exec('CREATE TABLE sms (_id INTEGER,address TEXT,body TEXT,date INTEGER,date_sent INTEGER,type INTEGER,creator TEXT)');
    for(const state of ['sent','failed','unknown'])db.prepare('INSERT INTO attempts(id,generation,phone,body,created,started,state) VALUES(?,?,?,?,?,?,?)').run(state,'old','01000001234','identical reply',1000,1000,state);
    let row=0;for(const creator of ['com.samsung.android.messaging','com.google.android.apps.messaging',null,'','com.tllhouse.hlbreplay'])db.prepare('INSERT INTO sms VALUES(?,?,?,?,?,?,?)').run(++row,'01000001234','identical reply',121000,121000,2,creator);
    db.prepare('INSERT INTO sms VALUES(?,?,?,?,?,?,?)').run(++row,'01000001234','historical',999,999,2,'com.samsung.android.messaging');
    const rows=db.prepare('SELECT * FROM sms WHERE '+selection+' ORDER BY date,_id').all(1000);assert.equal(rows.length,5);
    assert.ok(!engine.includes('store.ownSend('),'a fingerprint must never suppress another app or unknown creator');
    assert.ok(engine.includes('if (sent && context.getPackageName().equals(c.getString(6))) continue;'),'only own-package provider provenance suppresses a sent row');
    assert.ok(!relayStore.includes('boolean ownSend('),'remove the unsafe attempts fingerprint query');
    assert.equal(rows.filter(r=>r.creator!=='com.tllhouse.hlbreplay').length,4);
  } finally {db.close();}
});

test('all automatic native stop paths carry the failed engine generation to the locked stop operation',()=>{
  const engine=readFileSync(new URL('../native/android-sms-relay/src/com/tllhouse/hlbreplay/RelayEngine.java',import.meta.url),'utf8');
  const calls=engine.match(/RelayConfig\.stop\([^;]+/g);assert.equal(calls.length,4);
  for(const call of calls)assert.match(call,/RelayConfig\.stop\(context, config\.generation,/);
});

const callCard=(id='call-1',extra={})=>({id,phone:'01000009999',receivedAt:Date.parse('2026-10-05T09:00:00+09:00'),name:'',studentId:null,matchStatus:'unknown',status:'pending',...extra});

test('call consent requires owner opt-in, preserves all same-owner drafts and only writes call settings',async()=>{
  const f=fixture({device:{paired:true,relayOrigin:'https://synthetic-relay.example'},calls:[callCard()]});await f.open();
  assert.equal(f.field('callEnabled').checked,false);assert.equal(f.field('includeUnknown').checked,false);
  assert.match(f.text(),/발신자 표시 제공자가 변경/);assert.equal(f.field('callName').value,'');
  f.fill('callEnabled',true);f.fill('includeUnknown',true);f.fill('callName','owner draft');f.fill('callMemo','memo draft');
  f.fill('mondayText','{name} SMS retained');f.fill('date','2099-10-06');f.fill('time','15:15');f.fill('checked',true);await f.click('refresh');
  assert.equal(f.field('callEnabled').checked,true);assert.equal(f.field('includeUnknown').checked,true);
  assert.equal(f.field('callName').value,'owner draft');assert.equal(f.field('callMemo').value,'memo draft');assert.equal(f.field('time').value,'15:15');assert.equal(f.field('checked').checked,true);
  f.control.confirm=false;await f.click('call-settings');assert.equal(f.calls.filter(c=>c.route==='call-settings').length,0);
  f.control.confirm=true;await f.click('call-settings');assert.deepEqual(f.calls.find(c=>c.route==='call-settings').body,{enabled:true,includeUnknown:true});
  assert.equal(f.calls.filter(c=>c.route==='settings'||c.route==='confirm').length,0);assert.equal(f.field('mondayText').value,'{name} SMS retained');
  f.fill('callEnabled',false);f.control.confirm=false;await f.click('call-settings');assert.equal(f.data.callSettings.enabled,false);
  await f.click('call-dismiss');assert.equal(f.data.calls[0].status,'acknowledged');assert.match(f.text(),/확인 완료/);assert.equal(f.action('call-dismiss').disabled,true);
  assert.equal(f.field('callName').value,'owner draft');assert.equal(f.calls.filter(c=>c.route==='confirm').length,0);
});

test('call names use current explicit person links and text nodes; no guesses for unlinked duplicate or stale revision',async()=>{
  const hostile='<img src=x onerror="bad()"><script>bad()</script>';
  const f=fixture({calls:[callCard('one',{phone:'01000001234',name:'untrusted alias',studentId:'student-1',matchStatus:'matched'}),callCard('two',{phone:'01000003333',name:hostile,matchStatus:'known-contact'})]});
  f.sync.state.base.students[0].consultData={id:'c1'};
  f.sync.state.base.consults=[{id:'c1',phone:'01000001234',name:'old alias'},{id:'c3',phone:'01000003333',name:hostile}];
  f.sync.state.base.inquiries=[{id:'q1',phone:'01000001234',studentId:'student-1',name:'inquiry alias'}];
  await f.open();assert.match(f.query('[data-call-id="one"]').textContent,/합성 정본 이름/);assert.ok(!f.text().includes('untrusted alias'));
  assert.ok(f.query('[data-call-id="two"]').textContent.includes(hostile));assert.equal(f.query('img'),null);assert.equal(f.query('script'),null);
  f.sync.state.base.consults.push({id:'not-linked',phone:'01000001234',name:'합성 정본 이름'});await f.click('refresh');
  assert.match(f.query('[data-call-id="one"]').textContent,/여러 연락처와 일치/);
  f.data.revision++;f.control.retry=false;await f.click('refresh');assert.ok(!f.query('[data-call-id="two"]').textContent.includes(hostile));
});

test('call actions, inputs and late responses are isolated on owner/epoch changes including overview failure',async()=>{
  const f=fixture({device:{paired:true,relayOrigin:'https://synthetic-relay.example'},calls:[callCard()]});await f.open();
  f.fill('callName','owner A private');f.fill('callEnabled',true);f.fill('includeUnknown',true);
  const staleDismiss=f.action('call-dismiss'),staleInquiry=f.action('call-inquiry'),staleSettings=f.action('call-settings'),staleInput=f.field('callName');
  f.calls.length=0;f.sync.owner='owner B';staleDismiss.emit('click');staleInquiry.emit('click');staleSettings.emit('click');staleInput.value='retained private';staleInput.emit('input');await settle();
  assert.equal(f.calls.filter(c=>c.body).length,0);assert.ok(!f.text().includes('owner A private'));assert.equal(f.field('callName'),null);
  f.data.calls=[];f.data.messages=[];f.control.handler=route=>route==='overview'?failure(401):undefined;await f.click('refresh');assert.equal(f.field('callEnabled'),null);
  f.control.handler=null;await f.click('refresh');assert.equal(f.field('callEnabled').checked,false);assert.equal(f.field('includeUnknown').checked,false);
  const g=fixture({device:{paired:true,relayOrigin:'https://synthetic-relay.example'},calls:[callCard()]});g.sync.epoch=1;await g.open();g.fill('callName','private old login');
  let release;const held=new Promise(resolve=>{release=resolve;});g.control.handler=async route=>{if(route==='call-dismiss'){await held;return ok({ok:true});}};
  g.action('call-dismiss').emit('click');await settle();g.sync.epoch+=2;g.data.calls=[];await g.ctx.VSSms.refresh();release();await settle();
  assert.equal(g.field('callName'),null);assert.ok(!g.text().includes('private old login'));
});

test('schedule window suggestions require click, preserve off-grid request, manual final confirmation and stale handlers',async()=>{
  const f=fixture();await f.open();f.fill('date','2099-10-06');f.fill('time','15:15');f.fill('startTime','12:00');f.fill('endTime','20:00');
  assert.equal(f.field('time').step,'60');await f.click('options');
  assert.deepEqual(f.calls.find(c=>c.route==='options').body,{baseRevision:7,messageId:'message-1',studentId:'student-1',date:'2099-10-06',startTime:'12:00',endTime:'20:00',preferredTime:'15:15'});
  assert.equal(f.calls.filter(c=>c.route==='confirm').length,0);assert.equal(f.field('checked').checked,false);
  const stale=f.action('choose-option');f.fill('endTime','19:00');stale.emit('click');await settle();assert.match(f.text(),/시간 후보를 다시/);
  await f.click('options');await f.click('choose-option');assert.equal(f.field('time').value,'15:15');assert.equal(f.calls.filter(c=>c.route==='confirm').length,0);
  f.fill('checked',true);f.control.confirm=false;await f.click('confirm');assert.equal(f.calls.filter(c=>c.route==='confirm').length,0);
  f.control.confirm=true;await f.click('confirm');assert.equal(f.calls.find(c=>c.route==='confirm').body.entries[0].time,'15:15');assert.match(f.text(),/일정 1건이 등록/);
  const g=fixture();await g.open();g.fill('startTime','12:00');g.fill('endTime','20:00');await g.click('options');const old=g.action('choose-option');
  g.sync.owner='other';old.emit('click');await settle();assert.equal(g.field('time'),null);assert.equal(g.calls.filter(c=>c.route==='confirm').length,0);
});

async function studioOwnerFixture(t,{lateEdit=false,held=false}={}) {
  const f=fixture({revision:0,messages:[],calls:[],unassigned:[]}),db=new DatabaseSync(':memory:');t.after(()=>db.close());let tail=Promise.resolve();
  const ctx={storage:{sql:{exec(query,...params){const rows=db.prepare(query).all(...params);return {toArray:()=>rows};}},
    transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}},async getAlarm(){return null;},async setAlarm(){}},
    blockConcurrencyWhile(fn){const result=tail.then(fn);tail=result.catch(()=>{});return result;},getWebSockets(){return [];}};
  const state=new StudioState(ctx,{ENVIRONMENT:'local-test',SMS_RELAY_ORIGIN:'http://127.0.0.1:8837'});
  const owner=(route,body)=>state.fetch(new Request('https://studio.internal/'+route,{method:body===undefined?'GET':'POST',headers:{'X-VS-Principal':'synthetic-owner'},...(body===undefined?{}:{body:JSON.stringify(body)})}));
  assert.equal((await owner('import',{state:{students:[student()],consults:[],inquiries:[],weekOvr:{}}})).status,201);
  const exp=await (await owner('export')).json();assert.equal((await owner('activate',{hash:exp.hash})).status,200);
  const paired=await (await owner('sms/pair',{relayOrigin:'http://127.0.0.1:8837'})).json();await owner('sms/call-settings',{enabled:true,includeUnknown:true});
  const send=(path,body)=>state.fetch(new Request('https://studio.internal/sms-device/'+path,{method:'POST',headers:{Authorization:'Bearer '+paired.token},body:JSON.stringify(body)}));
  const call=await send('call',{id:'observed-call',phone:'01000009999',receivedAt:Date.now(),direction:'incoming'});assert.equal(call.status,200);
  Object.assign(f.data,await (await owner('sms/overview')).json());
  f.ctx.VCFTransport.api=async(path,options)=>{
    const route=path.split('/').at(-1);f.calls.push({kind:'api',route,body:options.body&&clone(options.body),options});
    if(f.control.handler){const custom=await f.control.handler(route,options.body);if(custom!==undefined)return custom;}
    const response=await owner('sms/'+route,options.body),data=await response.json();if(route==='overview'&&response.ok)Object.assign(f.data,clone(data));return {response,data};
  };
  const actual=actualDisplayFixture({providedFixture:f,canonicalRead:()=>state.record(),lateEdit,held});
  return {...actual,state,send,owner,db};
}

test('real SQLite StudioState + actual VSSync connection-test UI preserves disabled automation through native claim ACK and duplicate readback',async t=>{
  const {f,state,send,owner,db}=await studioOwnerFixture(t);await f.open();const before=clone(state.record());
  f.fill('testPhone','+82 10-0000-1234');await f.click('test-message');assert.equal(f.field('testPhone').value,'');
  const row=db.prepare('SELECT * FROM sms_outbox').get();assert.equal(row.stage,'connection-test');assert.match(f.text(),/연결 시험 · 전송 대기/);
  f.fill('mondayText','{name} changed reminder draft');await f.click('settings');assert.equal(state.getKV('sms.settings').enabled,false);
  assert.equal(db.prepare('SELECT status FROM sms_outbox').get().status,'pending');
  const claim=await send('claim',{id:row.id});assert.equal(claim.status,200);const message=(await claim.json()).message;
  assert.deepEqual(Object.keys(message).sort(),['id','phone','text']);assert.equal(message.phone,'01000001234');
  assert.equal((await send('ack',{id:row.id,status:'unknown'})).status,200);
  await f.click('refresh');assert.match(f.text(),/연결 시험 · 전송 결과 불확실 · 자동 재시도 없음/);
  f.fill('testPhone','01000001234');await f.click('test-message');assert.match(f.text(),/기존 요청 확인 · 전송 결과 불확실/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM sms_outbox').get().n,1);assert.deepEqual(state.record(),before);
  assert.equal((await owner('sms/overview')).status,200);assert.equal(state.getKV('sms.settings').enabled,false);
});

test('real SQLite StudioState + actual VSSync owner call-to-inquiry CAS and durable display readback',async t=>{
  const {f,state,controller,ui}=await studioOwnerFixture(t);await f.open();await f.click('call-inquiry');assert.match(f.text(),/문의자 이름을 직접/);assert.equal(state.record().revision,0);
  f.fill('callName','Owner explicit <name>');f.fill('callMemo','explicit memo');f.control.confirm=false;await f.click('call-inquiry');assert.equal(state.record().revision,0);
  f.control.confirm=true;await f.click('call-inquiry');assert.equal(state.record().revision,1);assert.equal(controller.state.revision,1);
  assert.equal(ui().inquiries[0].name,'Owner explicit <name>');assert.equal(ui().inquiries[0].memo,'explicit memo');assert.equal(ui().inquiries[0].visitDate,'');assert.deepEqual(clone(ui().weekOvr),{});
  assert.match(f.text(),/문의자 등록 결과를 확인/);assert.equal(f.field('callName'),null);assert.equal(f.data.calls[0].status,'acknowledged');
  const accepted=f.calls.find(c=>c.route==='call-inquiry');assert.equal(accepted.body.baseRevision,0);assert.equal(f.calls.filter(c=>c.route==='call-inquiry').length,1);
});

test('real StudioState call inquiry + actual async VSSync overflow host-edit race retains drafts until authoritative display',{timeout:5000},async t=>{
  const {f,state,controller,host,ui,recover,entered,release}=await studioOwnerFixture(t,{lateEdit:true,held:true});await f.open();
  f.fill('callName','retained inquiry name');f.fill('callMemo','retained inquiry memo');f.fill('mondayText','{name} retained reminder');
  const pending=f.click('call-inquiry');await entered;assert.equal(controller.hold,'durability');host.focus();release();await pending;
  assert.equal(state.record().revision,1);assert.equal(controller.state.revision,1);assert.equal(ui().inquiries.length,0);assert.equal(host.value,'uncommitted host draft');assert.equal(f.document.activeElement,host);
  assert.match(f.text(),/등록 결과를 아직 확인하지 못/);assert.equal(f.field('callName').value,'retained inquiry name');assert.equal(f.field('callMemo').value,'retained inquiry memo');
  assert.equal(f.field('mondayText').value,'{name} retained reminder');assert.equal(f.action('call-inquiry').disabled,true);assert.equal(controller.displayRequired,true);
  assert.equal(f.calls.filter(c=>c.kind==='render'||c.kind==='adapter-render').length,0);assert.equal(f.calls.filter(c=>c.route==='call-inquiry').length,1);
  recover();await f.click('refresh');assert.equal(ui().inquiries[0].name,'retained inquiry name');assert.equal(controller.displayRequired,false);assert.equal(f.field('callName'),null);
  assert.equal(f.calls.filter(c=>c.route==='call-inquiry').length,1);assert.equal(f.field('mondayText').value,'{name} retained reminder');assert.equal(f.data.calls[0].status,'acknowledged');
});

test('real StudioState schedule options never book; actual VSSync final confirmation reads exact off-grid accepted time',async t=>{
  const {f,state,send,controller,ui}=await studioOwnerFixture(t);
  assert.equal((await send('event',{id:'student-sms',phone:'01000001234',text:'unambiguous owner window',receivedAt:Date.now(),direction:'received'})).status,200);
  await f.open();f.fill('date','2099-10-06');f.fill('time','15:15');f.fill('startTime','12:00');f.fill('endTime','20:00');await f.click('options');
  assert.equal(state.record().revision,0);assert.equal(f.action('choose-option').textContent.includes('15:15'),true);await f.click('choose-option');assert.equal(f.field('time').value,'15:15');
  assert.equal(state.record().revision,0);f.fill('checked',true);await f.click('confirm');assert.equal(state.record().revision,1);assert.equal(controller.state.revision,1);
  const slots=Object.values(ui().weekOvr).flatMap(week=>Object.values(week).flat());assert.equal(slots[0].time,'15:15');assert.match(f.text(),/일정 1건이 등록/);
  assert.equal(f.calls.filter(c=>c.route==='confirm').length,1);
});

test('pending suggestion response and retained choice invalidate on each edited date/window/requested time',async()=>{
  for(const [key,value] of [['date','2099-10-07'],['startTime','13:00'],['endTime','19:00'],['time','16:15']]) {
    const f=fixture();await f.open();f.fill('date','2099-10-06');f.fill('time','15:15');f.fill('startTime','12:00');f.fill('endTime','20:00');
    f.control.handler=route=>{if(route==='options')f.fill(key,value);};await f.click('options');assert.equal(f.action('choose-option'),null);assert.equal(f.field(key).value,value);
    f.control.handler=null;await f.click('options');const stale=f.action('choose-option');f.fill(key,key==='date'?'2099-10-08':key==='time'?'17:15':key==='startTime'?'14:00':'18:00');
    stale.emit('click');await settle();assert.match(f.text(),/시간 후보를 다시/);assert.equal(f.calls.filter(c=>c.route==='confirm').length,0);
  }
});

test('real StudioState concurrent call-inquiry CAS409 keeps explicit owner fields and never guesses identity',async t=>{
  const {f,state,owner}=await studioOwnerFixture(t);await f.open();f.fill('callName','Owner exact');f.fill('callMemo','retained memo');
  f.control.handler=async route=>{if(route==='call-inquiry'){const r=state.record();assert.equal((await owner('commit',{requestId:'synthetic-host-edit',baseRevision:r.revision,state:{...r.state,hostFlag:'retain'}})).status,200);}};
  await f.click('call-inquiry');await actionSettled(f,'call-inquiry');assert.equal(state.record().revision,1);assert.equal(state.record().state.inquiries.length,0);assert.match(f.text(),/자료가 변경/);
  assert.equal(f.field('callName').value,'Owner exact');assert.equal(f.field('callMemo').value,'retained memo');
  f.control.handler=null;await f.click('refresh');assert.equal(f.field('callName').value,'Owner exact');await f.click('call-inquiry');await actionSettled(f,'call-inquiry');assert.equal(state.record().revision,2);assert.equal(state.record().state.inquiries[0].name,'Owner exact');
});

test('real accepted call inquiry response discarded after owner changes, without leaking drafts or readback',async t=>{
  const {f,state,owner}=await studioOwnerFixture(t);await f.open();f.fill('callName','Owner A private');f.fill('callMemo','private memo');
  let release,entered;const ready=new Promise(resolve=>{entered=resolve;});
  f.control.handler=async(route,body)=>{if(route==='call-inquiry'){
    const response=await owner('sms/call-inquiry',body),data=await response.json();assert.equal(response.status,200);entered();await new Promise(resolve=>{release=resolve;});return {response,data};
  }if(route==='overview'&&f.ctx._vsSync.owner==='other-owner')return failure(401);};
  f.action('call-inquiry').emit('click');await ready;f.ctx._vsSync={owner:'other-owner',ready:false,confirmed:false};await f.ctx.VSSms.refresh();release();await settle();
  assert.equal(state.record().revision,1);assert.equal(f.field('callName'),null);assert.ok(!f.text().includes('Owner A private'));assert.ok(!f.text().includes('private memo'));
  assert.equal(f.calls.filter(c=>c.kind==='adapter-render'||c.kind==='render').length,0);assert.ok(!f.text().includes('문의자 등록 결과를 확인'));
});

test('UI reciprocal host inquiry-consult-student chain shows canonical name only with unique consistent IDs',async()=>{
  const base={students:[student('student-1',{consultData:{id:'c1'}})],consults:[{id:'c1',phone:'01000001234',name:'consult alias',_inquiryId:'q1'}],
    inquiries:[{id:'q1',phone:'01000001234',name:'inquiry alias',consultId:'c1'}]};
  for(const mutate of [()=>{},s=>delete s.inquiries[0].consultId,s=>delete s.consults[0]._inquiryId,s=>s.inquiries[0].consultId='missing',
    s=>s.inquiries.push({...s.inquiries[0],id:'q2'}),s=>s.consults.push({...s.consults[0]}),s=>s.inquiries.push({...s.inquiries[0]}),
    s=>s.students.push(student('student-2',{consultData:{id:'c1'}})),s=>s.inquiries[0].studentId='missing',
    s=>{s.students.push(student('student-2'));s.inquiries[0].studentId='student-2';}]) {
    const f=fixture({calls:[callCard('chain',{phone:'01000001234',name:'untrusted server alias',studentId:'student-1',matchStatus:'matched'})]});
    const canonical=clone(base);mutate(canonical);f.sync.state.base=canonical;await f.open();const text=f.query('[data-call-id="chain"]').textContent;
    if(JSON.stringify(canonical)===JSON.stringify(base))assert.match(text,/합성 정본 이름/);else{assert.match(text,/여러 연락처와 일치/);assert.ok(!text.includes('합성 정본 이름'));}
    assert.ok(!text.includes('consult alias'));assert.ok(!text.includes('inquiry alias'));assert.ok(!text.includes('untrusted server alias'));
  }
});

test('editing date/window/student/requested time immediately removes stale recommendation DOM and retains focused input',async()=>{
  for(const [key,value] of [['date','2099-10-07'],['startTime','13:00'],['endTime','19:00'],['studentId',''],['time','16:15']]) {
    const f=fixture();await f.open();f.fill('date','2099-10-06');f.fill('time','15:15');f.fill('startTime','12:00');f.fill('endTime','20:00');await f.click('options');
    const old=f.action('choose-option'),edited=f.field(key),date=f.field('date'),time=f.field('time');edited.focus();edited.selectionStart=1;edited.selectionEnd=3;
    f.calls.length=0;f.fill(key,value);assert.equal(f.action('choose-option'),null);assert.equal(old.disabled,true);assert.equal(f.query('[data-schedule-options]'),null);
    assert.equal(f.field(key),edited);assert.equal(f.document.activeElement,edited);assert.equal(edited.selectionStart,1);assert.equal(edited.selectionEnd,3);
    assert.equal(f.field('date'),date);assert.equal(f.field('time'),time);assert.equal(edited.value,value);
    old.emit('click');await settle();assert.equal(edited.value,value);assert.equal(f.calls.filter(c=>c.kind==='api'||c.kind==='render'||c.kind==='retry').length,0);
    assert.match(f.text(),/시간 후보를 다시 확인/);assert.ok(!f.text().includes('시간 후보를 입력했습니다'));
  }
});
