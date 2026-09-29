import fs from 'node:fs';
import crypto from 'node:crypto';

const files=['worker/auth.mjs','worker/state.mjs','worker/index.mjs'];
const manifest=files.map(file=>{
  const body=fs.readFileSync(file);
  return {file,bytes:body.length,sha256:crypto.createHash('sha256').update(body).digest('hex')};
});
console.log(JSON.stringify({ok:true,bundler:'wrangler-at-dry-run',sourceManifest:manifest},null,2));
