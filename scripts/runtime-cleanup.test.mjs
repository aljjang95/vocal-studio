import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('active administrator runtime has no retired Firebase write paths',()=>{
  for(const token of ['_fs()','firebase.firestore()','firebase.initializeApp','firebase.auth()','firebase.storage()','firebaseConfig'])assert.doesNotMatch(index,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),token);
});
test('inquiry initialization never performs a second backend write',()=>{
  const start=index.indexOf('function _injectInitialInquiries()');const end=index.indexOf('/* ── 문자 파싱',start);const body=index.slice(start,end);
  assert.match(body,/saveAll\(\)/);assert.doesNotMatch(body,/\.collection\(|\.doc\(|\.set\(/);
});
test('schedule reset persists through the canonical save controller only',()=>{
  const start=index.indexOf('function resetWeekOvr()');const end=index.indexOf('function resetAllData()',start);const body=index.slice(start,end);
  assert.match(body,/delete weekOvr\[wk\][\s\S]*saveAll\(\)/);assert.doesNotMatch(body,/_fs|\.collection\(|\.set\(/);
});
test('active runtime backend vocabulary is Cloudflare, not Firestore',()=>{
  assert.match(index,/Cloudflare unified runtime/);assert.doesNotMatch(index,/localStorage \+ Firestore 동시 저장|Firebase에도 즉시 동기화|Firestore 동시 저장/);
});
