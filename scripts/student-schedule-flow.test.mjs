import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(process.env.STUDENT_SCHEDULE_SOURCE||new URL('../index.html',import.meta.url),'utf8');
const source=(start,end)=>{
  const a=html.indexOf(start),b=html.indexOf(end,a);
  assert.ok(a>=0&&b>a,`${start} boundary`);
  return html.slice(a,b);
};
const copy=value=>JSON.parse(JSON.stringify(value));
const mon=new Date(2026,8,28);
const student=(id,extra={})=>({id,name:id,status:'수강중',schedType:'fixed',days:['월'],times:{월:'10:00'},st:'2026-09-01',...extra});
function setup(){
  const nodes={},calls={save:0,undo:0,render:0,today:0,open:[],timers:[]};
  const ctx=vm.createContext({Date,console,students:[],consults:[],inquiries:[],weekOvr:{},editSid:null,curSType:'fixed',ALL7:['월','화','수','목','금','토','일'],JSDOW:['일','월','화','수','목','금','토'],HRS_LBL:['10:00','11:00','12:00'],page:'schedule',mobileSchedDay:0,
    parseDateLocal:ds=>{const [y,m,d]=ds.split('-').map(Number);return new Date(y,m-1,d);},getViewMon:()=>mon,loadHolidaysForView:callback=>callback(),setTimeout:callback=>calls.timers.push(callback),isMobile:()=>true,PT:{schedule:'주간 스케줄'},_removeConsultFixedBar:()=>{},updateSchedCfgUI:()=>{},
    ge:id=>nodes[id]||null,gv:id=>nodes[id]?.value||'',pushUndo:()=>calls.undo++,saveAll:()=>calls.save++,renderSidebarToday:()=>calls.today++,renderScheduleContent:()=>calls.render++,render:()=>calls.render++,toast:()=>{},cm:()=>{},om:id=>calls.open.push(id),uid:()=> 'new-student',window:{scrollY:0,_bulkSelections:{}},
    gc:()=> '#456',esc:v=>String(v),fmtS:d=>String(d.getDate()),isOffDay:()=>false,getOffLabel:()=> '휴무',scheduleStatusLabel:()=> '확정',scheduleAvatarHtml:()=>'',scheduleTimeControl:()=>'<button onclick="event.stopPropagation()">시간</button>',scheduleKindKey:()=> 'solo',scheduleLessonKind:()=> '개인',buildMobileScheduleSummary:()=>''});
  ctx.document={getElementById:id=>nodes[id]||null,querySelectorAll:()=>[],body:{attributes:{},setAttribute(key,value){this.attributes[key]=value;},appendChild:m=>{nodes[m.id]=m;}},createElement:()=>({dataset:{},remove(){delete nodes[this.id];}})};
  for(const name of ['getMon','toDS','addDays','getWK'])vm.runInContext(html.match(new RegExp('function '+name+'\\([^\\n]+'))[0],ctx);
  vm.runInContext(source('function consultDateEntries(c){','function getWeekSched(mon){'),ctx);
  vm.runInContext(source('function getWeekSched(mon){','function createScheduleResetSnapshot('),ctx);
  vm.runInContext(source('function openQuickSlot(','/* ── 연기 횟수 관리 ── */'),ctx);
  vm.runInContext(source('function openBulkSchedule(','function parseDateLocal('),ctx);
  vm.runInContext(source("var qsDay=''",'/* FULL WEEK EDIT */'),ctx);
  vm.runInContext(source('function studentFlexWeekRowHtml(','function openSModal('),ctx);
  vm.runInContext(source('function buildMobileWeekView(','function buildMobileSchedule('),ctx);
  vm.runInContext(source('async function saveStudent(','function delStudent('),ctx);
  vm.runInContext(source('function go(p){','function render(){'),ctx);
  vm.runInContext(source('function updateMobileTabBar(){','/* 창 크기 변경 시 처리 */'),ctx);
  // Entry helper is added next to the existing student modal, when implemented.
  if(html.includes('async function openStudentConfirmedSchedule('))vm.runInContext(source('async function openStudentConfirmedSchedule(','function tDay('),ctx);
  const week=ctx.getWK(mon);
  ctx.scheduleTimeOptions=time=>`<option selected>${time}</option>`;
  function bulk(entries,initial=1){
    const modal={dataset:{initialConfirmedCount:String(initial)},querySelectorAll:selector=>selector==='.bulk-confirmed-row'?entries.map(cd=>({querySelector:sel=>({value:sel==='.bulk-confirmed-date'?cd.date:cd.time})})):[],remove(){delete nodes.mBulkSched;}};
    nodes.mBulkSched=modal;nodes['bulk-error']={style:{},textContent:''};
    return modal;
  }
  function form(s){
    ctx.editSid=s?.id||null;ctx.pendingConvertId=null;ctx.curSType=s?.schedType||'fixed';ctx.curFreq=1;ctx.curIntervalWeeks=1;
    const fields={'s-nm':s?.name||'새 학생','s-cls':'pro','s-gd':'여성','s-age':'','s-ph':'','s-st':'2026-09-01','s-memo':'보존할 메모','s-stat':'수강중','s-fee':'','s-lesson-offset':'','s-photo-data':'','ts-월':'10:00','ts-화':'11:00','ts-금':'11:00'};
    for(const [id,value] of Object.entries(fields))nodes[id]={value};
    nodes['s-schedule-error']={style:{},textContent:'',scrollIntoView(){}};
    ctx.document.querySelectorAll=selector=>selector==='#s-dpick .dpb.on'?(ctx.formDays||['월']).map(textContent=>({textContent})):[];
    ctx.isKeptPhotoReference=()=>false;ctx.syncStudentPaymentCycles=()=>{};
  }
  return {ctx,nodes,calls,week,bulk,form,slots:(m=mon)=>copy(ctx.getWeekSched(m))};
}

