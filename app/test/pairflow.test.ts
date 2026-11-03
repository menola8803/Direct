// Pairing with a one-time code: two phones and a real signal server, with phones that go away and come back in the middle.
import assert from 'node:assert/strict';
import wrtc from '@roamhq/wrtc';
import nacl from 'tweetnacl';
import { Contact, Identity, cardToContact, encodeCard, newIdentity } from '../src/core/crypto';
import { checkDigit, formatCode } from '../src/core/pair';
import { KEEP_ENDED_MS, MAX_ACTIVE, PAIR_TTL_MS, PairFlow, PairRec } from '../src/core/pairflow';
import { PeerManager } from '../src/net/peers';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServer } = require('../../server/server.js');

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(f: () => boolean, ms = 10000, what = 'condition') { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout: ' + what); await wait(20); } }

const PORT = 18110, URL = `ws://127.0.0.1:${PORT}`;
const FAST = { heartbeatMs: 400, heartbeatTimeoutMs: 400, connectMs: 1000, reconnectMs: 200 };

// A phone as the app has it: a saved state that survives the app being closed, a connection, and the pairing flow on top of it.
class Phone {
  id: Identity; name: string;
  saved: PairRec[] = [];
  contacts: Record<string, Contact> = {};
  m!: PeerManager; flow!: PairFlow;
  clock = Date.now();
  rand?: (k: number) => Uint8Array;
  constructor(name: string) { this.name = name; this.id = newIdentity(); }
  start() {
    this.m = new PeerManager({ identity: this.id, signalUrl: URL, iceServers: [], rtc: wrtc as any, ...FAST,
      getContactBySign: s => Object.values(this.contacts).find(c => c.signPub === s),
      onPlain: () => {}, onLink: () => {},
      onSignal: st => { if (st === 'online') this.flow.sync(); },
      onPair: m => this.flow.onMessage(m) });
    this.flow = new PairFlow({
      send: o => this.m.signalSend(o), now: () => this.clock, rand: this.rand,
      myCard: () => encodeCard(this.id, this.name),
      addContact: card => { const c = cardToContact(card); if (c.signPub === this.id.signPublic) return null; this.contacts[c.id] = this.contacts[c.id] ?? c; return { id: c.id, name: c.name }; },
      load: () => JSON.parse(JSON.stringify(this.saved)), save: l => { this.saved = JSON.parse(JSON.stringify(l)); },
    });
    this.m.start();
    return this;
  }
  stop() { this.m.stop(); return this; }
  online() { return this.m.isSignalOnline(); }
  rec(key: string) { return this.saved.find(r => r.key === key); }
  names() { return Object.values(this.contacts).map(c => c.name).sort(); }
}
const SECRETS = ['digits', 'y', 'Y', 'theirY', 'out', 'tries'] as const;
const hasNoSecrets = (r: PairRec) => SECRETS.every(k => !(k in r));

(async () => {
  let srv = createServer({ port: PORT, host: '127.0.0.1' });

  // ---- 1. the plain case: A makes a code, B types it, both have each other
  {
    const A = new Phone('Anna').start(), B = new Phone('Bo').start();
    await until(() => A.online() && B.online(), 5000, 'online');
    const made = A.flow.create()!;
    assert.equal(made.step, 'opening');
    await until(() => A.rec(made.key)?.step === 'open', 5000, 'A: code is open');
    assert.equal(srv.pairs.size(), 1);
    const digits = A.rec(made.key)!.digits!;
    assert.match(formatCode(digits), /^\d{4}-\d{5}-\d$/);
    const r = B.flow.enter(formatCode(digits));
    assert.ok(r.ok);
    await until(() => B.rec('B' + made.box)?.step === 'done' && A.rec(made.key)?.step === 'done', 8000, 'both done');
    assert.deepEqual(A.names(), ['Bo']);
    assert.deepEqual(B.names(), ['Anna']);
    assert.equal(Object.values(A.contacts)[0].signPub, B.id.signPublic, 'A has B\'s real key');
    assert.equal(Object.values(B.contacts)[0].signPub, A.id.signPublic, 'B has A\'s real key');
    assert.equal(A.rec(made.key)!.name, 'Bo');
    assert.equal(B.rec('B' + made.box)!.name, 'Anna');
    assert.ok(hasNoSecrets(A.rec(made.key)!) && hasNoSecrets(B.rec('B' + made.box)!), 'nothing secret is kept once it is done');
    await until(() => srv.pairs.size() === 0, 3000, 'the mailbox is gone');
    // the finished record can be dismissed, and goes by itself after a day
    A.flow.dismiss(made.key);
    assert.equal(A.rec(made.key), undefined);
    B.clock += KEEP_ENDED_MS + 1000; B.flow.sync();
    assert.equal(B.saved.length, 0, 'removed after a day');
    A.stop(); B.stop();
  }

  // ---- 2. a wrong code: the right mailbox, the wrong secret. A finds out, the code is burnt, nobody is added
  {
    const A = new Phone('Anna').start(), B = new Phone('Bo').start(), E = new Phone('Eve').start();
    await until(() => A.online() && B.online() && E.online(), 5000, 'online');
    const made = A.flow.create()!;
    await until(() => A.rec(made.key)?.step === 'open', 5000, 'open');
    const real = A.rec(made.key)!.digits!;
    const box = real.slice(0, 4);
    const guess = real.slice(4, 9) === '00000' ? '00001' : '00000';
    const wrong = box + guess + checkDigit(box + guess); // passes the check digit, so it reaches the server
    assert.ok(E.flow.enter(wrong).ok);
    await until(() => A.rec(made.key)?.step === 'failed', 8000, 'A: found out');
    assert.equal(A.rec(made.key)!.why, 'wrong');
    assert.deepEqual(A.names(), [], 'A added nobody');
    assert.deepEqual(E.names(), [], 'and Eve got nothing');
    await until(() => E.rec('B' + box)?.step === 'failed', 8000, 'E: told');
    assert.equal(E.rec('B' + box)!.why, 'gone');
    assert.ok(hasNoSecrets(A.rec(made.key)!) && hasNoSecrets(E.rec('B' + box)!));
    // the real code is burnt too: Bo gets nothing
    assert.ok(B.flow.enter(real).ok);
    await until(() => B.rec('B' + box)?.step === 'failed', 8000, 'B: told');
    assert.equal(B.rec('B' + box)!.why, 'none');
    assert.deepEqual(B.names(), []);
    A.stop(); B.stop(); E.stop();
  }

  // ---- 3. only one may try: a second phone with the right code, after someone has claimed it, is turned away
  {
    const A = new Phone('Anna').start(), B = new Phone('Bo').start(), X = new Phone('Xia').start();
    await until(() => A.online() && B.online() && X.online(), 5000, 'online');
    const made = A.flow.create()!;
    await until(() => A.rec(made.key)?.step === 'open', 5000, 'open');
    const code = A.rec(made.key)!.digits!;
    A.stop(); // Anna is away, so B's claim stays in the mailbox
    await until(() => !A.online(), 5000, 'A away');
    assert.ok(B.flow.enter(code).ok);
    await until(() => B.rec('B' + made.box)?.step === 'sent', 8000, 'B: sent its card and waits');
    assert.ok(X.flow.enter(code).ok);
    await until(() => X.rec('B' + made.box)?.step === 'failed', 8000, 'X: turned away');
    assert.equal(X.rec('B' + made.box)!.why, 'used');
    // Anna comes back (the app was closed: only the saved records are left) and finds Bo's card waiting
    const saved = A.saved;
    const A2 = new Phone('Anna'); A2.id = A.id; A2.saved = saved; A2.start();
    await until(() => A2.rec(made.key)?.step === 'done' && B.rec('B' + made.box)?.step === 'done', 10000, 'finished after the restart');
    assert.deepEqual(A2.names(), ['Bo']);
    assert.deepEqual(B.names(), ['Anna']);
    assert.deepEqual(X.names(), []);
    A2.stop(); B.stop(); X.stop();
  }

  // ---- 4. B is away when A answers: B picks the answer up when it comes back
  {
    const A = new Phone('Anna').start(), B = new Phone('Bo').start();
    await until(() => A.online() && B.online(), 5000, 'online');
    const made = A.flow.create()!;
    await until(() => A.rec(made.key)?.step === 'open', 5000, 'open');
    const code = A.rec(made.key)!.digits!;
    A.stop(); await until(() => !A.online(), 5000, 'A away');
    B.flow.enter(code);
    await until(() => B.rec('B' + made.box)?.step === 'sent', 8000, 'sent');
    B.stop(); await until(() => !B.online(), 5000, 'B away');
    const A2 = new Phone('Anna'); A2.id = A.id; A2.saved = A.saved; A2.start();
    await until(() => A2.rec(made.key)?.step === 'done', 10000, 'A done');
    assert.equal(srv.pairs.size(), 1, 'the answer waits in the mailbox for B');
    const B2 = new Phone('Bo'); B2.id = B.id; B2.saved = B.saved; B2.start();
    await until(() => B2.rec('B' + made.box)?.step === 'done', 10000, 'B done after coming back');
    assert.deepEqual(B2.names(), ['Anna']);
    await until(() => srv.pairs.size() === 0, 3000, 'box closed');
    A2.stop(); B2.stop();
  }

  // ---- 5. the server restarts and forgets everything: A puts the code back when it reconnects
  {
    const A = new Phone('Anna').start(), B = new Phone('Bo').start();
    await until(() => A.online() && B.online(), 5000, 'online');
    const made = A.flow.create()!;
    await until(() => A.rec(made.key)?.step === 'open', 5000, 'open');
    const code = A.rec(made.key)!.digits!;
    await srv.close();
    srv = createServer({ port: PORT, host: '127.0.0.1' });
    assert.equal(srv.pairs.size(), 0, 'a new server knows nothing');
    await until(() => A.online() && B.online() && srv.pairs.size() === 1, 15000, 'A put the code back');
    B.flow.enter(code);
    await until(() => A.rec(made.key)?.step === 'done' && B.rec('B' + made.box)?.step === 'done', 10000, 'done');
    A.stop(); B.stop();
  }

  // ---- 6. the code runs out
  {
    const A = new Phone('Anna').start(), B = new Phone('Bo').start();
    await until(() => A.online() && B.online(), 5000, 'online');
    const made = A.flow.create()!;
    await until(() => A.rec(made.key)?.step === 'open', 5000, 'open');
    const code = A.rec(made.key)!.digits!;
    A.clock += PAIR_TTL_MS + 1000; A.flow.sync();
    assert.equal(A.rec(made.key)!.step, 'failed');
    assert.equal(A.rec(made.key)!.why, 'expired');
    assert.ok(hasNoSecrets(A.rec(made.key)!));
    await until(() => srv.pairs.size() === 0, 3000, 'A closed its box');
    B.flow.enter(code);
    await until(() => B.rec('B' + made.box)?.step === 'failed', 8000, 'B told');
    assert.equal(B.rec('B' + made.box)!.why, 'none');
    A.stop(); B.stop();
  }

  // ---- 7. the mailbox number is taken by someone else: another code is made
  {
    const A = new Phone('Anna'), X = new Phone('Xia');
    const fixed = () => { let n = 0; return (k: number) => (n++ < 3 ? new Uint8Array(k).fill(1) : nacl.randomBytes(k)); };
    A.rand = fixed(); X.rand = fixed();
    A.start(); X.start();
    await until(() => A.online() && X.online(), 5000, 'online');
    const a = A.flow.create()!;
    assert.equal(a.box, '1111');
    await until(() => A.rec(a.key)?.step === 'open', 5000, 'A open');
    const x = X.flow.create()!;
    assert.equal(x.box, '1111');
    await until(() => X.saved.some(r => r.step === 'open'), 8000, 'X open on another number');
    assert.equal(X.saved.length, 1);
    assert.notEqual(X.saved[0].box, '1111', 'a new number');
    assert.equal(srv.pairs.size(), 2);
    A.stop(); X.stop();
  }

  // ---- 8. things the person can do wrong
  {
    const A = new Phone('Anna').start();
    await until(() => A.online(), 5000, 'online');
    assert.deepEqual(A.flow.enter('12345'), { ok: false, why: 'invalid' });
    assert.deepEqual(A.flow.enter('1234-56789-1'), { ok: false, why: 'invalid' }, 'wrong check digit');
    const made = A.flow.create()!;
    await until(() => A.rec(made.key)?.step === 'open', 5000, 'open');
    assert.deepEqual(A.flow.enter(A.rec(made.key)!.digits!), { ok: false, why: 'own' }, 'your own code');
    for (let i = 1; i < MAX_ACTIVE; i++) assert.ok(A.flow.create());
    assert.equal(A.flow.create(), null, 'no more than three open codes');
    await until(() => A.saved.filter(r => r.step === 'open').length === MAX_ACTIVE, 5000, 'all three open');
    const before = srv.pairs.size();
    A.flow.cancel(made.key);
    await until(() => srv.pairs.size() === before - 1, 3000, 'cancelled: the mailbox is gone');
    assert.equal(A.rec(made.key), undefined);
    assert.ok(A.flow.create(), 'room for another');
    A.stop();
    for (const r of A.saved) A.flow.cancel(r.key);
  }

  // ---- what the server's answers do to a record, one at a time (some of them are rare in real life)
  {
    const t = Date.now();
    const mk = (role: 'A' | 'B', step: PairRec['step'], extra: Partial<PairRec> = {}): PairRec => ({ key: role + '1111', role, box: '1111', step, created: t, exp: t + PAIR_TTL_MS, ...extra });
    const run = (rec: PairRec, m: any) => {
      let saved: PairRec[] = [rec]; const sent: any[] = [];
      const f = new PairFlow({ send: o => (sent.push(o), true), myCard: () => '', addContact: () => null, load: () => saved, save: l => { saved = l; } });
      f.onMessage(m);
      return { r: saved[0], sent };
    };
    const msg = (st: string, extra: object = {}) => ({ type: 'pair', box: '1111', st, ...extra });
    let x = run(mk('A', 'reply', { out: 'x', name: 'Bo', contactId: 'id' }), msg('none'));
    assert.equal(x.r.step, 'done', 'A\'s answer was sent and the box is gone: B has taken it'); assert.equal(x.r.name, 'Bo');
    x = run(mk('A', 'reply', { out: 'x', name: 'Bo', contactId: 'id' }), msg('ended')); assert.equal(x.r.step, 'done');
    x = run(mk('A', 'reply', { out: 'x', name: 'Bo', contactId: 'id' }), msg('replied')); assert.equal(x.r.step, 'done');
    x = run(mk('A', 'open', { Y: 'y' }), msg('ended')); assert.equal(x.r.step, 'open', 'A\'s code lives on when nobody has answered');
    x = run(mk('A', 'open', { Y: 'y' }), msg('busy')); assert.deepEqual([x.r.step, x.r.why], ['failed', 'lost'], 'someone else took the number while the server was away');
    x = run(mk('A', 'opening', { Y: 'y' }), msg('limit')); assert.deepEqual([x.r.step, x.r.why], ['failed', 'limit']);
    x = run(mk('A', 'open', { Y: 'y' }), msg('limit')); assert.equal(x.r.step, 'open', 'a busy server does not cancel a code that is already open');
    x = run(mk('B', 'sent', { y: 'y', Y: 'y', theirY: 'y' }), msg('none')); assert.deepEqual([x.r.step, x.r.why], ['failed', 'gone']);
    x = run(mk('B', 'claiming', { digits: '1' }), msg('ended')); assert.deepEqual([x.r.step, x.r.why], ['failed', 'none']);
    x = run(mk('B', 'claiming', { digits: '1' }), msg('used')); assert.deepEqual([x.r.step, x.r.why], ['failed', 'used']);
    x = run(mk('B', 'claiming', { digits: '1' }), msg('limit')); assert.deepEqual([x.r.step, x.r.why], ['failed', 'limit']);
    x = run(mk('B', 'claiming', { digits: '1' }), msg('wait')); assert.equal(x.r.step, 'claiming', 'wait changes nothing');
    x = run(mk('B', 'claiming', { digits: 'junk' }), msg('offer', { Y: 'AAAA' })); assert.deepEqual([x.r.step, x.r.why], ['failed', 'bad'], 'a broken code on our side or a broken value from theirs: no crash');
    x = run(mk('A', 'open', { y: 'AAAA', Y: 'AAAA' }), msg('join', { Y: 'AAAA', sealed: 'AAAA' })); assert.deepEqual([x.r.step, x.r.why], ['failed', 'bad']);
    assert.ok(x.sent.some(o => o.type === 'pair-end'), 'and the box is closed');
    // nonsense does nothing and does not throw
    for (const m of [null, undefined, 5, 'x', {}, { type: 'relay' }, { type: 'pair' }, { type: 'pair', box: 5, st: 'ended' }, { type: 'pair', box: '1111' }, { type: 'pair', box: '9999', st: 'ended' }, msg('what')]) {
      const y = run(mk('B', 'claiming', { digits: '1' }), m); assert.equal(y.r.step, 'claiming');
    }
    // records from storage that are damaged are left out
    const f = new PairFlow({ send: () => true, myCard: () => '', addContact: () => null, load: () => [null, 5, {}, mk('A', 'open')] as any, save: () => {} });
    assert.equal(f.records().length, 1);
  }

  await srv.close();
  console.log('pairflow.test.ts OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
