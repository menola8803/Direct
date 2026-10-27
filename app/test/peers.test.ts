// Integration test: real relay server + real WebRTC (wrtc) between two PeerManagers.
import assert from 'node:assert/strict';
import wrtc from '@roamhq/wrtc';
import { newIdentity, cardToContact, decodeCard, encodeCard, Contact } from '../src/core/crypto';
import { newId, Plain } from '../src/core/protocol';
import { PeerManager } from '../src/net/peers';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServer } = require('../../server/server.js');

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(f: () => boolean, ms = 8000) { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(25); } }

(async () => {
  const srv = createServer({ port: 18081, host: '127.0.0.1' });
  const ia = newIdentity(), ib = newIdentity();
  // Contacts are added via a card (like the QR code)
  const aSeesB: Contact = cardToContact(decodeCard(encodeCard(ib, 'Bo'))!);
  const bSeesA: Contact = cardToContact(decodeCard(encodeCard(ia, 'Anna'))!);
  const gotA: Plain[] = [], gotB: Plain[] = [];
  const linkA: string[] = [], linkB: string[] = [];
  const mk = (id: typeof ia, other: Contact, got: Plain[], link: string[]) => new PeerManager({
    identity: id, signalUrl: 'ws://127.0.0.1:18081', iceServers: [], rtc: wrtc as any,
    getContactBySign: s => (s === other.signPub ? other : undefined),
    onPlain: (_c, p) => got.push(p), onLink: (_id, s) => link.push(s),
  });
  const A = mk(ia, aSeesB, gotA, linkA), B = mk(ib, bSeesA, gotB, linkB);
  A.start(); B.start();
  await until(() => A.isSignalOnline() && B.isSignalOnline());

  // Both try to connect at the same time: only one initiates, no deadlock
  A.connect(aSeesB); B.connect(bSeesA);
  await until(() => A.isOpen(aSeesB.id) && B.isOpen(bSeesA.id));

  const m: Plain = { t: 'msg', id: newId(), text: 'Hello from A åäö', at: Date.now() };
  assert.equal(A.send(aSeesB, m), true);
  await until(() => gotB.length === 1);
  assert.deepEqual(gotB[0], m);
  assert.equal(B.send(bSeesA, { t: 'ack', id: (m as any).id }), true);
  await until(() => gotA.length === 1);
  assert.deepEqual(gotA[0], { t: 'ack', id: (m as any).id });

  // Unknown sender is ignored
  const eve = newIdentity(); const gotE: Plain[] = [];
  const E = new PeerManager({ identity: eve, signalUrl: 'ws://127.0.0.1:18081', iceServers: [], rtc: wrtc as any,
    getContactBySign: s => (s === ia.signPublic ? cardToContact(decodeCard(encodeCard(ia, 'Anna'))!) : undefined), onPlain: (_c, p) => gotE.push(p), onLink: () => {} });
  E.start(); await until(() => E.isSignalOnline());
  const annaForEve = cardToContact(decodeCard(encodeCard(ia, 'Anna'))!);
  E.connect(annaForEve); await wait(1500);
  assert.equal(E.isOpen(annaForEve.id), false, 'unknown contact gets no connection');

  // Shut down B: A notices, and can reconnect when B comes back
  B.stop(); await until(() => !A.isOpen(aSeesB.id), 8000);
  assert.equal(A.send(aSeesB, m), false, 'sending fails when the channel is down (goes to the outbox)');
  const B2 = mk(ib, bSeesA, gotB, linkB); B2.start();
  await until(() => B2.isSignalOnline());
  A.connect(aSeesB); B2.connect(bSeesA);
  await until(() => A.isOpen(aSeesB.id) && B2.isOpen(bSeesA.id));
  assert.equal(A.send(aSeesB, m), true);

  A.stop(); B2.stop(); E.stop(); await srv.close();
  console.log('peers: all tests OK (real WebRTC + relay)');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
