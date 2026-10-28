// Runs the two signing scripts: the one that makes the key (with the real keytool) and the one that checks an APK
// (with a stand-in for apksigner that prints what the real one prints).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(__dirname, '../..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'direct-sign-'));
const run = (script: string, args: string[], env: Record<string, string> = {}) =>
  spawnSync('bash', [path.join(ROOT, 'scripts', script), ...args], { env: { PATH: process.env.PATH ?? '', HOME: TMP, ...env }, encoding: 'utf8', input: '' });

// ---- check-apk-signature.sh with a stand-in apksigner
const fake = (name: string, dn: string, sha: string, fail = false) => {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, `#!/usr/bin/env bash\n${fail ? 'echo "DOES NOT VERIFY" >&2; exit 1' : `cat <<'X'\nSigner #1 certificate DN: ${dn}\nSigner #1 certificate SHA-256 digest: ${sha}\nSigner #1 certificate SHA-1 digest: 0000\nX`}\n`, { mode: 0o755 });
  return p;
};
const OWN = 'CN=Direct, O=SNC AB, C=SE', DEBUG = 'CN=Android Debug, O=Android, C=US';
const SHA_OWN = 'ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12', SHA_DBG = '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';
const pin = path.join(TMP, 'pin.txt');
const check = (signer: string, extra: string[] = [], pinned?: string) => {
  if (pinned === undefined) fs.rmSync(pin, { force: true }); else fs.writeFileSync(pin, pinned + '\n');
  return run('check-apk-signature.sh', ['x.apk', ...extra], { APKSIGNER: signer, DIRECT_PIN_FILE: pin });
};

let r = check(fake('own', OWN, SHA_OWN), ['--require-own-key']);
assert.equal(r.status, 0, r.stderr); assert.ok(r.stdout.includes(SHA_OWN) && r.stdout.includes(OWN));
assert.ok(r.stdout.includes('NOTE'), 'without a pinned fingerprint it says nothing was compared');

r = check(fake('own', OWN, SHA_OWN), ['--require-own-key'], SHA_OWN.toUpperCase().replace(/(..)(?!$)/g, '$1:'));
assert.equal(r.status, 0, 'a fingerprint written as AB:CD:… in capitals matches'); assert.ok(r.stdout.includes('matches'));

r = check(fake('own', OWN, SHA_OWN), ['--require-own-key'], SHA_DBG);
assert.equal(r.status, 1, 'another certificate than the pinned one fails'); assert.ok(r.stderr.includes('not the expected one'));

r = check(fake('dbg', DEBUG, SHA_DBG), ['--require-own-key']);
assert.equal(r.status, 1, 'debug key with --require-own-key fails'); assert.ok(r.stderr.includes('public debug key'));
r = check(fake('dbg', DEBUG, SHA_DBG));
assert.equal(r.status, 0, 'debug key without it only warns'); assert.ok(r.stderr.includes('WARNING'));
r = check(fake('dbg', DEBUG, SHA_DBG), [], SHA_OWN);
assert.equal(r.status, 1, 'a debug-signed APK never matches a pinned own key');

r = check(fake('bad', '', '', true), ['--require-own-key']);
assert.equal(r.status, 1, 'an invalid signature fails'); assert.ok(r.stderr.includes('NOT valid'));
fs.writeFileSync(pin, SHA_OWN + '\n');
r = run('check-apk-signature.sh', ['x.apk'], { APKSIGNER: '/nonexistent/apksigner', DIRECT_PIN_FILE: pin });
assert.equal(r.status, 1, 'a pinned key and no tool to check it: stop'); assert.ok(r.stderr.includes('apksigner was not found'));
r = run('check-apk-signature.sh', ['x.apk', '--require-own-key'], { APKSIGNER: '/nonexistent/apksigner', DIRECT_PIN_FILE: path.join(TMP, 'none.txt') });
assert.equal(r.status, 1, 'own key required and no tool: stop');
fs.rmSync(pin, { force: true });
r = run('check-apk-signature.sh', ['x.apk'], { APKSIGNER: '/nonexistent/apksigner', DIRECT_PIN_FILE: pin });
assert.equal(r.status, 0, 'nothing pinned and no tool: only a warning'); assert.ok(r.stderr.includes('not checked'));
r = run('check-apk-signature.sh', [], { DIRECT_PIN_FILE: pin });
assert.notEqual(r.status, 0, 'an APK is required');

// ---- new-signing-key.sh with the real keytool
const hasKeytool = spawnSync('keytool', ['-help'], { encoding: 'utf8' }).error === undefined;
if (hasKeytool) {
  const out = path.join(TMP, 'keys'), pin2 = path.join(TMP, 'repo/app/signing/cert-sha256.txt');
  const env = { DIRECT_NEW_KEY_PASSWORD: 'a long enough password', DIRECT_SKIP_UPLOAD: '1', DIRECT_PIN_FILE: pin2 };
  r = run('new-signing-key.sh', [out], { ...env, DIRECT_NEW_KEY_PASSWORD: 'short' });
  assert.equal(r.status, 1); assert.ok(r.stderr.includes('at least 12'), 'a short password is refused');
  assert.equal(fs.existsSync(path.join(out, 'direct-release.p12')), false, 'and nothing is made');

  r = run('new-signing-key.sh', [out], env);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const ks = path.join(out, 'direct-release.p12');
  assert.ok(fs.existsSync(ks), 'the key file is made');
  assert.equal(fs.statSync(ks).mode & 0o077, 0, 'only the owner can read it');
  const sha = fs.readFileSync(pin2, 'utf8').trim();
  assert.match(sha, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/, 'the fingerprint is written to the pin file');
  assert.ok(r.stdout.includes(sha), 'and shown');
  assert.equal(r.stdout.includes(env.DIRECT_NEW_KEY_PASSWORD), false, 'the password is never printed');
  assert.ok(r.stdout.includes('DIRECT_KEYSTORE_FILE'), 'it explains how to build with the key');

  const list = spawnSync('keytool', ['-list', '-v', '-keystore', ks, '-storepass:env', 'PW'], { env: { PATH: process.env.PATH ?? '', PW: env.DIRECT_NEW_KEY_PASSWORD, LC_ALL: 'C' }, encoding: 'utf8' });
  assert.equal(list.status, 0, list.stderr);
  assert.ok(/Alias name: direct/.test(list.stdout) && /RSA/.test(list.stdout) && /4096/.test(list.stdout), 'alias direct, RSA 4096');
  assert.ok(list.stdout.includes('CN=Direct, O=SNC AB, C=SE'));
  assert.ok(list.stdout.toUpperCase().includes(sha), 'the pinned fingerprint is the key\'s fingerprint');

  r = run('new-signing-key.sh', [out], env);
  assert.equal(r.status, 1); assert.ok(r.stderr.includes('already exists'), 'an existing key is never overwritten');
  assert.equal(fs.readFileSync(pin2, 'utf8').trim(), sha, 'and the pin is not changed');
} else console.log('(keytool not found: key creation not tested)');

fs.rmSync(TMP, { recursive: true, force: true });
console.log('signing-scripts.test.ts OK');
