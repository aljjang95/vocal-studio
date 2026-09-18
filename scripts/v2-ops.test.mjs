import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const html=read('index.html');
const ui=read('v2-ui.js');
const css=read('v2.css');
const manifest=read('manifest.json');
const build=read('scripts/build-worker.mjs');

test('V2 shell exposes premium operations workflow actions',()=>{
  assert.match(html,/id="v2OpsCenter"/);
  for(const id of ['v2CallCapture','v2ConsultIntake','v2FixedSchedule','v2FlexSchedule'])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(css,/--v2-bg:/);assert.match(css,/\.v2-ops-center/);assert.match(css,/\.v2-action-card/);
});
test('phone inquiry capture persists through canonical saveAll',()=>{
  assert.match(ui,/function saveV2PhoneInquiry/);
  assert.match(ui,/callHistory/);assert.match(ui,/saveAll\(\)/);
  assert.match(ui,/visitDate/);assert.match(ui,/visitTime/);
});
test('V2 schedule actions reuse guarded fixed and flexible schedule engines',()=>{
  assert.match(ui,/openSModal\(\)/);assert.match(ui,/setSType\('fixed'\)/);
  assert.match(ui,/openFlexWeek\(\)/);assert.match(ui,/auditScheduleConflicts/);
});
test('V2 assets ship in Worker static assets',()=>{
  assert.match(build,/'v2-ui\.js'/);assert.match(build,/'v2\.css'/);
  assert.match(html,/v2-ui\.js/);assert.match(html,/v2\.css/);
});
test('PWA install copy and manifest contain no mojibake placeholders',()=>{
  const area=html.slice(html.indexOf('pwaInstallBtn'),html.indexOf('</section>',html.indexOf('pwaInstallBtn')));
  assert.doesNotMatch(area,/>\?\s*\?\?/);
  assert.match(area,/앱 설치|설치/);
  assert.match(manifest,/HLB Studio V2 관리자/);
  assert.match(manifest,/고객·문의·상담·일정·결제/);
  assert.doesNotMatch(manifest,/"(?:name|short_name|description)"\s*:\s*"[^"\n]*\?\?+/);
});
