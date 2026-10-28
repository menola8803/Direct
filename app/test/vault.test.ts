import assert from 'node:assert/strict';
import { SEALED_PREFIX, VaultIO, isSealed, keyFromText, keyToText, loadVault, makeSaver, newDataKey, openStored, openText, sealText } from '../src/core/vault';

const key = newDataKey(), other = newDataKey();
assert.equal(key.length, 32);
assert.notDeepEqual(key, other);

// ---- seal / open
const text = JSON.stringify({ name: 'Åsa', msg: 'hej 🌍', turn: 'turn:x user pass' });
const s1 = sealText(key, text), s2 = sealText(key, text);
assert.ok(s1.startsWith(SEALED_PREFIX) && isSealed(s1));
assert.notEqual(s1, s2, 'a new nonce every time: same text, different bytes');
assert.ok(!s1.includes('Åsa') && !s1.includes('pass'), 'nothing readable in the sealed text');
assert.equal(openText(key, s1), text, 'round trip, also non-ASCII');
assert.equal(openText(key, sealText(key, '')), '', 'empty text');
assert.equal(openText(other, s1), null, 'wrong key');
assert.equal(openText(key, text), null, 'plain text is not sealed data');
assert.equal(openText(key, SEALED_PREFIX + '!!!notbase64'), null);
assert.equal(openText(key, SEALED_PREFIX), null, 'too short');
assert.equal(openText(new Uint8Array(5), s1), null, 'wrong key length');
const flipped = s1.slice(0, -6) + (s1.slice(-6, -5) === 'A' ? 'B' : 'A') + s1.slice(-5);
assert.equal(openText(key, flipped), null, 'a changed byte is detected');
assert.equal(isSealed('{"a":1}'), false);
assert.equal(isSealed(null), false);

// ---- key text
assert.deepEqual(keyFromText(keyToText(key)), key);
assert.equal(keyFromText(null), null);
assert.equal(keyFromText(''), null);
assert.equal(keyFromText(keyToText(new Uint8Array(16))), null, 'a 16-byte key is refused');
assert.equal(keyFromText('@@@'), null);

// ---- what to load
const state = { name: 'Anna', contacts: {} };
const sealed = sealText(key, JSON.stringify(state)), plain = JSON.stringify({ name: 'Old' });
assert.deepEqual(openStored(null, null, key), { state: null, status: 'fresh' }, 'nothing saved: a fresh install');
assert.deepEqual(openStored(null, null, null), { state: null, status: 'fresh' });
assert.deepEqual(openStored(sealed, null, key), { state, status: 'ok' });
assert.deepEqual(openStored(sealed, plain, key), { state, status: 'ok' }, 'the sealed state wins over the old one');
assert.deepEqual(openStored(null, plain, key), { state: { name: 'Old' }, status: 'legacy' }, 'state from before 0.13.0 is read, then sealed on the next save');
assert.deepEqual(openStored(null, plain, null), { state: { name: 'Old' }, status: 'legacy' }, 'also if the key could not be read');
assert.deepEqual(openStored(sealed, null, null), { state: null, status: 'lost' }, 'key missing: cannot be read');
assert.deepEqual(openStored(sealed, null, other), { state: null, status: 'lost' }, 'wrong key');
assert.deepEqual(openStored(sealed, plain, other), { state: { name: 'Old' }, status: 'legacy' }, 'unreadable sealed state: fall back to the older one rather than nothing');
assert.deepEqual(openStored(null, '{broken', key), { state: null, status: 'lost' });
assert.deepEqual(openStored(null, '"a string"', key), { state: null, status: 'lost' }, 'must be an object');
assert.deepEqual(openStored(sealText(key, 'not json'), null, key), { state: null, status: 'lost' });

