import assert from 'node:assert/strict';
import { newIdentity, encodeCard } from '../src/core/crypto';
import { APK_URL, cardFromUrl, deepLink, inviteLink, inviteMessage } from '../src/core/invite';
import { dict } from '../src/i18n';

const card = encodeCard(newIdentity(), 'Anna');
assert.equal(cardFromUrl(deepLink(card)), card);
assert.equal(cardFromUrl(inviteLink(card)), card);
assert.equal(cardFromUrl(`hello ${card} bye`), card);
assert.equal(cardFromUrl('direct://add?c=direct1:garbage'), null);
assert.equal(cardFromUrl('https://example.com/?c=nothing'), null);
assert.equal(cardFromUrl(''), null);
assert.ok(!inviteLink(card).split('#')[0].includes('direct1:'), 'the card is only in the fragment');

// The SMS, in both languages: who invites, what Direct is, the fixed APK link, the install note, the invite link.
for (const lang of ['sv', 'en'] as const) {
  const t = dict[lang];
  const sms = inviteMessage(card, t, 'Claes');
  assert.equal(cardFromUrl(sms), card, `${lang}: the whole SMS parses back to the card`);
  assert.ok(sms.startsWith('Claes '), `${lang}: starts with who invites`);
  assert.ok(sms.includes(APK_URL), `${lang}: has the link to the newest APK`);
  assert.ok(sms.includes(t.inviteAllow), `${lang}: explains the third-party install`);
  assert.ok(sms.includes(inviteLink(card)), `${lang}: has the invite link`);
  assert.ok(!/\{name\}/.test(sms), `${lang}: placeholder replaced`);
  assert.ok(inviteMessage(card, t, '').startsWith(t.inviteSomeone), `${lang}: falls back when the name is empty`);
  assert.ok(inviteMessage(card, t, 'A$&B\n').includes('A$&B'), `${lang}: odd names are inserted literally`);
  console.log(`  ${lang}: SMS is ${sms.length} characters`);
}
assert.equal(APK_URL, 'https://github.com/menola8803/Direct/releases/latest/download/Direct.apk');
console.log('invite: all tests OK');
