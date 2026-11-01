// A contact added while the app is already online must be connected without a restart.
import assert from 'node:assert/strict';
import wrtc from '@roamhq/wrtc';
import { Contact, Identity, cardToContact, decodeCard, encodeCard, newIdentity } from '../src/core/crypto';
import { pickNewContacts } from '../src/core/autoconnect';
import { isInitiator } from '../src/core/protocol';
import { PeerManager } from '../src/net/peers';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServer } = require('../../server/server.js');

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(f: () => boolean, ms = 8000) { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(25); } }
const card = (id: Identity, name: string): Contact => cardToContact(decodeCard(encodeCard(id, name))!);

// ---- which contacts to start
{
  const a = card(newIdentity(), 'A'), b = card(newIdentity(), 'B'), c = card(newIdentity(), 'C');
  const tried = new Set<string>();
  assert.deepEqual(pickNewContacts({}, {}, tried), [], 'nobody');
  assert.deepEqual(pickNewContacts({ [a.id]: a, [b.id]: b }, {}, tried).map(x => x.name), ['A', 'B'], 'everyone the first time');
  assert.deepEqual(pickNewContacts({ [a.id]: a, [b.id]: b }, {}, tried), [], 'nobody twice');
  assert.deepEqual(pickNewContacts({ [a.id]: a, [b.id]: b, [c.id]: c }, {}, tried).map(x => x.name), ['C'], 'only the one added later');
  assert.deepEqual(pickNewContacts({ [a.id]: a, [b.id]: b, [c.id]: c }, { [b.id]: 'B' }, tried), [], 'a blocked contact is not started');
  assert.deepEqual(pickNewContacts({ [a.id]: a, [b.id]: b, [c.id]: c }, {}, tried).map(x => x.name), ['B'], 'unblocked: started again');
  assert.deepEqual(pickNewContacts({ [a.id]: a }, {}, tried), [], 'removed contacts are forgotten');
  assert.deepEqual(pickNewContacts({ [a.id]: a, [b.id]: b }, {}, tried).map(x => x.name), ['B'], 'and added again: started again');
  const fresh = new Set<string>(); fresh.add('x');
  assert.deepEqual(pickNewContacts({ [a.id]: a }, { [a.id]: 'A' }, fresh), [], 'blocked from the start');
  assert.equal(fresh.size, 0, 'ids that are not contacts are dropped from the set');
}

// ---- two phones that are already online when they add each other
(async () => {
  const srv = createServer({ port: 18090, host: '127.0.0.1' });
  type Phone = { m: PeerManager; add: (c: Contact) => void; self: (name: string) => Contact };
  // `auto` = the fix: every change of the contact list starts the new contacts. Without it nothing starts them.
  const phone = (id: Identity, auto: boolean): Phone => {
    const contacts: Record<string, Contact> = {}, tried = new Set<string>();
    const m = new PeerManager({ identity: id, signalUrl: 'ws://127.0.0.1:18090', iceServers: [], rtc: wrtc as any,
      getContactBySign: s => Object.values(contacts).find(c => c.signPub === s), onPlain: () => {}, onLink: () => {},
      onSignal: st => { if (st === 'online') { tried.clear(); pickNewContacts(contacts, {}, tried).forEach(c => m.connect(c)); } } });
    const add = (c: Contact) => { contacts[c.id] = c; if (auto && m.isSignalOnline()) pickNewContacts(contacts, {}, tried).forEach(x => m.connect(x)); };
    return { m, add, self: name => card(id, name) };
  };
  // Which phone makes the offer depends on the keys, so make one pair of each kind: `I` offers, `N` waits and says hello.
  const pair = () => {
    for (;;) { const x = newIdentity(), y = newIdentity(); if (isInitiator(x.signPublic, y.signPublic)) return { I: x, N: y }; }
  };

  // before the fix: both online, both add each other, nothing happens (the contact would stay "offline")
  {
    const { I, N } = pair();
    const A = phone(I, false), B = phone(N, false); A.m.start(); B.m.start();
    await until(() => A.m.isSignalOnline() && B.m.isSignalOnline());
    const a = A.self('Anna'), b = B.self('Bo');
    A.add(b); B.add(a); await wait(1500);
    assert.equal(A.m.isOpen(b.id) || B.m.isOpen(a.id), false, 'without starting new contacts nobody connects');
    A.m.stop(); B.m.stop();
  }

  // after the fix: whoever adds the other last, with no restart and without opening a chat
  const cases: [string, 'I' | 'N', number][] = [
    ['the phone that makes the offers adds first, the other 1.2 s later (the offer is still unanswered: offered again)', 'I', 1200],
    ['the phone that makes the offers adds first, the other 4.5 s later (offered again at once)', 'I', 4500],
    ['the phone that waits adds first, the other 1.2 s later (its hello was ignored: the new offer is answered)', 'N', 1200],
  ];
  for (const [what, first, gap] of cases) {
    const { I, N } = pair();
    const P = { I: phone(I, true), N: phone(N, true) }; P.I.m.start(); P.N.m.start();
    await until(() => P.I.m.isSignalOnline() && P.N.m.isSignalOnline());
    const forI = P.N.self('Bo'), forN = P.I.self('Anna'); // how each phone sees the other
    const add = (who: 'I' | 'N') => (who === 'I' ? P.I.add(forI) : P.N.add(forN));
    add(first); await wait(gap);
    assert.equal(P.I.m.isOpen(forI.id) || P.N.m.isOpen(forN.id), false, `${what}: not connected while only one has added the other`);
    add(first === 'I' ? 'N' : 'I');
    await until(() => P.I.m.isOpen(forI.id) && P.N.m.isOpen(forN.id), 9000).catch(e => { throw new Error(`${what}: ${e.message}`); });
    P.I.m.stop(); P.N.m.stop();
  }

  await srv.close();
  console.log('autoconnect.test.ts OK');
})().catch(e => { console.error(e); process.exit(1); });
