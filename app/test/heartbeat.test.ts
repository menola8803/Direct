// A phone that loses its network (Wi-Fi off, hotspot gone, sleep) does not get a close event: the connection just stops
// carrying anything. These tests make that happen for real, with a proxy that swallows every packet while the connection
// stays open, and check that the app notices, reconnects, and does not wait for someone to restart it.
import assert from 'node:assert/strict';
import net from 'node:net';
import wrtc from '@roamhq/wrtc';
import { Contact, Identity, cardToContact, decodeCard, encodeCard, newIdentity } from '../src/core/crypto';
import { isInitiator } from '../src/core/protocol';
import { PeerManager, SignalState } from '../src/net/peers';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServer } = require('../../server/server.js');

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(f: () => boolean, ms = 8000, what = 'condition') { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout: ' + what); await wait(25); } }
const card = (id: Identity, name: string): Contact => cardToContact(decodeCard(encodeCard(id, name))!);

// A TCP proxy in front of the server. `black = true` makes it swallow everything in both directions, like a network that went away.
function proxy(to: number, listen: number) {
  const st = { black: false, seen: 0 };
  const socks = new Set<net.Socket>();
  const srv = net.createServer(c => {
    st.seen++;
    const up = net.connect(to, '127.0.0.1');
    socks.add(c); socks.add(up);
    c.on('data', d => { if (!st.black) up.write(d); });
    up.on('data', d => { if (!st.black) c.write(d); });
    const end = () => { c.destroy(); up.destroy(); socks.delete(c); socks.delete(up); };
    c.on('close', end); up.on('close', end); c.on('error', () => {}); up.on('error', () => {});
  });
  srv.listen(listen, '127.0.0.1');
  return { st, close: () => new Promise<void>(r => { for (const s of socks) s.destroy(); srv.close(() => r()); }) };
}

const pair = () => { for (;;) { const x = newIdentity(), y = newIdentity(); if (isInitiator(x.signPublic, y.signPublic)) return { I: x, N: y }; } };

(async () => {
  const srv = createServer({ port: 18100, host: '127.0.0.1' });
  const FAST = { heartbeatMs: 150, heartbeatTimeoutMs: 200, connectMs: 500, reconnectMs: 200 };

  type Phone = { m: PeerManager; states: SignalState[]; links: string[]; contacts: Record<string, Contact> };
  const phone = (id: Identity, url: string, extra: Partial<ConstructorParameters<typeof PeerManager>[0]> = {}): Phone => {
    const contacts: Record<string, Contact> = {}, states: SignalState[] = [], links: string[] = [];
    const m: PeerManager = new PeerManager({ identity: id, signalUrl: url, iceServers: [], rtc: wrtc as any, ...FAST, ...extra,
      getContactBySign: s => Object.values(contacts).find(c => c.signPub === s),
      onPlain: () => {}, onLink: (cid, st) => links.push(`${cid}:${st}`),
      // like the app: when the server is reached, ask every contact for a connection
      onSignal: st => { states.push(st); if (st === 'online') Object.values(contacts).forEach(c => m.connect(c)); } });
    return { m, states, links, contacts };
  };

  // ---- 1. a dead connection is noticed, and replaced as soon as the network is back
  {
    const px = proxy(18100, 18101);
    const A = phone(newIdentity(), 'ws://127.0.0.1:18101');
    A.m.start();
    await until(() => A.m.isSignalOnline(), 3000, 'online');
    const t0 = Date.now();
    px.st.black = true;
    await until(() => !A.m.isSignalOnline(), 3000, 'noticed that the connection is dead');
    assert.ok(Date.now() - t0 < 4000, `noticed within about a heartbeat (${Date.now() - t0} ms)`);
    assert.match(A.m.signalInfo().err, /no reply|no answer/, 'and says why');
    px.st.black = false;
    await until(() => A.m.isSignalOnline(), 6000, 'online again by itself');
    assert.deepEqual(A.states.slice(0, 5), ['connecting', 'online', 'offline', 'connecting', 'online'], 'offline, then straight back');
    A.m.stop(); await px.close();
  }

  // ---- 2. a connection that never gets started is given up, not waited for for ever
  {
    const px = proxy(18100, 18102); px.st.black = true;
    const A = phone(newIdentity(), 'ws://127.0.0.1:18102');
    A.m.start();
    await until(() => px.st.seen >= 2, 6000, 'a second attempt after the first got no answer');
    assert.equal(A.m.isSignalOnline(), false);
    assert.match(A.m.signalInfo().err, /no answer/);
    px.st.black = false;
    await until(() => A.m.isSignalOnline(), 6000, 'online when the network is back');
    A.m.stop(); await px.close();
  }

  // ---- 3. coming back to the app: a long retry pause is skipped, and a dead connection is found within seconds
  {
    // (a) the server was unreachable for a while, so the next retry is far away
    const dead = createServer({ port: 18103, host: '127.0.0.1' }); await dead.close(); // nothing listens on 18103
    const A = phone(newIdentity(), 'ws://127.0.0.1:18103', { heartbeatMs: 60000 });
    A.m.start();
    await wait(5000); // the tries fail one after the other, each pause longer than the last: the next one is about 3.5 s away
    const late = createServer({ port: 18103, host: '127.0.0.1' });
    const t0 = Date.now();
    A.m.wake();
    await until(() => A.m.isSignalOnline(), 2000, 'online right after wake');
    assert.ok(Date.now() - t0 < 2500, `wake() does not wait for the retry timer (${Date.now() - t0} ms)`);
    A.m.stop(); await late.close();

    // (b) a dead connection, with a heartbeat that would not look for minutes: wake() checks at once
    const px = proxy(18100, 18104);
    const B = phone(newIdentity(), 'ws://127.0.0.1:18104', { heartbeatMs: 60000, wakeCheckMs: 250 });
    B.m.start();
    await until(() => B.m.isSignalOnline(), 3000, 'online');
    px.st.black = true;
    await wait(300);
    assert.equal(B.m.isSignalOnline(), true, 'nothing has noticed yet');
    const t1 = Date.now();
    B.m.wake();
    await until(() => !B.m.isSignalOnline(), 3000, 'wake() finds the dead connection');
    assert.ok(Date.now() - t1 < 3000, `found within the wake check (${Date.now() - t1} ms)`);
    // and a healthy connection survives wake()
    px.st.black = false;
    await until(() => B.m.isSignalOnline(), 6000, 'online again');
    B.m.wake(); await wait(600);
    assert.equal(B.m.isSignalOnline(), true, 'a working connection is left alone');
    assert.equal(B.states.filter(s => s === 'offline').length, 1, 'and not restarted');
    B.m.stop(); await px.close();
  }

  // ---- 4. an offer sent into a dead connection does not leave the link waiting for the 20 s timeout
  {
    const px = proxy(18100, 18105);
    const { I, N } = pair();
    const A = phone(I, 'ws://127.0.0.1:18105', { connectTimeoutMs: 30000 }), B = phone(N, 'ws://127.0.0.1:18100', { connectTimeoutMs: 30000 });
    const a = card(I, 'Anna'), b = card(N, 'Bo');
    A.m.start(); B.m.start();
    await until(() => A.m.isSignalOnline() && B.m.isSignalOnline(), 5000, 'both online');
    // They add each other only now: the phones connect to the contacts they have when the server comes online, so with the
    // contacts in place earlier the link could already be open here, depending on how fast the machine is.
    A.contacts[b.id] = b; B.contacts[a.id] = a;
    px.st.black = true;                  // Anna's network goes, she does not know it
    A.m.connect(b);                      // her offer goes nowhere
    await wait(100);
    assert.equal(A.m.isOpen(b.id), false);
    const t0 = Date.now();
    await until(() => !A.m.isSignalOnline(), 5000, 'Anna notices');
    px.st.black = false;
    await until(() => A.m.isOpen(b.id) && B.m.isOpen(a.id), 12000, 'the link comes up on the new connection');
    assert.ok(Date.now() - t0 < 14000, `well before the 30 s attempt timeout (${Date.now() - t0} ms)`);
    A.m.stop(); B.m.stop(); await px.close();
  }

  // ---- 5. an open link that dies is made again by itself, once
  {
    const { I, N } = pair();
    const A = phone(I, 'ws://127.0.0.1:18100'), B = phone(N, 'ws://127.0.0.1:18100');
    const a = card(I, 'Anna'), b = card(N, 'Bo');
    A.contacts[b.id] = b; B.contacts[a.id] = a;
    A.m.start(); B.m.start();
    await until(() => A.m.isOpen(b.id) && B.m.isOpen(a.id), 8000, 'first connection');
    const before = A.links.length;
    (A.m as any).drop(b.id, 'closed', false, 'test: link died'); // what happens when the connection dies under the app
    assert.equal(A.m.isOpen(b.id), false);
    await until(() => A.m.isOpen(b.id) && B.m.isOpen(a.id), 8000, 'link made again without anyone doing anything');
    assert.ok(A.links.slice(before).join().includes(`${b.id}:closed`) && A.links.slice(before).join().includes(`${b.id}:open`), 'closed, then open');

    // stopping on purpose must not bring it back
    const att = (A.m as any).peers; A.m.stop(); await wait(600);
    assert.equal(att.size, 0, 'nothing is started after stop()');
    assert.equal(A.m.isOpen(b.id), false);
    B.m.stop();
  }

  // ---- 6. an attempt that never got open is not repeated on its own (no retry storm against a phone that is gone)
  {
    const { I, N } = pair();
    const A = phone(I, 'ws://127.0.0.1:18100', { connectTimeoutMs: 600 });
    const b = card(N, 'Bo');
    A.contacts[b.id] = b;
    A.m.start();
    await until(() => A.m.isSignalOnline(), 3000, 'online');
    await until(() => A.links.some(l => l === `${b.id}:closed`), 4000, 'the first attempt times out');
    const n = A.links.filter(l => l === `${b.id}:connecting`).length;
    await wait(2500);
    assert.equal(A.links.filter(l => l === `${b.id}:connecting`).length, n, 'and nothing starts it again by itself');
    assert.equal(A.m.getDiag(b.id)?.offline, true, 'the server told us the other phone is not there, and the report knows it');
    A.m.stop();
  }

  await srv.close();
  console.log('heartbeat.test.ts OK');
})().catch(e => { console.error(e); process.exit(1); });
