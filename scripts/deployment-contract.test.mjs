import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const json = name => JSON.parse(readFileSync(new URL('../' + name, import.meta.url), 'utf8'));
test('legacy Vercel Git deployments are disabled for all branches', () => {
  assert.equal(json('vercel.json').git?.deploymentEnabled, false);
});
test('legacy URL rewrites and cache headers remain available', () => {
  const config = json('vercel.json');
  for (const source of ['/vocal-studio.html', '/vocal-studi.html', '/gjc-session-:path*'])
    assert.ok(config.rewrites.some(rule => rule.source === source && rule.destination === '/index.html'));
  for (const source of ['/index.html', '/sw.js'])
    assert.ok(config.headers.find(rule => rule.source === source)?.headers.some(h => h.key === 'Cache-Control' && h.value === 'no-store'));
});
test('build and dry-run keep the canonical Worker asset contract', () => {
  const pkg = json('package.json'), worker = json('wrangler.jsonc');
  assert.equal(pkg.scripts.build, 'node scripts/build-worker.mjs');
  assert.match(pkg.scripts['dry-run'], /^npm run build && wrangler deploy --dry-run\b/);
  assert.equal(worker.name, 'vocal-studio');
  assert.equal(worker.main, 'worker/entry.mjs');
  assert.equal(worker.assets.directory, './dist/cloudflare-assets');
});
test('production deployment remains explicitly approval-locked', () => {
  assert.equal(json('package.json').scripts.deploy, 'node scripts/deploy-locked.mjs');
  assert.equal(json('wrangler.jsonc').vars.DEPLOYMENT_ENABLED, 'false');
  const result = spawnSync(process.execPath, ['scripts/deploy-locked.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stderr, /production deployment locked/);
});
