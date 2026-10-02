import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('./fixtures/runtime-excerpts.js', import.meta.url), 'utf8');
const mergeSource = source.slice(source.indexOf('function _mergeWeekOvr('));
const ctx = vm.createContext({}); vm.runInContext(mergeSource, ctx);
const old = { '2026-09-07': { 'student-demo': [{ day: '화', time: '14:00' }] } };
test('UNRESOLVED: deleting a week remotely must not be resurrected by a stale device', () => {
  const result = ctx._mergeWeekOvr({}, old, false);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {});
});
test('UNRESOLVED: a recent unrelated local save must not mask a newer remote lesson time', () => {
  const remote = { '2026-09-07': { 'student-demo': [{ day: '화', time: '16:00' }] } };
  const result = ctx._mergeWeekOvr(remote, old, true);
  assert.equal(result['2026-09-07']['student-demo'][0].time, '16:00');
});
