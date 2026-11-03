// One-time pairing codes: two phones that share a short code add each other without a QR code.
//
// A short code is not a key. Nine digits are about 30 bits, so whoever sees a message encrypted with the code (the signal server
// for one) could try all of them offline in seconds. What is used instead is a password-authenticated key exchange (PAKE): the
// code is only a password in a handshake, and what goes over the wire holds nothing that can be checked against a guess. Whoever
// is not one of the two phones gets exactly one try per code, online, and a wrong try is noticed (the code is then burned).
//
// The handshake is CPace (the CFRG's balanced PAKE) over ristretto255, built from the audited primitives of @noble/curves and
// @noble/hashes. It is our own composition of those primitives, not a packaged protocol library: there is no maintained and
// reviewed PAKE package for JavaScript. It has not been reviewed by a cryptographer. See docs/PAIRING.md.
//
//   Both know the password PRS (the 5 secret digits) and the channel id sid (made from the 4 digits that name the mailbox on the server).
//   g  = map_to_group( H( PRS, sid ) )                     the same generator on both sides, only if the password matches
//   A:  Ya = g^ya          B: Yb = g^yb                    random scalars, never sent
//   K  = Yb^ya = Ya^yb     (rejected when it is the identity)
//   ISK = H( sid, K, Ya, Yb )                              the transcript is part of the key
//   Keys for each direction come from ISK. A box that opens proves that the sender knew the password.
//
// Plain TypeScript, so it can be tested in Node.
import { ristretto255, ristretto255_hasher } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';
import { decodeCard, type Card } from './crypto';

// ---- the code: 4 digits that find the mailbox, 5 that are the secret, 1 check digit that catches typing mistakes
export const BOX_DIGITS = 4;
export const SECRET_DIGITS = 5; // one try per code, so about 1 in 100 000 for someone who has not got the code
export const CODE_DIGITS = BOX_DIGITS + SECRET_DIGITS + 1;

export type Code = { box: string; secret: string; digits: string }; // digits = box + secret + check

// Verhoeff: catches every single wrong digit and every swap of two neighbours. A typo then does not use up the only try.
const D = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]];
const P = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]];
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];
export function checkDigit(digits: string): string {
  let c = 0;
  const r = digits.split('').reverse().map(Number);
  for (let i = 0; i < r.length; i++) c = D[c][P[(i + 1) % 8][r[i]]];
  return String(INV[c]);
}
export function checkOk(digits: string): boolean {
  let c = 0;
  const r = digits.split('').reverse().map(Number);
  for (let i = 0; i < r.length; i++) c = D[c][P[i % 8][r[i]]];
  return c === 0;
}

// Uniform digits: a byte is used only when it is below 250, so that no digit is more likely than another.
function randomDigits(n: number, rand: (k: number) => Uint8Array): string {
  let out = '';
  while (out.length < n) for (const b of rand(n * 2)) { if (b < 250 && out.length < n) out += String(b % 10); }
  return out;
}
export function newCode(rand: (k: number) => Uint8Array = nacl.randomBytes): Code {
  const box = randomDigits(BOX_DIGITS, rand), secret = randomDigits(SECRET_DIGITS, rand);
  return { box, secret, digits: box + secret + checkDigit(box + secret) };
}

// How a code is shown: 4829-17305-6
export const formatCode = (digits: string) => `${digits.slice(0, BOX_DIGITS)}-${digits.slice(BOX_DIGITS, BOX_DIGITS + SECRET_DIGITS)}-${digits.slice(BOX_DIGITS + SECRET_DIGITS)}`;

// A code being typed, shaped as it goes: digits only, at most one whole code, with the dashes put in (4829-17305-6).
export function formatPartial(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, CODE_DIGITS);
  return [d.slice(0, BOX_DIGITS), d.slice(BOX_DIGITS, BOX_DIGITS + SECRET_DIGITS), d.slice(BOX_DIGITS + SECRET_DIGITS)].filter(Boolean).join('-');
}

// What a person types, with spaces or dashes or without: the code, or null when it is not a whole code or the check digit is wrong.
export function parseCode(text: string): Code | null {
  const d = text.replace(/[\s\-–—.·]/g, '');
  if (!/^\d+$/.test(d) || d.length !== CODE_DIGITS || !checkOk(d)) return null;
  return { box: d.slice(0, BOX_DIGITS), secret: d.slice(BOX_DIGITS, BOX_DIGITS + SECRET_DIGITS), digits: d };
}
// How far a half-typed code has got, for the screen: 'short' (still typing), 'bad' (all digits but a mistake in them), 'ok'.
export function codeState(text: string): 'short' | 'bad' | 'ok' {
  const d = text.replace(/\D/g, '');
  if (d.length < CODE_DIGITS) return 'short';
  return parseCode(d) ? 'ok' : 'bad';
}

