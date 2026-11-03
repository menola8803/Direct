// Pairing with a one-time code, as seen from one phone: what to send to the signal server and what to do with what comes back.
// Plain TypeScript with everything it touches handed in (the connection, the clock, the contact list, storage), so two phones
// and a real server can be run against each other in Node (test/pairflow.test.ts). The cryptography is in pair.ts, the
// mailboxes on the server in server/pair.js.
//
// A = the phone that makes the code. B = the phone that types it. Both may be offline for a while:
//   A  create()   opening → open        waits in the server's mailbox for B (up to 24 hours)
//   B  enter()    claiming → joining → sent
//   A  gets B's value and sealed card; opens it with the shared key; adds B; sends its own card back   open → reply → done
//   B  gets A's card; opens it; adds A                                                               sent → done
// A record lives in the phone's saved state until it is done, has failed or has run out, so a phone that is closed or loses
// its connection picks up where it was (sync() is called whenever the connection is back and now and then while a screen is open).
import { Card } from './crypto';
import { Code, newCode, openCard, pakeFinish, pakeStart, parseCode, sealCard, sidOf } from './pair';

export const PAIR_TTL_MS = 24 * 3600_000;
export const MAX_ACTIVE = 3;          // codes a phone keeps open (made or entered) at the same time
export const KEEP_ENDED_MS = 24 * 3600_000; // how long a finished or failed record stays to be seen, if nobody dismisses it
const TRIES = 6;                      // numbers tried when a mailbox number turns out to be taken

export type PairStep = 'opening' | 'open' | 'reply' | 'claiming' | 'joining' | 'sent' | 'done' | 'failed';
// why a code did not work out: no such code | in use or burnt | the other did not answer in time | wrong code (found out by A) |
// garbage from the other side | the server lost it | too many tries | this phone's own code
export type PairWhy = 'none' | 'used' | 'expired' | 'wrong' | 'bad' | 'lost' | 'limit' | 'gone';
export type PairRec = {
  key: string; role: 'A' | 'B'; box: string; step: PairStep;
  created: number; exp: number;     // exp: when the code stops working. For a finished record: when it is removed
  digits?: string;                  // the whole code. A: shown while waiting. B: kept until the server has the answer
  y?: string; Y?: string; theirY?: string;
  out?: string;                     // what is waiting to be sent: A's sealed reply, B's sealed card
  tries?: number;
  why?: PairWhy;                    // failed
  name?: string; contactId?: string; // done: who was added
};
export type PairDeps = {
  send: (o: object) => boolean;     // false when there is no connection to the server
  now?: () => number;
  rand?: (k: number) => Uint8Array;
  myCard: () => string;             // this phone's contact card
  addContact: (c: Card) => { id: string; name: string } | null; // null: not a usable card (or our own)
  load: () => PairRec[];
  save: (list: PairRec[]) => void;
};

const active = (r: PairRec) => r.step !== 'done' && r.step !== 'failed';
const keyOf = (role: 'A' | 'B', box: string) => role + box;

export class PairFlow {
  private list: PairRec[];
  private now: () => number;
  constructor(private d: PairDeps) {
    this.now = d.now ?? Date.now;
    this.list = d.load().filter(r => r && typeof r.key === 'string');
    this.clean();
  }

  records(): PairRec[] { return this.list.slice(); }
  find(key: string) { return this.list.find(r => r.key === key); }

  // ---- A: make a code
  create(): PairRec | null {
    if (this.list.filter(r => active(r) && r.role === 'A').length >= MAX_ACTIVE) return null;
    return this.fresh(1);
  }
  private fresh(tries: number, replace?: string): PairRec | null {
    let code: Code, key = '';
    for (let i = 0; i < 20; i++) { code = newCode(this.d.rand); key = keyOf('A', code.box); if (!this.find(key)) break; key = ''; }
    if (!key) return null;
    const p = pakeStart(code!.secret, sidOf(code!.box), this.d.rand);
    const t = this.now();
    const rec: PairRec = { key, role: 'A', box: code!.box, step: 'opening', created: t, exp: t + PAIR_TTL_MS, digits: code!.digits, y: p.y, Y: p.Y, tries };
    this.list = this.list.filter(r => r.key !== replace).concat(rec);
    this.changed();
    this.sendFor(rec);
    return rec;
  }

