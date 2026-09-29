import test from 'node:test';
import assert from 'node:assert/strict';
import sync from '../vs-sync.js';
const copy=structuredClone;
const empty=()=>({students:[],logs:[],consults:[],payments:[],inquiries:[],weekOvr:{}});
const base=()=>({...empty(),students:[{id:'s1',name:'Synthetic A'},{id:'s2',name:'Synthetic B'}],weekOvr:{w1:{s1:{time:'10:00'}}}});
function merge(b,l,r){return sync.apply(r,sync.diff(b,l));}
test('server deletion cannot be resurrected by an unchanged stale schedule',()=>{
  const b=base(),remote=base();remote.weekOvr.w1={};
  assert.deepEqual(merge(b,b,remote).value.weekOvr,{w1:{}});
});
test('unrelated local save does not revert the remote schedule time',()=>{
  const b=base(),local=base(),remote=base();local.students[0].name='Edited';remote.weekOvr.w1.s1.time='11:00';
  const result=merge(b,local,remote);assert.equal(result.conflicts.length,0);assert.equal(result.value.weekOvr.w1.s1.time,'11:00');
});
test('same assignment conflict fails closed',()=>{
  const b=base(),local=base(),remote=base();local.weekOvr.w1.s1.time='12:00';remote.weekOvr.w1.s1.time='11:00';
  const result=merge(b,local,remote);assert.equal(result.conflicts.length,1);assert.equal(result.value.weekOvr.w1.s1.time,'11:00');
});
test('replaying a committed change is idempotent',()=>{
  const b=base(),local=base();local.weekOvr.w1.s1.time='11:00';assert.equal(merge(b,local,local).conflicts.length,0);
});
test('deleting a week preserves independently added remote assignments',()=>{
  const b=base(),local=base(),remote=base();delete local.weekOvr.w1;remote.weekOvr.w1.s2={time:'13:00'};
  assert.deepEqual(merge(b,local,remote).value.weekOvr.w1,{s2:{time:'13:00'}});
});
for(const field of ['logs','payments','consults','inquiries'])test(`${field}: distinct records sharing a student stay distinct`,()=>{
  const b=empty(),local=empty(),remote=empty();b[field]=[{id:'r1',sid:'s1',value:1}];local[field]=copy(b[field]);remote[field]=copy(b[field]);
  local[field].push({id:'r2',sid:'s1',value:2});remote[field].push({id:'r3',sid:'s1',value:3});
  const result=merge(b,local,remote);assert.equal(result.conflicts.length,0);assert.equal(result.value[field].length,3);
});
for(const rows of [[{sid:'same',value:1},{sid:'same',value:2}],[{id:'same',value:1},{id:'same',value:2}]])test('ambiguous record identity uses an atomic conflict, never deduplication',()=>{
  const b=empty(),local=empty(),remote=empty();b.logs=copy(rows);local.logs=copy(rows);remote.logs=copy(rows);
  local.logs[0].value=4;remote.logs[1].value=5;const result=merge(b,local,remote);
  assert.equal(result.conflicts.length,1);assert.equal(result.value.logs.length,2);
});
test('local media pointers are not cloud edits',()=>{
  const b=base(),local=base();local.students[0]._photoKey='local-only';local.students[1]._mediaKey='local-media';assert.equal(sync.diff(b,local).length,0);
});
test('unknown fields on unrelated remote records survive',()=>{
  const b=base(),local=base(),remote=base();local.students[0].name='Edited';remote.students[1].futureField={keep:true};
  assert.deepEqual(merge(b,local,remote).value.students[1].futureField,{keep:true});
});
test('malformed schedules fail instead of silently dropping data',()=>{
  assert.throws(()=>sync.normalize({...empty(),weekOvr:{w1:null}}),/invalid-week/);
});
test('prototype-like schedule keys remain own data, without prototype pollution',()=>{
  const b=empty(),local=empty();local.weekOvr=JSON.parse('{"__proto__":{"x":{"time":"10:00"}}}');
  const result=merge(b,local,b);assert.equal(result.conflicts.length,0);assert.equal(Object.prototype.x,undefined);assert.ok(Object.hasOwn(result.value.weekOvr,'__proto__'));
});
test('comparison and application do not mutate input snapshots',()=>{
  const b=base(),local=base(),remote=base(),saved=copy(b);local.students[0].name='Edited';merge(b,local,remote);assert.deepEqual(b,saved);assert.deepEqual(remote,saved);
});
test('media-safe projection retains local playback pointers only on surviving attachment identities',()=>{
  const original={id:'s1',_photoKey:'photo-local',photo:'data:image/jpeg;base64,'+'A'.repeat(6000),audios:[{id:'a1',_mediaKey:'audio-local',data:'data:audio/wav;base64,'+'B'.repeat(60000)}],videos:[{id:'v1',_mediaKey:'video-local',data:'data:video/mp4;base64,'+'C'.repeat(60000)}],consentRec:{id:'c1',_mediaKey:'consent-local',data:'D'.repeat(60000)}};
  const data={...base(),students:[original]},projected=sync.normalize(data).students[0];
  assert.equal(projected.audios[0].data,'[saved]');assert.equal(projected.audios[0]._mediaKey,undefined);
  const local=sync.retainLocal(projected,original);assert.equal(local.audios[0]._mediaKey,'audio-local');assert.equal(local.audios[0].data,original.audios[0].data);
  assert.equal(local.videos[0]._mediaKey,'video-local');assert.equal(local.consentRec._mediaKey,'consent-local');assert.equal(local._photoKey,'photo-local');
  const removed=sync.retainLocal({...projected,audios:[]},original);assert.equal(removed.audios.length,0);
  const replaced=sync.retainLocal({...projected,audios:[{id:'remote-new',data:'[saved]'}]},original);assert.equal(replaced.audios[0]._mediaKey,undefined);
  assert.ok(sync.equal(projected,sync.normalize({...base(),students:[local]}).students[0]));
});
