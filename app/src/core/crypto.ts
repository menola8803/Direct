// Plain TypeScript (no React Native) so it can be tested in Node.
import nacl from 'tweetnacl';
import { decodeBase64, encodeBase64, decodeUTF8, encodeUTF8 } from 'tweetnacl-util';

export type Identity = { boxPublic: string; boxSecret: string; signPublic: string; signSecret: string };
export type Card = { v: 1; n: string; b: string; s: string }; // namn, box-nyckel, signeringsnyckel
export type Contact = { id: string; name: string; boxPub: string; signPub: string; addedAt: number; verified?: boolean };
export type Sealed = { n: string; c: string };

const CARD_PREFIX = 'direct1:';

export function newIdentity(): Identity {
  const box = nacl.box.keyPair();
  const sign = nacl.sign.keyPair();
  return {
    boxPublic: encodeBase64(box.publicKey), boxSecret: encodeBase64(box.secretKey),
    signPublic: encodeBase64(sign.publicKey), signSecret: encodeBase64(sign.secretKey),
  };
}

const b64url = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); return t + '='.repeat((4 - (t.length % 4)) % 4); };

export function encodeCard(id: Identity, name: string): string {
  const card: Card = { v: 1, n: name.slice(0, 40), b: id.boxPublic, s: id.signPublic };
  return CARD_PREFIX + b64url(encodeBase64(decodeUTF8(JSON.stringify(card))));
}

export function decodeCard(text: string): Card | null {
  try {
    const t = text.trim();
    const at = t.indexOf(CARD_PREFIX);
    if (at < 0) return null;
    const body = t.slice(at + CARD_PREFIX.length).split(/\s/)[0];
    const c = JSON.parse(encodeUTF8(decodeBase64(unb64url(body)))) as Card;
    if (c.v !== 1 || typeof c.n !== 'string' || decodeBase64(c.b).length !== 32 || decodeBase64(c.s).length !== 32) return null;
    return c;
  } catch { return null; }
}

export function contactId(signPub: string, boxPub: string): string {
  const h = nacl.hash(new Uint8Array([...decodeBase64(signPub), ...decodeBase64(boxPub)]));
  return Array.from(h.slice(0, 8)).map(x => x.toString(16).padStart(2, '0')).join('');
}

export function cardToContact(c: Card, now = Date.now()): Contact {
  return { id: contactId(c.s, c.b), name: c.n, boxPub: c.b, signPub: c.s, addedAt: now };
}

// Safety code: the same for both parties, 6 groups of 5 digits.
export function safetyCode(mySignPub: string, myBoxPub: string, theirSignPub: string, theirBoxPub: string): string {
  const a = mySignPub + myBoxPub, b = theirSignPub + theirBoxPub;
  const [x, y] = a < b ? [a, b] : [b, a];
  const h = nacl.hash(decodeUTF8(x + '|' + y));
  const groups: string[] = [];
  for (let i = 0; i < 6; i++) {
    const n = ((h[i * 3] << 16) | (h[i * 3 + 1] << 8) | h[i * 3 + 2]) % 100000;
    groups.push(String(n).padStart(5, '0'));
  }
  return groups.join(' ');
}

export function seal(plain: unknown, mySecretBox: string, theirBoxPub: string): Sealed {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const msg = decodeUTF8(JSON.stringify(plain));
  const c = nacl.box(msg, nonce, decodeBase64(theirBoxPub), decodeBase64(mySecretBox));
  return { n: encodeBase64(nonce), c: encodeBase64(c) };
}

export function open<T = unknown>(env: Sealed, theirBoxPub: string, mySecretBox: string): T | null {
  try {
    const p = nacl.box.open(decodeBase64(env.c), decodeBase64(env.n), decodeBase64(theirBoxPub), decodeBase64(mySecretBox));
    return p ? (JSON.parse(encodeUTF8(p)) as T) : null;
  } catch { return null; }
}

export function signText(text: string, signSecret: string): string {
  return encodeBase64(nacl.sign.detached(decodeUTF8(text), decodeBase64(signSecret)));
}
export function verifyText(text: string, sig: string, signPub: string): boolean {
  try { return nacl.sign.detached.verify(decodeUTF8(text), decodeBase64(sig), decodeBase64(signPub)); } catch { return false; }
}
