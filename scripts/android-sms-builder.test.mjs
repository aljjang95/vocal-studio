import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

// Local integration test using the existing SDK/JDK/key. No device, SDK install,
// credentials in arguments, baseline promotion, native-source edits or network.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(repo, 'work/android-studio-release/build');
const evidence = join(root, `builder-checks-${Date.now()}`);
mkdirSync(evidence, { recursive: true });
const jdk = process.env.HLB_ANDROID_JDK || 'C:/Unity/Editors/6000.3.21f1/Editor/Data/PlaybackEngines/AndroidPlayer/OpenJDK';
const sdk = process.env.HLB_ANDROID_SDK || 'C:/Unity/Editors/6000.3.21f1/Editor/Data/PlaybackEngines/AndroidPlayer/SDK';
const java = join(jdk, 'bin/java.exe');
const jar = join(jdk, 'bin/jar.exe');
const bundletool = join(dirname(sdk), 'Tools/bundletool-all-1.17.2.jar');
const reviewed = join(repo, 'work/sms-flex-bridge/hlb-sms-relay.apk');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fileDigest = path => digest(readFileSync(path));
const json = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const baseline = fileDigest(reviewed);
const privatePaths = ['relay-release.p12', 'password.dpapi', '.gitignore'].map(name => join(repo, 'work/sms-flex-bridge/private-signing', name));
const privateState = privatePaths.map(path => ({ path, hash: fileDigest(path), mtime: statSync(path).mtimeMs }));
const observed = [];
const successfulBuilds = [];
let tamperChecksPassed = false;

function run(label, exe, args) {
  // Keep the inherited environment: the builder must also work when launched
  // through npm/Node from PowerShell 7 with its module path still present.
  const result = spawnSync(exe, args, { cwd: repo, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  writeFileSync(join(evidence, `${label}.log`), output);
  observed.push({ label, executable: exe, arguments: args, exitCode: result.status, error: result.error?.message });
  writeFileSync(join(evidence, 'commands.json'), JSON.stringify(observed, null, 2));
  assert.ifError(result.error);
  return { ...result, output };
}
function build(label, args = []) {
  const result = run(label, 'powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/build-android-sms-relay.ps1', '-SdkRoot', sdk, '-JdkRoot', jdk, ...args]);
  assert.equal(result.status, 0, `${label}: ${result.output}`);
  const receiptPath = result.output.match(/Receipt: ([^\r\n]+)/)?.[1];
  assert.ok(receiptPath, 'successful build must provide its own receipt');
  const receipt = json(receiptPath);
  assert.equal(receipt.packageName, 'com.tllhouse.hlbreplay');
  assert.equal(receipt.publishApkRequested, false);
  assert.equal(receipt.localPublication.status, 'NOT_REQUESTED');
  assert.equal(fileDigest(reviewed), baseline, 'default build must preserve the reviewed APK bytes');
  for (const source of receipt.sourceFiles) {
    assert.equal(fileDigest(join(receipt.sourceSnapshot, source.path)), source.sha256, `snapshot receipt: ${source.path}`);
  }
  if (receipt.sourceFiles.some(source => source.path.endsWith('/tests/verify-native.mjs'))) {
    assert.equal(receipt.nativeVerifier, 'PASS');
    assert.ok(receipt.hostTestGroups.some(group => group.name === 'verify-native.mjs' && group.result === 'PASS'));
  }
  for (const artifact of receipt.artifacts) {
    assert.equal(fileDigest(artifact.path), artifact.sha256);
    assert.equal(dirname(artifact.path), receipt.evidence, 'only this new build run receives package output');
    assert.equal(artifact.existingReviewedCertificateMatches, true);
    assert.equal(artifact.signatureVerified, true);
  }
  const commands = json(receipt.commands);
  assert.ok(commands.every(command => command.exitCode === 0));
  for (const command of commands) {
    for (const flag of ['--ks-pass', '--key-pass']) {
      const i = command.arguments.indexOf(flag);
      if (i >= 0) assert.equal(command.arguments[i + 1], 'env:HLB_SMS_SIGN_PASSWORD');
    }
    for (const flag of ['-storepass:env', '-keypass:env']) {
      const i = command.arguments.indexOf(flag);
      if (i >= 0) assert.equal(command.arguments[i + 1], 'HLB_SMS_SIGN_PASSWORD');
    }
  }
  successfulBuilds.push(receiptPath);
  return receipt;
}

// Read ZIP entries directly, so receipt/package assertions do not rely on the
// builder's self-reported flags or on another installed dependency.
function zipEntries(path) {
  const bytes = readFileSync(path);
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(end) !== 0x06054b50) end--;
  assert.ok(end >= 0, 'ZIP end-of-directory exists');
  const entries = new Map();
  let at = bytes.readUInt32LE(end + 16);
  for (let i = 0; i < bytes.readUInt16LE(end + 10); i++) {
    assert.equal(bytes.readUInt32LE(at), 0x02014b50);
    const method = bytes.readUInt16LE(at + 10);
    const size = bytes.readUInt32LE(at + 20);
    const nameSize = bytes.readUInt16LE(at + 28);
    const name = bytes.subarray(at + 46, at + 46 + nameSize).toString('utf8');
    const local = bytes.readUInt32LE(at + 42);
    assert.equal(bytes.readUInt32LE(local), 0x04034b50);
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const data = bytes.subarray(start, start + size);
    assert.ok(method === 0 || method === 8, 'supported package compression');
    entries.set(name, method === 8 ? inflateRawSync(data) : data);
    at += 46 + nameSize + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
  }
  return entries;
}

