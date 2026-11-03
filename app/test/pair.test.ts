// One-time pairing codes: the code itself and the handshake (core/pair.ts).
import assert from 'node:assert/strict';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import { ristretto255 } from '@noble/curves/ed25519.js';
import { newIdentity, encodeCard } from '../src/core/crypto';
import { CODE_DIGITS, checkDigit, checkOk, codeState, formatCode, newCode, openCard, pakeFinish, pakeStart, parseCode, sealCard, sidOf } from '../src/core/pair';

// ---- the check digit (Verhoeff). Known value from the literature: 236 → 3.
assert.equal(checkDigit('236'), '3');
assert.ok(checkOk('2363'));
assert.ok(!checkOk('2364'));
// Every single wrong digit and every swap of two different neighbours is caught, in every position of a real code.
for (let n = 0; n < 300; n++) {
  const c = newCode().digits;
  assert.ok(checkOk(c), 'a made code passes its own check');
  for (let i = 0; i < c.length; i++) for (let d = 0; d < 10; d++) {
    if (String(d) === c[i]) continue;
    assert.ok(!checkOk(c.slice(0, i) + d + c.slice(i + 1)), `one wrong digit at ${i} is caught`);
  }
  for (let i = 0; i + 1 < c.length; i++) {
    if (c[i] === c[i + 1]) continue;
    assert.ok(!checkOk(c.slice(0, i) + c[i + 1] + c[i] + c.slice(i + 2)), `swapped neighbours at ${i} are caught`);
  }
}

// ---- making and reading codes
const code = newCode();
assert.equal(code.digits.length, CODE_DIGITS);
assert.equal(code.box.length, 4);
assert.equal(code.secret.length, 5);
assert.equal(code.digits, code.box + code.secret + code.digits.slice(9));
assert.match(formatCode(code.digits), /^\d{4}-\d{5}-\d$/);
assert.deepEqual(parseCode(formatCode(code.digits)), code, 'the shown form reads back');
assert.deepEqual(parseCode(code.digits), code, 'without dashes');
assert.deepEqual(parseCode(` ${code.digits.slice(0, 4)} ${code.digits.slice(4, 9)}  ${code.digits.slice(9)}\n`), code, 'with spaces');
assert.deepEqual(parseCode(formatCode(code.digits).replace(/-/g, '–')), code, 'with en dashes (what a phone keyboard may make)');
assert.equal(parseCode(code.digits.slice(0, 9)), null, 'too short');
assert.equal(parseCode(code.digits + '1'), null, 'too long');
assert.equal(parseCode('abcd-efghi-j'), null, 'not digits');
assert.equal(parseCode(''), null);
const bad = code.digits.slice(0, 4) + String((Number(code.digits[4]) + 1) % 10) + code.digits.slice(5);
assert.equal(parseCode(bad), null, 'one wrong digit');
assert.equal(codeState(code.digits.slice(0, 5)), 'short');
assert.equal(codeState(''), 'short');
assert.equal(codeState(bad), 'bad');
assert.equal(codeState(formatCode(code.digits)), 'ok');

// Digits come out evenly (a byte ≥ 250 is skipped, so 0–9 are equally likely) and codes are not repeated.
{
  const seen = new Set<string>(), count = new Array(10).fill(0);
  for (let i = 0; i < 4000; i++) { const c = newCode(); seen.add(c.digits); for (const ch of c.secret) count[Number(ch)]++; }
  assert.ok(seen.size > 3900, `codes differ (${seen.size} of 4000)`);
  const total = count.reduce((a, b) => a + b, 0);
  for (let d = 0; d < 10; d++) assert.ok(Math.abs(count[d] / total - 0.1) < 0.01, `digit ${d} share ${(count[d] / total).toFixed(3)}`);
}
// A weak random source cannot make a digit more likely: bytes 250–255 are never used.
{
  let calls = 0;
  const rigged = (k: number) => { calls++; return new Uint8Array(k).fill(calls % 2 ? 255 : 7); };
  assert.match(newCode(rigged).secret, /^77777$/, 'bytes ≥ 250 skipped');
}

// ---- the handshake
const BOX = '4829', SID = sidOf(BOX);
function run(prsA: string, prsB: string, sidA = SID, sidB = SID) {
  const a = pakeStart(prsA, sidA), b = pakeStart(prsB, sidB);
  return { a, b, ka: pakeFinish(sidA, a.y, a.Y, b.Y, true), kb: pakeFinish(sidB, b.y, b.Y, a.Y, false) };
}
{
  const r = run('17305', '17305');
  assert.ok(r.ka && r.kb);
  assert.deepEqual(r.ka!.ab, r.kb!.ab, 'same password: the same A→B key');
  assert.deepEqual(r.ka!.ba, r.kb!.ba, 'and the same B→A key');
  assert.notDeepEqual(r.ka!.ab, r.ka!.ba, 'the two directions have different keys');
  assert.equal(r.ka!.ab.length, 32);
  // another run gives other keys: nothing is fixed by the password alone
  const r2 = run('17305', '17305');
  assert.notDeepEqual(r.ka!.ab, r2.ka!.ab, 'new run, new keys');
  assert.notEqual(r.a.Y, r2.a.Y, 'new public value each time');
}
{
  const r = run('17305', '17306');
  assert.ok(r.ka && r.kb, 'a wrong password still gives keys (that is how a PAKE works) ...');
  assert.notDeepEqual(r.ka!.ab, r.kb!.ab, '... but not the same ones');
  assert.notDeepEqual(r.ka!.ba, r.kb!.ba);
  const card = encodeCard(newIdentity(), 'Anna');
  assert.equal(openCard(r.kb!.ab, sealCard(r.ka!.ab, card)), null, '... so a card sealed with one cannot be opened with the other');
}
{
  const r = run('17305', '17305', SID, sidOf('4830'));
  assert.notDeepEqual(r.ka!.ab, r.kb!.ab, 'a different mailbox id means different keys');
}
{
  // The wire holds only Y. A third party who sees both values and guesses the password cannot check the guess:
  // for every guess the values are valid group elements and nothing in them tells which guess is right.
  const r = run('17305', '17305');
  for (const guess of ['00000', '17305', '99999']) {
    const g = pakeStart(guess, SID); // a guesser's own value says nothing about ours
    assert.notEqual(g.Y, r.a.Y);
  }
}
{
  // The roles matter for the order inside the key derivation: both sides must agree who is A.
  const a = pakeStart('17305', SID), b = pakeStart('17305', SID);
  const wrong = pakeFinish(SID, b.y, b.Y, a.Y, true); // B pretends to be A
  const right = pakeFinish(SID, a.y, a.Y, b.Y, true);
  assert.notDeepEqual(wrong!.ab, right!.ab);
}