test('assigning one student leaves unrelated weeks derived so recurrence edits take effect',async()=>{
  const {ctx,week,form,slots}=setup();
  ctx.students=[student('a'),student('b',{days:['화'],times:{화:'11:00'}})];
  ctx.qsDate='2026-09-30';ctx.qsDay='수';ctx.qsTime='12:00';ctx.qsSel={a:true};ctx.saveQS();
  assert.equal(Object.hasOwn(ctx.weekOvr[week],'b'),false,'unselected student must not acquire a frozen override');
  form(ctx.students[1]);ctx.formDays=['금'];await ctx.saveStudent();
  assert.ok(slots()['금_11:00'].some(x=>x.s.id==='b'));
});

test('removing the last confirmation validates restored recurrence transactionally',()=>{
  const {ctx,bulk,calls}=setup();
  ctx.students=[student('a',{confirmedDates:[{date:'2026-09-29',time:'11:00'}]}),student('b')];
  bulk([]);const before=copy(ctx.students);ctx.saveBulkSchedule('a');
  assert.deepEqual(copy(ctx.students),before,'collision must leave confirmations unchanged');
  assert.equal(calls.save,0);assert.equal(calls.undo,0);
});

test('confirming a date must preserve a manual cancellation at the same date and time',()=>{
  const {ctx,week,bulk}=setup();ctx.students=[student('a')];
  const canceled={day:'화',time:'11:00',absent:true,kind:'cancel',source:'weekOvr',makeupOf:'original'};
  ctx.weekOvr[week]={a:[canceled]};const before=copy(canceled);bulk([{date:'2026-09-29',time:'11:00'}],0);ctx.saveBulkSchedule('a');
  assert.deepEqual(copy(ctx.weekOvr[week].a),[before]);
});

test('saving a flexible student checks proposed week rows before committing the student',async()=>{
  const {ctx,nodes,week,form,calls}=setup();ctx.students=[student('a',{schedType:'flex',days:[]}),student('b')];form(ctx.students[0]);
  nodes['s-flex-week-rows']={};ctx.document.querySelectorAll=selector=>selector==='#s-flex-week-rows .s-flex-week-row'?[{querySelector:sel=>({value:sel==='.s-flex-day'?'월':'10:00'})}]:[];
  const before=copy(ctx.students);await ctx.saveStudent();
  assert.deepEqual(copy(ctx.students),before);assert.equal(ctx.weekOvr[week],undefined);assert.equal(calls.save,0);
});

