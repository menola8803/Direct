import assert from 'node:assert/strict';
import { BACKUP_EXT, KDF_N, MIN_PASSPHRASE, PHONE_ONLY, applyBackup, backupFileName, backupState, createBackup, passphraseProblem, readBackup, BackupData } from '../src/core/backup';
import { newIdentity } from '../src/core/crypto';
import { migrateSaved } from '../src/core/migrate';
import nacl from 'tweetnacl';
import { scrypt } from 'scrypt-js';

const N = 1 << 12; // the smallest allowed: fast tests
const PASS = 'orange kitchen thunder 42';
const id = newIdentity();
const saved = {
  themeName: 'beige', langChoice: 'sv', name: 'Åsa Lind', signalUrl: 'wss://example.org', stunList: 'stun:a:3478', turnList: 'turn:b:3478 user secretpassword',
  hideIp: true, tcpOnly: false, retentionDays: 30,
  contacts: { a1: { id: 'a1', name: 'Anna', boxPub: 'x', signPub: 'y', addedAt: 1, verified: true } }, blocked: { z9: 'Spam' },
  messages: { a1: [
    { id: 'm1', mine: true, text: 'hej 🌍', at: 5, status: 'delivered' },
    { id: 'm2', mine: false, text: 'foto.jpg', at: 6, file: { name: 'foto.jpg', mime: 'image/jpeg', size: 10, kind: 'file', uri: 'file:///storage/emulated/0/Download/Direct/Anna-a1/foto.jpg' } },
  ] },
  fileMode: 'private', lockOn: true, lockDelay: 300, storagePrompted: true, orphanAsked: true, introSeen: true,
};
const frozen = JSON.stringify(saved);

