// Sessionskryptering med forward secrecy.
// Varje uppkoppling gör en ny X25519-nyckelväxling med tillfälliga nycklar (autentiserad av de långlivade nycklarna).
// Därefter används en hash-kedja (ratchet): varje meddelande får en egen nyckel som raderas direkt.
// Stulna långtidsnycklar avslöjar alltså inte tidigare sessioner. (Ingen "post-compromise security" – det kräver Double Ratchet.)
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';

export type Frame = { s: 1; i: number; c: string };
const MAX_SKIP = 2000;

const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const tag = (s: string) => decodeUTF8(s);
const nonceOf = (i: number) => { const n = new Uint8Array(24); new DataView(n.buffer).setUint32(16, Math.floor(i / 2 ** 32)); new DataView(n.buffer).setUint32(20, i >>> 0); return n; };

export class Session {
  private sendChain: Uint8Array; private recvChain: Uint8Array;
  private sendI = 0; private recvI = 0;
  private dead = false;

  static newEphemeral() {
    const k = nacl.box.keyPair();
    return { pub: encodeBase64(k.publicKey), secret: k.secretKey };
  }

  constructor(mySecret: Uint8Array, theirPub: string, iAmInitiator: boolean) {
    const shared = nacl.box.before(decodeBase64(theirPub), mySecret);
    const root = nacl.hash(cat(tag('direct-session-v1'), shared));
    const a = root.slice(0, 32), b = root.slice(32, 64);
    this.sendChain = iAmInitiator ? a : b;
    this.recvChain = iAmInitiator ? b : a;
    shared.fill(0); root.fill(0);
  }

  private step(chain: Uint8Array): [Uint8Array, Uint8Array] {
    const key = nacl.hash(cat(chain, tag('m'))).slice(0, 32);
    const next = nacl.hash(cat(chain, tag('c'))).slice(0, 32);
    chain.fill(0);
    return [key, next];
  }

  encrypt(plain: unknown): Frame {
    if (this.dead) throw new Error('session closed');
    const [key, next] = this.step(this.sendChain);
    this.sendChain = next;
    const i = this.sendI++;
    const c = nacl.secretbox(decodeUTF8(JSON.stringify(plain)), nonceOf(i), key);
    key.fill(0);
    return { s: 1, i, c: encodeBase64(c) };
  }

  decrypt<T>(f: Frame): T | null {
    if (this.dead || f.s !== 1 || typeof f.i !== 'number' || f.i < this.recvI || f.i - this.recvI > MAX_SKIP) return null;
    // Spola fram kedjan vid hopp, men bara i en kopia: en falsk ram får inte förstöra läget.
    let chain: Uint8Array = this.recvChain.slice();
    for (let k = this.recvI; k < f.i; k++) { const [key, next] = this.step(chain); key.fill(0); chain = next; }
    const [key, next] = this.step(chain);
    let out: Uint8Array | null = null;
    try { out = nacl.secretbox.open(decodeBase64(f.c), nonceOf(f.i), key); } catch { out = null; }
    key.fill(0);
    if (!out) { next.fill(0); return null; }
    this.recvChain.fill(0);
    this.recvChain = next; this.recvI = f.i + 1;
    try { return JSON.parse(encodeUTF8(out)) as T; } catch { return null; }
  }

  close() { this.dead = true; this.sendChain.fill(0); this.recvChain.fill(0); }
}
