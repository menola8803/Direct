// The "Why does it not connect?" report: the verdicts, and the facts collected from two real phones (real relay, real WebRTC).
import assert from 'node:assert/strict';
import wrtc from '@roamhq/wrtc';
import { Cause, Diag, Facts, cause, hints, reportText } from '../src/core/diagnose';
import { cardToContact, decodeCard, encodeCard, newIdentity, Contact, Identity } from '../src/core/crypto';
import { isInitiator } from '../src/core/protocol';
import { PeerManager } from '../src/net/peers';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServer } = require('../../server/server.js');

const NOW = 1_000_000;
const diag = (o: Partial<Diag> = {}): Diag => ({ at: NOW - 30_000, how: 'offer', heard: true, gather: 'complete', ice: 'failed', conn: 'failed', dc: 'connecting',
  cand: { host: 2, srflx: 1, relay: 0, other: 0 }, remote: 3, ended: { at: NOW - 10_000, why: 'timeout after 20 s' }, errors: [], ...o });
const facts = (o: Partial<Facts> = {}): Facts => ({ signal: { url: 'wss://x.example', state: 'online', err: '', since: NOW - 60_000, tries: 0 }, link: 'closed', diag: diag(), relayOnly: false, hasTurn: false, now: NOW, ...o });
const is = (f: Facts, c: Cause, what: string) => assert.equal(cause(f), c, what);

// ---- verdicts, from the outside in
is(facts({ link: 'open' }), 'open', 'connected');
is(facts({ signal: { url: '', state: 'offline', err: '', since: 0, tries: 0 }, diag: undefined }), 'no-server', 'no signal server set');
is(facts({ signal: { url: 'wss://x.example', state: 'connecting', err: '', since: NOW - 5_000, tries: 1 }, diag: undefined }), 'server-wait', 'just started, may still be waking up');
is(facts({ signal: { url: 'wss://x.example', state: 'connecting', err: '', since: NOW - 90_000, tries: 4 }, diag: undefined }), 'server-down', 'trying for a long time');
is(facts({ signal: { url: 'wss://x.example', state: 'offline', err: 'closed (1006)', since: NOW - 3_000, tries: 2 }, diag: undefined }), 'server-down', 'closed by the server or the network');
is(facts({ diag: undefined }), 'no-attempt', 'nothing has been tried');
is(facts({ diag: diag({ ended: undefined, at: NOW - 3_000, heard: false }) }), 'in-progress', 'only just started');
is(facts({ diag: diag({ ended: undefined, at: NOW - 1_000, heard: false, offline: true }) }), 'peer-offline', 'the server says the other phone is not there: said at once');
is(facts({ diag: diag({ heard: false, offline: true }) }), 'peer-offline', 'and still said after the attempt has ended');
is(facts({ diag: diag({ heard: true, offline: true }) }), 'no-path', 'it was offline once but has answered since');
is(facts({ signal: { url: '', state: 'offline', err: '', since: 0, tries: 0 }, diag: diag({ how: 'manual', heard: false, remote: 0, offline: true }) }), 'no-reply', 'manual pairing never asks the server');
is(facts({ diag: diag({ heard: false, remote: 0 }) }), 'no-reply', 'the offer got no answer');
is(facts({ diag: diag({ cand: { host: 0, srflx: 0, relay: 0, other: 0 }, remote: 0 }) }), 'no-address', 'no addresses of our own');
is(facts({ diag: diag({ remote: 0 }) }), 'no-remote', 'none from the other phone');
is(facts({ diag: diag() }), 'no-path', 'addresses on both sides but no route');
is(facts({ diag: diag({ ice: 'connected', conn: 'connected', ended: undefined, at: NOW - 20_000 }) }), 'channel', 'network up, encrypted channel not');
is(facts({ signal: { url: '', state: 'offline', err: '', since: 0, tries: 0 }, diag: diag({ how: 'manual', heard: false, remote: 0 }) }), 'no-reply', 'manual pairing needs no server');
is(facts({ diag: diag({ ended: undefined, at: NOW - 20_000 }) }), 'no-path', 'still going after a long time counts as no route');

