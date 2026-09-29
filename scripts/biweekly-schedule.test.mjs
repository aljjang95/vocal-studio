import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const context=vm.createContext({Date,console,students:[],consults:[],inquiries:[],weekOvr:{},ALL7:['월','화','수','목','금','토','일']});
for(const name of ['getMon','toDS','addDays','getWK']){
  const line=html.match(new RegExp('function '+name+'\\([^\\n]+'))?.[0];
  assert.ok(line,name+' exists');
  vm.runInContext(line,context);
}
context.parseDateLocal=ds=>{const [y,m,d]=ds.split('-').map(Number);return new Date(y,m-1,d);};
vm.runInContext(source('function consultDateEntries(c){','function getWeekSched(mon){'),context);
vm.runInContext(source('function auditScheduleConflicts(mon){','function createScheduleResetSnapshot('),context);
vm.runInContext(source('function freqNum(s){','var JSDOW='),context);
vm.runInContext(source('function scheduleStatusLabel(slot){','function personAvatarHtml('),context);

const mon=context.getMon(new Date());
const weekDate=(offset)=>context.toDS(context.addDays(mon,offset));
const thisWeek=context.getWK(mon);
const consultation={id:'c1',name:'격주 상담',status:'상담',confirmedDates:[
  {date:weekDate(1),time:'14:00'},
  {date:weekDate(3),time:'16:00'}
]};

test('consultation dates survive conversion and take precedence over fixed weekdays',()=>{
  context.consults=[consultation];context.students=[];context.weekOvr={};
  const before=context.buildScheduleEngine(mon);
  assert.equal(before.counts.slots,2);
  assert.ok(Object.values(before.slotsByKey).flat().every(slot=>slot.type==='consult-sched'));

  context.document={querySelectorAll:selector=>selector==='#s-dpick .dpb.on'?[{textContent:'월'},{textContent:'금'}]:[]};
  const fields={'s-nm':'격주 상담','s-cls':'pro','s-gd':'여성','s-age':'','s-ph':'','s-st':weekDate(1),
    's-memo':'','s-stat':'수강중','s-fee':'','s-lesson-offset':'','s-photo-data':''};
  context.gv=id=>fields[id]||'';
  context.ge=id=>id==='ts-월'?{value:'11:00'}:id==='ts-금'?{value:'17:00'}:null;
  context.uid=()=> 'student-1';
  context.editSid=null;context.pendingConvertId='c1';context.curSType='fixed';context.curFreq=2;context.curIntervalWeeks=2;
  context.isKeptPhotoReference=()=>false;
  context.normalizeScheduleGroupEnrollment=()=>({lessonType:'solo',groupMembers:[],groupId:'',primaryPayerId:'',sharedSlot:false});
  context._scheduleConflictToast=(after)=>after.overbookCount>0;
  context.syncStudentPaymentCycles=()=>{};context.saveAll=()=>{};context.renderSidebarToday=()=>{};
  context.render=()=>{};context.cm=()=>{};context.toast=()=>{};context.window={scrollY:0};context.page='students';
  vm.runInContext(source('async function saveStudent(){','function delStudent(){'),context);
  return context.saveStudent().then(()=>{
    assert.equal(consultation.converted,true);
    assert.equal(context.students.length,1);
    const student=context.students[0];
    assert.equal(student.intervalWeeks,2);
    assert.equal(student.freq,2);
    assert.equal(student.confirmedDates.length,2);
    assert.equal(context.cycleSizeOf(student),4);
    assert.equal(context.cycleSizeOf({freq:2}),8,'existing weekly billing cycles stay unchanged');
    const current=context.buildScheduleEngine(mon);
    assert.deepEqual(Object.keys(current.slotsByKey).sort(),['목_16:00','화_14:00']);
    assert.equal(current.counts.slots,2,'converted consultation is not duplicated');
    assert.ok(Object.values(current.slotsByKey).flat().every(slot=>slot.s.id===student.id&&slot.source==='consult-confirmed'));
    assert.ok(Object.values(current.slotsByKey).flat().every(slot=>context.scheduleStatusLabel(slot)==='확정'));

    const off=context.buildScheduleEngine(context.addDays(mon,7));
    assert.equal(off.counts.slots,0,'the intervening week is empty');
    const active=context.buildScheduleEngine(context.addDays(mon,14));
    assert.deepEqual(Object.keys(active.slotsByKey).sort(),['금_17:00','월_11:00']);

    context.weekOvr[thisWeek]={[student.id]:[{day:'수',time:'13:00',absent:false}]};
    assert.deepEqual(Object.keys(context.buildScheduleEngine(mon).slotsByKey),['수_13:00'],'manual week override wins');
    delete context.weekOvr[thisWeek];
    consultation.confirmedDates=[{date:weekDate(2),time:'15:00'}];
    assert.deepEqual(Object.keys(context.buildScheduleEngine(mon).slotsByKey),['수_15:00'],'editing the linked consultation updates the date');
    consultation.confirmedDates=[];
    assert.deepEqual(Object.keys(context.buildScheduleEngine(mon).slotsByKey),['금_17:00'],'clearing explicit dates restores only recurring slots on or after the start date');
  });
});

test('biweekly weeks keep their phase across a year boundary and weekly students are unchanged',()=>{
  context.consults=[];context.weekOvr={};
  context.students=[{id:'year',name:'연말 격주',status:'수강중',schedType:'fixed',freq:2,intervalWeeks:2,
    st:'2026-12-29',days:['화','금'],times:{화:'12:00',금:'18:00'}},
  {id:'weekly',name:'매주',status:'수강중',schedType:'fixed',freq:1,st:'2026-12-29',days:['수'],times:{수:'10:00'}}];
  const dec=new Date(2026,11,28);
  assert.equal(context.buildScheduleEngine(dec).counts.slots,3);
  assert.equal(context.buildScheduleEngine(context.addDays(dec,7)).counts.slots,1);
  assert.equal(context.buildScheduleEngine(context.addDays(dec,14)).counts.slots,3);
  assert.equal(context.cycleSizeOf(context.students[0]),4);
  assert.equal(context.cycleSizeOf(context.students[1]),4);
});

test('first partial week starts on the declared date while an explicit confirmation stays visible',()=>{
  context.consults=[];context.weekOvr={};
  context.students=[{id:'partial',name:'부분 첫 주',status:'수강중',schedType:'fixed',freq:2,intervalWeeks:2,
    st:'2026-10-01',days:['화','목'],times:{화:'10:00',목:'11:00'}}];
  const firstWeek=new Date(2026,8,28);
  assert.deepEqual(Object.keys(context.buildScheduleEngine(firstWeek).slotsByKey),['목_11:00']);
  context.students[0].confirmedDates=[{date:'2026-09-29',time:'14:30'}];
  assert.deepEqual(Object.keys(context.buildScheduleEngine(firstWeek).slotsByKey),['화_14:30']);
  context.students[0].confirmedDates=[{date:'2026-09-23',time:'14:30'}];
  assert.deepEqual(Object.keys(context.buildScheduleEngine(new Date(2026,8,21)).slotsByKey),['수_14:30']);
});
