import {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync} from 'node:fs';
import {resolve,join,relative,delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {stubs as shared} from './call/host-stubs.mjs';
import {stubs} from './connection/host-stubs.mjs';

const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const native=join(root,'native/android-sms-relay');
const sdk=process.env.ANDROID_HOME || 'C:/Unity/Editors/6000.3.21f1/Editor/Data/PlaybackEngines/AndroidPlayer/SDK';
const jdk=process.env.JAVA_HOME || 'C:/Unity/Editors/6000.3.21f1/Editor/Data/PlaybackEngines/AndroidPlayer/OpenJDK';
const baseline=process.argv.includes('--baseline');
const hostOnly=process.argv.includes('--host-only');
const baselineRef='fd1e1311ff8573a60dfb7402c07159921627b7c5';
const run=join(root,'work/android-connection-fix',`${baseline?'baseline':'candidate'}-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`);
mkdirSync(run,{recursive:true});
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?files(join(dir,f.name)):[join(dir,f.name)]);
const inputs=[...files(join(native,'src')),...files(join(native,'tests/connection')),join(native,'tests/verify-connection.mjs'),join(native,'tests/call/host-stubs.mjs')];
const hashes=[];
const workingHashes=inputs.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
for(const path of inputs){
 const rel=relative(root,path).replaceAll('\\','/'),target=join(run,'source',rel);mkdirSync(resolve(target,'..'),{recursive:true});
 if(baseline && rel.startsWith('native/android-sms-relay/src/')){
  const r=spawnSync('git',['show',`${baselineRef}:${rel}`],{cwd:root,windowsHide:true,encoding:'utf8'});
  if(r.status!==0)throw new Error('baseline source unavailable: '+rel);
  writeFileSync(target,r.stdout);
 } else copyFileSync(path,target);
 hashes.push({path:rel,sha256:createHash('sha256').update(readFileSync(target)).digest('hex')});
}
writeFileSync(join(run,'source-hashes.json'),JSON.stringify(hashes,null,2));
const commands=[];
function invoke(exe,args,name){const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,timeout:45000,maxBuffer:4*1024*1024});const log=(r.stdout||'')+(r.stderr||'')+(r.error?String(r.error):'');writeFileSync(join(run,name+'.log'),log);commands.push({executable:exe,args,exitCode:r.status,log:name+'.log'});writeFileSync(join(run,'commands.json'),JSON.stringify(commands,null,2));console.log(name+': '+r.status+'\n'+log.trim());if(r.status!==0)throw new Error(name+' failed');return log;}
try {
 const source=join(run,'source/native/android-sms-relay'),pkg=join(source,'src/com/tllhouse/hlbreplay');
 if(!hostOnly){
  const api=join(run,'api-classes');mkdirSync(api);
  invoke(join(jdk,'bin/javac.exe'),['-encoding','UTF-8','-source','8','-target','8','-bootclasspath',join(sdk,'platforms/android-36/android.jar')+delimiter+join(sdk,'build-tools/36.0.0/core-lambda-stubs.jar'),'-d',api,...files(join(source,'src')).filter(p=>p.endsWith('.java'))],'android36-compile');
 }
 const fixtureFiles=[];
 const combined={...Object.fromEntries(['android/content/SharedPreferences.java','android/content/Intent.java','android/content/pm/PackageManager.java','android/content/pm/ResolveInfo.java','android/content/pm/ActivityInfo.java','android/os/Build.java','android/os/Bundle.java','android/net/Uri.java'].map(k=>[k,shared[k]])),...stubs};
 for(const [p,c] of Object.entries(combined)){const path=join(run,'host-stubs',p);mkdirSync(resolve(path,'..'),{recursive:true});writeFileSync(path,c);fixtureFiles.push(path);}
 const host=join(run,'host-classes');mkdirSync(host);
 const real=['MainActivity','RelayConfig','RelayPolicy','CallConsent','CallPolicy'].map(p=>join(pkg,p+'.java'));
 invoke(join(jdk,'bin/javac.exe'),['-encoding','UTF-8','--release','8','-d',host,...fixtureFiles,...real,join(source,'tests/connection/ConnectionActivityTest.java')],'host-compile');
 const log=invoke(join(jdk,'bin/java.exe'),['-Dfile.encoding=UTF-8','-cp',host,'com.tllhouse.hlbreplay.ConnectionActivityTest'],'activity-regressions');
 for(const entry of workingHashes)if(createHash('sha256').update(readFileSync(entry.path)).digest('hex')!==entry.sha256)throw new Error('source drift: '+entry.path);
 writeFileSync(join(run,'result.json'),JSON.stringify({status:'PASS',baseline,baselineRef:baseline?baselineRef:null,hostOnly,evidence:run,summary:log.trim(),unverified:['physical clipboard/IME/lifecycle/permission dialog','actual key/server pairing','scheduler/device/network/SMS','integrated signed build and independent review']},null,2));
} catch(e){writeFileSync(join(run,'result.json'),JSON.stringify({status:'FAIL',baseline,baselineRef:baseline?baselineRef:null,hostOnly,error:String(e),evidence:run},null,2));process.exitCode=1;}
console.log('Evidence: '+run);
