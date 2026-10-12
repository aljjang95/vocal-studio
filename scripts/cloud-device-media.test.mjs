import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function source(name){const text=html.match(new RegExp('function '+name+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'))?.[0];assert.ok(text,name);return text;}
function context(students,consults=[]){const c=vm.createContext({students,consults});vm.runInContext(['_cfDeviceMediaIdentity','_cfCaptureDeviceMedia','_cfRestoreDeviceMedia'].map(source).join('\n'),c);return c;}

test('photo and consent/local media references survive normalization and a new page',()=>{
  const c=context([{id:'student',photo:'',_photoKey:'vsC_ph_kept',audios:[{id:'audio',name:'practice',data:'[saved]',_mediaKey:'vsM_audio_kept'}],videos:[],consentRec:{id:'consent',date:'2026-10-12',data:'[saved]',_mediaKey:'vsM_consent_kept'}}]);
  const refs=JSON.parse(JSON.stringify(c._cfCaptureDeviceMedia()));
  const reloaded=context([{id:'student',photo:'',audios:[{id:'audio',name:'practice',data:'[saved]'}],videos:[],consentRec:{id:'consent',date:'2026-10-12',data:'[saved]'}}]);
  reloaded._cfRestoreDeviceMedia(refs);
  assert.equal(reloaded.students[0]._photoKey,'vsC_ph_kept');assert.equal(reloaded.students[0].audios[0]._mediaKey,'vsM_audio_kept');
  assert.equal(reloaded.students[0].consentRec._mediaKey,'vsM_consent_kept');
});

test('a missing local media key preserves the original body instead of discarding it',()=>{
  const photo='data:image/jpeg;base64,'+'A'.repeat(70000),audio='data:audio/webm;base64,'+'B'.repeat(80000);
  const c=context([{id:'student',photo,audios:[{id:'audio',data:audio}],videos:[],consentRec:null}]);
  const refs=JSON.parse(JSON.stringify(c._cfCaptureDeviceMedia()));
  const reloaded=context([{id:'student',photo:'',audios:[{id:'audio',data:'[saved]'}],videos:[],consentRec:null}]);
  reloaded._cfRestoreDeviceMedia(refs);assert.equal(reloaded.students[0].photo,photo);assert.equal(reloaded.students[0].audios[0].data,audio);
});

test('media restoration never resurrects deleted rows or binds an ambiguous/different entry',()=>{
  const c=context([{id:'student',photo:'',audios:[{id:'audio',name:'old',_mediaKey:'vsM_old'}],consentRec:{id:'consent',_mediaKey:'vsM_consent'}}]);
  const refs=JSON.parse(JSON.stringify(c._cfCaptureDeviceMedia()));
  const deleted=context([]);deleted._cfRestoreDeviceMedia(refs);assert.deepEqual(JSON.parse(JSON.stringify(deleted.students)),[]);
  const changed=context([{id:'student',photo:'/api/media/new.jpg',audios:[{id:'audio',name:'different'}],consentRec:null}]);changed._cfRestoreDeviceMedia(refs);
  assert.equal(changed.students[0].audios[0]._mediaKey,undefined);assert.equal(changed.students[0].consentRec,null);
  const duplicated=context([{id:'student',audios:[{id:'audio',name:'old'},{id:'audio',name:'old'}]}]);duplicated._cfRestoreDeviceMedia(refs);
  assert.ok(duplicated.students[0].audios.every(x=>x._mediaKey===undefined));
});

test('unload is protected while persistence or server confirmation is still pending',()=>{
  for(const [hold,pending,expected] of [['durability',0,true],['storage',0,true],[null,1,true],[null,0,false]]){
    let protectedExit=false;const c=vm.createContext({_vsSync:{hold,pending:()=>pending}});vm.runInContext(source('_cfProtectPendingUnload'),c);
    const event={preventDefault(){protectedExit=true;}};c._cfProtectPendingUnload(event);assert.equal(protectedExit,expected);
  }
});