  // ---- B: type a code
  enter(text: string): { ok: true; rec: PairRec } | { ok: false; why: 'invalid' | 'own' | 'many' } {
    const code = parseCode(text);
    if (!code) return { ok: false, why: 'invalid' };
    this.clean();
    if (this.list.some(r => r.role === 'A' && r.box === code.box && active(r))) return { ok: false, why: 'own' };
    const same = this.find(keyOf('B', code.box));
    if (same && active(same)) return { ok: true, rec: same };
    if (this.list.filter(r => active(r) && r.role === 'B').length >= MAX_ACTIVE) return { ok: false, why: 'many' };
    const t = this.now();
    const rec: PairRec = { key: keyOf('B', code.box), role: 'B', box: code.box, step: 'claiming', created: t, exp: t + PAIR_TTL_MS, digits: code.digits };
    this.list = this.list.filter(r => r.key !== rec.key).concat(rec);
    this.changed();
    this.sendFor(rec);
    return { ok: true, rec };
  }

  cancel(key: string) {
    const r = this.find(key);
    if (!r) return;
    if (active(r)) this.d.send({ type: 'pair-end', box: r.box });
    this.list = this.list.filter(x => x.key !== key);
    this.changed();
  }
  dismiss(key: string) { const r = this.find(key); if (r && !active(r)) { this.list = this.list.filter(x => x.key !== key); this.changed(); } }

  // ---- the connection is back, or a screen asks again: say again whatever is waiting for an answer (all of it is safe to repeat)
  sync() {
    this.clean();
    for (const r of this.list) if (active(r)) this.sendFor(r);
  }
  private sendFor(r: PairRec) {
    const box = r.box;
    switch (r.step) {
      case 'opening': case 'open': this.d.send({ type: 'pair-open', box, Y: r.Y, ttl: Math.max(1, Math.floor((r.exp - this.now()) / 1000)) }); break;
      case 'reply': this.d.send({ type: 'pair-reply', box, sealed: r.out }); break;
      case 'claiming': this.d.send({ type: 'pair-claim', box }); break;
      case 'joining': this.d.send({ type: 'pair-join', box, Y: r.Y, sealed: r.out }); break;
      case 'sent': this.d.send({ type: 'pair-poll', box }); break;
    }
  }

  // ---- what the server says
  onMessage(m: any) {
    if (!m || m.type !== 'pair' || typeof m.box !== 'string' || typeof m.st !== 'string') return;
    this.clean();
    const A = this.find(keyOf('A', m.box)), B = this.find(keyOf('B', m.box));
    const a = A && active(A) ? A : undefined, b = B && active(B) ? B : undefined;
    switch (m.st) {
      case 'opened': if (a?.step === 'opening') this.set(a, { step: 'open' }); break;
      case 'busy':
        if (a?.step === 'opening' && (a.tries ?? 1) < TRIES) this.fresh((a.tries ?? 1) + 1, a.key); // that number is taken: another code
        else if (a) this.fail(a, a.step === 'opening' ? 'limit' : 'lost');
        break;
      case 'limit': { const x = a?.step === 'opening' ? a : b?.step === 'claiming' ? b : undefined; if (x) this.fail(x, 'limit'); break; }
      case 'none':
        if (a?.step === 'reply') this.finish(a, a.name, a.contactId); // B has fetched the answer and closed the box
        if (b) this.fail(b, b.step === 'sent' || b.step === 'joining' ? 'gone' : 'none');
        break;
      case 'used':
        if (b) this.fail(b, b.step === 'claiming' ? 'used' : 'gone');
        else if (a?.step === 'open') this.fail(a, 'lost');
        break;
      case 'bad': { const x = a ?? b; if (x) this.fail(x, 'bad'); break; }
      case 'offer': if (b?.step === 'claiming' && typeof m.Y === 'string') this.offer(b, m.Y); break;
      case 'joined': if (b?.step === 'joining') this.set(b, { step: 'sent', digits: undefined, out: undefined }); break;
      case 'join': if ((a?.step === 'open' || a?.step === 'opening') && typeof m.Y === 'string' && typeof m.sealed === 'string') this.join(a, m.Y, m.sealed); break;
      case 'replied': if (a?.step === 'reply') this.finish(a, a.name, a.contactId); break;
      case 'ended': // the other phone closed the box
        if (a?.step === 'reply') this.finish(a, a.name, a.contactId);   // B has taken the answer
        else if (b) this.fail(b, b.step === 'claiming' ? 'none' : 'gone'); // A found the code wrong, or gave up
        break;
      case 'reply': if ((b?.step === 'sent' || b?.step === 'joining') && typeof m.sealed === 'string') this.reply(b, m.sealed); break;
      default: break; // 'wait'
    }
  }