// ---- saver: one write for a burst, in order, flush and cancel
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
(async () => {
  const written: string[] = [];
  let busy = 0, overlap = false;
  const sv = makeSaver(async t => { busy++; if (busy > 1) overlap = true; await sleep(15); written.push(t); busy--; }, 30);

  sv.schedule(() => 'a'); sv.schedule(() => 'b'); sv.schedule(() => 'c');
  assert.deepEqual(written, [], 'nothing is written straight away');
  await sleep(90);
  assert.deepEqual(written, ['c'], 'a burst is written once, with the latest value');

  let value = 'x';
  sv.schedule(() => value); value = 'y'; // the text is read when the write happens
  await sv.flush();
  assert.deepEqual(written, ['c', 'y'], 'flush writes at once with the newest value');
  await sv.flush();
  assert.deepEqual(written, ['c', 'y'], 'flush with nothing waiting writes nothing');

  sv.schedule(() => 'p'); await sv.flush(); sv.schedule(() => 'q'); await sv.flush();
  assert.deepEqual(written.slice(-2), ['p', 'q'], 'writes happen in order');
  assert.equal(overlap, false, 'never two writes at the same time');

  const before = written.length;
  sv.schedule(() => 'never'); await sv.cancel(); await sleep(70);
  assert.equal(written.length, before, 'cancel drops what was waiting');

  const bad = makeSaver(async () => { throw new Error('disk full'); }, 10);
  bad.schedule(() => 'z'); await bad.flush();
  bad.schedule(() => 'z2'); await bad.flush(); // a failed write does not stop later ones from running
  const ok: string[] = []; let fail = true;
  const sv2 = makeSaver(async t => { if (fail) { fail = false; throw new Error('first fails'); } ok.push(t); }, 10);
  sv2.schedule(() => '1'); await sv2.flush(); sv2.schedule(() => '2'); await sv2.flush();
  assert.deepEqual(ok, ['2'], 'after a failed write the next one still happens');


  // ---- loading at start: the safety rules
  const NAMES = { sealed: 'v3', legacy: 'v2' };
  const fakeIO = (o: { state?: Record<string, string>; key?: string | null; failState?: boolean; failKeyRead?: boolean; failKeyWrite?: boolean } = {}) => {
    const st = { ...(o.state ?? {}) }; let keyText: string | null = o.key ?? null; const wrote: string[] = [];
    const io: VaultIO = {
      readState: async n => { if (o.failState) throw new Error('storage'); return st[n] ?? null; },
      readKey: async () => { if (o.failKeyRead) throw new Error('keystore'); return keyText; },
      writeKey: async t => { if (o.failKeyWrite) throw new Error('keystore'); keyText = t; wrote.push(t); },
    };
    return { io, wrote, key: () => keyText };
  };
  const goodKey = keyToText(key);

  let f = fakeIO();
  let l = await loadVault(f.io, NAMES);
  assert.equal(l.status, 'fresh'); assert.equal(l.canSave, true); assert.ok(l.key && l.key.length === 32, 'a fresh install makes a key');
  assert.equal(f.wrote.length, 1, 'and stores it'); assert.equal(f.key(), keyToText(l.key!)); assert.equal(l.legacyLeft, false);

  f = fakeIO({ state: { v2: plain } });
  l = await loadVault(f.io, NAMES);
  assert.deepEqual(l.state, { name: 'Old' }); assert.equal(l.status, 'legacy'); assert.equal(l.canSave, true);
  assert.equal(l.legacyLeft, true, 'an update from before 0.13.0: the plain copy is deleted once the sealed one is written'); assert.equal(f.wrote.length, 1, 'a key is made');

  f = fakeIO({ state: { v3: sealed }, key: goodKey });
  l = await loadVault(f.io, NAMES);
  assert.deepEqual(l.state, state); assert.equal(l.status, 'ok'); assert.equal(l.canSave, true); assert.equal(f.wrote.length, 0, 'an existing key is kept'); assert.equal(l.legacyLeft, false);

  f = fakeIO({ state: { v3: sealed, v2: plain }, key: goodKey });
  l = await loadVault(f.io, NAMES);
  assert.equal(l.status, 'ok'); assert.equal(l.legacyLeft, true, 'both exist (an earlier run stopped in the middle): the old copy is still to be deleted');

  f = fakeIO({ state: { v3: sealed }, failState: true, key: goodKey });
  l = await loadVault(f.io, NAMES);
  assert.equal(l.canSave, false, 'storage cannot be read: never write over it'); assert.equal(l.state, null);

  f = fakeIO({ state: { v3: sealed }, failKeyRead: true });
  l = await loadVault(f.io, NAMES);
  assert.equal(l.canSave, false, 'secure storage cannot be read: no new key is made, nothing is overwritten');
  assert.equal(f.wrote.length, 0, 'in particular the real key is not replaced'); assert.equal(l.state, null);
  f = fakeIO({ state: { v2: plain }, failKeyRead: true });
  l = await loadVault(f.io, NAMES);
  assert.deepEqual(l.state, { name: 'Old' }, 'the plain older state can still be shown'); assert.equal(l.canSave, false); assert.equal(l.legacyLeft, false, 'and it is not deleted');

  f = fakeIO({ state: { v3: sealed } });
  l = await loadVault(f.io, NAMES);
  assert.equal(l.status, 'lost', 'the key is gone: the sealed state cannot be read'); assert.equal(l.state, null);
  assert.equal(l.canSave, true, 'the app starts empty with a new key'); assert.equal(f.wrote.length, 1);

  f = fakeIO({ state: { v3: sealed }, key: 'AAAA' });
  l = await loadVault(f.io, NAMES);
  assert.equal(l.status, 'lost', 'a damaged key text is the same as no key'); assert.equal(l.canSave, true);

  f = fakeIO({ state: { v2: plain }, failKeyWrite: true });
  l = await loadVault(f.io, NAMES);
  assert.equal(l.canSave, false, 'a key that cannot be stored is not used: data sealed with it could never be read again');
  assert.deepEqual(l.state, { name: 'Old' }); assert.equal(l.legacyLeft, false);
  assert.equal(l.key, null, 'and it is not handed on for sealing files either');

  f = fakeIO({ state: { v3: sealText(other, JSON.stringify(state)) }, key: goodKey });
  l = await loadVault(f.io, NAMES);
  assert.equal(l.status, 'lost', 'sealed with another key'); assert.equal(l.canSave, true);

  console.log('vault.test.ts OK');
})().catch(e => { console.error(e); process.exit(1); });