test('student edit has a confirmed-date entry that leaves the draft intact',async()=>{
  const {ctx,nodes,form,calls}=setup();ctx.students=[student('a')];form(ctx.students[0]);
  assert.match(html,/>일정 확정 등록<\/button>/);
  const before=copy(ctx.students),draft=copy(nodes['s-memo']);ctx.openBulkSchedule=id=>calls.open.push(id);
  await ctx.openStudentConfirmedSchedule();
  assert.deepEqual(calls.open,['a']);assert.deepEqual(copy(nodes['s-memo']),draft);assert.deepEqual(copy(ctx.students),before);assert.equal(calls.save,0);
});

test('viewed week date opens the existing quick dialog with the exact clicked date',()=>{
  const {ctx}=setup();const calls=[];ctx.cellClick=(...args)=>calls.push(args);
  ctx.openQuickSlot('2026-10-09');
  assert.equal(calls[0][0],'금');assert.equal(calls[0][2],'2026-10-09');
  const glance=ctx.buildWeekGlance(new Date(2026,9,5),{});
  assert.match(glance,/data-date="2026-10-09"[^>]*onclick="[^"]*openQuickSlot/);
});

test('confirmed dates add, update and remove without duplicating manual makeup or changing an empty week',()=>{
  const {ctx,week,bulk,slots,calls}=setup();ctx.students=[student('a')];
  const makeup={day:'수',time:'17:00',absent:false,kind:'makeup',makeupOf:'missed-lesson'};
  const emptyWeek=ctx.getWK(ctx.addDays(mon,7));ctx.weekOvr={[week]:{a:[makeup]},[emptyWeek]:{a:[]}};
  bulk([{date:'2026-10-02',time:'11:30'},{date:'2026-10-02',time:'11:30'}],0);ctx.saveBulkSchedule('a');
  assert.deepEqual(Object.keys(slots()).sort(),['금_11:30','수_17:00']);
  assert.equal(ctx.students[0].confirmedDates.length,1);assert.deepEqual(copy(ctx.weekOvr[emptyWeek].a),[]);
  bulk([{date:'2026-10-01',time:'16:30'}]);ctx.saveBulkSchedule('a');
  assert.deepEqual(Object.keys(slots()).sort(),['목_16:30','수_17:00']);
  bulk([]);ctx.saveBulkSchedule('a');
  assert.deepEqual(Object.keys(slots()),['수_17:00']);assert.deepEqual(copy(ctx.weekOvr[week].a),[makeup]);
  assert.equal(calls.today,3);assert.equal(calls.save,3);
});

test('adding a confirmation to an explicit empty week is intentional and never restores recurrence',()=>{
  const {ctx,week,bulk,slots}=setup();ctx.students=[student('a')];ctx.weekOvr[week]={a:[]};
  bulk([{date:'2026-10-02',time:'11:30'}],0);ctx.saveBulkSchedule('a');assert.deepEqual(Object.keys(slots()),['금_11:30']);
  bulk([]);ctx.saveBulkSchedule('a');assert.deepEqual(Object.keys(slots()),[]);assert.deepEqual(copy(ctx.weekOvr[week].a),[]);
});

test('batch conflicts roll back confirmations, linked consultation and all weekly exceptions',()=>{
  const {ctx,week,bulk,calls}=setup();const consult={id:'linked',converted:true,confirmedDates:[{date:'2026-10-01',time:'16:30'}],firstDate:'2026-10-01',firstTime:'16:30'};
  ctx.consults=[consult];ctx.students=[student('a',{consultData:copy(consult)}),student('b',{days:['금'],times:{금:'14:00'}})];
  ctx.weekOvr[week]={a:[{day:'수',time:'17:00',absent:false}]};
  const before=copy({students:ctx.students,consults:ctx.consults,weekOvr:ctx.weekOvr});
  bulk([{date:'2026-10-02',time:'11:30'},{date:'2026-10-02',time:'14:00'}]);ctx.saveBulkSchedule('a');
  assert.deepEqual(copy({students:ctx.students,consults:ctx.consults,weekOvr:ctx.weekOvr}),before);assert.equal(calls.save,0);assert.equal(calls.undo,0);
});