  // B: A's value has come. Make our own, derive the keys, seal our card and send it.
  private offer(r: PairRec, theirY: string) {
    const code = r.digits && parseCode(r.digits);
    if (!code) return this.fail(r, 'bad');
    const sid = sidOf(r.box), p = pakeStart(code.secret, sid, this.d.rand);
    const keys = pakeFinish(sid, p.y, p.Y, theirY, false);
    if (!keys) { this.d.send({ type: 'pair-end', box: r.box }); return this.fail(r, 'bad'); }
    this.set(r, { step: 'joining', y: p.y, Y: p.Y, theirY, out: sealCard(keys.ba, this.d.myCard()) });
    this.sendFor(this.find(r.key)!);
  }

  // A: B's value and card have come. A box that opens means B knew the code; if not, the code is burnt.
  private join(r: PairRec, theirY: string, sealed: string) {
    const keys = r.y && r.Y ? pakeFinish(sidOf(r.box), r.y, r.Y, theirY, true) : null;
    if (!keys) { this.d.send({ type: 'pair-end', box: r.box }); return this.fail(r, 'bad'); }
    const card = openCard(keys.ba, sealed);
    if (!card) { this.d.send({ type: 'pair-end', box: r.box }); return this.fail(r, 'wrong'); }
    const c = this.d.addContact(card);
    if (!c) { this.d.send({ type: 'pair-end', box: r.box }); return this.fail(r, 'bad'); }
    this.set(r, { step: 'reply', name: c.name, contactId: c.id, out: sealCard(keys.ab, this.d.myCard()), digits: undefined, y: undefined, Y: undefined });
    this.sendFor(this.find(r.key)!);
  }

  // B: A's card has come.
  private reply(r: PairRec, sealed: string) {
    const keys = r.y && r.Y && r.theirY ? pakeFinish(sidOf(r.box), r.y, r.Y, r.theirY, false) : null;
    const card = keys && openCard(keys.ab, sealed);
    if (!card) { this.d.send({ type: 'pair-end', box: r.box }); return this.fail(r, 'bad'); }
    const c = this.d.addContact(card);
    if (!c) { this.d.send({ type: 'pair-end', box: r.box }); return this.fail(r, 'bad'); }
    this.d.send({ type: 'pair-end', box: r.box });
    this.finish(r, c.name, c.id);
  }

  // ---- bookkeeping
  private set(r: PairRec, p: Partial<PairRec>) { Object.assign(r, p); for (const k of Object.keys(p)) if ((p as any)[k] === undefined) delete (r as any)[k]; this.changed(); }
  private strip(r: PairRec) { delete r.digits; delete r.y; delete r.Y; delete r.theirY; delete r.out; delete r.tries; r.exp = this.now() + KEEP_ENDED_MS; }
  private fail(r: PairRec, why: PairWhy) { this.strip(r); r.step = 'failed'; r.why = why; this.changed(); }
  private finish(r: PairRec, name?: string, contactId?: string) { this.strip(r); r.step = 'done'; r.name = name; r.contactId = contactId; this.changed(); }
  // Codes that have run out fail with 'expired'; finished records that nobody dismissed are removed after a day.
  private clean() {
    const t = this.now();
    let ch = false;
    for (const r of this.list) if (active(r) && r.exp <= t) { this.d.send({ type: 'pair-end', box: r.box }); this.strip(r); r.step = 'failed'; r.why = 'expired'; ch = true; }
    const keep = this.list.filter(r => active(r) || r.exp > t);
    if (keep.length !== this.list.length) { this.list = keep; ch = true; }
    if (ch) this.changed();
  }
  private changed() { this.d.save(this.list.map(r => ({ ...r }))); }
}
