// How contacts are added (code or QR): the setting, its repair, and that unfinished codes stay on the phone and out of backups.
import assert from 'node:assert/strict';
import { ADD_MODES, DEFAULT_ADD_MODE, normAddMode } from '../src/core/addmode';
import { PHONE_ONLY, applyBackup, backupState } from '../src/core/backup';
import { migrateSaved } from '../src/core/migrate';
import { formatCode, formatPartial, newCode, parseCode } from '../src/core/pair';
import { APK_URL, pairMessage } from '../src/core/invite';
import { dict } from '../src/i18n';

assert.equal(DEFAULT_ADD_MODE, 'code', 'the code is the default');
assert.deepEqual(ADD_MODES, ['code', 'qr']);
assert.equal(normAddMode('qr'), 'qr');
assert.equal(normAddMode('code'), 'code');
for (const junk of [undefined, null, 'x', 1, true, 'QR', {}]) assert.equal(normAddMode(junk), 'code', `junk ${String(junk)} -> default`);
assert.equal(migrateSaved({}).addMode, undefined, 'older state: the app default (code) applies');
assert.equal(migrateSaved({ addMode: 'qr' }).addMode, 'qr', 'a chosen QR is kept');
assert.equal(migrateSaved({ addMode: 'weird' }).addMode, 'code', 'a damaged value becomes the default');
assert.equal(migrateSaved({ pairs: 'junk' }).pairs, undefined, 'a damaged list of codes is dropped');
assert.deepEqual(migrateSaved({ pairs: [] }).pairs, []);

// codes under way belong to this phone and its mailbox: not in a backup, and a restore keeps the phone's own
assert.ok((PHONE_ONLY as readonly string[]).includes('pairs'));
const rec = { key: 'A4829', role: 'A', box: '4829', step: 'open', digits: '4829173056', y: 'secret', Y: 'pub', created: 1, exp: 2 };
assert.equal('pairs' in backupState({ pairs: [rec], name: 'x' }), false, 'no pairing secrets in a backup');
assert.deepEqual(applyBackup({ pairs: [rec] }, { v: 1, at: 0, identity: {} as any, state: { name: 'x', pairs: [{ key: 'old' }] } }).pairs, [rec], 'a restore does not bring back or remove codes');
// the preference itself travels with a backup
assert.equal(backupState({ addMode: 'qr' }).addMode, 'qr');

// typing a code: digits only, dashes put in, never longer than a whole code
assert.equal(formatPartial(''), '');
assert.equal(formatPartial('4'), '4');
assert.equal(formatPartial('4829'), '4829');
assert.equal(formatPartial('48291'), '4829-1');
assert.equal(formatPartial('482917305'), '4829-17305');
assert.equal(formatPartial('4829173056'), '4829-17305-6');
assert.equal(formatPartial('4829-17305-6'), '4829-17305-6', 'already shaped');
assert.equal(formatPartial('4829 17305 6 99999'), '4829-17305-6', 'too long is cut');
assert.equal(formatPartial('a4b8c2d9'), '4829', 'letters are dropped');
for (let i = 0; i < 50; i++) { const c = newCode(); assert.deepEqual(parseCode(formatPartial(c.digits)), c, 'typing a whole code digit by digit gives a code that reads back'); assert.equal(formatPartial(c.digits), formatCode(c.digits)); }

// the message that carries a code, in both languages
for (const lang of ['sv', 'en'] as const) {
  const t = dict[lang];
  const code = formatCode(newCode().digits);
  const sms = pairMessage(code, t, 'Claes');
  assert.ok(sms.startsWith('Claes '), `${lang}: starts with who it is`);
  assert.ok(sms.includes(code), `${lang}: has the code`);
  assert.ok(sms.includes(t.pcSmsValid), `${lang}: says that it works once and for how long`);
  assert.ok(sms.includes(APK_URL) && sms.includes(t.inviteAllow), `${lang}: has the app link for someone who lacks the app`);
  assert.ok(!/\{name\}/.test(sms), `${lang}: placeholder replaced`);
  assert.ok(pairMessage(code, t, '').startsWith(t.inviteSomeone), `${lang}: falls back when the name is empty`);
  assert.ok(pairMessage(code, t, 'A$&B\n').includes('A$&B'), `${lang}: odd names are inserted literally`);
  assert.ok(!/[–—→›]/.test(sms), `${lang}: plain characters only`);
  console.log(`  ${lang}: code message is ${sms.length} characters`);
}
// every text of the pairing screens exists in both languages and the placeholders match
for (const k of Object.keys(dict.sv).filter(k => /^(pc|addway)/.test(k)) as (keyof typeof dict.sv)[]) {
  assert.ok(dict.en[k] && dict.sv[k], `${k} exists in both languages`);
  assert.deepEqual(dict.sv[k].match(/\{\w+\}/g) ?? [], dict.en[k].match(/\{\w+\}/g) ?? [], `${k}: same placeholders`);
}
console.log('addmode.test.ts OK');