(async () => {
  assert.equal(KDF_N, 32768); assert.equal(MIN_PASSPHRASE, 12); assert.equal(BACKUP_EXT, 'direct');
  assert.equal(backupFileName(new Date(2026, 9, 5)), 'Direct-backup-2026-10-05.direct');

  // ---- what goes into a backup
  const st = backupState(saved);
  assert.equal(JSON.stringify(saved), frozen, 'the input is not modified');
  for (const k of PHONE_ONLY) assert.equal(k in st, false, `${k} belongs to the phone, not the backup`);
  assert.equal(st.name, 'Åsa Lind'); assert.equal(st.turnList, saved.turnList); assert.equal(st.retentionDays, 30);
  assert.equal(st.messages.a1[1].file.uri, '', 'file addresses are not carried to another phone');
  assert.equal(st.messages.a1[1].file.name, 'foto.jpg', 'but the message and the file details are');
  assert.equal(st.messages.a1[0].text, 'hej 🌍');

  // ---- create and read
  const data: BackupData = { v: 1, at: 1234, identity: id, state: st };
  const steps: number[] = [];
  const file = await createBackup(data, PASS, { N, onProgress: p => { steps.push(p); } });
  assert.ok(steps.length > 0 && steps[steps.length - 1] === 1 && steps.every((p, i) => i === 0 || p >= steps[i - 1]), 'progress rises to 1');
  const j = JSON.parse(file);
  assert.equal(j['direct-backup'], 1); assert.equal(j.kdf, 'scrypt'); assert.equal(j.N, N); assert.equal(j.r, 8); assert.equal(j.p, 1);
  for (const secret of [id.boxSecret, id.signSecret, 'Åsa', 'Anna', 'secretpassword', 'hej', PASS]) assert.equal(file.includes(secret), false, `"${secret}" is not readable in the file`);
  assert.notEqual(file, await createBackup(data, PASS, { N }), 'every backup is different (salt and nonce)');

  const r = await readBackup(file, PASS);
  assert.ok(r.ok);
  if (r.ok) { assert.deepEqual(r.data, data, 'everything comes back'); assert.equal(r.data.identity.signSecret, id.signSecret); }

  // ---- wrong passphrase, changed file, bad files
  assert.deepEqual(await readBackup(file, PASS + ' '), { ok: false, error: 'passphrase' });
  assert.deepEqual(await readBackup(file, 'orange kitchen thunder 43'), { ok: false, error: 'passphrase' });
  assert.deepEqual(await readBackup(file, ''), { ok: false, error: 'passphrase' });
  const ct = j.ct as string, flip = (c: string) => (c[10] === 'A' ? 'B' : 'A');
  assert.deepEqual(await readBackup(JSON.stringify({ ...j, ct: ct.slice(0, 10) + flip(ct) + ct.slice(11) }), PASS), { ok: false, error: 'passphrase' }, 'a changed file is refused');
  assert.deepEqual(await readBackup(JSON.stringify({ ...j, salt: Buffer.alloc(16, 7).toString('base64') }), PASS), { ok: false, error: 'passphrase' }, 'another salt: another key');
  const bad = async (o: any) => (await readBackup(JSON.stringify({ ...j, ...o }), PASS) as any).error;
  assert.equal(await readBackup('not json', PASS).then(x => (x as any).error), 'format');
  assert.equal(await readBackup('{}', PASS).then(x => (x as any).error), 'format');
  assert.equal(await readBackup('null', PASS).then(x => (x as any).error), 'format');
  assert.equal(await bad({ 'direct-backup': 2 }), 'format', 'a newer format is not guessed at');
  assert.equal(await bad({ kdf: 'pbkdf2' }), 'format');
  assert.equal(await bad({ N: 1 << 30 }), 'format', 'a file cannot ask for a huge amount of memory');
  assert.equal(await bad({ N: 1 << 11 }), 'format', 'nor a too weak setting');
  assert.equal(await bad({ N: 5000 }), 'format', 'N must be a power of two');
  assert.equal(await bad({ N: 1.5 }), 'format');
  assert.equal(await bad({ r: 1 }), 'format'); assert.equal(await bad({ p: 16 }), 'format');
  assert.equal(await bad({ salt: 'AAAA' }), 'format'); assert.equal(await bad({ nonce: '!!' }), 'format'); assert.equal(await bad({ ct: 'AA==' }), 'format');
  assert.equal(await bad({ salt: 5 }), 'format');

  // ---- sealed content that is not a backup (right passphrase, wrong content)
  const forge = async (content: unknown) => {
    const salt = nacl.randomBytes(16), nonce = nacl.randomBytes(24);
    const key = await scrypt(Buffer.from(PASS), salt, N, 8, 1, 32);
    const ctx = nacl.secretbox(Buffer.from(JSON.stringify(content)), nonce, key);
    return JSON.stringify({ 'direct-backup': 1, kdf: 'scrypt', N, r: 8, p: 1, salt: Buffer.from(salt).toString('base64'), nonce: Buffer.from(nonce).toString('base64'), ct: Buffer.from(ctx).toString('base64') });
  };
  assert.equal(await readBackup(await forge({ hello: 1 }), PASS).then(x => (x as any).error), 'damaged');
  assert.equal(await readBackup(await forge({ v: 1, at: 1, identity: { ...id, boxSecret: 'AAAA' }, state: {} }), PASS).then(x => (x as any).error), 'damaged', 'an identity with a short key');
  const other = newIdentity();
  assert.equal(await readBackup(await forge({ v: 1, at: 1, identity: { ...id, boxSecret: other.boxSecret }, state: {} }), PASS).then(x => (x as any).error), 'damaged', 'a public key that does not belong to its secret key');
  assert.equal(await readBackup(await forge({ v: 1, at: 1, identity: { ...id, signSecret: other.signSecret }, state: {} }), PASS).then(x => (x as any).error), 'damaged');
  assert.equal(await readBackup(await forge({ v: 1, at: 1, identity: id, state: [] }), PASS).then(x => (x as any).error), 'damaged', 'state must be an object');
  assert.equal(await readBackup(await forge({ v: 1, at: 1, identity: id }), PASS).then(x => (x as any).error), 'damaged');
  assert.equal((await readBackup(await forge({ v: 1, at: 1, identity: id, state: {} }), PASS)).ok, true, 'a minimal backup is fine');

  // ---- passphrase rules and spelling
  assert.equal(passphraseProblem('short one'), 'short');
  assert.equal(passphraseProblem('a'.repeat(30)), 'same');
  assert.equal(passphraseProblem('abababababab'), 'same', 'only two different characters');
  assert.equal(passphraseProblem('abcd abcd abcd'), null);
  assert.equal(passphraseProblem(PASS), null);
  assert.equal(passphraseProblem('x'.repeat(11) + 'y'), 'same');
  const nfc = 'blåbär söndag köket 7', nfd = nfc.normalize('NFD');
  assert.notEqual(nfc, nfd, 'the test needs two spellings');
  const f2 = await createBackup(data, nfc, { N });
  assert.equal((await readBackup(f2, nfd)).ok, true, 'å ä ö typed in another way open the same backup');
  assert.equal((await readBackup(f2, 'blabar sondag koket 7')).ok, false, 'but a missing accent does not');

  // ---- restoring on top of the phone's own settings
  const current = { themeName: 'dark', langChoice: 'en', name: 'Old', contacts: { q: { id: 'q' } }, blocked: {}, messages: { q: [{ id: 'x' }] }, fileMode: 'visible', lockOn: false, lockDelay: 60, storagePrompted: false, orphanAsked: false, introSeen: false, retentionDays: 14, signalUrl: '' };
  const res = applyBackup(current, data);
  assert.deepEqual(Object.keys(res.contacts), ['a1'], 'contacts and chats are replaced, not mixed');
  assert.equal(res.messages.q, undefined, 'the old chats are gone');
  assert.equal(res.name, 'Åsa Lind'); assert.equal(res.themeName, 'beige'); assert.equal(res.retentionDays, 30); assert.equal(res.signalUrl, 'wss://example.org');
  assert.equal(res.fileMode, 'visible', 'where files go stays as set on this phone'); assert.equal(res.lockOn, false); assert.equal(res.lockDelay, 60);
  assert.equal(res.introSeen, true, 'no getting-started screen after a restore');
  assert.equal(applyBackup(current, { ...data, state: {} }).retentionDays, 14, 'a setting missing in the backup keeps the phone\'s value');
  assert.deepEqual(applyBackup(current, { ...data, state: {} }).contacts, {}, 'a backup without contacts leaves none');
  assert.equal(migrateSaved(res).retentionDays, 30, 'the result passes through the usual migration');

  console.log('backup.test.ts OK');
})().catch(e => { console.error(e); process.exit(1); });