// ---- hints only for "no route"
assert.deepEqual(hints(facts({ diag: diag({ cand: { host: 2, srflx: 0, relay: 0, other: 0 } }) })), ['stun-silent', 'no-turn'], 'STUN gave nothing, no TURN');
assert.deepEqual(hints(facts({ hasTurn: true })), [], 'STUN answered and TURN is set: nothing to add');
assert.deepEqual(hints(facts()), ['no-turn']);
assert.deepEqual(hints(facts({ relayOnly: true, diag: diag({ cand: { host: 0, srflx: 0, relay: 1, other: 0 } }) })), ['no-turn'], 'no STUN is expected in privacy mode');
assert.deepEqual(hints(facts({ diag: diag({ heard: false }) })), [], 'not for other causes');

// ---- the text report holds no address, and names what is missing
const rep = reportText(facts({ diag: diag({ errors: ['setRemoteDescription failed'] }) }), '9.9.9');
assert.ok(rep.startsWith('Direct 9.9.9'));
for (const line of ['Signal server: online · x.example', 'Link: closed', 'we made the offer', 'ended after 20 s: timeout after 20 s', 'Other phone answered: yes', 'host 2 · STUN 1 · relay 0', 'Their addresses received: 3', 'Errors: setRemoteDescription failed', 'Verdict: no-path'])
  assert.ok(rep.includes(line), line);
assert.ok(!/wss:|\d+\.\d+\.\d+\.\d+/.test(rep), 'no full address and no IP address in the report');
assert.ok(reportText(facts({ diag: undefined, signal: { url: '', state: 'offline', err: '', since: 0, tries: 0 } }), '1').includes('Signal server: not set'));
assert.ok(reportText(facts({ diag: undefined }), '1').includes('Attempt: none yet'));
assert.ok(reportText(facts({ signal: { url: 'wss://x.example/path?k=1', state: 'offline', err: 'closed (1006)', since: 0, tries: 3 }, diag: undefined }), '1').includes('last signal error: closed (1006) (3 tries)'));
assert.ok(!reportText(facts({ signal: { url: 'wss://secret.example/path?token=abc', state: 'online', err: '', since: 0, tries: 0 } }), '1').includes('token=abc'), 'only the host name of the server is shown');

// ---- facts from real connections
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(f: () => boolean, ms = 8000) { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(25); } }
const card = (id: Identity, name: string): Contact => cardToContact(decodeCard(encodeCard(id, name))!);