// ---- a fixed vector: with fixed random bytes the values and keys are always these. This is a regression check, not an independent
// test vector (no published CPace vector exists for this exact composition): it makes sure that two versions of the app derive
// the same keys, so a pairing between phones on different versions keeps working, and that nobody changes the derivation by accident.
{
  const det = (seed: number) => (k: number) => { const o = new Uint8Array(k); for (let i = 0; i < k; i++) o[i] = (seed * 31 + i * 7 + (i >> 3)) & 255; return o; };
  const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');
  const sid = sidOf('4829');
  const a = pakeStart('17305', sid, det(1)), b = pakeStart('17305', sid, det(2));
  assert.equal(a.Y, 'YHO+sL8l8fbKartvDUf0YBFC28Dx1Ug1kZChy0XOFx8=');
  assert.equal(b.Y, 'pEgDCVD7Hdob8T6AGMhX/ttQgeZkcMiodMew4mT3FSE=');
  const ka = pakeFinish(sid, a.y, a.Y, b.Y, true)!, kb = pakeFinish(sid, b.y, b.Y, a.Y, false)!;
  assert.equal(hex(ka.ab), '978cdaa22f31b4d3f072ae41fbb1385bdb4495c296dd9fdb7f84777c0e52a445');
  assert.equal(hex(ka.ba), '9f3d388216d7b4300efb8f2e22fee29f75b1092ffdb677a92cc0eae528ac43ee');
  assert.equal(hex(kb.ab), hex(ka.ab));
  assert.equal(hex(kb.ba), hex(ka.ba));
}

// ---- junk and the dangerous values are refused
{
  const a = pakeStart('17305', SID);
  const id = encodeBase64(ristretto255.Point.ZERO.toBytes());
  assert.equal(pakeFinish(SID, a.y, a.Y, id, true), null, 'the identity element');
  assert.equal(pakeFinish(SID, a.y, a.Y, encodeBase64(new Uint8Array(32)), true), null, 'all zero bytes');
  assert.equal(pakeFinish(SID, a.y, a.Y, encodeBase64(new Uint8Array(32).fill(255)), true), null, 'not a group element');
  assert.equal(pakeFinish(SID, a.y, a.Y, encodeBase64(nacl.randomBytes(31)), true), null, 'wrong length');
  assert.equal(pakeFinish(SID, a.y, a.Y, '', true), null, 'empty');
  assert.equal(pakeFinish(SID, a.y, a.Y, '!!!not base64', true), null, 'not base64');
  assert.equal(pakeFinish(SID, a.y, a.Y, a.Y, true), null, 'our own value reflected back');
  assert.equal(pakeFinish(SID, encodeBase64(new Uint8Array(32)), a.Y, pakeStart('1', SID).Y, true), null, 'a zero secret');
  assert.equal(pakeFinish(SID, 'AAAA', a.Y, pakeStart('1', SID).Y, true), null, 'a secret of the wrong length');
  // Random 32-byte strings: about 1 in 16 happens to be a valid ristretto255 element, the rest are refused, and none may throw.
  let ok = 0;
  for (let i = 0; i < 200; i++) { const k = pakeFinish(SID, a.y, a.Y, encodeBase64(nacl.randomBytes(32)), true); if (k) ok++; }
  assert.ok(ok < 40, `most random bytes are refused (${ok} of 200 accepted)`);
}

// ---- the sealed card
{
  const r = run('17305', '17305');
  const id = newIdentity();
  const card = encodeCard(id, 'Anna');
  const boxed = sealCard(r.ka!.ab, card);
  const got = openCard(r.kb!.ab, boxed);
  assert.ok(got, 'opens with the same key');
  assert.equal(got!.n, 'Anna');
  assert.equal(got!.s, id.signPublic);
  assert.equal(openCard(r.kb!.ba, boxed), null, 'not with the other direction');
  assert.equal(openCard(nacl.randomBytes(32), boxed), null, 'not with a random key');
  assert.notEqual(sealCard(r.ka!.ab, card), boxed, 'a fresh nonce each time');
  const bytes = Buffer.from(boxed, 'base64');
  bytes[bytes.length - 1] ^= 1;
  assert.equal(openCard(r.kb!.ab, bytes.toString('base64')), null, 'a changed byte is noticed');
  assert.equal(openCard(r.kb!.ab, ''), null);
  assert.equal(openCard(r.kb!.ab, 'AAAA'), null);
  assert.equal(openCard(r.kb!.ab, '%%%'), null);
  // what is inside must be a real card: a box with some other text in it is not accepted
  const other = sealCard(r.ka!.ab, 'hello');
  assert.equal(openCard(r.kb!.ab, other), null, 'not a card');
}

console.log('pair.test.ts OK');