test('manual Android builder modes, package contents, signature rejection and output preservation', { timeout: 120_000 }, async t => {
  await t.test('invalid versions/mode and incompatible promotion fail before creating output', () => {
    const before = readdirSync(root).sort();
    for (const [label, args] of [
      ['zero-version', ['-VersionCode', '0']], ['overflow-version', ['-VersionCode', '2100000001']],
      ['invalid-mode', ['-BuildFormat', 'Other']], ['no-tests-promotion', ['-TestsOnly', '-PublishApk']],
      ['no-aab-promotion', ['-BuildFormat', 'Aab', '-PublishApk']]
    ]) {
      const result = run(label, 'powershell.exe', ['-NoProfile', '-File', 'scripts/build-android-sms-relay.ps1', ...args]);
      assert.notEqual(result.status, 0, label);
    }
    assert.deepEqual(readdirSync(root).sort(), before);
    assert.equal(fileDigest(reviewed), baseline);
  });

  await t.test('TestsOnly ignores bundletool and produces no signed package', () => {
    const receipt = build('tests-only', ['-TestsOnly', '-BuildFormat', 'Both', '-BundletoolPath', 'missing-bundletool.jar']);
    assert.equal(receipt.testsOnly, true);
    assert.deepEqual(receipt.artifacts, []);
    assert.equal(receipt.bundletool, null);
    assert.equal(readdirSync(receipt.evidence).some(name => /\.(apk|aab)$/.test(name)), false);
    assert.equal(json(receipt.commands).some(command => command.arguments.some(arg => /apksigner|jarsigner|keytool/.test(arg))), false);
  });

  await t.test('incomplete Both build with explicit promotion still preserves reviewed APK', () => {
    const before = new Set(readdirSync(root));
    const result = run('incomplete-promotion', 'powershell.exe', ['-NoProfile', '-File', 'scripts/build-android-sms-relay.ps1', '-SdkRoot', sdk, '-JdkRoot', jdk, '-BuildFormat', 'Both', '-BundletoolPath', 'missing-bundletool.jar', '-PublishApk']);
    assert.notEqual(result.status, 0);
    assert.equal(fileDigest(reviewed), baseline);
    const newRuns = readdirSync(root).filter(name => !before.has(name) && statSync(join(root, name)).isDirectory());
    assert.equal(newRuns.length, 1, 'failed attempt only creates its unique evidence directory');
    assert.equal(existsSync(join(root, newRuns[0], 'build-receipt.json')), false, 'incomplete build must not issue a successful package receipt');
  });

  await t.test('default APK is versionCode2; resources/dex exclude host doubles and tests', () => {
    const receipt = build('apk-default');
    assert.equal(receipt.versionCode, 2);
    assert.equal(receipt.versionName, '1.1');
    assert.deepEqual(receipt.artifacts.map(item => item.format), ['apk']);
    const apk = zipEntries(receipt.apk);
    assert.ok(apk.has('AndroidManifest.xml') && apk.has('resources.arsc') && apk.has('res/xml/data_extraction_rules.xml'));
    assert.deepEqual(apk.get('classes.dex'), readFileSync(join(receipt.evidence, 'dex/classes.dex')));
    const compiled = zipEntries(join(receipt.evidence, 'classes.jar'));
    assert.ok(compiled.has('com/tllhouse/hlbreplay/MainActivity.class'));
    assert.equal([...compiled.keys()].some(name => name.startsWith('android/') || name.includes('Test.class')), false);
    assert.match(readFileSync(join(receipt.evidence, 'badging.txt'), 'utf8'), /versionCode='2' versionName='1.1'/);
    for (const resource of receipt.sourceFiles.filter(source => /\/res\/drawable\/.*\.png$|\/assets\//.test(source.path))) {
      const entry = resource.path.slice('native/android-sms-relay/'.length);
      const bytes = apk.get(entry);
      assert.ok(bytes, entry);
      if (entry.startsWith('res/')) assert.deepEqual(bytes.subarray(0, 24), readFileSync(join(receipt.sourceSnapshot, resource.path)).subarray(0, 24), 'PNG header and dimensions survive AAPT packaging');
      else assert.equal(digest(bytes), resource.sha256, `packaged asset bytes: ${entry}`);
    }
  });

  let aabReceipt;
  await t.test('AAB-only supports version override and official base-module contents', () => {
    aabReceipt = build('aab-override', ['-BuildFormat', 'Aab', '-VersionCode', '3', '-VersionName', '1.2-internal']);
    assert.equal(aabReceipt.versionCode, 3);
    assert.equal(aabReceipt.versionName, '1.2-internal');
    assert.deepEqual(aabReceipt.artifacts.map(item => item.format), ['aab']);
    assert.equal(existsSync(join(aabReceipt.evidence, 'hlb-sms-relay.apk')), false);
    assert.equal(fileDigest(aabReceipt.bundletool.path), aabReceipt.bundletool.sha256);
    const aab = zipEntries(aabReceipt.aab);
    for (const entry of ['BundleConfig.pb', 'base/manifest/AndroidManifest.xml', 'base/resources.pb', 'base/res/xml/data_extraction_rules.xml', 'base/dex/classes.dex']) assert.ok(aab.has(entry), entry);
    assert.deepEqual(aab.get('base/dex/classes.dex'), readFileSync(join(aabReceipt.evidence, 'dex/classes.dex')));
    assert.equal([...aab.keys()].some(name => /host-stubs|RelayCoreTest|\.java$|\.class$/.test(name)), false);
    assert.match(readFileSync(join(aabReceipt.evidence, 'aab-manifest.xml'), 'utf8'), /android:versionCode="3"/);
    for (const resource of aabReceipt.sourceFiles.filter(source => /\/res\/drawable\/.*\.png$|\/assets\//.test(source.path))) {
      const entry = 'base/' + resource.path.slice('native/android-sms-relay/'.length);
      const bytes = aab.get(entry);
      assert.ok(bytes, entry);
      if (entry.startsWith('base/res/')) assert.deepEqual(bytes.subarray(0, 24), readFileSync(join(aabReceipt.sourceSnapshot, resource.path)).subarray(0, 24), 'PNG header and dimensions survive proto packaging');
      else assert.equal(digest(bytes), resource.sha256, `packaged asset bytes: ${entry}`);
    }
  });

  await t.test('Both uses identical dex bytes and signing identity for the same source snapshot', () => {
    const receipt = build('both', ['-BuildFormat', 'Both', '-VersionCode', '4', '-VersionName', '1.3-candidate']);
    assert.deepEqual(receipt.artifacts.map(item => item.format), ['apk', 'aab']);
    assert.equal(receipt.artifacts[0].signerCertificateSha256, receipt.artifacts[1].signerCertificateSha256);
    assert.deepEqual(zipEntries(receipt.apk).get('classes.dex'), zipEntries(receipt.aab).get('base/dex/classes.dex'));
  });

  await t.test('modified signed dex is rejected and malformed AAB fails bundletool validate', () => {
    assert.ok(aabReceipt, 'AAB must have passed its build checks');
    const altered = join(evidence, 'altered.aab');
    copyFileSync(aabReceipt.aab, altered);
    const alteredRoot = join(evidence, 'altered/base/dex');
    mkdirSync(alteredRoot, { recursive: true });
    const changedDex = Buffer.from(zipEntries(altered).get('base/dex/classes.dex'));
    changedDex[changedDex.length - 1] ^= 1;
    writeFileSync(join(alteredRoot, 'classes.dex'), changedDex);
    assert.equal(run('alter-dex', jar, ['--update', '--file', altered, '-C', join(evidence, 'altered'), 'base/dex/classes.dex']).status, 0);
    assert.notEqual(run('reject-modified-signature', join(jdk, 'bin/jarsigner.exe'), ['-J-Duser.language=en', '-verify', altered]).status, 0);
    const malformed = join(evidence, 'malformed.aab');
    const malformedRoot = join(evidence, 'malformed');
    mkdirSync(malformedRoot);
    writeFileSync(join(malformedRoot, 'not-a-module.txt'), 'invalid bundle layout');
    assert.equal(run('malformed-zip', jar, ['--create', '--no-manifest', '--file', malformed, '-C', malformedRoot, '.']).status, 0);
    assert.notEqual(run('reject-malformed-bundle', java, ['-jar', bundletool, 'validate', `--bundle=${malformed}`]).status, 0);
    tamperChecksPassed = true;
  });

  await t.test('reviewed APK and private signing bytes/timestamps are unchanged', () => {
    assert.equal(fileDigest(reviewed), baseline);
    for (const previous of privateState) {
      assert.ok(fileDigest(previous.path) === previous.hash, 'private signing bytes must remain unchanged');
      assert.equal(statSync(previous.path).mtimeMs, previous.mtime);
    }
    // Do not emit private signing hashes, timestamps or contents.
    writeFileSync(join(evidence, 'result.json'), JSON.stringify({ status: successfulBuilds.length === 4 && tamperChecksPassed ? 'PASS' : 'FAIL', successfulBuilds, tamperChecksPassed, reviewedApkUnchanged: true, privateSigningUnchanged: true, physicalAcceptance: 'UNVERIFIED', playAcceptance: 'UNVERIFIED' }, null, 2));
    console.log(`Builder integration evidence: ${evidence}`);
  });
});
