import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import syncRuntime from '../vs-sync.js';
import {DatabaseSync} from 'node:sqlite';

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
  const data={ok:true,settings:{enabled:false,mondayTime:'10:00',tuesdayTime:'14:00',mondayText:'{name}님 가능 시간을 알려 주세요.',tuesdayText:'{name}님 일정 확인 부탁드립니다.'},device:{paired:false,lastSeen:null,relayOrigin:'https://synthetic-relay.example'},revision:7,weekStart:'2026-09-28',unassigned:[{id:'student-1',name:'신뢰하지 않을 별명'}],messages:[message()],outbox:[],aliasChanges:[],...extra};
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
      if(route==='prepare'){return ok({ok:true,count:1});}
      if(route==='dismiss'){data.messages.find(m=>m.id===options.body.messageId).status='dismissed';return ok({ok:true});}
      if(route==='revoke'){data.device.paired=false;data.settings.enabled=false;return ok({ok:true});}
      if(route==='pair'){data.device.paired=true;return ok({ok:true,token:'synthetic-one-time-token',deviceId:'device-test',relayOrigin:data.device.relayOrigin});}
      throw Error('Unexpected test route');
    }}});
  vm.runInContext(source,ctx);
  const query=selector=>document.body.querySelector(selector);
  const action=key=>query(`[data-action="${key}"]`);
  const card=()=>query('[data-message-id]') || query('.vs-sms-card');
  const field=(key,parent=document.body)=>parent.querySelector(`[data-field="${key}"]`);
  async function click(key) { const el=action(key);assert.ok(el,`button ${key} exists`);assert.equal(el.disabled,false,`button ${key} enabled`);el.emit('click');await settle(); }
  function fill(key,value,parent=document.body) { const el=field(key,parent);assert.ok(el,`field ${key} exists`); if(el.type==='checkbox')el.checked=value;else el.value=value;el.emit(el.tagName==='select'?'change':'input'); }
  return {ctx,document,calls,clipboard,data,control,sync,query,action,card,field,click,fill,text:()=>document.body.textContent,open:()=>ctx.VSSms.open()};
}
function ok(data) { return {response:{ok:true,status:200},data}; }
function failure(status) { return {response:{ok:false,status},data:{ok:false,error:'synthetic-secret-error-never-display'}}; }
async function settle() { for(let i=0;i<4;i++) await new Promise(resolve=>setImmediate(resolve)); }

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
test('one-time pairing uses password value only, copies explicitly, clears on close and cannot rotate without confirmation',async()=>{
  const f=fixture();await f.open();f.control.confirm=false;await f.click('pair');assert.equal(f.calls.filter(c=>c.route==='pair').length,0);
  f.control.confirm=true;await f.click('pair');const token=f.field('token');assert.equal(token.type,'password');assert.equal(token.value,'synthetic-one-time-token');
  assert.equal(token.getAttribute('value'),undefined);assert.ok(!f.text().includes(token.value));assert.equal(f.action('copy-token').disabled,false);
  await f.click('copy-token');assert.deepEqual(f.clipboard,['synthetic-one-time-token']);
  f.ctx.VSSms.close();assert.equal(token.value,'');await f.open();assert.equal(f.field('token'),null);
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

function actualDisplayFixture({lateEdit=false,skipDisplay=false,held=false,localMedia=false}={}) {
  const f=fixture(),memory=new Map(),host=f.document.createElement('input');host.value='uncommitted host draft';f.document.body.appendChild(host);
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
    overflowStore:{async put(key,text){if(JSON.parse(text).revision===8&&allowEdit){
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
  controller.state={version:1,namespace:'sms-synthetic',owner:controller.owner,revision:7,base:syncRuntime.normalize(ui),local:syncRuntime.normalize(ui),recovery:[]};
  controller.doc={async get(){const data={...syncRuntime.normalize(ui),_vsSyncRevision:f.data.revision};if(f.data.revision===8){const receipt=f.data.messages[0].confirmation;
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
