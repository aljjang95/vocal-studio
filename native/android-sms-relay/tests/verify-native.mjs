import {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync} from 'node:fs';
import {resolve,join,relative,delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {stubs} from './call/host-stubs.mjs';

const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const native=join(root,'native/android-sms-relay');
const sdk='C:/Unity/Editors/6000.3.21f1/Editor/Data/PlaybackEngines/AndroidPlayer/SDK';
const jdk='C:/Unity/Editors/6000.3.21f1/Editor/Data/PlaybackEngines/AndroidPlayer/OpenJDK';
const run=join(root,'work/android-studio-release/native-checks',new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
mkdirSync(run,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?files(join(dir,f.name)):[join(dir,f.name)]);
const inputs=[join(native,'AndroidManifest.xml'),join(native,'README.md'),...files(join(native,'src')),...files(join(native,'res')),...files(join(native,'tests'))];
const hashes=inputs.map(path=>({path:relative(root,path).replaceAll('\\','/'),sha256:sha(readFileSync(path))}));
for(const entry of hashes){const target=join(run,'source',entry.path);mkdirSync(resolve(target,'..'),{recursive:true});copyFileSync(join(root,entry.path),target);assert.equal(sha(readFileSync(target)),entry.sha256);}
writeFileSync(join(run,'source-hashes.json'),JSON.stringify(hashes,null,2));
const source=join(run,'source/native/android-sms-relay'),packageDir=join(source,'src/com/tllhouse/hlbreplay');
const commands=[];
function invoke(executable,args,name){
 const output=spawnSync(executable,args,{encoding:'utf8',windowsHide:true,timeout:45000,maxBuffer:4*1024*1024});
 const log=(output.stdout||'')+(output.stderr||'')+(output.error?String(output.error):'');
 writeFileSync(join(run,name+'.log'),log);commands.push({executable,args,exitCode:output.status,log:name+'.log'});
 writeFileSync(join(run,'commands.json'),JSON.stringify(commands,null,2));
 if(output.status!==0)throw new Error(name+' failed: '+log);
 // The builder expects one canonical Evidence line from this verifier. Keep the
 // child's raw receipt/log intact, but label its console pointer separately.
 const displayLog=name==='connection-activity' ? log.replace(/^Evidence: /gm,'ConnectionEvidence: ') : log;
 console.log(name+': PASS'+(displayLog.trim()?'\n'+displayLog.trim():''));
}
try {
 const manifest=readFileSync(join(source,'AndroidManifest.xml'),'utf8'),activity=readFileSync(join(packageDir,'MainActivity.java'),'utf8');
 const service=readFileSync(join(packageDir,'StudioCallScreeningService.java'),'utf8');
 assert(service.indexOf('respondToCall(details,allow.build())')<service.indexOf('synchronized (RelayConfig.LOCK)'));
 assert.match(service,/if \(Build\.VERSION\.SDK_INT>=29\) allow\.setSilenceCall\(false\)/);
 assert.match(manifest,/android:label="HLB 스튜디오"/);assert.match(manifest,/android:icon="@drawable\/icon"/);
 assert.match(manifest,/android:permission="android.permission.BIND_SCREENING_SERVICE"/);
 assert.doesNotMatch(manifest,/READ_CALL_LOG|WRITE_CALL_LOG|PROCESS_OUTGOING_CALLS|READ_PHONE_STATE|RECORD_AUDIO|CALL_PHONE/);
 assert.match(activity,/config\.origin\.isEmpty\(\) \? RelayConfig\.DEFAULT_ORIGIN : config\.origin/);
 assert.match(activity,/onPause\(\).*token\.setText\(""\)/);
 assert.match(activity,/FLAG_SECURE/);assert.match(activity,/setSaveEnabled\(false\)/);
 assert.match(activity,/Manifest\.permission\.READ_CONTACTS\},44/);
 const allSource=files(join(source,'src')).map(p=>readFileSync(p,'utf8')).join('\n');
 assert(!/android\.provider\.(ContactsContract|CallLog)|android\.webkit\.|new\s+WebView|CookieManager\.|addJavascriptInterface\(|createRequestRoleIntent\(RoleManager\.ROLE_SMS/.test(allSource),'no contacts/call-history/WebView access or SMS-role takeover');
 const http=readFileSync(join(packageDir,'RelayHttp.java'),'utf8');assert.match(http,/"\/device\/call"\.equals\(route\)/);
 assert.match(http,/setInstanceFollowRedirects\(false\)/);assert.match(http,/setRequestProperty\("Authorization", "Bearer "/);
 assert.equal(sha(readFileSync(join(source,'res/drawable/icon.png'))),sha(readFileSync(join(root,'icon-512.png'))));
 writeFileSync(join(run,'source-guards.log'),'PASS fixed URLs/icon, optional permission boundary, credential defenses, immediate response/API26 branch guards\n');

 // Exercise actual production DDL with SQLite. Android SQLite helper/lifecycle/fsync
 // still needs device acceptance; the SQL and immutable queue contract execute here.
 const store=readFileSync(join(packageDir,'RelayStore.java'),'utf8');
 const ddl=[...store.matchAll(/db\.execSQL\("(CREATE [^"]+)"\)/g)].map(m=>m[1]);
 const databasePath=join(run,'queue.sqlite');let db=new DatabaseSync(databasePath);
 for(const sql of ddl.filter(s=>!s.includes('calls')))db.exec(sql);
 db.exec("INSERT INTO events(id,generation,phone,body,date,direction) VALUES('sms','old','01000000000','synthetic',10,'received'); INSERT INTO attempts(id,generation,phone,body,created,state) VALUES('send','old','01000000000','synthetic',10,'sent')");
 for(const sql of ddl.filter(s=>s.includes('calls')))db.exec(sql);
 assert.equal(db.prepare('SELECT count(*) n FROM events').get().n,1);assert.equal(db.prepare('SELECT count(*) n FROM attempts').get().n,1);
 assert.match(store,/if \(old==1 && version==2\) createCalls\(db\)/);assert.match(store,/"calls",null,v,SQLiteDatabase\.CONFLICT_IGNORE/);
 assert.match(store,/"generation=\? AND done=0",new String\[\]\{generation\}/);
 const insert=db.prepare('INSERT OR IGNORE INTO calls(id,generation,epoch,boundary,phone,date,direction) VALUES(?,?,?,?,?,?,?)');
 insert.run('same','g','e',100,'01000000000',101,'incoming');
 insert.run('same','g','e',100,'01000000001',202,'incoming');
 assert.equal(db.prepare('SELECT phone,date FROM calls WHERE id=?').get('same').date,101);
 assert.equal(db.prepare('SELECT phone,date FROM calls WHERE id=?').get('same').phone,'01000000000');
 insert.run('out','g','e',100,'01000000000',103,'outgoing');
 assert.equal(db.prepare('SELECT count(*) n FROM calls WHERE id=?').get('out').n,0,'incoming-only CHECK ignores invalid direction');
 insert.run('old','old','e',1,'01000000000',2,'incoming');db.close();db=new DatabaseSync(databasePath);
 const pending=db.prepare('SELECT id,phone,date,generation,epoch,boundary FROM calls WHERE generation=? AND done=0 ORDER BY date,id LIMIT 40').all('g');
 assert.equal(pending.length,1);assert.equal(pending[0].id,'same');assert.equal(pending[0].date,101);
 db.prepare('UPDATE calls SET done=1 WHERE id=?').run('same');db.close();db=new DatabaseSync(databasePath);
 assert.equal(db.prepare('SELECT count(*) n FROM calls WHERE generation=? AND done=0').get('g').n,0);db.close();
 writeFileSync(join(run,'sqlite.log'),'PASS additive v1->v2 DDL retains SMS rows; duplicate payload immutable; incoming only; reopen retains generation/boundary/payload/done\n');

 const apiClasses=join(run,'android-classes');mkdirSync(apiClasses);
 invoke(join(jdk,'bin/javac.exe'),['-encoding','UTF-8','-source','8','-target','8','-bootclasspath',join(sdk,'platforms/android-36/android.jar')+delimiter+join(sdk,'build-tools/36.0.0/core-lambda-stubs.jar'),'-d',apiClasses,...files(join(source,'src')).filter(p=>p.endsWith('.java'))],'android-api-compile');
 // aapt2 compile/link validates new icon and manifest, unsigned and local only.
 const res=join(run,'compiled-res');mkdirSync(res);
 const aapt=join(sdk,'build-tools/36.0.0/aapt2.exe');
 invoke(aapt,['compile','--dir',join(source,'res'),'-o',res],'android-resources');
 invoke(aapt,['link','-I',join(sdk,'platforms/android-36/android.jar'),'--manifest',join(source,'AndroidManifest.xml'),'--version-code','2','--version-name','1.1','-o',join(run,'resource-check.apk'),...files(res)],'android-manifest-link');
 const fixtureFiles=[];
 for(const [path,content] of Object.entries(stubs)){const f=join(run,'host-stubs',path);mkdirSync(resolve(f,'..'),{recursive:true});writeFileSync(f,content);fixtureFiles.push(f);}
 const host=join(run,'host-classes');mkdirSync(host);
 const real=['RelayPolicy','SendCoordinator','RelayConfig','CallPolicy','CallForwarder','CallConsent','StudioCallScreeningService','RelayEngine','ManagementLauncher'].map(f=>join(packageDir,f+'.java'));
 const platform=join(sdk,'platforms/android-36/android.jar');
 invoke(join(jdk,'bin/javac.exe'),['-encoding','UTF-8','--release','8','-cp',platform,'-d',host,...real,...fixtureFiles,join(source,'tests/RelayCoreTest.java'),join(source,'tests/call/NativeCallTest.java')],'host-compile');
 for(const main of ['RelayCoreTest','NativeCallTest'])invoke(join(jdk,'bin/java.exe'),['-cp',host+delimiter+platform,'com.tllhouse.hlbreplay.'+main],main);
 // API compilation above already covers MainActivity; execute its scoped UI/clipboard regressions once.
 invoke(process.execPath,[join(source,'tests/verify-connection.mjs'),'--host-only'],'connection-activity');
 for(const entry of hashes)assert.equal(sha(readFileSync(join(root,entry.path))),entry.sha256,'source changed during verification: '+entry.path);
 const result={status:'PASS',time:new Date().toISOString(),evidence:run,sourceHashes:'source-hashes.json',verified:['Android36 production API compilation','aapt2 icon/manifest resource link (unsigned, version2 test artifact)','production Java synthetic role/consent/service order/config/queue/engine/browser checks','production MainActivity synthetic UI/clipboard/poll/lifecycle/permission/setup checks','SQLite production DDL and immutable queue reopen checks','existing RelayCoreTest'],unverified:['physical Android26/29/36 behavior and browser auth UI','Android SQLite fsync/process death/permissions/role selection','provider/SIM/modem/SMS/calls/background/OEM behavior','signed frozen APK/AAB and integrated backend/UI review','public privacy content and Play/store/release acceptance']};
 writeFileSync(join(run,'result.json'),JSON.stringify(result,null,2));console.log('Evidence: '+run);
} catch(error){writeFileSync(join(run,'result.json'),JSON.stringify({status:'FAIL',error:String(error),evidence:run},null,2));console.error(String(error));console.error('Evidence: '+run);process.exitCode=1;}
