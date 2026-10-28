import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { patchBuildGradle } = require('../plugins/withReleaseSigning');
const tpl = fs.readFileSync(path.join(__dirname, 'fixtures/build.gradle.txt'), 'utf8');
const count = (s: string, c: string) => s.split(c).length - 1;
const section = (s: string, name: string) => { const i = s.indexOf(name); let d = 0; for (let j = s.indexOf('{', i); j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}' && --d === 0) return s.slice(i, j + 1); } throw new Error('x'); };

const out = patchBuildGradle(tpl);
assert.notEqual(out, tpl);
assert.equal(count(out, '{'), count(out, '}'), 'braces stay balanced');

const sc = section(out, 'signingConfigs');
assert.ok(sc.includes("storeFile file('debug.keystore')"), 'the debug config is untouched');
assert.ok(/release\s*\{/.test(sc), 'a release signing config is added');
for (const v of ['DIRECT_KEYSTORE_FILE', 'DIRECT_KEYSTORE_PASSWORD', 'DIRECT_KEY_ALIAS', 'DIRECT_KEY_PASSWORD']) assert.ok(sc.includes(`System.getenv('${v}')`), `${v} is read`);
assert.ok(!/storePassword\s+'/.test(sc.slice(sc.indexOf('release'))), 'no password in the file itself');
assert.ok(/if \(System\.getenv\('DIRECT_KEYSTORE_FILE'\)\)/.test(sc), 'the key is only used when the keystore variable is set');

const bt = section(out, 'buildTypes');
const dbg = section(bt, 'debug'), rel = section(bt, 'release');
assert.ok(dbg.includes('signingConfig signingConfigs.debug'), 'the debug build type still uses the debug key');
assert.ok(rel.includes("signingConfig System.getenv('DIRECT_KEYSTORE_FILE') ? signingConfigs.release : signingConfigs.debug"), 'release uses the own key when it is set, else debug');
assert.equal(count(bt, 'signingConfigs.debug'), 2, 'one debug and one fallback');
assert.ok(rel.includes('minifyEnabled') && rel.includes('proguardFiles'), 'the rest of the release build type is untouched');

assert.equal(patchBuildGradle(out), out, 'running it twice changes nothing');

// the generated file must look as expected, or the build stops (never a silently wrong key)
assert.throws(() => patchBuildGradle('android { }'), /signingConfigs block not found/);
assert.throws(() => patchBuildGradle(tpl.replace('buildTypes', 'buildTypez')), /buildTypes block not found/);
assert.throws(() => patchBuildGradle(tpl.replace(/release \{\s*\/\/ Caution[\s\S]*?signingConfig signingConfigs\.debug/, 'release {')), /does not use the debug signing config|release build type not found/);
assert.throws(() => patchBuildGradle(tpl.replace(/buildTypes \{[\s\S]*?release \{/, 'buildTypes {\n        other {')), /release build type not found|does not use/);
assert.throws(() => patchBuildGradle(tpl.slice(0, tpl.indexOf('release {', tpl.indexOf('buildTypes')) + 40)), /unbalanced|not found|does not use/, 'a file cut off inside the release build type');

console.log('signing.test.ts OK');
