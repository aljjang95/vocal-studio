import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
export function gitBlob(bytes) {
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}
export function applyExact(source, patches) {
  let result = source;
  for (const p of patches) {
    const matches = result.split(p.old).length - 1;
    if (matches !== 1) throw new Error(`${p.id}: expected one match, found ${matches}; no write performed`);
    result = result.replace(p.old, p.new);
  }
  return result;
}
export function validateInlineScripts(html) {
  let count = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (/\bsrc\s*=/i.test(match[1]) || !match[2].trim()) continue;
    if (/\btype\s*=\s*['"](?:application\/ld\+json|application\/json)['"]/i.test(match[1])) continue;
    new vm.Script(match[2], { filename: `index.inline-${++count}.js` });
  }
  if (!count) throw new Error('No inline runtime found; refusing unknown application layout');
  return count;
}
export function main(args = process.argv.slice(2)) {
  const plan = JSON.parse(fs.readFileSync(new URL('../patches/sync-hardening.json', import.meta.url), 'utf8'));
  const flags = new Set(args.filter(x => x.startsWith('--')));
  for (const flag of flags) if (flag !== '--apply') throw new Error(`Unknown flag: ${flag}`);
  const positionals = args.filter(x => !x.startsWith('--'));
  if (positionals.length > 1) throw new Error('Usage: node scripts/apply-sync-hardening.mjs [repo-root] [--apply]');
  const target = path.resolve(positionals[0] || '.', plan.target);
  if (fs.lstatSync(target).isSymbolicLink()) throw new Error('Refusing a symbolic-link target');
  const bytes = fs.readFileSync(target);
  const before = gitBlob(bytes);
  if (before !== plan.expectedGitBlob) throw new Error(`Source drift: expected ${plan.expectedGitBlob}, got ${before}; no write performed`);
  const candidate = applyExact(bytes.toString('utf8'), plan.patches);
  const scripts = validateInlineScripts(candidate);
  const receipt = { status: flags.has('--apply') ? 'candidate-applied-review-required' : 'dry-run-only', baseCommit: plan.baseCommit, before, after: gitBlob(Buffer.from(candidate)), scripts, independentReview: 'missing', production: 'not-deployed' };
  if (flags.has('--apply')) {
    const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocal-sync-backup-'));
    const backup = path.join(backupDir, 'index.html'); fs.writeFileSync(backup, bytes, { flag: 'wx', mode: 0o600 });
    const tmp = `${target}.sync-${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(tmp, candidate, { flag: 'wx', mode: fs.statSync(target).mode });
      if (gitBlob(fs.readFileSync(target)) !== before) throw new Error('Source changed during preparation; write aborted');
      fs.renameSync(tmp, target);
    } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
    receipt.rollbackFile = backup;
  }
  console.log(JSON.stringify(receipt, null, 2));
  return receipt;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