test('converted consultation dates stay synchronized through update, removal and reload',()=>{
  const {ctx,bulk,slots}=setup();const consult={id:'linked',converted:true,confirmedDates:[{date:'2026-10-01',time:'16:30'}],firstDate:'2026-10-01',firstTime:'16:30'};
  ctx.consults=[consult];ctx.students=[student('a',{consultData:copy(consult),confirmedDates:copy(consult.confirmedDates)})];
  bulk([{date:'2026-10-02',time:'11:30'}]);ctx.saveBulkSchedule('a');
  assert.equal(Object.values(slots()).flat().length,1);assert.deepEqual(copy(ctx.students[0].consultData.confirmedDates),copy(consult.confirmedDates));
  bulk([]);ctx.saveBulkSchedule('a');ctx.consults=[];ctx.students=copy(ctx.students);ctx.weekOvr=copy(ctx.weekOvr);
  assert.deepEqual(Object.keys(slots()),['월_10:00']);assert.equal(ctx.students[0].consultData.firstDate,'');
});

test('same-group confirmations share a slot while preserving enrollment and attendance identities',()=>{
  const {ctx,bulk,slots}=setup();const group={lessonType:'group',sharedSlot:true,groupId:'group-1',primaryPayerId:'member-1',groupMembers:[{id:'member-1',name:'첫 멤버'},{id:'member-2',name:'둘째 멤버'}]};
  ctx.students=[student('a',{...group,days:[]}),student('b',{...group,days:['금'],times:{금:'14:00'}})];
  const before=copy(ctx.students[0].groupMembers);bulk([{date:'2026-10-02',time:'14:00'}],0);ctx.saveBulkSchedule('a');
  assert.equal(slots()['금_14:00'].length,2);assert.equal(ctx.auditScheduleConflicts(mon).overbookCount,0);assert.deepEqual(copy(ctx.students[0].groupMembers),before);
  assert.equal(slots()['금_14:00'][0].primaryPayerId,'member-1');
});

test('manual cancellation marked as a copied confirmation is retained when the date is deleted',()=>{
  const {ctx,week,bulk,slots}=setup();ctx.students=[student('a',{confirmedDates:[{date:'2026-09-29',time:'11:00'}]})];
  const canceled={day:'화',time:'11:00',absent:true,source:'consult-confirmed',overrideType:'cancel'};ctx.weekOvr[week]={a:[canceled]};
  bulk([]);ctx.saveBulkSchedule('a');assert.deepEqual(copy(ctx.weekOvr[week].a),[canceled]);assert.equal(slots()['화_11:00'][0].absent,true);
});

test('real calendar dates and time ranges validate before any mutation',()=>{
  for(const entry of [{date:'2026-02-30',time:'11:30'},{date:'2026-10-02',time:'24:00'}]){
    const {ctx,bulk,calls,nodes}=setup();ctx.students=[student('a')];const before=copy(ctx.students);
    bulk([entry],0);ctx.saveBulkSchedule('a');assert.deepEqual(copy(ctx.students),before);assert.equal(calls.save,0);assert.ok(nodes['bulk-error'].textContent);
  }
});

test('date manager cancel is a draft-only operation',()=>{
  const {ctx,nodes}=setup();ctx.students=[student('a')];const before=copy({students:ctx.students,weekOvr:ctx.weekOvr});
  ctx.openBulkSchedule('a');assert.match(nodes.mBulkSched.innerHTML,/확정 일정 관리/);nodes.mBulkSched.remove();
  assert.deepEqual(copy({students:ctx.students,weekOvr:ctx.weekOvr}),before);
});

test('new student manager opens only after normal validation and a successful first save',async()=>{
  const {ctx,nodes,form,calls}=setup();form();ctx.formDays=[];ctx.openBulkSchedule=id=>calls.open.push(id);ctx.openSModal=id=>calls.open.push(`edit:${id}`);
  await ctx.openStudentConfirmedSchedule();assert.equal(ctx.students.length,0);assert.deepEqual(calls.open,[]);
  ctx.formDays=['월'];nodes['s-nm'].value='';await ctx.openStudentConfirmedSchedule();assert.equal(ctx.students.length,0);
  nodes['s-nm'].value='새 학생';await ctx.openStudentConfirmedSchedule();
  assert.equal(ctx.students.length,1);assert.equal(ctx.students[0].memo,'보존할 메모');assert.deepEqual(calls.open,['edit:new-student','new-student']);assert.equal(calls.save,1);
});