(async () => {
  const PORT = 18091, srv = createServer({ port: PORT, host: '127.0.0.1' });
  const url = `ws://127.0.0.1:${PORT}`;
  const mk = (id: Identity, others: Contact[], extra: Record<string, unknown> = {}) => new PeerManager({ identity: id, signalUrl: url, iceServers: [], rtc: wrtc as any,
    getContactBySign: s => others.find(c => c.signPub === s), onPlain: () => {}, onLink: () => {}, ...extra });
  const ia = newIdentity(), ib = newIdentity();
  const forA = card(ib, 'Bo'), forB = card(ia, 'Anna'); // how A sees B, and B sees A

  // a connection that works: the facts are filled in on both sides
  {
    const A = mk(ia, [forA]), B = mk(ib, [forB]); A.start(); B.start();
    await until(() => A.isSignalOnline() && B.isSignalOnline());
    assert.equal(A.signalInfo().state, 'online'); assert.equal(A.signalInfo().url, url);
    A.connect(forA); B.connect(forB);
    await until(() => A.isOpen(forA.id) && B.isOpen(forB.id));
    for (const [m, c, who] of [[A, forA, 'A'], [B, forB, 'B']] as const) {
      const d = m.getDiag(c.id)!;
      assert.ok(d, `${who}: an attempt is recorded`);
      assert.equal(d.heard, true, `${who}: the other phone was heard`);
      assert.ok(d.cand.host + d.cand.srflx + d.cand.relay > 0, `${who}: our own addresses were counted`);
      assert.ok(d.remote > 0, `${who}: addresses from the other phone were counted`);
      assert.equal(d.conn, 'connected', `${who}: connection state`);
      assert.equal(d.dc, 'open', `${who}: channel state`);
      assert.equal(d.ended, undefined, `${who}: not ended`);
    }
    const initiator = isInitiator(ia.signPublic, ib.signPublic) ? 'A' : 'B';
    assert.equal((initiator === 'A' ? A : B).getDiag(initiator === 'A' ? forA.id : forB.id)!.how, 'offer', 'the initiator made the offer');
    assert.equal((initiator === 'A' ? B : A).getDiag(initiator === 'A' ? forB.id : forA.id)!.how, 'answer', 'the other one answered');
    A.stop(); B.stop(); await wait(100);
    assert.equal(A.getDiag(forA.id)!.ended!.why, 'stopped', 'the attempt is kept after it ended, with the reason');
  }

  // the other phone is not online: the offer gets no answer, the server says so, and the report says so
  {
    const ic = newIdentity(), forA2 = card(ic, 'Offline');
    const [x, y] = isInitiator(ia.signPublic, ic.signPublic) ? [ia, ic] : [ic, ia]; // make sure the one that offers is the one we look at
    const me = x === ia ? ia : ic, other = me === ia ? card(ic, 'Offline') : card(ia, 'Offline');
    void y; void forA2;
    const M = mk(me, [other], { connectTimeoutMs: 1500 }); M.start(); await until(() => M.isSignalOnline());
    M.connect(other); await wait(2200);
    const d = M.getDiag(other.id)!;
    const f: Facts = { signal: M.signalInfo(), link: 'closed', diag: d, relayOnly: false, hasTurn: false, now: Date.now() };
    if (d.how === 'offer') { assert.equal(d.heard, false); assert.equal(d.offline, true, 'the server said the other phone is not connected'); assert.ok(d.ended!.why.startsWith('timeout'), d.ended!.why); assert.equal(cause(f), 'peer-offline'); }
    else assert.equal(cause({ ...f, diag: undefined }), 'no-attempt', 'the phone that waits has made no attempt');
    M.stop();
  }

  // the other phone is online but has not added us: the server delivers the offer, nobody answers, and it is not "offline"
  {
    let x = newIdentity(), y = newIdentity();
    while (!isInitiator(x.signPublic, y.signPublic)) { x = newIdentity(); y = newIdentity(); }
    const bo = card(y, 'Bo');
    const M = mk(x, [bo], { connectTimeoutMs: 1500 }), O = mk(y, []); M.start(); O.start();
    await until(() => M.isSignalOnline() && O.isSignalOnline());
    M.connect(bo); await wait(2200);
    const d = M.getDiag(bo.id)!;
    assert.equal(d.heard, false); assert.ok(!d.offline, 'the server did not say offline: the phone is there');
    assert.equal(cause({ signal: M.signalInfo(), link: 'closed', diag: d, relayOnly: false, hasTurn: false, now: Date.now() }), 'no-reply');
    M.stop(); O.stop();
  }

  // privacy mode without a relay: nothing can be gathered, and the report says "no addresses"
  {
    const A = mk(ia, [forA], { relayOnly: true, connectTimeoutMs: 2500 }), B = mk(ib, [forB], { relayOnly: true, connectTimeoutMs: 2500 }); A.start(); B.start();
    await until(() => A.isSignalOnline() && B.isSignalOnline());
    A.connect(forA); B.connect(forB); await wait(3500);
    assert.equal(A.isOpen(forA.id) || B.isOpen(forB.id), false, 'relay only without a relay server cannot connect');
    const off = isInitiator(ia.signPublic, ib.signPublic) ? [A, forA] as const : [B, forB] as const;
    const d = off[0].getDiag(off[1].id)!;
    assert.equal(d.cand.host + d.cand.srflx + d.cand.relay, 0, 'no addresses gathered');
    assert.equal(cause({ signal: off[0].signalInfo(), link: 'closed', diag: d, relayOnly: true, hasTurn: false, now: Date.now() }), 'no-address');
    A.stop(); B.stop();
  }

  await srv.close();
  console.log('diagnose.test.ts OK');
})().catch(e => { console.error(e); process.exit(1); });
