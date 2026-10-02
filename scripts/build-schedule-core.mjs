import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),html=await readFile(new URL('index.html',root),'utf8');
const helpers=['toDS','getMon','addDays','getWK'].map(name=>{const s=html.match(new RegExp('function '+name+'\\([^\\n]+'));if(!s)throw Error('missing schedule helper '+name);return s[0];}).join('\n');
const a=html.indexOf('function consultDateEntries(c){'),b=html.indexOf('function createScheduleResetSnapshot(',a);
if(a<0||b<a)throw Error('schedule source boundary');
const source=`// Generated from index.html by build-schedule-core.mjs. Do not hand edit.\nexport function scheduleSnapshot(state,date){\nvar students=state.students||[],consults=state.consults||[],inquiries=state.inquiries||[],weekOvr=state.weekOvr||{};\nvar ALL7=['월','화','수','목','금','토','일'];\nfunction parseDateLocal(s){return new Date(s+'T00:00:00');}\n${helpers}\nfunction getViewMon(){return getMon(parseDateLocal(date));}\n${html.slice(a,b)}\nvar mon=getMon(parseDateLocal(date));return {weekKey:getWK(mon),weekStart:toDS(mon),weekEnd:toDS(addDays(mon,6)),...buildScheduleEngine(mon)};\n}\n`;
await writeFile(new URL('worker/schedule-core.generated.mjs',root),source);