test('save targets the newly registered week and day even when outside the currently viewed week',()=>{
  const {ctx,bulk}=setup();ctx.students=[student('a')];bulk([{date:'2026-11-06',time:'11:30'}],0);ctx.saveBulkSchedule('a');
  const today=ctx.getMon(new Date()),target=ctx.getMon(new Date(2026,10,6));
  assert.equal(ctx.wkOfs,Math.round((Date.UTC(target.getFullYear(),target.getMonth(),target.getDate())-Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()))/604800000));
  assert.equal(ctx.mobileSchedDay,4);assert.equal(ctx.page,'schedule');assert.equal(ctx.mobileSchedView,'week');
});

test('future viewed-week flexible conflicts are rejected without student or override changes',async()=>{
  const {ctx,nodes,form,calls}=setup();const future=new Date(2026,10,2);ctx.getViewMon=()=>future;ctx.students=[student('a',{schedType:'flex',days:[]}),student('b')];form(ctx.students[0]);
  nodes['s-flex-week-rows']={};ctx.document.querySelectorAll=selector=>selector==='#s-flex-week-rows .s-flex-week-row'?[{querySelector:sel=>({value:sel==='.s-flex-day'?'월':'10:00'})}]:[];
  const before=copy({students:ctx.students,weekOvr:ctx.weekOvr});await ctx.saveStudent();assert.deepEqual(copy({students:ctx.students,weekOvr:ctx.weekOvr}),before);assert.equal(calls.save,0);
});

test('standalone flexible week save is transactional and retains cancellation/makeup metadata',()=>{
  const {ctx,nodes,week,calls}=setup();ctx.students=[student('a',{schedType:'flex',days:[]}),student('b')];ctx.editSid='a';nodes['s-flex-week-rows']={};
  ctx.document.querySelectorAll=()=>[{querySelector:sel=>({value:sel==='.s-flex-day'?'월':'10:00'})}];ctx.saveStudentFlexWeek();assert.equal(ctx.weekOvr[week],undefined);assert.equal(calls.save,0);
  const canceled={day:'수',time:'17:00',absent:true,kind:'cancel',makeupOf:'missed'};
  ctx.weekOvr[week]={a:[canceled]};ctx.studentFlexDraftSlots=[canceled];ctx.document.querySelectorAll=()=>[{querySelector:sel=>({value:sel==='.s-flex-day'?'수':'17:00'})}];
  ctx.renderStudentFlexWeekEditor=()=>{};ctx.saveStudentFlexWeek();assert.deepEqual(copy(ctx.weekOvr[week].a),[canceled]);assert.equal(calls.save,1);
});

