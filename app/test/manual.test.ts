// Utan någon server: manuell parkoppling med koder, sessionskryptering och omförhandling av mediaspår.
import assert from 'node:assert/strict';
import wrtc from '@roamhq/wrtc';
import { newIdentity, cardToContact, decodeCard, encodeCard, Contact } from '../src/core/crypto';
import { Plain } from '../src/core/protocol';
import { PeerManager } from '../src/net/peers';
import { Receiver, sendFile, Sink, Source } from '../src/core/transfer';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(f: () => boolean, ms = 10000) { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(25); } }

(async () => {
  const ia = newIdentity(), ib = newIdentity();
  const aSeesB: Contact = cardToContact(decodeCard(encodeCard(ib, 'Bo'))!);
  const bSeesA: Contact = cardToContact(decodeCard(encodeCard(ia, 'Anna'))!);
  const gotA: Plain[] = [], gotB: Plain[] = [];
  const tracksA: string[] = [], tracksB: string[] = [];
  const mk = (id: typeof ia, other: Contact, got: Plain[], tr: string[]) => new PeerManager({
    identity: id, signalUrl: '', iceServers: [], rtc: wrtc as any,
    getContactBySign: s => (s === other.signPub ? other : undefined),
    onPlain: (_c, p) => got.push(p), onLink: () => {}, onTrack: (_c, _s, t) => tr.push(t.kind),
  });
  const A = mk(ia, aSeesB, gotA, tracksA), B = mk(ib, bSeesA, gotB, tracksB);
  A.start(); B.start();

  // utan server och utan kod händer inget
  A.connect(aSeesB); assert.equal(A.isOpen(aSeesB.id), false);

  // A skapar förfråga, B svarar, A slutför
  const offer = await A.manualOffer(aSeesB);
  assert.ok(offer.startsWith('directm1:'));
  assert.equal(PeerManager.manualSender(offer), ia.signPublic);
  assert.ok(!offer.includes('v=0'), 'koden är inte klartext-SDP');
  const answer = await B.manualAnswer(bSeesA, offer);
  // fel person kan inte slutföra
  const eve = newIdentity();
  const E = new PeerManager({ identity: eve, signalUrl: '', iceServers: [], rtc: wrtc as any, getContactBySign: () => undefined, onPlain: () => {}, onLink: () => {} });
  await assert.rejects(E.manualAnswer(cardToContact(decodeCard(encodeCard(ia, 'Anna'))!), offer));
  await A.manualFinish(aSeesB, answer);
  await until(() => A.isOpen(aSeesB.id) && B.isOpen(bSeesA.id));

  const m: Plain = { t: 'msg', id: 'x1', text: 'Helt utan server', at: 1 };
  assert.equal(A.send(aSeesB, m), true);
  await until(() => gotB.length === 1);
  assert.deepEqual(gotB[0], m);

  // Mediaspår läggs till i efterhand och förhandlas över den krypterade kanalen
  const src = new (wrtc as any).nonstandard.RTCAudioSource();
  const stream = new (wrtc as any).MediaStream([src.createTrack()]);
  A.setLocalStream(aSeesB.id, stream);
  await until(() => tracksB.includes('audio'));
  // och åt andra hållet samtidigt
  const src2 = new (wrtc as any).nonstandard.RTCAudioSource();
  B.setLocalStream(bSeesA.id, new (wrtc as any).MediaStream([src2.createTrack()]));
  await until(() => tracksA.includes('audio'));
  // chatten fungerar fortfarande efter omförhandling
  assert.equal(B.send(bSeesA, { t: 'ack', id: 'x1' }), true);
  await until(() => gotA.length === 1);

  // Filöverföring (300 000 byte) i bitar, med mottagare som skriver till minnet
  const data = new Uint8Array(300000).map((_, i) => (i * 7 + 3) & 255);
  const doneFiles: { id: string; bytes: Uint8Array }[] = [];
  const rx = new Receiver({
    makeSink: async () => { const parts: Uint8Array[] = []; return { write: async b => { parts.push(b); }, abort: async () => {},
      finish: async () => { const all = new Uint8Array(parts.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of parts) { all.set(x, o); o += x.length; } doneFiles.push({ id: 'f1', bytes: all }); return 'mem://f1'; } } as Sink; },
    onDone: () => {},
  });
  const fsrc: Source = { size: data.length, read: async (o, l) => data.slice(o, o + l) };
  const ok = await sendFile({ id: 'f1', name: 'a/b.bin', mime: 'application/octet-stream', size: data.length, kind: 'file', at: 1 }, fsrc,
    { send: p => A.send(aSeesB, p), buffered: () => A.bufferedAmount(aSeesB.id), isOpen: () => A.isOpen(aSeesB.id) });
  assert.equal(ok, true);
  await until(() => gotB.filter(x => x.t === 'chunk' || x.t === 'file').length === 38);
  for (const x of gotB) if (x.t === 'file' || x.t === 'chunk') await rx.handle(x);
  assert.equal(doneFiles.length, 1);
  assert.deepEqual(doneFiles[0].bytes, data, 'filen kom fram oförändrad');
  // för stor fil / trasig ordning avvisas
  const fails: string[] = [];
  const rx2 = new Receiver({ makeSink: async () => ({ write: async () => {}, finish: async () => '', abort: async () => {} }), onDone: () => assert.fail('ska ej bli klar'), onFail: id => fails.push(id) });
  await rx2.handle({ t: 'file', id: 'z', name: 'x', mime: 'x', size: 99999999999, kind: 'file', chunks: 1, at: 1 });
  await rx2.handle({ t: 'file', id: 'y', name: 'x', mime: 'x', size: 20000, kind: 'file', chunks: 3, at: 1 });
  await rx2.handle({ t: 'chunk', id: 'y', i: 1, d: 'AAAA' });
  assert.deepEqual(fails, ['z', 'y']);

  A.stop(); B.stop(); E.stop();
  console.log('manual: alla tester OK (serverlös koppling, session, media)');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
