import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {scheduleSnapshot} from '../worker/schedule-core.generated.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function browserEngine(state,date){
  const ctx=vm.createContext({Date,...structuredClone(state),ALL7:['월','화','수','목','금','토','일'],getViewMon:()=>new Date(date+'T00:00:00'),parseDateLocal:d=>new Date(d+'T00:00:00')});
  for(const name of ['toDS','getMon','addDays','getWK'])vm.runInContext(html.match(new RegExp('function '+name+'\\([^\\n]+'))[0],ctx);
  vm.runInContext(html.slice(html.indexOf('function consultDateEntries(c){'),html.indexOf('function createScheduleResetSnapshot(')),ctx);
  return JSON.parse(JSON.stringify(ctx.buildScheduleEngine(ctx.getMon(new Date(date+'T00:00:00')))));
}
test('server generated schedule engine keeps confirmed, cancelled, grouped and year-edge behavior equal to the actual UI engine',()=>{
  for(const date of ['2026-10-09','2027-01-01']){
    const base={students:[{id:'a',name:'A',status:'수강중',schedType:'flex',confirmedDates:[{date,time:'16:00'}]},{id:'b',name:'B',status:'수강중',schedType:'fixed',st:'2026-01-01',days:['금'],times:{금:'16:00'}}],consults:[],inquiries:[],weekOvr:{}};
    const wk=scheduleSnapshot(base,date).weekKey;
    const cases=[base,{...base,weekOvr:{[wk]:{b:[{day:'금',time:'16:00',absent:true,overrideType:'cancel'}]}}},{...base,students:base.students.map(s=>({...s,lessonType:'group',sharedSlot:true,groupId:'same',groupMembers:[{id:'member',name:'Member'}]}))}];
    for(const state of cases){const actual=scheduleSnapshot(state,date);assert.deepEqual(actual,browserEngine(state,date));assert.ok(actual.weekKey);assert.match(actual.weekEnd,/^\d{4}-\d{2}-\d{2}$/);}
  }
});