// ---- the handshake
const DSI = 'direct.pair.v1';
const utf8 = (s: string) => decodeUTF8(s);
const be32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
// Length-prefixed concatenation, so that no two different lists of parts give the same bytes.
function lv(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + 4 + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(be32(p.length), o); o += 4; out.set(p, o); o += p.length; }
  return out;
}
export const sidOf = (box: string) => `${DSI}/${box}`;
const Pt = ristretto255.Point, Fn = Pt.Fn;

function generator(prs: string, sid: string) {
  return ristretto255_hasher.deriveToCurve!(sha512(lv(utf8(DSI + '/generator'), utf8(prs), utf8(sid))));
}
function randomScalar(rand: (k: number) => Uint8Array): bigint {
  for (;;) {
    const b = rand(64);
    let n = 0n;
    for (const x of b) n = (n << 8n) | BigInt(x);
    const s = Fn.create(n); // reduced modulo the group order: 512 random bits make the bias negligible
    if (s !== 0n) return s;
  }
}
const scalarToBytes = (s: bigint) => { const o = new Uint8Array(32); let n = s; for (let i = 31; i >= 0; i--) { o[i] = Number(n & 255n); n >>= 8n; } return o; };
const bytesToScalar = (b: Uint8Array) => { let n = 0n; for (const x of b) n = (n << 8n) | BigInt(x); return n; };

// The secret scalar y is kept (base64) until the other phone has answered, and the public value Y goes over the wire.
export type PakeStart = { y: string; Y: string };
export function pakeStart(prs: string, sid: string, rand: (k: number) => Uint8Array = nacl.randomBytes): PakeStart {
  const y = randomScalar(rand);
  return { y: encodeBase64(scalarToBytes(y)), Y: encodeBase64(generator(prs, sid).multiply(y).toBytes()) };
}

export type PairKeys = { ab: Uint8Array; ba: Uint8Array }; // direction keys: A→B and B→A, A being the one that made the code

// The keys, or null when the other phone's value is not a proper group element (junk, or the identity), which a real phone never sends.
export function pakeFinish(sid: string, y: string, mine: string, theirs: string, iAmA: boolean): PairKeys | null {
  try {
    const yb = decodeBase64(y), mb = decodeBase64(mine), tb = decodeBase64(theirs);
    if (yb.length !== 32 || mb.length !== 32 || tb.length !== 32) return null;
    const T = Pt.fromBytes(tb);                       // throws on anything that is not a canonical ristretto255 element
    if (T.is0()) return null;                         // the identity would make K the same for every password
    if (encodeBase64(tb) === encodeBase64(mb)) return null; // our own value sent back
    const s = bytesToScalar(yb);
    if (s === 0n || s >= Fn.ORDER) return null;
    const K = T.multiply(s);
    if (K.is0()) return null;
    const [Ya, Yb] = iAmA ? [mb, tb] : [tb, mb];
    const isk = sha512(lv(utf8(DSI + '/isk'), utf8(sid), K.toBytes(), Ya, Yb)).slice(0, 32);
    const salt = utf8(sid);
    return { ab: hkdf(sha256, isk, salt, utf8(DSI + '/A->B'), 32), ba: hkdf(sha256, isk, salt, utf8(DSI + '/B->A'), 32) };
  } catch { return null; }
}

// ---- what travels inside: a contact card, sealed with a direction key. A box that opens proves the sender knew the password.
export function sealCard(key: Uint8Array, card: string): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const ct = nacl.secretbox(utf8(JSON.stringify({ v: 1, card })), nonce, key);
  const out = new Uint8Array(nonce.length + ct.length);
  out.set(nonce); out.set(ct, nonce.length);
  return encodeBase64(out);
}
export function openCard(key: Uint8Array, boxed: string): Card | null {
  try {
    const raw = decodeBase64(boxed);
    if (raw.length < nacl.secretbox.nonceLength + nacl.secretbox.overheadLength) return null;
    const plain = nacl.secretbox.open(raw.slice(nacl.secretbox.nonceLength), raw.slice(0, nacl.secretbox.nonceLength), key);
    if (!plain) return null;
    const j = JSON.parse(encodeUTF8(plain));
    return j?.v === 1 && typeof j.card === 'string' ? decodeCard(j.card) : null;
  } catch { return null; }
}
