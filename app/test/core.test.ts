import assert from 'node:assert/strict';
import { newIdentity, encodeCard, decodeCard, cardToContact, safetyCode, seal, open, signText, verifyText } from '../src/core/crypto';
import { isInitiator } from '../src/core/protocol';

const a = newIdentity(), b = newIdentity(), eve = newIdentity();

// Card: round trip and rejection of garbage
const code = encodeCard(a, 'Anna');
assert.ok(code.startsWith('direct1:'));
const card = decodeCard('Min kod: ' + code + ' hej');
assert.equal(card?.n, 'Anna');
assert.equal(card?.b, a.boxPublic);
assert.equal(decodeCard('direct1:xxxx'), null);
assert.equal(decodeCard('hej'), null);
const c = cardToContact(card!);
assert.equal(c.id.length, 16);

// Encryption: the right recipient can open, others cannot, tampering is detected
const env = seal({ t: 'msg', id: '1', text: 'Hej åäö 😀', at: 1 }, a.boxSecret, b.boxPublic);
assert.deepEqual(open(env, a.boxPublic, b.boxSecret), { t: 'msg', id: '1', text: 'Hej åäö 😀', at: 1 });
assert.equal(open(env, a.boxPublic, eve.boxSecret), null);
assert.equal(open(env, eve.boxPublic, b.boxSecret), null); // wrong sender
const bad = { ...env, c: env.c.slice(0, -4) + 'AAAA' };
assert.equal(open(bad, a.boxPublic, b.boxSecret), null);
assert.notEqual(seal({ x: 1 }, a.boxSecret, b.boxPublic).n, seal({ x: 1 }, a.boxSecret, b.boxPublic).n); // unik nonce

// Safety code: equal for both, different against a third party
const s1 = safetyCode(a.signPublic, a.boxPublic, b.signPublic, b.boxPublic);
const s2 = safetyCode(b.signPublic, b.boxPublic, a.signPublic, a.boxPublic);
assert.equal(s1, s2);
assert.match(s1, /^(\d{5} ){5}\d{5}$/);
assert.notEqual(s1, safetyCode(a.signPublic, a.boxPublic, eve.signPublic, eve.boxPublic));

// Signatur
const sig = signText('nonce123', a.signSecret);
assert.ok(verifyText('nonce123', sig, a.signPublic));
assert.ok(!verifyText('nonce124', sig, a.signPublic));
assert.ok(!verifyText('nonce123', sig, b.signPublic));

// Initiator: exactly one of two
assert.notEqual(isInitiator(a.signPublic, b.signPublic), isInitiator(b.signPublic, a.signPublic));
console.log('core: all tests OK');

import { cmpVersion } from '../src/core/semver';
assert.ok(cmpVersion('v0.10.0', '0.9.9') > 0);
assert.ok(cmpVersion('0.7.0', 'v0.7.0') === 0);
assert.ok(cmpVersion('0.6.0', '0.7.0') < 0);
assert.ok(cmpVersion('1.0', '0.9.9') > 0);
console.log('semver: OK');
