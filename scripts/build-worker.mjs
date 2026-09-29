import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'dist','cloudflare-assets');
const assets=['index.html','vs-sync.js','cf-transport.js','cf-migration.js','v2-ui.js','v2.css','sw.js','manifest.json','icon-192.png','icon-512.png'];
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const name of assets)await cp(path.join(root,name),path.join(out,name));
const index=await readFile(path.join(root,'index.html'),'utf8');
for(const forbidden of ['gstatic.com/firebasejs','cdn.jsdelivr.net/npm/fullcalendar','www.googleapis.com/calendar/v3']){
  if(index.includes(forbidden))throw new Error(`forbidden-active-dependency:${forbidden}`);
}
console.log(JSON.stringify({ok:true,assets:assets.length,out},null,2));
