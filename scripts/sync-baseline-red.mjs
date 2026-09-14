// Reproduce data loss using exact baseline functions, without loading customer fixtures.
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=execFileSync('git',['show','607409a149bce61644a7c288bf6fb0c52179fcc0:index.html'],{encoding:'utf8',maxBuffer:8e6});
const names=['_rowIdentityKeys','_carryDeviceLocalFields','_mergeByIdentity','_mergeWeekOvr','_stableForSig'];
const context=vm.createContext({DEVICE_LOCAL_FIELDS:['_photoKey','_mediaKey']});
for(const name of names){
  const start=source.indexOf('function '+name+'(');
  const end=source.indexOf('\nfunction ',start+1);
  // Function plus following comments/var declarations; no app bootstrap.
  vm.runInContext(source.slice(start,end),context);
}
const cases=[
  ['stale schedule overwrites server edit',()=>assert.equal(context._mergeWeekOvr({w:{a:['new']}},{w:{a:['old']}},true).w.a[0],'new')],
  ['deleted schedule resurrected',()=>assert.equal(Object.hasOwn(context._mergeWeekOvr({w:{}},{w:{a:['old']}},false).w,'a'),false)],
  ['independent logs for same student collapsed',()=>assert.equal(context._mergeByIdentity([{id:'l1',sid:'s'},{id:'l2',sid:'s'}],[],'log',false).list.length,2)]
];
let failures=0;
for(const [name,run] of cases){try{run();console.log('UNEXPECTED GREEN',name);}catch(e){failures++;console.log('RED',name,':',e.message.split('\n')[0]);}}
console.log(JSON.stringify({baseline:'607409a149bce61644a7c288bf6fb0c52179fcc0',expectedFailures:3,observedFailures:failures}));
assert.equal(failures,3);