test('date header and empty-space controls are keyboard buttons, card clicks stop propagation',()=>{
  const {ctx}=setup();const sched={'금_11:30':[{s:student('a'),day:'금',time:'11:30',type:'fixed'}]};
  const glance=ctx.buildWeekGlance(mon,sched),agenda=ctx.buildMobileWeekView(mon,sched,'',true,[],[],ctx.students);
  for(const text of [glance,agenda]){
    assert.match(text,/<button type="button" class="[^\"]*day-head"[^>]*data-date="2026-10-02"/);
    assert.match(text,/event.stopPropagation\(\);lbClick\(this\)/);
    assert.doesNotMatch(text,/<(?:section|div)[^>]*role="button"/);
  }
  assert.match(agenda,/class="mobile-week-empty"[^>]*data-date="2026-10-04"/);
  const css=readFileSync(new URL('../v3-daylight.css',import.meta.url),'utf8');assert.match(css,/week-glance-slot\{min-height:44px/);
});

test('holiday quick-add uses existing confirmation policy; cancelling it creates no appointment',()=>{
  const {ctx,calls}=setup();const opened=[];ctx.isOffDay=()=>true;ctx.vsConfirm=opts=>opened.push(opts);ctx.cellClick=(...args)=>calls.open.push(args);
  ctx.openQuickSlot('2026-10-03');assert.equal(calls.open.length,0);assert.equal(opened.length,1);assert.equal(ctx.students.length,0);
  opened[0].onOk();assert.equal(calls.open[0][0],'토');assert.equal(calls.open[0][2],'2026-10-03');
});

test('quick slot time changes and save render the exact next/previous-week appointment',()=>{
  for(const date of ['2026-10-09','2026-09-25']){
    const {ctx,nodes,calls}=setup();ctx.students=[student('a',{schedType:'flex',days:[]})];
    for(const id of ['qsTitle','qsMeta','qsBody','qs-time'])nodes[id]={};
    nodes['qsr-a']={classList:{toggle(){}},querySelector:()=>({})};
    ctx.openQuickSlot(date);ctx.tQS('a');ctx.changeQuickSlotTime('11:30');ctx.saveQS();
    const sched=copy(ctx.getWeekSched(ctx.getMon(ctx.parseDateLocal(date))));assert.equal(sched['금_11:30'][0].date,date);assert.equal(calls.render,1);assert.equal(calls.today,1);assert.equal(calls.save,1);
    ctx.students=copy(ctx.students);ctx.weekOvr=copy(ctx.weekOvr);assert.equal(ctx.getWeekSched(ctx.getMon(ctx.parseDateLocal(date)))['금_11:30'].length,1);
  }
});

test('manager save preserves unsaved student fields and flexible rows, then student save retains the new appointment',async()=>{
  const {ctx,nodes,week,form,bulk,slots}=setup();
  ctx.students=[student('a',{schedType:'flex',days:[],confirmedDates:[{date:'2026-10-01',time:'16:30'}]})];form(ctx.students[0]);
  nodes['s-nm'].value='아직 저장하지 않은 이름';nodes['s-memo'].value='아직 저장하지 않은 메모';
  nodes.mS={classList:{contains:()=>true}};nodes['s-flex-week-rows']={};ctx.studentFlexWeekMon=mon;
  ctx.showStudentConfirmedHint=()=>{};ctx.showStudentWeekOverrideHint=()=>{};
  const draft=[{day:'수',time:'17:00',absent:false},{day:'목',time:'16:30',absent:false,source:'consult-confirmed'}];
  const modal=bulk([{date:'2026-10-02',time:'11:30'}]);modal._studentFlexDraft=draft;
  ctx.saveBulkSchedule('a');
  assert.equal(ctx.students[0].name,'a');assert.equal(nodes['s-nm'].value,'아직 저장하지 않은 이름');assert.equal(nodes['s-memo'].value,'아직 저장하지 않은 메모');
  assert.deepEqual(copy(ctx.studentFlexDraftSlots),[{day:'수',time:'17:00',absent:false},{day:'금',time:'11:30',absent:false,source:'consult-confirmed'}]);
  ctx.getViewMon=()=>new Date(2026,10,2); // Manager navigation cannot move the draft's original week.
  ctx.document.querySelectorAll=selector=>selector==='#s-flex-week-rows .s-flex-week-row'?ctx.studentFlexDraftSlots.map(sl=>({querySelector:sel=>({value:sel==='.s-flex-day'?sl.day:sl.time})})):[];
  await ctx.saveStudent();
  assert.equal(ctx.students[0].name,'아직 저장하지 않은 이름');assert.equal(ctx.students[0].memo,'아직 저장하지 않은 메모');
  assert.deepEqual(Object.keys(slots()).sort(),['금_11:30','수_17:00']);assert.equal(ctx.weekOvr[week].a.length,2);assert.equal(ctx.weekOvr[ctx.getWK(ctx.getViewMon())],undefined);
});

test('recurrence edit updates unoverridden weeks while explicit empty, canceled and makeup weeks remain unchanged',async()=>{
  const {ctx,week,form}=setup();ctx.students=[student('a')];form(ctx.students[0]);ctx.formDays=['금'];
  const next=ctx.getWK(ctx.addDays(mon,7)),later=ctx.getWK(ctx.addDays(mon,14));
  ctx.weekOvr={[week]:{a:[]},[next]:{a:[{day:'월',time:'10:00',absent:true,kind:'cancel'}]},[later]:{a:[{day:'수',time:'17:00',absent:false,kind:'makeup',makeupOf:'missed'}]}};
  const before=copy(ctx.weekOvr);await ctx.saveStudent();assert.deepEqual(copy(ctx.weekOvr),before);
  assert.deepEqual(Object.keys(ctx.getWeekSched(ctx.addDays(mon,21))),['금_11:00']);assert.deepEqual(Object.keys(ctx.getWeekSched(mon)),[]);
});

test('connected manager navigation audits the original flexible editor week before applying its conflicting draft',async()=>{
  const {ctx,nodes,form,bulk,calls}=setup();const editorMon=new Date(2026,9,19);
  ctx.students=[student('a',{schedType:'flex',days:[]}),student('peer',{days:['수'],times:{수:'15:00'}})];form(ctx.students[0]);
  vm.runInContext(html.match(/function getViewMon\([^\n]+/)[0],ctx);
  const today=ctx.getMon(new Date());ctx.wkOfs=Math.round((Date.UTC(2026,9,19)-Date.UTC(today.getFullYear(),today.getMonth(),today.getDate()))/604800000);
  ctx.studentFlexWeekMon=editorMon;ctx.studentFlexDraftSlots=[{day:'수',time:'15:00',absent:false}];
  nodes.mS={classList:{contains:()=>true}};nodes['s-flex-week-rows']={};
  ctx.showStudentConfirmedHint=()=>{};ctx.showStudentWeekOverrideHint=()=>{};
  const modal=bulk([{date:'2026-10-30',time:'12:30'}],0);modal._studentFlexDraft=copy(ctx.studentFlexDraftSlots);
  ctx.saveBulkSchedule('a');assert.equal(ctx.toDS(ctx.getViewMon()),'2026-10-26');assert.equal(calls.save,1);
  ctx.document.querySelectorAll=selector=>selector==='#s-flex-week-rows .s-flex-week-row'?ctx.studentFlexDraftSlots.map(sl=>({querySelector:sel=>({value:sel==='.s-flex-day'?sl.day:sl.time})})):[];
  const before=copy({students:ctx.students,consults:ctx.consults,weekOvr:ctx.weekOvr});
  await ctx.saveStudent();
  assert.deepEqual(copy({students:ctx.students,consults:ctx.consults,weekOvr:ctx.weekOvr}),before,'original W43 collision must reject the draft after manager navigates to W44');
  assert.equal(calls.save,1,'only the independently valid manager save is persisted');assert.ok(nodes['s-schedule-error'].textContent);
});

test('registered-date navigation updates body, sidebar and mobile active state without resetting the requested date',()=>{
  const {ctx,nodes,bulk,calls}=setup();
  const nav=p=>({id:'mTab_'+p,dataset:{p},on:p==='students',classList:{toggle(key,value){this.owner.on=value;}}});
  const sidebar=['students','schedule'].map(nav),mobile=['students','schedule'].map(nav);[...sidebar,...mobile].forEach(el=>el.classList.owner=el);
  nodes.mobileTabBar={querySelectorAll:()=>mobile};ctx.document.querySelectorAll=selector=>selector==='.ni[data-p]'?sidebar:[];
  ctx.page='students';ctx.document.body.setAttribute('data-active-page','students');ctx.students=[student('a')];
  vm.runInContext(html.match(/function getViewMon\([^\n]+/)[0],ctx);
  bulk([{date:'2026-10-30',time:'12:30'}],0);ctx.saveBulkSchedule('a');
  while(calls.timers.length)calls.timers.shift()();
  assert.equal(ctx.document.body.attributes['data-active-page'],'schedule');assert.equal(ctx.page,'schedule');
  assert.equal(sidebar[0].on,false);assert.equal(sidebar[1].on,true);assert.equal(mobile[0].on,false);assert.equal(mobile[1].on,true);
  assert.equal(ctx.toDS(ctx.getViewMon()),'2026-10-26');assert.equal(ctx.mobileSchedDay,4);assert.equal(ctx.mobileSchedView,'week');
});
